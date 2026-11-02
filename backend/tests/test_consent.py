from io import BytesIO

from django.test import Client
from PIL import Image

from accounts.models import User
from links.models import LinkRequest
from orders.models import Order
from tests.conftest import make_product
from tests.test_telegram import site_client, widget


def jpeg():
    buffer = BytesIO()
    Image.new("RGB", (400, 300), "white").save(buffer, "JPEG")
    buffer.seek(0)
    buffer.name = "screen.jpg"
    return buffer


def test_order_needs_consent_and_stores_when(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    client = Client()
    body = {"items": [{"product": "hoodie"}], "contact": "@anna"}
    resp = client.post("/api/orders", body, content_type="application/json")
    assert resp.status_code == 422 and "согласие" in resp.json()["detail"]
    assert not Order.objects.exists()
    ok = client.post("/api/orders", {**body, "consent": True}, content_type="application/json")
    assert ok.status_code == 201
    assert Order.objects.get().pd_consent_at is not None


def test_link_order_and_request_need_consent(pricing_setup):
    client = Client()
    order = {"text": "https://m.dewu.com/x?spuId=42", "price_cny": "601", "contact": "@b"}
    assert client.post("/api/link/order", order).status_code == 422
    assert client.post("/api/link/requests", {"text": "https://item.taobao.com/item.htm?id=1", "contact": "@b"}
                       ).status_code == 422
    assert not Order.objects.exists() and not LinkRequest.objects.exists()
    assert client.post("/api/link/order", {**order, "consent": "true"}).status_code == 201
    assert Order.objects.get().pd_consent_at is not None


def test_photo_to_manager_needs_consent(settings, pricing_setup):
    settings.YANDEX_API_KEY = ""  # ИИ выключен: фото уходит менеджеру, а с ним и контакт
    client = Client()
    resp = client.post("/api/link/photo", {"photo": jpeg(), "contact": "@b"})
    assert resp.status_code == 422 and not LinkRequest.objects.exists()
    ok = client.post("/api/link/photo", {"photo": jpeg(), "contact": "@b", "consent": "true"}).json()
    assert LinkRequest.objects.get(pk=ok["request_id"]).pd_consent_at is not None
    # Без контакта персональных данных нет — согласие не спрашиваем.
    assert client.post("/api/link/photo", {"photo": jpeg()}).status_code == 200


def test_telegram_login_needs_consent(db, settings):
    settings.TELEGRAM_BOT_TOKEN = "123456:TEST-bot-token"
    client, csrf = site_client()
    data = widget()
    data.pop("consent")
    resp = client.post("/api/auth/telegram", data, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
    assert resp.status_code == 422 and not User.objects.exists()
    ok = client.post("/api/auth/telegram", widget(), content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
    assert ok.status_code == 200 and User.objects.get(telegram_id=777).pd_consent_at is not None
