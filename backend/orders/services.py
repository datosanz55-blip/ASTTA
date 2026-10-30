"""Заказ: покупатель платит сразу, после оплаты заказ сразу уходит на выкуп у поставщика.

Ход заказа:
  ждёт оплаты → оплачен (части заказа у поставщиков: «заказать») → заказано у поставщика
  → поставщик отправил на склад → склад принял → дальше статусы ведёт агент: отправлен в Россию и т. д.
Если у поставщика товара нет, его часть отменяется, а деньги за неё возвращаются покупателю.
"""

import datetime as dt
from collections import OrderedDict
from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from catalog.models import Product
from orders.models import Order, OrderEvent, OrderItem, Payout, SupplierOrder
from pricing.services import PricingContext, PricingError, quote, round10

MAX_QTY = 10_000
# Неоплаченный заказ держим сутки: дольше нельзя, курс и наличие у поставщика меняются.
UNPAID_HOURS = 24


@dataclass
class CartLine:
    product: str  # slug
    qty: int
    size: str = ""
    color: str = ""


class OrderError(Exception):
    pass


def _pick(value: str, options: list[str], what: str, title: str, max_len: int) -> str:
    """Размер и цвет — строго из списка товара, без опечаток: поставщик получит ровно то, что выбрали."""
    value = value.strip()
    if not options:
        return value[:max_len]
    for option in options:
        if option.lower() == value.lower():
            return option
    if not value:
        raise OrderError(f"{title}: выберите {what}")
    raise OrderError(f"{title}: {what} «{value}» нет, есть {', '.join(options)}")


def _merge(lines: list[CartLine]) -> list[CartLine]:
    merged: OrderedDict[tuple, CartLine] = OrderedDict()
    for line in lines:
        key = (line.product, line.size, line.color)
        if key in merged:
            merged[key].qty += line.qty
        else:
            merged[key] = CartLine(line.product, line.qty, line.size, line.color)
    return list(merged.values())


def create_order(lines: list[CartLine], contact: str, mode: str = "retail", shipping: str | None = None,
                 name: str = "", comment: str = "", buyer=None) -> Order:
    if not lines:
        raise OrderError("Корзина пуста")
    if not contact.strip():
        raise OrderError("Укажите телефон или Telegram")
    slugs = {line.product for line in lines}
    products = {p.slug: p for p in Product.objects.filter(slug__in=slugs, status=Product.Status.PUBLISHED,
                                                          supplier__is_active=True).prefetch_related("tiers")}
    missing = slugs - products.keys()
    if missing:
        raise OrderError(f"Товары недоступны: {', '.join(sorted(missing))}")

    checked = []
    for line in lines:
        product = products[line.product]
        if not 1 <= line.qty <= MAX_QTY:
            raise OrderError(f"{product.title_ru}: количество от 1 до {MAX_QTY}")
        checked.append(CartLine(line.product, line.qty,
                                _pick(line.size, product.size_list, "размер", product.title_ru, 32),
                                _pick(line.color, product.color_list, "цвет", product.title_ru, 40)))
    lines = _merge(checked)

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
        # У каждого поставщика своя часть заказа: её выкупают и везут на склад отдельно.
        supplier_orders = {}
        for line, q in quotes:
            product = products[line.product]
            if product.supplier_id not in supplier_orders:
                supplier_orders[product.supplier_id] = SupplierOrder.objects.create(order=order,
                                                                                    supplier_id=product.supplier_id)
            OrderItem.objects.create(
                order=order, supplier_order=supplier_orders[product.supplier_id], product=product,
                title=product.title_ru, size=line.size, color=line.color, qty=line.qty, unit_cny=q.unit_cny,
                shipping_code=q.shipping.code,
                goods_rub=q.goods_rub.quantize(Decimal("0.01")),
                delivery_rub=q.delivery_rub.quantize(Decimal("0.01")),
                fee_rub=q.fee_rub.quantize(Decimal("0.01")), total_rub=q.total_rub,
            )
            total += q.goods_rub + q.delivery_rub + q.fee_rub
        order.total_rub = round10(total).quantize(Decimal("0.01"))
        order.save(update_fields=["total_rub"])
        OrderEvent.objects.create(order=order, status=Order.Status.AWAITING_PAYMENT,
                                  note=f"Заказ оформлен. После оплаты сразу заказываем у поставщика. "
                                       f"Цена держится {UNPAID_HOURS} часа.")
    return order


def set_status(order: Order, status: str, note: str = "", photo=None, weight_kg=None, author=None) -> OrderEvent:
    with transaction.atomic():
        order.status = status
        order.save(update_fields=["status", "updated_at"])
        return OrderEvent.objects.create(order=order, status=status, note=note, photo=photo or "",
                                         weight_kg=weight_kg, author=author)


