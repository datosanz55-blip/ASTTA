import datetime as dt
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from django.test import Client
from django.utils import timezone

from accounts.models import User
from accounts.roles import setup_roles
from orders.models import Order, SupplierOrder
from orders.services import (
    CartLine,
    OrderError,
    SupplierOrderError,
    cancel_expired_unpaid,
    create_order,
    mark_ordered,
    mark_paid,
    mark_received,
    purchase_for,
    supplier_action,
)
from tests.conftest import make_product


@pytest.fixture
def hoodie(supplier, shoes, pricing_setup):
    return make_product(supplier, shoes, "hoodie", 80, "0.7", [(10, 70)], title_ru="Худи", title_zh="卫衣",
                        sizes="S, M, L", colors="чёрный, белый", source_url="https://detail.1688.com/offer/5.html")


@pytest.fixture
def slippers(other_supplier, shoes, pricing_setup):
    return make_product(other_supplier, shoes, "slippers", 20, "0.3", [], title_ru="Тапки")


def test_size_and_color_only_from_product_lists(hoodie):
    with pytest.raises(OrderError, match="выберите размер"):
        create_order([CartLine("hoodie", 1, "", "чёрный")], contact="@b")
    with pytest.raises(OrderError, match="размер «XXL» нет, есть S, M, L"):
        create_order([CartLine("hoodie", 1, "XXL", "чёрный")], contact="@b")
    with pytest.raises(OrderError, match="цвет «зелёный» нет"):
        create_order([CartLine("hoodie", 1, "M", "зелёный")], contact="@b")
    with pytest.raises(OrderError, match="количество"):
        create_order([CartLine("hoodie", 0, "M", "чёрный")], contact="@b")
    order = create_order([CartLine("hoodie", 1, "m", "Чёрный"), CartLine("hoodie", 2, "M", "чёрный")], contact="@b")
    item = order.items.get()  # одинаковые строки корзины сложены в одну
    assert (item.size, item.color, item.qty) == ("M", "чёрный", 3)


def test_order_waits_for_payment_then_goes_to_supplier(hoodie, slippers):
    order = create_order([CartLine("hoodie", 1, "M", "белый"), CartLine("slippers", 2)], contact="@b")
    assert order.status == Order.Status.AWAITING_PAYMENT
    assert set(order.supplier_orders.values_list("status", flat=True)) == {SupplierOrder.Status.PENDING}
    assert purchase_for(hoodie.supplier).lines == []  # до оплаты заказывать нечего

    mark_paid(order)
    order.refresh_from_db()
    assert order.status == Order.Status.PAID and order.paid_at
    assert set(order.supplier_orders.values_list("status", flat=True)) == {SupplierOrder.Status.TO_ORDER}
    with pytest.raises(OrderError):
        mark_paid(order)


def test_purchase_groups_same_items_and_writes_chinese_message(hoodie):
    first = create_order([CartLine("hoodie", 1, "M", "чёрный")], contact="@a")
    second = create_order([CartLine("hoodie", 2, "M", "чёрный"), CartLine("hoodie", 1, "L", "белый")], contact="@b")
    for order in (first, second):
        mark_paid(order)
    purchase = purchase_for(hoodie.supplier)
    assert [(line.size, line.color, line.qty) for line in purchase.lines] == [("M", "чёрный", 3), ("L", "белый", 1)]
    assert (purchase.total_qty, purchase.total_cny) == (4, Decimal("320"))
    text = purchase.text_zh
    assert "卫衣（货号 HOODIE · 颜色 黑色（чёрный） · 尺码 M） × 3 件，单价 80 元" in text
    assert "合计 4 件，320 元" in text
    assert "https://detail.1688.com/offer/5.html" in text
    assert first.number in text and second.number in text

    assert mark_ordered(hoodie.supplier, [so.pk for so in purchase.orders]) == 2
    first.refresh_from_db()
    assert first.status == Order.Status.PURCHASED  # единственный поставщик заказа выкупил всё
    assert purchase_for(hoodie.supplier).lines == []


