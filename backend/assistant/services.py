"""ASTTA AI: ответы покупателям по базе знаний, разбор скриншота с ценой, перевод карточек с китайского.

ИИ ничего не выдумывает: в вопросах он видит только наши статьи и живые данные (тарифы, курс, правила
заказа) и передаёт вопрос агенту, если ответа там нет. Цену со скриншота сначала ищем по символам ¥ и 元
в распознанном тексте, YandexGPT только помогает понять, что за товар.
"""

import json
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from io import BytesIO

from django.db.models import Q
from PIL import Image, ImageOps, UnidentifiedImageError

from assistant import yandex
from assistant.models import AiLog, KnowledgeArticle
from catalog.models import Category, Product
from orders.services import UNPAID_HOURS
from pricing.models import PricingConfig, ShippingMethod
from pricing.services import PricingError, current_rate

MAX_QUESTION = 1000
MAX_ARTICLES = 5
HANDOFF_TEXT = "Передал вопрос агенту TT Логистики, он ответит в чате."


# ---------- Ответы на вопросы ----------

def _stems(text: str) -> set[str]:
    """Грубая основа слова: первые 5 букв. «доставка», «доставки», «доставку» совпадут."""
    return {w[:5] for w in re.findall(r"[a-zа-яё0-9]+", text.lower()) if len(w) >= 3}


def find_articles(question: str, limit: int = MAX_ARTICLES) -> list[KnowledgeArticle]:
    words = _stems(question)
    scored = []
    for article in KnowledgeArticle.objects.filter(is_active=True):
        head = _stems(f"{article.title} {article.keywords}")
        body = _stems(article.answer)
        score = 3 * len(words & head) + len(words & body)
        if score:
            scored.append((score, article.pk, article))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [article for _, _, article in scored[:limit]]


def facts_text() -> str:
    """Живые правила из настроек и кода: их ИИ знает всегда, статьи для этого не нужны."""
    config = PricingConfig.load()
    lines = [
        "Цена под ключ = цена товара в юанях по курсу + доставка по весу + сервисный сбор ASTTA, "
        "итог округляется до 10 ₽. Пошлины и доставку до двери в цене не упоминай, если о них нет статьи.",
        f"Сервисный сбор: {config.retail_fee * 100:g}% в рознице, {config.wholesale_fee * 100:g}% в опте; "
        "у некоторых категорий и поставщиков свой сбор.",
        f"Платить нужно сразу при заказе. Неоплаченный заказ отменяется через {UNPAID_HOURS} часа.",
        "После оплаты товар сразу заказываем у поставщика. Если товара у поставщика нет, эту часть заказа "
        "отменяем и возвращаем за неё деньги.",
        "Размер и цвет выбираются только из списка в карточке товара.",
        "Товара нет в каталоге — можно прислать ссылку или скриншот, агент найдёт и посчитает цену.",
    ]
    try:
        lines.append(f"Курс юаня для покупателя сегодня: {current_rate(config=config):.2f} ₽.")
    except PricingError:
        pass
    for method in ShippingMethod.objects.filter(is_active=True):
        bulky = ", только для крупногабарита (мебель)" if method.for_bulky_only else ""
        lines.append(f"Доставка «{method.name}»: {method.days_min}–{method.days_max} дней, "
                     f"{method.rub_per_kg:g} ₽ за кг{bulky}.")
    return "\n".join(f"- {line}" for line in lines)


@dataclass
class Answer:
    text: str
    handoff: bool
    articles: list[KnowledgeArticle]
    log_id: int


