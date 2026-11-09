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
MAX_MESSAGE = 3000  # ответ ИИ вместе с «[Данные о товаре: …]»
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
  переведи название, проверь, нет ли товара у нас. Если вернулся on_marketplace — назови цену под ключ и размеры,
  иначе попроси цену в юанях или скриншот.
- Строки «[Данные о товаре: …]» в истории — это уже найденное по ссылке. Не вызывай inspect_link заново,
  отвечай по ним. Цен по каждому размеру у нас нет: назови диапазон под ключ (от и до) и скажи, что точную цену
  за выбранный размер агент сверит до выкупа; если покупатель знает цену своего размера в юанях — посчитай её.
- Прислали скриншот — прочитай с него цену в юанях (обычно крупная цифра с ¥, не зачёркнутая и не доставка),
  название и выбранный размер, переведи с китайского и посчитай через estimate_link_price. Не видно цену — попроси
  написать её текстом.
- Нашёл конкретный товар (по ссылке, скриншоту или в каталоге) — дай короткую справку в 2–3 предложения: что это
  за модель и для кого (например: «KD 19 — именная баскетбольная линейка Кевина Дюранта, лёгкая, для зала и улицы»),
  чем хороша. Для брендовых вещей вызови search_reviews и добавь 1–2 конкретных плюса или минуса из обзоров
  со ссылкой на сайт («по обзору на …»). Не придумывай оценки, рейтинги и цифры — только из найденного.
- Оформить заказ сам ты не можешь: предложи нажать «Заказать по ссылке» (или кнопку «В корзину» для каталога).
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
                       "этот товар в нашем каталоге. Для Poizon, Taobao и Tmall ещё цену в юанях, размеры и фото "
                       "с площадки и цену под ключ (если просмотр площадок подключён). Может думать до минуты.",
        "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}}},
    {"type": "function", "function": {
        "name": "search_reviews",
        "description": "Найти в интернете обзоры, отзывы и рейтинги товара или модели (например «Nike KD 19 обзор»). "
                       "Возвращает заголовок, сайт, дату и краткое содержание.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "модель и слова «обзор отзывы», до 128 символов"}},
            "required": ["query"]}}},
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
        market = marketplace_card(info)
        if market.get("item"):
            result["on_marketplace"] = market["item"]
            result["estimate"] = market.get("estimate")
            result["next_step"] = ("Это данные с площадки сейчас. Назови цену под ключ из estimate (если есть "
                                   "диапазон по размерам — уточни размер), предложи «Заказать по ссылке».")
        else:
            result["next_step"] = (market.get("note") or "Цены с площадки не видно") + (
                ": попросите цену в юанях со страницы товара или скриншот, посчитайте через estimate_link_price. "
                "Заказать можно кнопкой «Заказать по ссылке».")
    return result


def marketplace_card(info) -> dict:
    """Цена, размеры и фото с Poizon/Taobao через Apify и сразу цена под ключ по минимальной цене."""
    from links import apify
    from links.services import estimate

    if not (info.item_id and apify.supported(info.code)):
        return {"note": "Эту площадку автоматически не смотрим" if info.code not in ("taobao", "tmall", "poizon")
                else "Номер товара не нашёлся в ссылке"}
    try:
        item = apify.fetch_item(info.code, info.item_id)
    except apify.ApifyError as exc:
        return {"note": str(exc)}
    if not item:
        return {"note": "Товар не нашёлся на площадке или снят с продажи"}
    out = {"item": item}
    if item.get("price_cny"):
        try:
            est = estimate(Decimal(str(item["price_cny"])), 1, info.marketplace)
            out["estimate"] = {"total_rub": int(est.total_rub), "for_price_cny": item["price_cny"],
                               "notes": est.notes}
            # Цены по каждому размеру скрапер не даёт — только от и до. Считаем и верхнюю границу.
            if item.get("price_cny_max") and item["price_cny_max"] > item["price_cny"]:
                top = estimate(Decimal(str(item["price_cny_max"])), 1, info.marketplace)
                out["estimate"].update(max_total_rub=int(top.total_rub), max_for_price_cny=item["price_cny_max"])
        except PricingError:
            pass
    return out


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
    # Что ИИ узнал о товаре по ссылке: сайт хранит это в истории, чтобы на «а размер 47?» не искать заново.
    memo: str = ""


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
    if name == "search_reviews":
        found = llm.web_search(str(args.get("query", "")))
        return found or {"note": "обзоров не нашлось или поиск недоступен — опирайся на общие знания, "
                                 "без выдуманных оценок"}
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


