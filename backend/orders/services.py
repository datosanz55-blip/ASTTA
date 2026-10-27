from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction

from catalog.models import Product
from orders.models import Order, OrderEvent, OrderItem
from pricing.services import PricingContext, PricingError, quote, round10


@dataclass
class CartLine:
    product: str  # slug
    qty: int
    size: str = ""


class OrderError(Exception):
    pass


def create_order(lines: list[CartLine], contact: str, mode: str = "retail", shipping: str | None = None,
                 name: str = "", comment: str = "", buyer=None) -> Order:
    if not lines:
        raise OrderError("Корзина пуста")
    if not contact.strip():
        raise OrderError("Укажите телефон или Telegram")
    slugs = {line.product for line in lines}
    products = {p.slug: p for p in Product.objects.filter(slug__in=slugs, status=Product.Status.PUBLISHED)
                .prefetch_related("tiers")}
    missing = slugs - products.keys()
    if missing:
        raise OrderError(f"Товары недоступны: {', '.join(sorted(missing))}")

    try:
        ctx = PricingContext()
        quotes = [(line, quote(products[line.product], qty=line.qty, mode=mode, shipping=shipping, ctx=ctx))
                  for line in lines]
    except PricingError as exc:
        raise OrderError(str(exc)) from exc

    with transaction.atomic():
        order = Order.objects.create(
            contact=contact.strip(), name=name.strip(), comment=comment.strip(), mode=mode, buyer=buyer,
            rate=ctx.rate, total_rub=Decimal("0"),
        )
        total = Decimal("0")
        for line, q in quotes:
            OrderItem.objects.create(
                order=order, product=products[line.product], title=products[line.product].title_ru,
                size=line.size, qty=line.qty, unit_cny=q.unit_cny, shipping_code=q.shipping.code,
                goods_rub=q.goods_rub.quantize(Decimal("0.01")),
                delivery_rub=q.delivery_rub.quantize(Decimal("0.01")),
                fee_rub=q.fee_rub.quantize(Decimal("0.01")), total_rub=q.total_rub,
            )
            total += q.goods_rub + q.delivery_rub + q.fee_rub
        order.total_rub = round10(total).quantize(Decimal("0.01"))
        order.save(update_fields=["total_rub"])
        OrderEvent.objects.create(order=order, status=Order.Status.NEW,
                                  note="Заказ принят. Агент проверит наличие и размер, платить после подтверждения.")
    return order


def set_status(order: Order, status: str, note: str = "", photo=None, weight_kg=None, author=None) -> OrderEvent:
    with transaction.atomic():
        order.status = status
        order.save(update_fields=["status", "updated_at"])
        return OrderEvent.objects.create(order=order, status=status, note=note, photo=photo or "",
                                         weight_kg=weight_kg, author=author)