def answer_question(question: str) -> Answer:
    question = question.strip()[:MAX_QUESTION]
    articles = find_articles(question)
    numbered = "\n\n".join(f"[{a.pk}] {a.title}\n{a.answer}" for a in articles) or "(подходящих статей нет)"
    system = (
        "Ты ASTTA AI, помощник маркетплейса ASTTA: товары из Китая с доставкой в Россию через TT Логистику. "
        "Отвечай по-русски, коротко и вежливо, только по ФАКТАМ и СТАТЬЯМ ниже. "
        "Если ответа в них нет, или вопрос про конкретный заказ, оплату, возврат денег, жалобу — не придумывай, "
        "поставь handoff=true: вопрос уйдёт агенту. Не обещай сроков, скидок и цен, которых нет в фактах. "
        'Верни JSON: {"answer": "текст ответа", "handoff": true или false, "sources": [номера статей]}.'
        f"\n\nФАКТЫ:\n{facts_text()}\n\nСТАТЬИ:\n{numbered}"
    )
    log = AiLog(kind=AiLog.Kind.ASK, request=question)
    try:
        data, log.tokens = yandex.complete_json(system, question, max_tokens=600)
    except yandex.AIError as exc:
        log.error, log.handoff, log.response = str(exc)[:300], True, HANDOFF_TEXT
        log.save()
        return Answer(HANDOFF_TEXT, True, [], log.pk)
    handoff = bool(data.get("handoff"))
    text = str(data.get("answer") or "").strip() or HANDOFF_TEXT
    allowed = {a.pk: a for a in articles}
    used = [allowed[i] for i in data.get("sources") or [] if isinstance(i, int) and i in allowed]
    log.response, log.handoff, log.sources = text, handoff, [a.pk for a in used]
    log.save()
    return Answer(text, handoff, used, log.pk)


# ---------- Скриншот с ценой ----------

PRICE_RE = re.compile(
    r"[¥￥]\s*(\d{1,3}(?:,\d{3})+|\d{1,6})(?:\.(\d{1,2}))?"
    r"|(\d{1,3}(?:,\d{3})+|\d{1,6})(?:\.(\d{1,2}))?\s*元"
)
MAX_PHOTO_SIDE = 2000


def find_prices(lines: list[yandex.OcrLine]) -> list[tuple[Decimal, int]]:
    """Все цены со знаком ¥ или 元 и высота их строки: крупнее шрифт — скорее всего главная цена."""
    found = []
    for line in lines:
        for match in PRICE_RE.finditer(line.text):
            whole, cents = (match.group(1), match.group(2)) if match.group(1) else (match.group(3), match.group(4))
            try:
                value = Decimal(whole.replace(",", "") + (f".{cents}" if cents else ""))
            except InvalidOperation:
                continue
            if value > 0:
                found.append((value, line.height))
    return found


def main_price(lines: list[yandex.OcrLine]) -> Decimal | None:
    prices = find_prices(lines)
    if not prices:
        return None
    return max(enumerate(prices), key=lambda x: (x[1][1], -x[0]))[1][0]


def to_jpeg(data: bytes) -> bytes:
    """Vision принимает JPEG до 10 МБ и 20 Мп: уменьшаем до 2000 px, этого хватает для цены и текста."""
    try:
        with Image.open(BytesIO(data)) as probe:
            probe.verify()
        image = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError) as exc:
        raise ValueError("Это не фото или файл повреждён") from exc
    image.thumbnail((MAX_PHOTO_SIDE, MAX_PHOTO_SIDE))
    out = BytesIO()
    image.save(out, "JPEG", quality=90)
    return out.getvalue()


@dataclass
class PhotoReading:
    text: str
    price_cny: Decimal | None
    prices: list[Decimal]
    title_ru: str = ""
    category: Category | None = None
    keywords: list[str] = field(default_factory=list)
    similar: list[Product] = field(default_factory=list)
    log_id: int | None = None


def similar_products(keywords: list[str], category: Category | None, limit: int = 6) -> list[Product]:
    words = [w for w in keywords if len(w) >= 3][:5]
    if not words:
        return []
    query = Q()
    for word in words:
        query |= Q(title_ru__icontains=word[:6]) | Q(description_ru__icontains=word[:6])
    qs = (Product.objects.filter(query, status=Product.Status.PUBLISHED, supplier__is_active=True)
          .select_related("category", "supplier").prefetch_related("tiers", "images"))
    products = list(qs[:50])
    # Сначала товары той же категории и с бóльшим числом совпавших слов.
    products.sort(key=lambda p: (p.category_id != getattr(category, "pk", None),
                                 -sum(w[:6].lower() in p.title_ru.lower() for w in words)))
    return products[:limit]


