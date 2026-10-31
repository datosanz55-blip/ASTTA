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
