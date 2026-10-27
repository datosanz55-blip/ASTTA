from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from catalog.models import Product
from orders.models import Order, OrderEvent, OrderItem, Payout, SupplierOrder
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
        # У каждого поставщика своя часть заказа: он видит только свои товары.
        supplier_orders = {}
        for line, q in quotes:
            product = products[line.product]
            if product.supplier_id not in supplier_orders:
                supplier_orders[product.supplier_id] = SupplierOrder.objects.create(order=order,
                                                                                    supplier_id=product.supplier_id)
            OrderItem.objects.create(
                order=order, supplier_order=supplier_orders[product.supplier_id], product=product,
                title=product.title_ru,
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


class SupplierOrderError(Exception):
    pass


# Какие переходы может сделать поставщик и какие агент на складе.
SUPPLIER_TRANSITIONS = {
    "confirm": (SupplierOrder.Status.CONFIRM, SupplierOrder.Status.SHIP),
    "cancel": (SupplierOrder.Status.CONFIRM, SupplierOrder.Status.CANCELLED),
    "ship": (SupplierOrder.Status.SHIP, SupplierOrder.Status.SHIPPED),
}


def supplier_action(so: SupplierOrder, action: str, tracking: str = "") -> SupplierOrder:
    if action not in SUPPLIER_TRANSITIONS:
        raise SupplierOrderError(f"Неизвестное действие {action}")
    expected, target = SUPPLIER_TRANSITIONS[action]
    if so.status != expected:
        raise SupplierOrderError(f"Заказ уже в статусе «{so.get_status_display()}»")
    tracking = tracking.strip()
    if action == "ship" and not tracking:
        raise SupplierOrderError("Укажите трек-номер / 请填写快递单号")
    with transaction.atomic():
        so.status = target
        if tracking:
            so.tracking = tracking[:64]
        so.save(update_fields=["status", "tracking", "updated_at"])
        notes = {
            "confirm": f"{so.supplier}: товар в наличии",
            "cancel": f"{so.supplier}: нет в наличии",
            "ship": f"{so.supplier}: отправлено на склад TT, трек {so.tracking}",
        }
        # Это заметка для агента, статус для покупателя агент меняет сам.
        OrderEvent.objects.create(order=so.order, status=so.order.status, note=notes[action])
    return so


def mark_received(so: SupplierOrder) -> SupplierOrder:
    """Склад TT принял посылку поставщика: сумма попадает в ближайшую выплату."""
    if so.status not in (SupplierOrder.Status.SHIP, SupplierOrder.Status.SHIPPED):
        raise SupplierOrderError(f"Заказ в статусе «{so.get_status_display()}», принять нельзя")
    so.status = SupplierOrder.Status.RECEIVED
    so.received_at = timezone.now()
    so.save(update_fields=["status", "received_at", "updated_at"])
    return so


def unpaid_received(supplier):
    return SupplierOrder.objects.filter(supplier=supplier, status=SupplierOrder.Status.RECEIVED, payout__isnull=True)


def create_payouts() -> list[Payout]:
    """Собрать выплату каждому поставщику за принятые складом и ещё не оплаченные заказы."""
    payouts = []
    with transaction.atomic():
        pending = (SupplierOrder.objects.select_for_update()
                   .filter(status=SupplierOrder.Status.RECEIVED, payout__isnull=True)
                   .prefetch_related("items"))
        by_supplier = {}
        for so in pending:
            by_supplier.setdefault(so.supplier_id, []).append(so)
        for supplier_id, orders in by_supplier.items():
            amount = sum((so.amount_cny for so in orders), Decimal("0"))
            payout = Payout.objects.create(supplier_id=supplier_id, amount_cny=amount)
            SupplierOrder.objects.filter(pk__in=[so.pk for so in orders]).update(payout=payout)
            payouts.append(payout)
    return payouts
