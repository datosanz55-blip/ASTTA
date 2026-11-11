"""Товары с Poizon и Taobao в каталог ASTTA.

Как это работает:
1. В админке создают «Импорт с площадки»: площадка, поисковые запросы, категория, сколько товаров.
2. Фоновая задача запускает готовый сборщик на Apify (тот же APIFY_TOKEN, что для цены по ссылке),
   ждёт результат, переводит названия, скачивает фото к нам (WebP) и создаёт или обновляет товары.
3. Раз в неделю цены обновляются; товары, которых больше нет в продаже, скрываются (черновик).

Цена размера на Poizon разная, сборщик отдаёт только «от» и «до». Поэтому такой товар на сайте
стоит «от …», а заказывается как заказ по ссылке: покупатель называет цену своего размера или
присылает скриншот.
"""

import re
import time
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

import httpx
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from catalog.images import ImageError, prepare_image
from catalog.importer import unique_slug
from catalog.models import Category, MarketImport, Product, ProductImage, Supplier

API = "https://api.apify.com/v2"
ACTORS = {
    # Поиск по словам, артикулу или номеру; русское название, размеры RU/EU, цена «от–до» в юанях.
    "poizon": "zen-studio~dewu-poizon-scraper",
    # Поиск по словам (лучше по-китайски), категории или номеру товара.
    "taobao": "scrapesage~taobao-scraper",
}
SUPPLIERS = {
    "poizon": ("Poizon", "Оригиналы с проверкой подлинности"),
    "taobao": ("Taobao", "Товары с Taobao"),
}
# Фото скачиваем только с CDN площадок: адреса приходят из чужих данных, на свои адреса сервер не ходит.
IMAGE_HOSTS = ("poizon.com", "dewu.com", "dewucdn.com", "poizon.net", "thepoizon.ru", "alicdn.com", "taobaocdn.com",
               "tbcdn.cn", "tmall.com", "taobao.com")
MAX_IMAGE = 10 * 1024 * 1024
IMAGES_PER_PRODUCT = 4
RUN_TIMEOUT = 30 * 60
POLL_SECONDS = 10
GONE_NOTE = "Нет в продаже на площадке (скрыт при обновлении цен)"
TRANSPORT = None  # в тестах — httpx.MockTransport
SLEEP = time.sleep


class MarketError(Exception):
    pass


def enabled() -> bool:
    return bool(settings.APIFY_TOKEN)


def _client(**kwargs) -> httpx.Client:
    return httpx.Client(transport=TRANSPORT, **kwargs)