def photo_for_model(data: bytes) -> str:
    """Скриншот покупателя → JPEG до 1600 px в виде data URL для модели с распознаванием картинок."""
    import base64
    from io import BytesIO

    from PIL import Image, ImageOps

    from catalog.images import ImageError, prepare_image

    try:
        webp = prepare_image(data, "photo")  # проверка, поворот по EXIF, уменьшение
        image = Image.open(BytesIO(webp.read())).convert("RGB")
    except (ImageError, OSError) as exc:
        raise ValueError("Это не фото или файл повреждён") from exc
    out = BytesIO()
    ImageOps.exif_transpose(image).save(out, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()


def chat(history: list[dict], buyer=None, photo: str | None = None) -> ChatAnswer:
    """history — сообщения покупателя и ответы ИИ: [{"role": "user"|"assistant", "content": "..."}].
    photo — скриншот к последнему сообщению (data URL из photo_for_model)."""
    turns = [{"role": m["role"], "content": str(m.get("content", ""))[:MAX_MESSAGE]}
             for m in history[-MAX_HISTORY:] if m.get("role") in ("user", "assistant") and m.get("content")]
    question = next((m["content"] for m in reversed(turns) if m["role"] == "user"), "")
    if photo and turns and turns[-1]["role"] == "user":
        turns[-1] = {"role": "user", "content": [{"type": "text", "text": turns[-1]["content"]},
                                                 {"type": "image_url", "image_url": {"url": photo}}]}
    log = AiLog(kind=AiLog.Kind.CHAT, request=("[фото] " if photo else "") + question)
    try:
        ctx = PricingContext()
    except PricingError:
        ctx = None
    messages = [{"role": "system", "content": SYSTEM.format(facts=facts_text())}, *turns]
    seen_products: set[str] = set()
    memos: list[str] = []
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
                if call["name"] == "inspect_link" and result.get("url"):
                    memos.append(_link_memo(result))
                trace.append({"tool": call["name"], "args": call["arguments"]})
                messages.append({"role": "tool", "tool_call_id": call["id"],
                                 "content": json.dumps(result, ensure_ascii=False, default=str)[:6000]})
        else:
            reply = llm.chat(messages)  # инструменты вызывались слишком долго — просим ответить тем, что есть
            tokens += reply.tokens
    except llm.LLMError as exc:
        text = ("Не получилось прочитать фото. Напишите цену в юанях текстом — сразу посчитаю."
                if photo else HANDOFF_TEXT)
        log.error, log.handoff, log.response, log.tokens = str(exc)[:300], not photo, text, tokens
        log.save()
        return ChatAnswer(text, handoff=not photo, log_id=log.pk)
    # Карточки показываем только для товаров, которые модель реально получила из каталога.
    text, products, handoff = _split_tail(reply.content, seen_products)
    log.response = text or HANDOFF_TEXT
    log.handoff, log.tokens, log.sources = handoff, tokens, {"tools": trace, "products": products}
    log.save()
    return ChatAnswer(text or HANDOFF_TEXT, products, handoff, log.pk, memo="\n".join(memos)[:1500])


def _link_memo(result: dict) -> str:
    """Короткая выжимка разбора ссылки для истории разговора."""
    market = result.get("on_marketplace") or {}
    est = result.get("estimate") or {}
    parts = [f"ссылка {result.get('url')}", f"площадка {result.get('marketplace')}",
             f"номер товара {result.get('item_id') or 'не найден'}"]
    if market.get("title"):
        parts.append(f"товар «{market['title']}»")
    if market.get("price_cny"):
        top = f"–{market['price_cny_max']:g}" if market.get("price_cny_max") else ""
        parts.append(f"цена на площадке {market['price_cny']:g}{top} ¥ (по размерам отдельно не известна)")
    if est.get("total_rub"):
        top = f"–{est['max_total_rub']}" if est.get("max_total_rub") else ""
        parts.append(f"под ключ {est['total_rub']}{top} ₽")
    if market.get("sizes"):
        parts.append("размеры " + ", ".join(market["sizes"][:30]))
    return "[Данные о товаре: " + "; ".join(parts) + "]"
