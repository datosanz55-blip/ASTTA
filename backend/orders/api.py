import datetime as dt
from decimal import Decimal
from uuid import UUID

from django.shortcuts import get_object_or_404
from ninja import Router, Schema, Status
from ninja.errors import HttpError

from accounts.api import buyer_contact, current_buyer, require_consent
from config.throttles import per_ip
from orders.models import Order
from orders.services import CartLine, OrderError, create_order

router = Router(tags=["Заказы"])


class LineIn(Schema):
    product: str
    qty: int = 1
    size: str = ""
    color: str = ""


class OrderIn(Schema):
    items: list[LineIn]
    contact: str = ""  # покупатель, вошедший через Telegram, может не заполнять
    name: str = ""
    comment: str = ""
    mode: str = "retail"
    shipping: str | None = None
    consent: bool = False  # согласие на обработку персональных данных


class ItemOut(Schema):
    title: str
    size: str
    color: str
    qty: int
    unit_cny: Decimal
    shipping_code: str
    total_rub: Decimal
    # Для профиля: фото покупки и ссылка на товар в каталоге (у заказа по ссылке — скриншот и адрес).
    product_slug: str | None = None
    image: str | None = None
    source_url: str = ""

    @staticmethod
    def resolve_product_slug(obj):
        return obj.product.slug if obj.product_id else None

    @staticmethod
    def resolve_image(obj, context):
        request = context["request"]
        if obj.product_id:
            first = next(iter(obj.product.images.all()), None)
            return request.build_absolute_uri(first.image.url) if first else None
        return request.build_absolute_uri(obj.photo.url) if obj.photo else None


class EventOut(Schema):
    status: str
    status_label: str
    note: str
    photo: str | None
    weight_kg: Decimal | None
    created_at: dt.datetime


class OrderOut(Schema):
    number: str
    token: UUID
    status: str
    status_label: str
    mode: str
    rate: Decimal
    total_rub: Decimal
    paid_at: dt.datetime | None
    refund_rub: Decimal
    items: list[ItemOut]
    events: list[EventOut]


def order_out(request, order: Order) -> dict:
    return {
        "number": order.number, "token": order.token, "status": order.status,
        "status_label": order.get_status_display(), "mode": order.mode, "rate": order.rate,
        "total_rub": order.total_rub, "paid_at": order.paid_at, "refund_rub": order.refund_rub,
        "items": list(order.items.select_related("product").prefetch_related("product__images")),
        "events": [{
            "status": e.status, "status_label": e.get_status_display(), "note": e.note,
            "photo": request.build_absolute_uri(e.photo.url) if e.photo else None,
            "weight_kg": e.weight_kg, "created_at": e.created_at,
        } for e in order.events.all()],
    }


@router.post("", response={201: OrderOut}, throttle=[per_ip("order", "20/h")],
             summary="Оформить заказ (оплата сразу, потом выкуп у поставщика)")
def place_order(request, payload: OrderIn):
    if payload.mode not in Order.Mode.values:
        raise HttpError(400, "mode: retail или wholesale")
    consent_at = require_consent(payload.consent)
    buyer = current_buyer(request)
    try:
        order = create_order(
            [CartLine(product=i.product, qty=i.qty, size=i.size, color=i.color) for i in payload.items],
            contact=buyer_contact(buyer, payload.contact), name=payload.name, comment=payload.comment,
            mode=payload.mode, shipping=payload.shipping, buyer=buyer,
        )
    except OrderError as exc:
        raise HttpError(400, str(exc)) from exc
    Order.objects.filter(pk=order.pk).update(pd_consent_at=consent_at)
    return Status(201, order_out(request, order))


@router.get("/{token}", response=OrderOut, throttle=[per_ip("order_track", "120/m")],
             summary="Заказ и трекинг по токену")
def get_order(request, token: UUID):
    order = get_object_or_404(Order.objects.prefetch_related("items", "events"), token=token)
    return order_out(request, order)