def _num(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return round(number, 2) if number > 0 else None


# ---------- Цена на сайте ----------

def link_total(product: Product, price_cny) -> Decimal | None:
    """Товар с площадки заказывают как по ссылке: и цену считаем той же формулой (links.services.estimate)."""
    from links.models import Marketplace
    from links.services import estimate
    from pricing.services import PricingError

    if not price_cny:
        return None
    try:
        place = Marketplace.objects.filter(code=product.market.get("source")).first()
        return estimate(Decimal(str(price_cny)), 1, place).total_rub
    except (PricingError, InvalidOperation):
        return None


def retail_rub(product: Product, ctx) -> Decimal | None:
    """Цена под ключ за штуку для карточки и для ИИ: у товара с площадки — «от» по формуле ссылки."""
    from pricing.services import PricingError, quote

    if product.is_market:
        return link_total(product, product.price_cny)
    try:
        return quote(product, ctx=ctx).total_rub if ctx else None
    except PricingError:
        return None


def market_out(product: Product) -> dict | None:
    if not product.is_market:
        return None
    m = product.market
    return {"source": m.get("source"), "url": m.get("url", ""), "poizon_url": m.get("poizon_url", ""),
            "price_cny_max": m.get("price_cny_max"), "retail_max_rub": link_total(product, m.get("price_cny_max")),
            "poizon_rub_min": m.get("poizon_rub_min"), "sizes": m.get("sizes", []),
            "fit_advice": m.get("fit_advice", ""), "brand": m.get("brand", ""), "article": m.get("article", "")}


# ---------- Apify ----------

def run_actor(actor: str, payload: dict, timeout: int = RUN_TIMEOUT) -> list[dict]:
    """Запустить сборщик, дождаться конца и вернуть его строки. Долгий: до timeout секунд."""
    if not enabled():
        raise MarketError("Не задан APIFY_TOKEN: без него площадки не смотрим")
    headers = {"Authorization": f"Bearer {settings.APIFY_TOKEN}"}
    with _client(headers=headers, timeout=60) as client:
        try:
            started = client.post(f"{API}/acts/{actor}/runs", json=payload)
        except httpx.HTTPError as exc:
            raise MarketError(f"Apify не ответил: {exc.__class__.__name__}") from None
        if started.status_code == 402:
            raise MarketError("На счёте Apify закончились деньги")
        if started.status_code not in (200, 201):
            raise MarketError(f"Apify не запустил сборщик: {started.status_code} {started.text[:200]}")
        run = started.json().get("data") or {}
        deadline = time.monotonic() + timeout
        while run.get("status") in (None, "READY", "RUNNING"):
            if time.monotonic() > deadline:
                raise MarketError("Сборщик не уложился во время, попробуйте меньше товаров")
            SLEEP(POLL_SECONDS)
            try:
                run = client.get(f"{API}/actor-runs/{run['id']}").json().get("data") or {}
            except (httpx.HTTPError, ValueError, KeyError):
                continue  # сеть моргнула — спросим ещё раз
        if run.get("status") != "SUCCEEDED":
            raise MarketError(f"Сборщик завершился со статусом {run.get('status')}")
        try:
            items = client.get(f"{API}/datasets/{run['defaultDatasetId']}/items",
                               params={"clean": "true", "format": "json"}).json()
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise MarketError(f"Не получили результат сборщика: {exc.__class__.__name__}") from None
    return [row for row in items if isinstance(row, dict)] if isinstance(items, list) else []


# ---------- Разбор строк сборщиков ----------

def poizon_item(row: dict) -> dict | None:
    """Строка zen-studio/dewu-poizon-scraper → наш вид. None — нет цены или товара."""
    if row.get("status") not in (None, "ok", "success"):
        return None
    low = _num(row.get("lowestAskCny")) or _num(row.get("floorPriceCny"))
    item_id = str(row.get("spuId") or "").strip()
    if not low or not item_id:
        return None
    sizes, seen = [], set()
    for sku in row.get("sizes") or []:
        if not isinstance(sku, dict):
            continue
        size = str(sku.get("size") or "").strip()[:12]
        if not size or size in seen or sku.get("skuStatus") not in (None, 1):
            continue
        seen.add(size)
        labels = sku.get("poizonSizes") if isinstance(sku.get("poizonSizes"), dict) else {}
        sizes.append({"size": size, "ru": str(labels.get("RU") or "")[:12],
                      "poizon_rub": _num(sku.get("poizonPriceRub"))})
    images = []
    for url in [row.get("thumbnailUrl"), *(row.get("images") or [])]:
        if isinstance(url, str) and url.startswith("https://") and url not in images:
            images.append(url)
    sold = re.sub(r"\D", "", str(row.get("soldLabel") or ""))
    return {
        "id": item_id,
        "title_ru": str(row.get("poizonTitle") or "").strip(),
        "title_zh": str(row.get("title") or "").strip(),
        "brand": str(row.get("brandName") or ""),
        "article": str(row.get("articleNumber") or ""),
        "price_cny": low,
        "price_cny_max": _num(row.get("highestAskCny")),
        "sizes": sizes,
        "images": images[:8],
        "url": row.get("url") or f"https://m.dewu.com/router/product/ProductDetail?spuId={item_id}",
        "poizon_url": row.get("poizonUrl") or "",
        "poizon_rub_min": _num(row.get("poizonMinPriceRub")),
        "fit_advice": str(row.get("poizonFitAdvice") or "")[:200],
        "category": str(row.get("poizonCategory") or row.get("categoryName") or ""),
        "sold": int(sold) if sold.isdigit() and len(sold) < 9 else 0,
    }


def taobao_item(row: dict) -> dict | None:
    from links import apify
    from links.services import parse_link

    base = apify.normalize("taobao", row)
    if not base or not base.get("price_cny"):
        return None
    url = base.get("url") or row.get("itemUrl") or ""
    item_id = str(row.get("itemId") or row.get("id") or parse_link(url).item_id or "").strip()
    if not item_id.isdigit():
        return None
    return {
        "id": item_id, "title_ru": "", "title_zh": base["title"][:160], "brand": "", "article": "",
        "price_cny": base["price_cny"], "price_cny_max": None, "sizes": [],
        "images": [u for u in base.get("images", []) if isinstance(u, str)][:8],
        "url": url or f"https://item.taobao.com/item.htm?id={item_id}", "poizon_url": "", "poizon_rub_min": None,
        "fit_advice": "", "category": "", "shop": base.get("shop", ""), "sold": 0,
    }


NORMALIZE = {"poizon": poizon_item, "taobao": taobao_item}


# ---------- Перевод (DeepSeek или другая модель чата) ----------

def _translate(lines: list[str], instruction: str) -> list[str]:
    """Перевести список строк. Модель недоступна или ошиблась — возвращаем как было."""
    from assistant import llm
    from assistant.services import _json_from_text

    if not lines or not llm.enabled():
        return lines
    out = list(lines)
    for start in range(0, len(lines), 25):
        batch = lines[start:start + 25]
        prompt = (f"{instruction} Верни только JSON {{\"items\": [...]}} — столько же строк и в том же порядке.\n"
                  + "\n".join(f"{i + 1}. {text[:200]}" for i, text in enumerate(batch)))
        try:
            reply = llm.chat([{"role": "user", "content": prompt}], max_tokens=60 * len(batch) + 200, temperature=0.1)
        except (llm.LLMError, llm.LLMUnavailable):
            continue
        items = _json_from_text(reply.content).get("items")
        if isinstance(items, list) and len(items) == len(batch):
            for i, text in enumerate(items):
                if isinstance(text, str) and text.strip():
                    out[start + i] = text.strip()[:160]
    return out


def titles_to_russian(titles: list[str]) -> list[str]:
    return _translate(titles, "Переведи названия товаров с китайского на русский, как на маркетплейсе: бренд и модель "
                              "латиницей как есть, тип товара и главное свойство по-русски, до 80 символов.")


def queries_to_chinese(queries: list[str]) -> list[str]:
    return _translate(queries, "Переведи поисковые запросы для Taobao на китайский. Бренды оставь латиницей.")


# ---------- Фото ----------

def _image_host_ok(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(host == h or host.endswith(f".{h}") for h in IMAGE_HOSTS)


def download_images(urls: list[str], name: str, limit: int = IMAGES_PER_PRODUCT) -> list:
    files = []
    with _client(timeout=20, follow_redirects=False) as client:
        for url in urls:
            if len(files) >= limit:
                break
            if not _image_host_ok(url):
                continue
            try:
                response = client.get(url)
            except httpx.HTTPError:
                continue
            if response.status_code != 200 or not response.headers.get("content-type", "").startswith("image/") \
                    or len(response.content) > MAX_IMAGE:
                continue
            try:
                files.append(prepare_image(response.content, f"{name}-{len(files) + 1}"))
            except ImageError:
                continue
    return files


# ---------- Товары ----------

def market_supplier(source: str) -> Supplier:
    name, about = SUPPLIERS[source]
    supplier, _ = Supplier.objects.get_or_create(code=source, defaults={"name": name, "about": about})
    return supplier


def _size_grid(item: dict) -> str:
    text = f"{item.get('category', '')} {item.get('title_ru', '')}".lower()
    if any(word in text for word in ("кроссовк", "кед", "ботин", "обув", "туфл", "сапог", "сланц", "鞋")):
        return Product.SizeGrid.SHOES
    return Product.SizeGrid.CLOTHES if item.get("sizes") else Product.SizeGrid.NONE


def market_data(source: str, item: dict) -> dict:
    return {
        "source": source, "url": item["url"], "poizon_url": item.get("poizon_url", ""),
        "price_cny_max": item.get("price_cny_max"), "poizon_rub_min": item.get("poizon_rub_min"),
        "sizes": item.get("sizes", []), "fit_advice": item.get("fit_advice", ""), "brand": item.get("brand", ""),
        "article": item.get("article", ""), "shop": item.get("shop", ""),
        "synced_at": timezone.now().isoformat(timespec="minutes"),
    }


def _cache_for_link(source: str, item: dict):
    """Тот же товар в кэше «цены по ссылке»: форма заказа не будет платно спрашивать Apify ещё раз."""
    from links.models import MarketplaceItem

    MarketplaceItem.objects.update_or_create(code=source, item_id=item["id"], defaults={"found": True, "data": {
        "title": item.get("title_ru") or item.get("title_zh", ""), "brand": item.get("brand", ""),
        "article": item.get("article", ""), "price_cny": item["price_cny"],
        "price_cny_max": item.get("price_cny_max"), "sizes": [s["size"] for s in item.get("sizes", [])],
        "size_prices": {}, "images": item.get("images", [])[:6]}})


def _apply(product: Product, source: str, item: dict):
    product.price_cny = Decimal(str(item["price_cny"]))
    product.market = market_data(source, item)
    product.sizes = ", ".join(s["size"] for s in item.get("sizes", []))[:300]
    product.source_url = item["url"][:500]
    if item.get("sold"):
        product.sold_count = item["sold"]


def save_item(source: str, item: dict, category: Category, publish: bool) -> str:
    """Создать или обновить товар. Возвращает «created» или «updated»."""
    from links.services import category_weight

    supplier = market_supplier(source)
    product = Product.objects.filter(supplier=supplier, sku=item["id"]).first()
    _cache_for_link(source, item)
    if product is not None:
        _apply(product, source, item)
        if product.moderation_note == GONE_NOTE:  # снова в продаже
            product.moderation_note = ""
            product.status = Product.Status.PUBLISHED
        product.save()
        return "updated"
    title = (item.get("title_ru") or item.get("title_zh") or f"Товар {item['id']}")[:160]
    product = Product(supplier=supplier, category=category, sku=item["id"], slug=unique_slug(supplier, item["id"]),
                      title_ru=title, title_zh=item.get("title_zh", "")[:160],
                      weight_kg=category_weight(category) or Decimal("1.0"), size_grid=_size_grid(item),
                      is_new=True, status=Product.Status.PUBLISHED if publish else Product.Status.DRAFT)
    _apply(product, source, item)
    images = download_images(item.get("images", []), f"{source}-{item['id']}")
    with transaction.atomic():
        product.save()
        for position, image in enumerate(images):
            ProductImage.objects.create(product=product, image=image, position=position)
    return "created"


def run_import(job: MarketImport) -> MarketImport:
    job.status, job.log = MarketImport.Status.RUNNING, ""
    job.save(update_fields=["status", "log"])
    lines = []
    try:
        queries = job.query_list
        if not queries:
            raise MarketError("Нет запросов")
        if job.source == MarketImport.Source.POIZON:
            rows = run_actor(ACTORS["poizon"], {"queries": queries, "maxResultsPerQuery": job.per_query})
        else:
            keywords = queries_to_chinese(queries)
            lines.append("Запросы для Taobao: " + "; ".join(keywords))
            rows = run_actor(ACTORS["taobao"], {"mode": "search", "keywords": keywords,
                                                 "maxItems": job.per_query * len(keywords)})
        items, seen = [], set()
        for row in rows:
            item = NORMALIZE[job.source](row)
            if item is None or item["id"] in seen:
                job.skipped += 1
                continue
            seen.add(item["id"])
            items.append(item)
        need = [i for i in items if not i["title_ru"] and i["title_zh"]]
        for item, title in zip(need, titles_to_russian([i["title_zh"] for i in need]), strict=True):
            item["title_ru"] = title
        for item in items:
            try:
                result = save_item(job.source, item, job.category, job.publish)
            except (InvalidOperation, ValueError) as exc:
                job.skipped += 1
                lines.append(f"{item['id']}: пропущен ({exc})")
                continue
            if result == "created":
                job.created += 1
            else:
                job.updated += 1
        job.status = MarketImport.Status.DONE
        lines.append(f"Нашли {len(rows)}, новых {job.created}, обновили {job.updated}, пропустили {job.skipped}.")
    except MarketError as exc:
        job.status = MarketImport.Status.FAILED
        lines.append(str(exc))
    job.log = "\n".join(lines)[:5000]
    job.finished_at = timezone.now()
    job.save()
    return job


def refresh_prices(source: str, chunk: int = 100) -> dict:
    """Обновить цены товаров площадки. Нет в продаже — скрыть, снова появился — вернуть."""
    counts = {"updated": 0, "hidden": 0}
    if not enabled():
        return counts
    products = {p.sku: p for p in Product.objects.filter(supplier__code=source, market__source=source)
                .exclude(status=Product.Status.REJECTED)}
    ids = list(products)
    for start in range(0, len(ids), chunk):
        batch = ids[start:start + chunk]
        payload = ({"queries": batch, "maxResultsPerQuery": 1} if source == "poizon"
                   else {"mode": "item", "itemUrls": batch, "maxItems": len(batch)})
        try:
            rows = run_actor(ACTORS[source], payload)
        except MarketError:
            continue  # попробуем на следующей неделе
        found = {}
        for row in rows:
            item = NORMALIZE[source](row)
            if item:
                found[item["id"]] = item
        for sku in batch:
            product = products[sku]
            if sku in found:
                save_item(source, found[sku], product.category, publish=False)
                counts["updated"] += 1
            elif product.status == Product.Status.PUBLISHED:
                product.status, product.moderation_note = Product.Status.DRAFT, GONE_NOTE
                product.save(update_fields=["status", "moderation_note", "updated_at"])
                counts["hidden"] += 1
    return counts
