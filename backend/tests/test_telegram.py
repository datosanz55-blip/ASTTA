import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest
from django.test import Client

from accounts.models import User
from orders.models import Order
from tests.conftest import make_product

TOKEN = "123456:TEST-bot-token"


@pytest.fixture(autouse=True)
def bot(settings):
    settings.TELEGRAM_BOT_TOKEN = TOKEN
    settings.TELEGRAM_BOT_USERNAME = "astta_bot"


def widget(user_id=777, auth_date=None, token=TOKEN, **extra):
    """Данные, которые присылает виджет «Войти через Telegram», подписанные как это делает Telegram."""
    data = {"id": user_id, "first_name": "Анна", "username": "anna_v", "auth_date": auth_date or int(time.time()),
            **extra}
    check = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    data["hash"] = hmac.new(hashlib.sha256(token.encode()).digest(), check.encode(), hashlib.sha256).hexdigest()
    data["consent"] = True  # галочка согласия на сайте, Telegram её не подписывает
    return data


def init_data(user_id=888, auth_date=None, token=TOKEN):
    """initData мини-приложения, подписанная как в Telegram."""
    fields = {"query_id": "AAH", "auth_date": str(auth_date or int(time.time())),
              "user": json.dumps({"id": user_id, "first_name": "Иван", "username": "ivan_k"}, ensure_ascii=False)}
    check = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def site_client():
    client = Client(enforce_csrf_checks=True)
    token = client.get("/api/auth/csrf").json()["csrf"]
    return client, token


def test_site_login_creates_buyer_and_session(db):
    client, csrf = site_client()
    assert client.get("/api/auth/config").json() == {"bot_username": "astta_bot", "enabled": True}
    resp = client.post("/api/auth/telegram", widget(), content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
    assert resp.status_code == 200, resp.content
    assert resp.json()["username"] == "anna_v"
    buyer = User.objects.get(telegram_id=777)
    assert buyer.role == User.Role.BUYER and not buyer.is_staff and not buyer.has_usable_password()
    assert client.get("/api/me").json()["first_name"] == "Анна"
    # Повторный вход — тот же покупатель, ник обновился.
    again = client.post("/api/auth/telegram", widget(username="anna_new"), content_type="application/json",
                        HTTP_X_CSRFTOKEN=client.get("/api/auth/csrf").json()["csrf"])
    assert again.status_code == 200
    assert User.objects.filter(telegram_id=777).count() == 1
    assert User.objects.get(telegram_id=777).telegram_username == "anna_new"


def test_forged_or_old_login_rejected(db):
    client, csrf = site_client()
    post = lambda data: client.post("/api/auth/telegram", data, content_type="application/json",  # noqa: E731
                                    HTTP_X_CSRFTOKEN=csrf)
    forged = widget()
    forged["id"] = 1  # подменили чужой ID — подпись не сходится
    assert post(forged).status_code == 401
    assert post(widget(token="999:other-bot")).status_code == 401
    assert post(widget(auth_date=int(time.time()) - 2 * 86400)).status_code == 401
    assert client.get("/api/me").status_code == 401
    assert not User.objects.exists()


def test_login_needs_csrf_token(db):
    client = Client(enforce_csrf_checks=True)
    client.get("/api/auth/csrf")
    resp = client.post("/api/auth/telegram", widget(), content_type="application/json")
    assert resp.status_code == 403  # чужой сайт не может тихо войти покупателем под своим аккаунтом


def test_staff_cannot_enter_through_telegram(db):
    User.objects.create_user("maria", password="pw-123456!", is_staff=True, telegram_id=777)
    client, csrf = site_client()
    resp = client.post("/api/auth/telegram", widget(), content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
    assert resp.status_code == 401 and "Сотрудники" in resp.json()["detail"]


def test_mini_app_orders_with_init_data(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    client = Client()
    auth = {"HTTP_AUTHORIZATION": f"tma {init_data()}"}
    me = client.get("/api/me", **auth).json()
    assert me["username"] == "ivan_k" and me["orders"] == []
    resp = client.post("/api/orders", {"items": [{"product": "hoodie"}], "consent": True},
                       content_type="application/json", **auth)
    assert resp.status_code == 201, resp.content
    order = Order.objects.get()
    assert order.buyer.telegram_id == 888 and order.contact == "@ivan_k"  # контакт подставили из Telegram
    assert client.get("/api/me", **auth).json()["orders"][0]["number"] == order.number
    bad = client.get("/api/me", HTTP_AUTHORIZATION=f"tma {init_data(token='1:other')}")
    assert bad.status_code == 401
    old = client.get("/api/me", HTTP_AUTHORIZATION=f"tma {init_data(auth_date=int(time.time()) - 3 * 86400)}")
    assert old.status_code == 401


def test_site_order_with_session_needs_csrf_and_links_buyer(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    client, csrf = site_client()
    client.post("/api/auth/telegram", widget(), content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
    body = {"items": [{"product": "hoodie"}], "consent": True}
    assert client.post("/api/orders", body, content_type="application/json").status_code == 403
    # После входа токен меняется: сайт берёт новый через /api/auth/csrf.
    fresh = client.get("/api/auth/csrf").json()["csrf"]
    ok = client.post("/api/orders", body, content_type="application/json", HTTP_X_CSRFTOKEN=fresh)
    assert ok.status_code == 201, ok.content
    assert Order.objects.get().buyer.telegram_id == 777
    client.post("/api/auth/logout", HTTP_X_CSRFTOKEN=fresh)
    assert client.get("/api/me").status_code == 401


def test_guest_order_still_needs_contact(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    resp = Client().post("/api/orders", {"items": [{"product": "hoodie"}], "consent": True},
                         content_type="application/json")
    assert resp.status_code == 400 and Order.objects.count() == 0


def test_login_off_without_bot(db, settings):
    settings.TELEGRAM_BOT_TOKEN = ""
    client, csrf = site_client()
    resp = client.post("/api/auth/telegram", widget(), content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
    assert resp.status_code == 401 and "не настроен" in resp.json()["detail"]


def test_profile_stats_and_edit(supplier, shoes, pricing_setup):
    from orders.services import mark_paid

    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    client = Client()
    auth = {"HTTP_AUTHORIZATION": f"tma {init_data()}"}
    body = {"items": [{"product": "hoodie"}], "consent": True}
    client.post("/api/orders", body, content_type="application/json", **auth)
    client.post("/api/orders", body, content_type="application/json", **auth)
    first = Order.objects.order_by("id").first()
    mark_paid(first)
    me = client.get("/api/me", **auth).json()
    assert me["stats"]["orders"] == 2
    assert me["stats"]["active"] == 1  # оплаченный едет, неоплаченный ждёт оплаты
    assert me["stats"]["spent_rub"] == str(first.total_rub)

    resp = client.patch("/api/me", {"phone": " +7 900 000-00-00 ", "city": "Казань",
                                     "measures": {"chest": "100", "foot": 26.5, "junk": 1}},
                        content_type="application/json", **auth)
    assert resp.status_code == 200, resp.content
    data = resp.json()
    assert data["phone"] == "+7 900 000-00-00" and data["city"] == "Казань"
    assert data["measures"] == {"chest": 100.0, "foot": 26.5}
    bad = client.patch("/api/me", {"measures": {"foot": 90}}, content_type="application/json", **auth)
    assert bad.status_code == 422


def test_profile_edit_needs_login(db):
    assert Client().patch("/api/me", {"city": "X"}, content_type="application/json").status_code == 401
