from decimal import Decimal
from io import BytesIO

import pytest
from django.core.cache import cache
from django.test import Client
from PIL import Image

from accounts.models import User
from links.models import LinkRequest, Marketplace
from links.services import estimate, find_in_catalog, parse_link
from pricing.models import CommissionRule, PricingConfig
from tests.conftest import make_product


@pytest.fixture(autouse=True)
def _clear_throttle():
    cache.clear()


@pytest.mark.parametrize(("text", "code", "item_id"), [
    ("https://detail.1688.com/offer/712345678901.html?spm=a26", "1688", "712345678901"),
    ("【淘宝】https://item.taobao.com/item.htm?id=6655443322&ali_refid=x 「卫衣」", "taobao", "6655443322"),
    ("https://m.tb.cn/h.5abcDEF 点击链接", "taobao", ""),
    ("https://detail.tmall.com/item.htm?id=778899", "tmall", "778899"),
    ("https://mobile.yangkeduo.com/goods.html?goods_id=123456", "pinduoduo", "123456"),
    ("Смотри кроссы https://m.dewu.com/router/product/ProductDetail?spuId=4455667，бери", "poizon", "4455667"),
    ("https://example.com/shop/item", "other", ""),
])
def test_parse_link(text, code, item_id):
    info = parse_link(text)
    assert (info.code, info.item_id) == (code, item_id)
    assert info.url.startswith("https://")


def test_no_link():
    assert parse_link("просто текст").url == ""


def test_find_same_product_in_catalog(supplier, shoes, pricing_setup):
    product = make_product(supplier, shoes, "hoodie", 80, 0.7, [], source_url="https://detail.1688.com/offer/555.html")
    make_product(supplier, shoes, "other", 80, 0.7, [], source_url="https://item.taobao.com/item.htm?id=555")
    assert find_in_catalog(parse_link("https://m.1688.com/offer/555.html?x=1")) == product
    assert find_in_catalog(parse_link("https://detail.1688.com/offer/5555.html")) is None
    hidden = make_product(supplier, shoes, "hidden", 80, 0.7, [], status="moderation",
                          source_url="https://detail.1688.com/offer/777.html")
    assert hidden and find_in_catalog(parse_link("https://detail.1688.com/offer/777.html")) is None


def test_estimate_by_link_rate_and_flat_logistics(pricing_setup):
    # Как просили: ¥601 со скрина Poizon × 13 ₽ + 1000 ₽ логистики = 8813 → 8810 ₽.
    e = estimate(Decimal("601"), 1, Marketplace.objects.get(code="poizon"))
    assert (e.rate, e.goods_rub, e.delivery_rub, e.fee_rub) == (13, 7813, 1000, 0)
    assert e.total_rub == 8810
    assert estimate(Decimal("601"), 2).total_rub == 17630  # 15626 + 2000


def test_estimate_uses_category_weight_marketplace_and_commission(supplier, shoes, pricing_setup):
    config = PricingConfig.load()
    config.link_rate = config.link_delivery_rub = None  # пустые поля — считаем как каталог
    config.save()
    make_product(supplier, shoes, "a", 100, "1.2", [])
    make_product(supplier, shoes, "b", 100, "1.6", [])
    poizon = Marketplace.objects.get(code="poizon")
    poizon.extra_fee, poizon.china_delivery_cny = Decimal("0.04"), Decimal("15")
    poizon.save()
    CommissionRule.objects.create(category=shoes, retail_fee=Decimal("0.08"))
    e = estimate(Decimal("500"), 1, poizon, shoes)
    assert e.weight_kg == Decimal("1.40") and "средний вес" in e.weight_source
    assert e.goods_rub == Decimal("500") * Decimal("11.4")
    assert e.china_delivery_rub == Decimal("15") * Decimal("11.4")
    assert e.marketplace_fee_rub == e.goods_rub * Decimal("0.04")
    assert e.fee_rub == e.goods_rub * Decimal("0.08")
    assert e.delivery_rub == Decimal("1.40") * 420
    assert e.total_rub == 7140  # 5700 + 171 + 228 + 588 + 456 = 7143 → до 10 ₽
    assert estimate(Decimal("10"), 1).weight_source.startswith("не знаем вес")


def test_lookup_and_estimate_api(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 0.7, [], title_ru="Худи",
                 source_url="https://detail.1688.com/offer/555.html")
    client = Client()
    found = client.post("/api/link/lookup", {"text": "вот https://detail.1688.com/offer/555.html"},
                        content_type="application/json").json()
    assert found["marketplace"]["code"] == "1688" and found["product"]["slug"] == "hoodie"
    missing = client.post("/api/link/lookup", {"text": "https://item.taobao.com/item.htm?id=9"},
                          content_type="application/json").json()
    assert missing["product"] is None and missing["item_id"] == "9"
    assert client.post("/api/link/lookup", {"text": "нет ссылки"}, content_type="application/json").status_code == 422

    data = client.post("/api/link/estimate", {"price_cny": "199", "qty": 2, "marketplace": "taobao",
                                              "category": "shoes"}, content_type="application/json").json()
    assert data["total_rub"] == "7170"  # 199 × 2 × 13 + 1000 × 2 = 7174 → до 10 ₽
    bad = client.post("/api/link/estimate", {"price_cny": "0"}, content_type="application/json")
    assert bad.status_code == 422