def mark_paid(order: Order, author=None, note: str = "") -> Order:
    """Оплата получена: части заказа сразу становятся заданиями «заказать у поставщика».
    Пока нет эквайринга, оплату отмечает команда в админке, потом её будет вызывать платёжный сервис."""
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order.pk)
        if order.status != Order.Status.AWAITING_PAYMENT:
            raise OrderError(f"Заказ {order.number} в статусе «{order.get_status_display()}», оплату не отметить")
        order.status = Order.Status.PAID
        order.paid_at = timezone.now()
        order.save(update_fields=["status", "paid_at", "updated_at"])
        order.supplier_orders.filter(status=SupplierOrder.Status.PENDING).update(status=SupplierOrder.Status.TO_ORDER)
        OrderEvent.objects.create(order=order, status=order.status, author=author,
                                  note=note or "Оплата получена, заказываем у поставщика.")
    return order


def cancel_unpaid(order: Order, note: str, author=None) -> Order:
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order.pk)
        if order.status != Order.Status.AWAITING_PAYMENT:
            raise OrderError(f"Заказ {order.number} уже оплачен или закрыт, отменить его здесь нельзя")
        order.supplier_orders.update(status=SupplierOrder.Status.CANCELLED)
        order.status = Order.Status.CANCELLED
        order.save(update_fields=["status", "updated_at"])
        OrderEvent.objects.create(order=order, status=order.status, note=note, author=author)
    return order


def cancel_expired_unpaid(now=None) -> int:
    """Фоновая задача: снимает заказы, не оплаченные за сутки."""
    border = (now or timezone.now()) - dt.timedelta(hours=UNPAID_HOURS)
    expired = Order.objects.filter(status=Order.Status.AWAITING_PAYMENT, created_at__lt=border)
    count = 0
    for order in expired:
        try:
            cancel_unpaid(order, f"Заказ не оплачен за {UNPAID_HOURS} часа и отменён. Оформите заново по новой цене.")
            count += 1
        except OrderError:
            continue  # оплатили, пока шла задача
    return count


class SupplierOrderError(Exception):
    pass


ACTIVE = (SupplierOrder.Status.TO_ORDER, SupplierOrder.Status.ORDERED, SupplierOrder.Status.SHIPPED,
          SupplierOrder.Status.RECEIVED)

# Действия команды с частью заказа у поставщика: (из каких статусов, в какой).
SUPPLIER_TRANSITIONS = {
    "confirm": ((SupplierOrder.Status.TO_ORDER,), SupplierOrder.Status.ORDERED),
    "cancel": ((SupplierOrder.Status.TO_ORDER, SupplierOrder.Status.ORDERED), SupplierOrder.Status.CANCELLED),
    "ship": ((SupplierOrder.Status.ORDERED,), SupplierOrder.Status.SHIPPED),
}


def supplier_action(so: SupplierOrder, action: str, tracking: str = "", author=None) -> SupplierOrder:
    if action not in SUPPLIER_TRANSITIONS:
        raise SupplierOrderError(f"Неизвестное действие {action}")
    allowed, target = SUPPLIER_TRANSITIONS[action]
    tracking = tracking.strip()
    if action == "ship" and not tracking:
        raise SupplierOrderError("Укажите трек-номер / 请填写快递单号")
    with transaction.atomic():
        so = SupplierOrder.objects.select_for_update().select_related("order", "supplier").get(pk=so.pk)
        if so.status not in allowed:
            raise SupplierOrderError(f"Заказ уже в статусе «{so.get_status_display()}»")
        so.status = target
        if tracking:
            so.tracking = tracking[:64]
        so.save(update_fields=["status", "tracking", "updated_at"])
        order = so.order
        if action == "cancel":
            refund = sum((item.total_rub for item in so.items.all()), Decimal("0"))
            refund = min(refund, order.total_rub - order.refund_rub)
            order.refund_rub += refund
            order.save(update_fields=["refund_rub", "updated_at"])
            note = f"{so.supplier}: нет в наличии, вернём {refund:.0f} ₽"
        elif action == "confirm":
            note = f"{so.supplier}: заказано у поставщика"
        else:
            note = f"{so.supplier}: отправлено на склад TT, трек {so.tracking}"
        OrderEvent.objects.create(order=order, status=order.status, note=note, author=author)
        _advance(order, author)
    return so


def mark_received(so: SupplierOrder, author=None) -> SupplierOrder:
    """Склад TT принял посылку поставщика: сумма попадает в ближайшую выплату."""
    with transaction.atomic():
        so = SupplierOrder.objects.select_for_update().select_related("order").get(pk=so.pk)
        if so.status not in (SupplierOrder.Status.ORDERED, SupplierOrder.Status.SHIPPED):
            raise SupplierOrderError(f"Заказ в статусе «{so.get_status_display()}», принять нельзя")
        so.status = SupplierOrder.Status.RECEIVED
        so.received_at = timezone.now()
        so.save(update_fields=["status", "received_at", "updated_at"])
        _advance(so.order, author)
    return so


