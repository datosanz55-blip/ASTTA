from decimal import Decimal

from django.shortcuts import get_object_or_404
from ninja import Router, Schema
from ninja.errors import HttpError

from catalog.models import Product
from pricing.models import ShippingMethod
from pricing.services import PricingError, current_rate, quote

router = Router(tags=["Цены"])


class ShippingOut(Schema):
    code: str
    name: str
    rub_per_kg: Decimal
    days_min: int
    days_max: int
    for_bulky_only: bool
    is_default: bool


class QuoteOut(Schema):
    mode: str
    qty: int
    unit_cny: Decimal
    rate: Decimal
    shipping: ShippingOut
    goods_rub: Decimal
    delivery_rub: Decimal
    fee_rub: Decimal
    fee_percent: Decimal
    total_rub: Decimal
    each_rub: Decimal


def quote_out(q) -> dict:
    return {
        "mode": q.mode, "qty": q.qty, "unit_cny": q.unit_cny, "rate": q.rate, "shipping": q.shipping,
        "goods_rub": q.goods_rub.quantize(Decimal("0.01")),
        "delivery_rub": q.delivery_rub.quantize(Decimal("0.01")),
        "fee_rub": q.fee_rub.quantize(Decimal("0.01")),
        "fee_percent": (q.fee_share * 100).quantize(Decimal("0.01")),
        "total_rub": q.total_rub, "each_rub": q.each_rub,
    }


@router.get("/rate", summary="Курс юаня для покупателя")
def rate(request):
    try:
        return {"currency": "CNY", "rub_per_unit": current_rate()}
    except PricingError as exc:
        raise HttpError(503, str(exc)) from exc


@router.get("/shipping", response=list[ShippingOut], summary="Способы доставки")
def shipping(request):
    return ShippingMethod.objects.filter(is_active=True)


@router.get("/quote", response=QuoteOut, summary="Цена под ключ с расшифровкой")
def get_quote(request, product: str, qty: int = 1, mode: str = "retail", shipping: str | None = None):
    item = get_object_or_404(Product.objects.prefetch_related("tiers"), slug=product,
                             status=Product.Status.PUBLISHED)
    try:
        return quote_out(quote(item, qty=qty, mode=mode, shipping=shipping))
    except PricingError as exc:
        raise HttpError(400, str(exc)) from exc


@router.get("/site", summary="Настройки для сайта одним запросом: курс, доставка, сборы, вход и ИИ")
def site(request):
    from django.conf import settings

    from assistant import llm, yandex
    from links import apify
    from pricing.models import PricingConfig

    config = PricingConfig.load()
    try:
        rate_value = current_rate(config=config)
    except PricingError:
        rate_value = None  # курса нет: сайт покажет каталог без цен в рублях
    return {
        "rate": rate_value,
        "retail_fee": config.retail_fee,
        "wholesale_fee": config.wholesale_fee,
        "link_rate": config.link_rate,
        "link_delivery_rub": config.link_delivery_rub,
        "shipping": [ShippingOut.from_orm(m).dict() for m in ShippingMethod.objects.filter(is_active=True)],
        "telegram_bot": settings.TELEGRAM_BOT_USERNAME if settings.TELEGRAM_BOT_TOKEN else "",
        "ai": yandex.enabled(),
        "chat": llm.enabled(),
        "market": apify.enabled(),
    }