def read_photo(data: bytes) -> PhotoReading:
    jpeg = to_jpeg(data)
    log = AiLog(kind=AiLog.Kind.PHOTO, request="скриншот")
    try:
        ocr = yandex.recognize_text(jpeg)
    except yandex.AIError as exc:
        log.error = str(exc)[:300]
        log.save()
        raise
    prices = find_prices(ocr.lines)
    reading = PhotoReading(text=ocr.full_text, price_cny=main_price(ocr.lines), prices=[p for p, _ in prices])
    log.request = ocr.full_text[:2000] or "(текста на фото нет)"
    if ocr.full_text.strip():
        categories = list(Category.objects.all())
        system = (
            "Ты помогаешь маркетплейсу ASTTA разобрать скриншот товара с китайской площадки (Poizon, Taobao, "
            "1688, Pinduoduo). Тебе дают распознанный со скриншота текст. Верни JSON: "
            '{"title_ru": "короткое название товара по-русски", "category": "код категории из списка или пусто", '
            '"price_cny": цена товара в юанях числом или null, "keywords": ["2–5 русских слов для поиска"]}. '
            "Цена — та, что платит покупатель за товар, не скидка и не доставка. "
            "Ничего не придумывай: если чего-то нет в тексте, ставь пустую строку или null."
        )
        user = "Категории: " + "; ".join(f"{c.slug} — {c.name_ru}" for c in categories)
        user += f"\n\nТекст со скриншота:\n{ocr.full_text[:3000]}"
        try:
            data_, log.tokens = yandex.complete_json(system, user, max_tokens=300, temperature=0.1)
        except yandex.AIError as exc:
            log.error = str(exc)[:300]
            data_ = {}
        reading.title_ru = str(data_.get("title_ru") or "")[:160]
        reading.category = next((c for c in categories if c.slug == data_.get("category")), None)
        reading.keywords = [str(k) for k in (data_.get("keywords") or []) if isinstance(k, str)][:5]
        if reading.price_cny is None and data_.get("price_cny"):
            try:
                reading.price_cny = Decimal(str(data_["price_cny"])).quantize(Decimal("0.01"))
            except InvalidOperation:
                pass
        reading.similar = similar_products(reading.keywords or reading.title_ru.split(), reading.category)
    log.response = json.dumps({"price_cny": str(reading.price_cny) if reading.price_cny else None,
                               "title_ru": reading.title_ru}, ensure_ascii=False)
    log.save()
    reading.log_id = log.pk
    return reading


# ---------- Перевод карточек ----------

TRANSLATE_BATCH = 20


def translate_cards(items: list[dict]) -> list[dict]:
    """[{"title_zh", "description_zh"}] → [{"title", "description"}] по-русски, в том же порядке."""
    system = (
        "Ты переводишь карточки товаров поставщиков из Китая для российского маркетплейса. "
        "Для каждого товара дай русское название, как на маркетплейсе: что это и главная особенность "
        "или материал, не длиннее 80 символов, без брендов, которых нет в исходнике. "
        "Описание переведи коротко и по делу; если описания нет, оставь пустым. "
        'Верни JSON {"items": [{"title": "...", "description": "..."}]} в том же порядке и того же количества.'
    )
    result = []
    for start in range(0, len(items), TRANSLATE_BATCH):
        batch = items[start:start + TRANSLATE_BATCH]
        source = [{"title_zh": i.get("title_zh", "")[:300], "description_zh": i.get("description_zh", "")[:1500]}
                  for i in batch]
        log = AiLog(kind=AiLog.Kind.TRANSLATE, request=json.dumps(source, ensure_ascii=False)[:4000])
        try:
            data, log.tokens = yandex.complete_json(system, json.dumps(source, ensure_ascii=False),
                                                    max_tokens=200 * len(batch) + 200, temperature=0.2)
            translated = data.get("items")
            if not isinstance(translated, list) or len(translated) != len(batch):
                raise yandex.AIError("YandexGPT вернул не столько товаров, сколько отправили")
        except yandex.AIError as exc:
            log.error = str(exc)[:300]
            log.save()
            raise
        log.response = json.dumps(translated, ensure_ascii=False)[:4000]
        log.save()
        for item in translated:
            item = item if isinstance(item, dict) else {}
            result.append({"title": str(item.get("title") or "").strip()[:160],
                           "description": str(item.get("description") or "").strip()})
    return result
