"""Background marketplace lookup and short-lived, server-verified size quotes."""
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlencode, urlparse

from django.core import signing
from django.core.exceptions import ValidationError
from django.utils import timezone

from links import apify
from links.models import MarketLookup
from links.services import category_for_link, estimate, parse_link, resolve_link
from pricing.services import PricingError

QUOTE_TTL = 5 * 60
IMAGE_SALT = "market-image-v1"


def image_url(url):
    from catalog.market import _image_host_ok

    if isinstance(url, str) and url.startswith("//"):
        url = "https:" + url
    try:
        parsed = urlparse(url) if isinstance(url, str) else None
        if (not parsed or not _image_host_ok(url) or parsed.port not in (None, 443)
                or parsed.username or parsed.password):
            return ""
    except ValueError:
        return ""
    return "/api/link/image?" + urlencode({"token": signing.dumps(url, salt=IMAGE_SALT)})


def public_item(item):
    out = dict(item)
    out["images"] = [u for src in item.get("images", [])[:8] if (u := image_url(src))]
    return out


def start_lookup(text, size="", qty=1):
    info = parse_link(text)
    if not info.url:
        raise ValueError("Вставьте ссылку на товар")
    if not apify.supported(info.code):
        raise ValueError("Для этой площадки автоматическая проверка пока недоступна")
    if not 1 <= qty <= 10000 or len(size) > 32:
        raise ValueError("Проверьте размер и количество")
    job = MarketLookup.objects.create(url=info.url[:2000], size=size.strip(), qty=qty)
    from links.tasks import lookup_market

    try:
        lookup_market.delay(str(job.pk))
        job.refresh_from_db()
    except Exception:
        job.status, job.note = "failed", "Не удалось запустить проверку. Попробуйте ещё раз."
        job.save()
    return job


def run_lookup(job):
    job.status = "working"
    job.save(update_fields=["status", "updated_at"])
    info = resolve_link(job.url)
    job.code, job.item_id, job.url = info.code, info.item_id, info.url
    try:
        item = apify.fetch_item(info.code, info.item_id, fresh=bool(job.size))
        if not item:
            job.status, job.note = "unavailable", "Товар не найден или площадка временно не отдаёт данные."
        else:
            job.data = {"item": public_item(item)}
            job.status = "ready"
            if job.size:
                price = apify.price_for_size(item, job.size)
                if price is None:
                    job.status = "unavailable"
                    job.note = "Площадка не подтвердила цену размера. Повторите проверку или уточните у агента."
                else:
                    result = estimate(Decimal(str(price)), job.qty, info.marketplace, category_for_link(info),
                                      source=info.code)
                    job.data["quote"] = {"id": str(job.pk), "price_cny": str(result.price_cny),
                                         "total_rub": str(result.total_rub), "size": job.size, "qty": job.qty,
                                         "excludes_delivery": result.excludes_delivery,
                                         "needs_confirmation": result.needs_confirmation,
                                         "checked_at": timezone.now().isoformat(),
                                         "expires_at": (timezone.now() + timedelta(seconds=QUOTE_TTL)).isoformat()}
    except (apify.ApifyError, PricingError) as exc:
        job.status = "failed"
        # Technical provider/account errors belong in server logs, not the storefront.
        import logging

        logging.getLogger(__name__).warning("Market lookup %s: %s", job.pk, exc)
        job.note = "Не удалось получить подтверждённые данные с площадки. Повторите проверку или напишите агенту."
    job.save()
    return job


def job_out(job):
    if job.status in ("pending", "working") and job.created_at < timezone.now() - timedelta(minutes=4):
        return {"id": str(job.pk), "status": "failed",
                "note": "Проверка заняла слишком много времени. Попробуйте ещё раз."}
    quote = job.data.get("quote")
    if quote and job.updated_at < timezone.now() - timedelta(seconds=QUOTE_TTL):
        return {"id": str(job.pk), "status": "expired",
                "note": "Время действия цены истекло. Проверьте размер ещё раз.",
                "item": job.data.get("item"), "url": job.url}
    return {"id": str(job.pk), "status": job.status, "url": job.url, "note": job.note, **job.data}


def verified_quote(quote_id, info, size, qty, price, category=None):
    try:
        job = MarketLookup.objects.get(pk=quote_id, status="ready")
    except (MarketLookup.DoesNotExist, ValueError, TypeError, ValidationError):
        raise ValueError("Проверьте цену выбранного размера ещё раз") from None
    quote = job.data.get("quote")
    if not quote or job.updated_at < timezone.now() - timedelta(seconds=QUOTE_TTL):
        raise ValueError("Цена устарела. Проверьте её ещё раз")
    if (job.code, job.item_id, job.size, job.qty) != (info.code, info.item_id, size.strip(), qty):
        raise ValueError("Вариант товара изменился. Проверьте цену ещё раз")
    confirmed = Decimal(quote["price_cny"])
    if price is not None and price != confirmed:
        raise ValueError("Цена изменилась. Проверьте выбранный размер ещё раз")
    try:
        current = estimate(confirmed, qty, info.marketplace, category or category_for_link(info), source=info.code)
    except PricingError:
        raise ValueError("Расчёт временно недоступен. Попробуйте ещё раз") from None
    if current.needs_confirmation:
        raise ValueError("Согласуйте стоимость товара с менеджером.")
    if current.total_rub != Decimal(quote["total_rub"]):
        raise ValueError("Курс или стоимость доставки изменились. Проверьте цену ещё раз")
    return confirmed