def _advance(order: Order, author=None):
    """Двигаем статус для покупателя сам, когда все части заказа дошли до следующего шага."""
    statuses = set(order.supplier_orders.values_list("status", flat=True))
    active = statuses - {SupplierOrder.Status.CANCELLED}
    if not active:
        if order.status not in (Order.Status.CANCELLED, Order.Status.DELIVERED):
            set_status(order, Order.Status.CANCELLED, f"Товара нет в наличии, вернём {order.refund_rub:.0f} ₽",
                       author=author)
        return
    if order.status == Order.Status.PAID and active <= {SupplierOrder.Status.ORDERED, SupplierOrder.Status.SHIPPED,
                                                        SupplierOrder.Status.RECEIVED}:
        set_status(order, Order.Status.PURCHASED, "Все товары выкуплены у поставщиков", author=author)
    if order.status == Order.Status.PURCHASED and active == {SupplierOrder.Status.RECEIVED}:
        set_status(order, Order.Status.AT_WAREHOUSE, "Все товары на складе TT в Китае", author=author)


# Цвета в карточках пишем по-русски, а поставщику в Китае нужны китайские названия.
COLORS_ZH = {
    "чёрный": "黑色", "черный": "黑色", "белый": "白色", "серый": "灰色", "светло-серый": "浅灰色",
    "тёмно-серый": "深灰色", "темно-серый": "深灰色", "красный": "红色", "бордовый": "酒红色", "розовый": "粉色",
    "оранжевый": "橙色", "жёлтый": "黄色", "желтый": "黄色", "зелёный": "绿色", "зеленый": "绿色",
    "хаки": "卡其色", "оливковый": "橄榄绿", "голубой": "浅蓝色", "синий": "蓝色", "тёмно-синий": "藏青色",
    "темно-синий": "藏青色", "фиолетовый": "紫色", "коричневый": "棕色", "бежевый": "米色", "молочный": "米白色",
    "золотой": "金色", "серебряный": "银色", "прозрачный": "透明",
}


def color_zh(color: str) -> str:
    zh = COLORS_ZH.get(color.strip().lower())
    return f"{zh}（{color}）" if zh else color


def money(value: Decimal) -> str:
    """89.00 → 89, 89.50 → 89.5: поставщику так привычнее."""
    return format(value.normalize(), "f")


@dataclass
class PurchaseLine:
    product_id: int
    title: str
    title_zh: str
    sku: str
    size: str
    color: str
    qty: int
    unit_cny: Decimal
    source_url: str

    @property
    def sum_cny(self):
        return self.unit_cny * self.qty


@dataclass
class Purchase:
    """Что заказать у поставщика по всем оплаченным заказам: одинаковые товары складываем в одну строку."""

    supplier: object
    lines: list[PurchaseLine]
    orders: list[SupplierOrder]

    @property
    def total_qty(self):
        return sum(line.qty for line in self.lines)

    @property
    def total_cny(self):
        return sum((line.sum_cny for line in self.lines), Decimal("0"))

    @property
    def text_zh(self) -> str:
        """Сообщение поставщику в WeChat на китайском: что, сколько и какие номера написать на коробке."""
        rows = ["您好！ASTTA 下单："]
        for n, line in enumerate(self.lines, start=1):
            name = line.title_zh or line.title
            details = " · ".join(filter(None, [
                f"货号 {line.sku}" if line.sku else "", f"颜色 {color_zh(line.color)}" if line.color else "",
                f"尺码 {line.size}" if line.size else "",
            ]))
            details = f"（{details}）" if details else ""
            rows.append(f"{n}. {name}{details} × {line.qty} 件，单价 {money(line.unit_cny)} 元")
            if line.source_url:
                rows.append(f"   {line.source_url}")
        numbers = ", ".join(so.order.number for so in self.orders)
        rows.append(f"合计 {self.total_qty} 件，{money(self.total_cny)} 元。")
        rows.append(f"请确认有货并发往 TT 仓库，包裹上请写订单号：{numbers}。谢谢！")
        return "\n".join(rows)


def purchase_for(supplier) -> Purchase:
    orders = list(SupplierOrder.objects.filter(supplier=supplier, status=SupplierOrder.Status.TO_ORDER)
                  .select_related("order").prefetch_related("items__product").order_by("created_at"))
    lines: OrderedDict[tuple, PurchaseLine] = OrderedDict()
    for so in orders:
        for item in so.items.all():
            key = (item.product_id, item.size, item.color, item.unit_cny)
            if key in lines:
                lines[key].qty += item.qty
            else:
                product = item.product
                lines[key] = PurchaseLine(product.pk, item.title, product.title_zh, product.sku, item.size,
                                          item.color, item.qty, item.unit_cny, product.source_url)
    return Purchase(supplier, list(lines.values()), orders)


def mark_ordered(supplier, order_ids, author=None) -> int:
    """Команда отправила поставщику сводный заказ: все эти части заказов становятся «заказано»."""
    done = 0
    for so in SupplierOrder.objects.filter(supplier=supplier, pk__in=order_ids, status=SupplierOrder.Status.TO_ORDER):
        try:
            supplier_action(so, "confirm", author=author)
            done += 1
        except SupplierOrderError:
            continue
    return done


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