def test_request_with_photo_creates_ticket(supplier, shoes, pricing_setup):
    buffer = BytesIO()
    Image.new("RGB", (800, 600), "white").save(buffer, "JPEG")
    buffer.seek(0)
    buffer.name = "screen.jpg"
    client = Client()
    resp = client.post("/api/link/requests", {"text": "https://m.dewu.com/x?spuId=42", "price_cny": "899",
                                              "size": "42", "contact": "@buyer", "photo": buffer})
    assert resp.status_code == 201, resp.content
    data = resp.json()
    assert data["estimate"]["total_rub"]
    ticket = LinkRequest.objects.get(pk=data["id"])
    assert (ticket.marketplace.code, ticket.item_id, ticket.size) == ("poizon", "42", "42")
    assert ticket.photo.name.endswith(".webp") and ticket.estimate_rub
    assert client.post("/api/link/requests", {"contact": "@b"}).status_code == 422
    assert client.post("/api/link/requests", {"text": "https://x.com/a", "contact": " "}).status_code == 422


def test_rate_limits_do_not_share_counter(supplier, shoes, pricing_setup):
    client = Client()
    for _ in range(15):
        client.post("/api/link/lookup", {"text": "https://item.taobao.com/item.htm?id=1"},
                    content_type="application/json")
    # Пятнадцать поисков по ссылке не должны закрывать вход в кабинет (лимит 10 в минуту у входа свой).
    login = client.post("/api/seller/login", {"username": "nobody", "password": "x"},
                        content_type="application/json")
    assert login.status_code == 401


def test_link_request_admin_page(supplier, shoes, pricing_setup):
    Client().post("/api/link/requests", {"text": "https://detail.1688.com/offer/9.html", "contact": "@b"})
    admin = User.objects.create_superuser("founder", password="pw-123456!")
    client = Client()
    client.force_login(admin)
    ticket = LinkRequest.objects.get()
    page = client.get(f"/admin/links/linkrequest/{ticket.pk}/change/")
    assert page.status_code == 200 and "1688" in page.content.decode()


def test_order_by_link_is_paid_like_any_order(pricing_setup, django_user_model):
    from orders.models import Order, SupplierOrder
    from orders.services import create_payouts, mark_paid, supplier_action

    client = Client()
    resp = client.post("/api/link/order", {"text": "Смотри https://m.dewu.com/x?spuId=42", "price_cny": "601",
                                           "size": "42", "contact": "@buyer"})
    assert resp.status_code == 201, resp.content
    data = resp.json()
    # Та же формула, что в расчёте: 601 × 13 + 1000 = 8813 → 8810 ₽, оплата сразу.
    assert (data["status"], data["total_rub"]) == ("awaiting_payment", "8810.00")
    assert data["items"][0]["title"] == "Товар по ссылке · Poizon" and data["items"][0]["size"] == "42"
    order = Order.objects.get(number=data["number"])
    part = order.supplier_orders.get()
    assert part.supplier is None and part.marketplace.code == "poizon" and str(part).endswith("по ссылке · Poizon")
    item = part.items.get()
    assert item.product is None and item.source_url == "https://m.dewu.com/x?spuId=42"

    admin = Client()
    admin.force_login(django_user_model.objects.create_superuser("boss", password="pw-123456!"))
    page = admin.get(f"/admin/orders/supplierorder/{part.pk}/change/").content.decode()
    assert "https://m.dewu.com/x?spuId=42" in page and "¥601" in page  # агенту видно, что и по какой цене выкупать

    mark_paid(order)
    part.refresh_from_db()
    assert part.status == SupplierOrder.Status.TO_ORDER  # агент видит задание «выкупить» в админке
    supplier_action(part, "confirm")
    supplier_action(part, "ship", "SF123")
    part.refresh_from_db()
    part.status = SupplierOrder.Status.RECEIVED
    part.save()
    assert create_payouts() == []  # на площадке платим сами, выплат поставщику нет


def test_order_by_screenshot_needs_price_and_contact(pricing_setup):
    buffer = BytesIO()
    Image.new("RGB", (800, 600), "white").save(buffer, "JPEG")
    buffer.seek(0)
    buffer.name = "screen.jpg"
    client = Client()
    resp = client.post("/api/link/order", {"price_cny": "120", "qty": 2, "contact": "+7 900", "photo": buffer,
                                           "title": "Кроссовки Nike"})
    assert resp.status_code == 201, resp.content
    data = resp.json()
    assert data["total_rub"] == "5120.00"  # 120 × 2 × 13 + 2000
    assert data["items"][0]["title"] == "Кроссовки Nike"
    assert client.post("/api/link/order", {"text": "https://x.com/a", "contact": "@b"}).status_code == 422  # нет цены
    assert client.post("/api/link/order", {"text": "https://x.com/a", "price_cny": "5", "contact": " "}
                       ).status_code == 422
    assert client.post("/api/link/order", {"price_cny": "5", "contact": "@b"}).status_code == 422  # ни ссылки, ни фото
