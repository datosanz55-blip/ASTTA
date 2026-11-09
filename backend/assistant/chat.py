"""Чат ASTTA AI: модель отвечает покупателю и сама вызывает инструменты.

Живые данные (цены, наличие, статус заказа) модель не помнит, а каждый раз берёт из базы через
инструменты. Правила и ответы на частые вопросы — из базы знаний (KnowledgeArticle), которую команда
пополняет в админке: исправленный ответ из журнала сразу становится статьёй.
"""

import json
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from django.db.models import Q

from assistant import llm
from assistant.models import AiLog
from assistant.services import facts_text, find_articles
from catalog.models import Product
from pricing.services import PricingContext, PricingError, quote

MAX_ROUNDS = 4  # сколько раз подряд модель может вызвать инструменты, прежде чем ответить
MAX_HISTORY = 12
MAX_MESSAGE = 1500
CATALOG_LIMIT = 8
HANDOFF_TEXT = "Передал вопрос агенту TT Логистики, он ответит в Telegram."

SYSTEM = """Ты ASTTA AI, помощник маркетплейса ASTTA: товары из Китая с доставкой в Россию через TT Логистику.
Отвечай по-русски, коротко и по делу, как живой консультант.

Правила:
- Цены, наличие, размеры и сроки бери ТОЛЬКО из инструментов и фактов ниже. Никогда не придумывай товары и цены.
- Подбор под задачу и бюджет: вызови search_catalog (можно несколько раз с разными словами), выбери подходящее,
  уложись в бюджет и назови итог. Цены уже под ключ: товар, доставка и сбор.
- Правила сервиса (оплата, возврат, доставка, таможня) — search_knowledge. Нет ответа — так и скажи
  и предложи написать агенту, не выдумывай.
- Пустой результат поиска или match="popular" значит, что точных совпадений нет (это не сбой). Скажи честно,
  что именно такого в каталоге нет, назови, что есть похожего или в бюджете, если подходит.
- Прислали ссылку или текст «поделиться» (часто с иероглифами) — сразу вызови inspect_link: назови площадку,
  переведи название, проверь, нет ли товара у нас. Цену с площадки ты не видишь — попроси цену в юанях или скриншот.
- Товара нет в каталоге — предложи прислать ссылку или скриншот с Poizon, Taobao, 1688. Если покупатель
  назвал цену в юанях — посчитай через estimate_link_price.
- Статус заказа — только через order_status.
- Вопросы про жалобы, возврат денег за конкретный заказ, спорные ситуации — передай агенту.

В конце ответа, если советуешь товары из каталога, перечисли их в последней строке так:
ТОВАРЫ: slug1, slug2
Если передаёшь агенту, последней строкой напиши: АГЕНТ

ФАКТЫ:
{facts}"""

