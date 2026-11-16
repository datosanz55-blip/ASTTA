"""Товар с Poizon и Taobao/Tmall по номеру — через готовые скраперы Apify (оплата за найденный товар).

Свой парсер площадки быстро банят: Taobao ограничивает запросы с одного адреса, Poizon требует подпись
приложения. Скраперы Apify решают это сами, нам нужен только токен (APIFY_TOKEN, apify.com → API & Integrations).
Каждый найденный товар стоит денег, поэтому ответ храним в базе (MarketplaceItem) на CACHE_HOURS часов.
"""

import math
import re
from datetime import timedelta

import httpx
from django.conf import settings
from django.utils import timezone

from links.models import MarketplaceItem

API = "https://api.apify.com/v2/actors/{actor}/run-sync-get-dataset-items"
ACTORS = {
    # Poizon: только кроссовки, одежда и люкс; ищет по spuId. ~6 $ за 1000 найденных.
    "poizon": ("sian.agency~dewu-poizon-price-tracker", lambda item_id: {"spuIds": [item_id], "styleCodes": []}),
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
        number = float(value)
        return round(number, 2) if math.isfinite(number) and number > 0 else None
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
    for key in ("salePriceCny", "lowestAskCny", "minSalePriceCny"):
        if (value := _num(sku.get(key))) is not None:
            return value
    for key in ("salePriceFen", "minSalePriceFen"):
        if (value := _num(sku.get(key))) is not None:
            return round(value / 100, 2)
    return None


def size_key(value):
    value = str(value).strip().casefold().replace(",", ".")
    value = re.sub(r"^(?:eu|cn)\s*", "", value)
    for fraction, decimal in [("⅓", ".333"), ("⅔", ".667"), ("½", ".5")]:
        value = value.replace(fraction, decimal)
    return re.sub(r"\.0+$", "", value)


def price_for_size(item, size):
    matches = [price for label, price in item.get("size_prices", {}).items() if size_key(label) == size_key(size)]
    return min(matches) if matches and len(set(matches)) == 1 else None


def size_prices(skus, low, high, cheapest_sku_id=None):
    if not isinstance(skus, list):
        return {}
    found, ambiguous = {}, set()
    for sku in skus:
        if not isinstance(sku, dict) or sku.get("available") is False:
            continue
        size, price = _sku_size(sku), _sku_price(sku)
        sku_id = str(sku.get("skuId") or sku.get("id") or "")
        if not price and low and cheapest_sku_id and sku_id == str(cheapest_sku_id):
            price = low  # Exact ID binding: only the variant carrying the live lowest ask.
        if not size or not price or (low and price < low * .99) or (high and price > high * 1.01):
            continue
        if size in found:
            ambiguous.add(size)
        found[size] = price
    return {size: price for size, price in found.items() if size not in ambiguous}


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
                "size_prices": size_prices(row.get("skus"), _num(row.get("minSalePriceCny")) or price,
                                           top, row.get("lowestPriceSkuId")),
                "images": [str(i) for i in
                           (row.get("images") or ([row["logoUrl"]] if row.get("logoUrl") else []))][:6]}
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


def fetch_item(code: str, item_id: str, *, fresh=False) -> dict | None:
    """Карточка товара или None (не найден). ApifyError — скрапер недоступен или нет токена."""
    if not supported(code) or not item_id:
        return None
    cached = MarketplaceItem.objects.filter(code=code, item_id=item_id).first()
    ttl = timedelta(minutes=2) if fresh else timedelta(hours=CACHE_HOURS)
    if (cached and cached.fetched_at > timezone.now() - ttl
            and (not fresh or cached.data.get("live_lookup"))):
        return cached.data if cached.found else None
    from config.budget import take

    if not take("apify", settings.APIFY_DAILY_LIMIT):
        raise ApifyError("Лимит просмотров площадок на сегодня исчерпан: пришлите цену в юанях или скриншот")
    rows = run_actor(code, item_id)
    matches = [r for r in rows if isinstance(r, dict)
               and (not (r.get("spuId") or r.get("productId"))
                    or str(r.get("spuId") or r.get("productId")) == item_id)]
    item = next((n for r in matches if (n := normalize(code, r))), None)
    if item:
        item["live_lookup"] = True
    MarketplaceItem.objects.update_or_create(
        code=code, item_id=item_id, defaults={"data": item or {"live_lookup": True}, "found": item is not None})
    return item