def test_out_of_stock_refunds_part_and_cancels_when_nothing_left(hoodie, slippers):
    order = create_order([CartLine("hoodie", 1, "S", "чёрный"), CartLine("slippers", 1)], contact="@b")
    mark_paid(order)
    hoodie_part = order.supplier_orders.get(supplier=hoodie.supplier)
    slippers_part = order.supplier_orders.get(supplier=slippers.supplier)

    supplier_action(slippers_part, "cancel")
    order.refresh_from_db()
    slippers_total = order.items.get(product=slippers).total_rub
    assert order.refund_rub == slippers_total
    assert order.status == Order.Status.PAID
    assert order.events.filter(note__contains=f"вернём {slippers_total:.0f} ₽").exists()

    supplier_action(hoodie_part, "confirm")
    order.refresh_from_db()
    assert order.status == Order.Status.PURCHASED  # отменённая часть не мешает двигать заказ дальше
    supplier_action(hoodie_part, "cancel")
    order.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert order.refund_rub <= order.total_rub


def test_shipping_and_warehouse_move_order_forward(hoodie):
    order = create_order([CartLine("hoodie", 1, "L", "белый")], contact="@b")
    so = order.supplier_orders.get()
    with pytest.raises(SupplierOrderError):
        supplier_action(so, "confirm")  # не оплачен — заказывать у поставщика нельзя
    mark_paid(order)
    supplier_action(so, "confirm")
    with pytest.raises(SupplierOrderError, match="трек"):
        supplier_action(so, "ship", " ")
    supplier_action(so, "ship", "SF123")
    mark_received(so)
    order.refresh_from_db()
    assert order.status == Order.Status.AT_WAREHOUSE


def test_unpaid_orders_cancelled_after_a_day(hoodie):
    old = create_order([CartLine("hoodie", 1, "S", "белый")], contact="@old")
    fresh = create_order([CartLine("hoodie", 1, "S", "белый")], contact="@new")
    Order.objects.filter(pk=old.pk).update(created_at=timezone.now() - dt.timedelta(hours=25))
    assert cancel_expired_unpaid() == 1
    old.refresh_from_db()
    fresh.refresh_from_db()
    assert old.status == Order.Status.CANCELLED
    assert set(old.supplier_orders.values_list("status", flat=True)) == {SupplierOrder.Status.CANCELLED}
    assert fresh.status == Order.Status.AWAITING_PAYMENT


@pytest.fixture
def moderator_client(db):
    setup_roles()
    user = User.objects.create_user("mod", password="pw-123456!", is_staff=True)
    user.groups.add(Group.objects.get(name="Модераторы"))
    client = Client()
    client.force_login(user)
    return client


def test_admin_marks_paid_and_purchase_page(moderator_client, hoodie):
    order = create_order([CartLine("hoodie", 2, "M", "чёрный")], contact="@b")
    resp = moderator_client.post("/admin/orders/order/", {"action": "paid", "_selected_action": [order.pk]})
    assert resp.status_code == 302
    order.refresh_from_db()
    assert order.status == Order.Status.PAID

    page = moderator_client.get("/admin/orders/supplierorder/purchase/").content.decode()
    assert "Худи" in page and "您好！ASTTA 下单" in page
    so = order.supplier_orders.get()
    resp = moderator_client.post("/admin/orders/supplierorder/purchase/",
                                 {"supplier": hoodie.supplier.pk, "orders": [so.pk]})
    assert resp.status_code == 302
    so.refresh_from_db()
    assert so.status == SupplierOrder.Status.ORDERED

    # Вписали трек в заказанную часть — она отправлена на склад.
    form = moderator_client.get(f"/admin/orders/supplierorder/{so.pk}/change/")
    assert form.status_code == 200
    moderator_client.post(f"/admin/orders/supplierorder/{so.pk}/change/", {"tracking": "YT777"})
    so.refresh_from_db()
    assert (so.status, so.tracking) == (SupplierOrder.Status.SHIPPED, "YT777")


def test_cabinet_purchase_summary(moderator_client, hoodie):
    order = create_order([CartLine("hoodie", 1, "S", "белый")], contact="@b")
    mark_paid(order)
    data = moderator_client.get("/api/seller/purchase", HTTP_X_ACT_AS="jj").json()
    assert data["total_qty"] == 1 and "卫衣" in data["text_zh"]
    resp = moderator_client.post("/api/seller/purchase/ordered", {"orders": data["orders"]},
                                 content_type="application/json", HTTP_X_ACT_AS="jj")
    assert resp.json() == {"ordered": 1}
    assert moderator_client.get("/api/seller/purchase", HTTP_X_ACT_AS="jj").json()["text_zh"] == ""
