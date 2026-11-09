"""Товар с Poizon и Taobao/Tmall по номеру — через готовые скраперы Apify (оплата за найденный товар).

Свой парсер площадки быстро банят: Taobao ограничивает запросы с одного адреса, Poizon требует подпись
приложения. Скраперы Apify решают это сами, нам нужен только токен (APIFY_TOKEN, apify.com → API & Integrations).
Каждый найденный товар стоит денег, поэтому ответ храним в базе (MarketplaceItem) на CACHE_HOURS часов.
"""

from datetime import timedelta

import httpx
from django.conf import settings
from django.utils import timezone

from links.models import MarketplaceItem

API = "https://api.apify.com/v2/actors/{actor}/run-sync-get-dataset-items"
ACTORS = {
    # Poizon: только кроссовки, одежда и люкс; ищет по spuId. ~6 $ за 1000 найденных.
    "poizon": ("sian.agency~dewu-poizon-price-tracker", lambda item_id: {"spuIds": [item_id]}),
    # Taobao и Tmall: по номеру товара. ~3 $ за 1000.
    "taobao": ("scrapesage~taobao-scraper", lambda item_id: {"mode": "item", "itemUrls": [item_id], "maxItems": 1}),
    "tmall": ("scrapesage~taobao-scraper", lambda item_id: {"mode": "item", "itemUrls": [item_id], "maxItems": 1}),
}
CACHE_HOURS = 6
TIMEOUT = 120  # скрапер запускается и ищет товар: обычно 10–60 секунд


class ApifyError(Exception):
    pass


def enabled() -> bool:
    return bool(settings.APIFY_TOKEN)


def supported(code: str) -> bool:
    return code in ACTORS


def _num(value):
    try:
        return round(float(value), 2) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


SIZE_KEYS = ("size", "sizeName", "propertyValue", "value", "name")
PROPS_KEYS = ("properties", "saleProperties", "propertyList", "props", "property", "saleProperty")


def _scalar(value) -> str:
    return str(value).strip() if isinstance(value, (str, int, float)) and str(value).strip() else ""


def _sku_size(sku: dict) -> str:
    for key in SIZE_KEYS:
        if found := _scalar(sku.get(key)):
            return found
    for key in PROPS_KEYS:
        props = sku.get(key)
        for prop in props if isinstance(props, list) else [props]:
            if isinstance(prop, dict):
                for inner in SIZE_KEYS:
                    if found := _scalar(prop.get(inner)):
                        return found
            elif found := _scalar(prop):
                return found
    return ""


def _sku_price(sku: dict) -> float | None:
    for key in ("priceCny", "salePriceCny", "price_cny"):
        if (value := _num(sku.get(key))) is not None:
            return value
    for key in ("price", "salePrice", "priceFen", "minPrice", "authPrice"):  # в «фенах»: 1 ¥ = 100 фэней
        if (value := _num(sku.get(key))) is not None:
            return round(value / 100, 2)
    return None


def size_prices(skus, low: float | None, high: float | None) -> dict[str, float]:
    """Цена каждого размера из skus, если скрапер её дал.

    Формат skus скрапер не описывает точно («id, цена в фэнях, статус, размер»), поэтому берём цены только
    правдоподобные: внутри диапазона от и до, и разные у разных размеров. Одинаковая цена у всех при разном
    диапазоне — это официальная розница, а не цена продажи: тогда считаем, что цен по размерам нет.
    """
    if not isinstance(skus, list) or not low or not high:
        return {}
    found = {}
    for sku in skus:
        if not isinstance(sku, dict):
            continue
        size, price = _sku_size(sku), _sku_price(sku)
        if size and price and low * 0.99 <= price <= high * 1.01:
            found.setdefault(size, price)
    if len(set(found.values())) < 2 and high > low:
        return {}
    return found


def normalize(code: str, row: dict) -> dict | None:
    """Ответы скраперов разные — приводим к одному виду для ИИ и сайта."""
    if code == "poizon":
        if row.get("status") not in (None, "success"):
            return None
        price = _num(row.get("priceCny")) or _num(row.get("minSalePriceCny"))
        top = _num(row.get("maxSalePriceCny"))
        return {"title": row.get("productTitle") or "", "brand": row.get("brandName") or "",
                "article": row.get("articleNumber") or "", "price_cny": price,
                "price_cny_max": top,
                "sizes": [str(s) for s in (row.get("sizes") or [])][:40],
                "size_prices": size_prices(row.get("skus"), _num(row.get("minSalePriceCny")) or price, top),
                "images": [str(i) for i in (row.get("images") or [])][:6]}
    price = _num(row.get("priceCny"))
    if not (row.get("title") or price):
        return None
    images = [str(i) for i in (row.get("images") or [])] or ([row["mainImage"]] if row.get("mainImage") else [])
    return {"title": row.get("title") or "", "brand": "", "article": "", "price_cny": price,
            "price_cny_max": None, "sizes": [], "size_prices": {}, "images": images[:6],
            "shop": row.get("shopName") or "", "url": row.get("url") or ""}


def run_actor(code: str, item_id: str) -> list:
    """Сырой ответ скрапера: для fetch_item и для проверки на сервере (manage.py market_raw)."""
    if not enabled():
        raise ApifyError("Просмотр товаров на площадках не подключён: задайте APIFY_TOKEN")
    actor, make_input = ACTORS[code]
    try:
        response = httpx.post(API.format(actor=actor), params={"timeout": TIMEOUT}, json=make_input(item_id),
                              headers={"Authorization": f"Bearer {settings.APIFY_TOKEN}"}, timeout=TIMEOUT + 15)
    except httpx.HTTPError:
        raise ApifyError("Площадка не ответила, попробуйте ещё раз или пришлите цену со скриншота") from None
    if response.status_code == 408:
        raise ApifyError("Площадка долго не отвечала, попробуйте ещё раз или пришлите цену со скриншота")
    if response.status_code == 402:
        raise ApifyError("На счёте Apify закончились деньги")
    if response.status_code not in (200, 201):
        raise ApifyError(f"Apify вернул {response.status_code}")
    try:
        rows = response.json()
    except ValueError:
        raise ApifyError("Непонятный ответ Apify") from None
    return rows if isinstance(rows, list) else []


def cached_item(code: str, item_id: str) -> dict | None:
    """Товар из кэша без запроса к Apify (бесплатно): None, если не смотрели или не нашли."""
    cached = MarketplaceItem.objects.filter(code=code, item_id=item_id, found=True).first()
    return cached.data if cached else None


def fetch_item(code: str, item_id: str) -> dict | None:
    """Карточка товара или None (не найден). ApifyError — скрапер недоступен или нет токена."""
    if not supported(code) or not item_id:
        return None
    cached = MarketplaceItem.objects.filter(code=code, item_id=item_id).first()
    if cached and cached.fetched_at > timezone.now() - timedelta(hours=CACHE_HOURS):
        return cached.data if cached.found else None
    from config.budget import take

    if not take("apify", settings.APIFY_DAILY_LIMIT):
        raise ApifyError("Лимит просмотров площадок на сегодня исчерпан: пришлите цену в юанях или скриншот")
    rows = run_actor(code, item_id)
    item = next((n for n in (normalize(code, r) for r in rows if isinstance(r, dict)) if n), None)
    MarketplaceItem.objects.update_or_create(code=code, item_id=item_id,
                                             defaults={"data": item or {}, "found": item is not None})
    return item