TOOLS = [
    {"type": "function", "function": {
        "name": "search_catalog",
        "description": "Найти товары в каталоге ASTTA по словам. Возвращает до 8 товаров с ценой под ключ в рублях.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "что ищем: «кроссовки», «худи оверсайз», «наушники»"},
            "max_price_rub": {"type": "number", "description": "верхняя граница цены за штуку, если есть бюджет"},
            "category": {"type": "string", "description": "код категории, если известен"},
        }, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "get_product",
        "description": "Подробно о товаре: описание, размеры, цвета, вес, оптовые цены.",
        "parameters": {"type": "object", "properties": {"slug": {"type": "string"}}, "required": ["slug"]}}},
    {"type": "function", "function": {
        "name": "search_knowledge",
        "description": "Найти ответ в базе знаний ASTTA: оплата, доставка, возвраты, размеры, таможня и т. п.",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "estimate_link_price",
        "description": "Цена под ключ для товара с площадки (Poizon, Taobao, 1688) по цене в юанях.",
        "parameters": {"type": "object", "properties": {
            "price_cny": {"type": "number"}, "qty": {"type": "integer"}}, "required": ["price_cny"]}}},
    {"type": "function", "function": {
        "name": "inspect_link",
        "description": "Разобрать ссылку или сообщение «поделиться» с Poizon, Taobao, Tmall, 1688, Pinduoduo: "
                       "площадка, "
                       "номер товара, название из сообщения (часто по-китайски — переведи его покупателю), есть ли "
                       "этот товар в нашем каталоге. Цену с площадки инструмент не видит.",
        "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}}},
    {"type": "function", "function": {
        "name": "order_status",
        "description": "Статус заказа покупателя по номеру вида A-000123. Работает, только если покупатель вошёл.",
        "parameters": {"type": "object", "properties": {"number": {"type": "string"}}, "required": ["number"]}}},
]


def _published():
    return (Product.objects.filter(status=Product.Status.PUBLISHED, supplier__is_active=True)
            .select_related("category", "supplier").prefetch_related("tiers"))


def _stems(text):
    return [w[:5] for w in re.findall(r"[a-zа-яё0-9]+", (text or "").lower()) if len(w) >= 3]


def search_catalog(query: str, max_price_rub=None, category: str = "", ctx=None) -> list[dict]:
    stems = _stems(query)[:6]
    qs = _published()
    if category:
        qs = qs.filter(category__slug=category)
    match = "exact"
    if stems:
        cond = Q()
        for st in stems:
            cond |= (Q(title_ru__icontains=st) | Q(description_ru__icontains=st) | Q(category__name_ru__icontains=st)
                     | Q(title_zh__icontains=st))
        if qs.filter(cond).exists():
            qs = qs.filter(cond)
        else:
            # Размытый запрос («что-нибудь в подарок») или такого нет: даём популярное, модель честно скажет.
            match = "popular"
    results = []
    for product in qs.order_by("-sold_count", "id")[:60]:
        try:
            price = quote(product, ctx=ctx).total_rub if ctx else None
        except PricingError:
            price = None
        if max_price_rub and price is not None and price > Decimal(str(max_price_rub)):
            continue
        hay = f"{product.title_ru} {product.description_ru} {product.category.name_ru}".lower()
        score = sum(hay.count(st) for st in stems)
        results.append((score, product, price))
    results.sort(key=lambda r: (-r[0], -r[1].sold_count))
    return [{"slug": p.slug, "title": p.title_ru, "price_rub": int(price) if price is not None else None,
             "category": p.category.name_ru, "supplier": p.supplier.name, "sizes": p.size_list[:12],
             "sale_percent": p.sale_percent, "match": match} for _, p, price in results[:CATALOG_LIMIT]]


def get_product(slug: str, ctx=None) -> dict:
    product = _published().filter(slug=slug).first()
    if product is None:
        return {"error": "товар не найден"}
    try:
        price = int(quote(product, ctx=ctx).total_rub) if ctx else None
    except PricingError:
        price = None
    tiers = sorted(product.tiers.all(), key=lambda t: t.min_qty)
    return {"slug": product.slug, "title": product.title_ru, "description": product.description_ru[:1200],
            "price_rub": price, "sizes": product.size_list, "colors": product.color_list,
            "weight_kg": float(product.weight_kg), "bulky": product.bulky,
            "wholesale": [{"from_qty": t.min_qty, "price_cny": float(t.price_cny)} for t in tiers]}


def search_knowledge(query: str) -> list[dict]:
    return [{"title": a.title, "answer": a.answer[:1500]} for a in find_articles(query, limit=4)]


def estimate_link_price(price_cny, qty=1) -> dict:
    from links.services import estimate

    try:
        price = Decimal(str(price_cny))
        qty = max(1, min(int(qty or 1), 10_000))
    except (InvalidOperation, TypeError, ValueError):
        return {"error": "нужна цена в юанях числом"}
    if price <= 0:
        return {"error": "цена должна быть больше нуля"}
    try:
        result = estimate(price, qty)
    except PricingError as exc:
        return {"error": str(exc)}
    return {"total_rub": int(result.total_rub), "qty": qty, "notes": result.notes}


def inspect_link(text: str, ctx=None) -> dict:
    from links.services import find_in_catalog, resolve_link, share_title

    info = resolve_link(text)
    if not info.url:
        return {"error": "в сообщении нет ссылки"}
    names = {"taobao": "Taobao", "tmall": "Tmall", "1688": "1688", "poizon": "Poizon (Dewu)",
             "pinduoduo": "Pinduoduo", "other": "другой сайт"}
    result = {"marketplace": names.get(info.code, info.code), "item_id": info.item_id or None,
              "title_from_share": share_title(text) or None, "url": info.url}
    product = find_in_catalog(info)
    if product is not None:
        try:
            price = int(quote(product, ctx=ctx).total_rub) if ctx else None
        except PricingError:
            price = None
        result["in_catalog"] = {"slug": product.slug, "title": product.title_ru, "price_rub": price}
    else:
        result["in_catalog"] = None
        result["next_step"] = ("Цены с площадки не видно: попросите цену в юанях со страницы товара или скриншот, "
                               "посчитайте через estimate_link_price. Заказать можно кнопкой «Заказать по ссылке».")
    return result


def order_status(number: str, buyer) -> dict:
    if buyer is None:
        return {"error": "покупатель не вошёл: попросите войти через Telegram или открыть заказ в профиле"}
    order = buyer.orders.filter(number__iexact=(number or "").strip()).prefetch_related("events").first()
    if order is None:
        return {"error": "у этого покупателя нет заказа с таким номером"}
    last = order.events.order_by("-created_at").first()
    return {"number": order.number, "status": order.get_status_display(), "total_rub": int(order.total_rub),
            "last_update": last.created_at.strftime("%d.%m %H:%M") if last else None,
            "note": last.note if last else ""}


@dataclass
class ChatAnswer:
    text: str
    products: list[str] = field(default_factory=list)
    handoff: bool = False
    log_id: int | None = None


def _run_tool(name: str, args: dict, buyer, ctx) -> object:
    if name == "search_catalog":
        return search_catalog(str(args.get("query", "")), args.get("max_price_rub"), str(args.get("category") or ""),
                              ctx=ctx)
    if name == "get_product":
        return get_product(str(args.get("slug", "")), ctx=ctx)
    if name == "search_knowledge":
        return search_knowledge(str(args.get("query", "")))
    if name == "estimate_link_price":
        return estimate_link_price(args.get("price_cny"), args.get("qty", 1))
    if name == "inspect_link":
        return inspect_link(str(args.get("text", "")), ctx=ctx)
    if name == "order_status":
        return order_status(str(args.get("number", "")), buyer)
    return {"error": f"нет инструмента {name}"}


def _split_tail(text: str, allowed: set[str]) -> tuple[str, list[str], bool]:
    """Служебные строки «ТОВАРЫ: …» и «АГЕНТ» в конце ответа превращаем в карточки и передачу агенту."""
    products, handoff, lines = [], False, text.rstrip().splitlines()
    while lines:
        last = lines[-1].strip()
        if last.upper().startswith("ТОВАРЫ:"):
            for slug in re.split(r"[,\s]+", last.split(":", 1)[1]):
                if slug in allowed and slug not in products:
                    products.append(slug)
            lines.pop()
        elif last.upper().rstrip(".") == "АГЕНТ":
            handoff = True
            lines.pop()
        else:
            break
    return "\n".join(lines).strip(), products, handoff


def chat(history: list[dict], buyer=None) -> ChatAnswer:
    """history — сообщения покупателя и ответы ИИ: [{"role": "user"|"assistant", "content": "..."}]."""
    turns = [{"role": m["role"], "content": str(m.get("content", ""))[:MAX_MESSAGE]}
             for m in history[-MAX_HISTORY:] if m.get("role") in ("user", "assistant") and m.get("content")]
    question = next((m["content"] for m in reversed(turns) if m["role"] == "user"), "")
    log = AiLog(kind=AiLog.Kind.CHAT, request=question)
    try:
        ctx = PricingContext()
    except PricingError:
        ctx = None
    messages = [{"role": "system", "content": SYSTEM.format(facts=facts_text())}, *turns]
    seen_products: set[str] = set()
    trace, tokens = [], 0
    try:
        for _ in range(MAX_ROUNDS + 1):
            reply = llm.chat(messages, TOOLS)
            tokens += reply.tokens
            if not reply.tool_calls:
                break
            step = {"role": "assistant", "content": reply.content or "",
                    "tool_calls": reply.raw_message.get("tool_calls")}
            # Модели с «размышлениями» (DeepSeek в режиме thinking) требуют вернуть их вместе с вызовом инструментов.
            if reply.raw_message.get("reasoning_content"):
                step["reasoning_content"] = reply.raw_message["reasoning_content"]
            messages.append(step)
            for call in reply.tool_calls:
                result = _run_tool(call["name"], call["arguments"], buyer, ctx)
                if call["name"] == "search_catalog":
                    seen_products.update(item["slug"] for item in result)
                elif call["name"] == "get_product" and "slug" in result:
                    seen_products.add(result["slug"])
                elif call["name"] == "inspect_link" and result.get("in_catalog"):
                    seen_products.add(result["in_catalog"]["slug"])
                trace.append({"tool": call["name"], "args": call["arguments"]})
                messages.append({"role": "tool", "tool_call_id": call["id"],
                                 "content": json.dumps(result, ensure_ascii=False, default=str)[:6000]})
        else:
            reply = llm.chat(messages)  # инструменты вызывались слишком долго — просим ответить тем, что есть
            tokens += reply.tokens
    except llm.LLMError as exc:
        log.error, log.handoff, log.response, log.tokens = str(exc)[:300], True, HANDOFF_TEXT, tokens
        log.save()
        return ChatAnswer(HANDOFF_TEXT, handoff=True, log_id=log.pk)
    # Карточки показываем только для товаров, которые модель реально получила из каталога.
    text, products, handoff = _split_tail(reply.content, seen_products)
    log.response = text or HANDOFF_TEXT
    log.handoff, log.tokens, log.sources = handoff, tokens, {"tools": trace, "products": products}
    log.save()
    return ChatAnswer(text or HANDOFF_TEXT, products, handoff, log.pk)
