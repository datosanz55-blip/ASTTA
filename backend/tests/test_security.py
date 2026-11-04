import pytest
from django.core.cache import cache
from django.test import Client
from django_otp.oath import TOTP
from django_otp.plugins.otp_totp.models import TOTPDevice

from accounts.models import User


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def founder(db):
    return User.objects.create_superuser("founder", password="Founder-pass-2026!")


def login(client, password, **extra):
    return client.post("/admin/login/?next=/admin/", {"username": "founder", "password": password}, **extra)


def test_admin_locks_after_wrong_passwords(founder, settings):
    settings.LOGIN_FAIL_LIMIT = 3
    client = Client()
    for _ in range(3):
        assert login(client, "wrong").status_code == 200  # форма с ошибкой
    locked = login(client, "Founder-pass-2026!")
    assert locked.status_code == 429 and "Вход временно закрыт" in locked.content.decode()
    # Подбирать тот же логин с другого адреса тоже нельзя.
    assert login(Client(), "Founder-pass-2026!", REMOTE_ADDR="10.9.9.9").status_code == 429
    cache.clear()
    assert login(client, "Founder-pass-2026!").status_code == 302


def test_success_resets_failures(founder, settings):
    settings.LOGIN_FAIL_LIMIT = 3
    client = Client()
    login(client, "wrong")
    login(client, "wrong")
    assert login(client, "Founder-pass-2026!").status_code == 302
    client.logout()
    login(client, "wrong")
    login(client, "wrong")
    assert login(client, "Founder-pass-2026!").status_code == 302  # счётчик обнулился после удачного входа


def test_admin_only_from_allowed_ips(founder, settings):
    settings.ADMIN_ALLOWED_IPS = ["10.0.0.0/8", "203.0.113.7"]
    assert Client().get("/admin/login/").status_code == 404
    assert Client(REMOTE_ADDR="10.1.2.3").get("/admin/login/").status_code == 200
    assert Client(REMOTE_ADDR="203.0.113.7").get("/admin/login/").status_code == 200
    # Без прокси подделанный X-Forwarded-For не помогает.
    assert Client(REMOTE_ADDR="8.8.8.8", HTTP_X_FORWARDED_FOR="10.0.0.1").get("/admin/login/").status_code == 404
    # За одним прокси берём адрес, который дописал прокси (последний).
    settings.NUM_PROXIES = 1
    behind = Client(REMOTE_ADDR="172.18.0.5", HTTP_X_FORWARDED_FOR="10.0.0.1, 8.8.8.8")
    assert behind.get("/admin/login/").status_code == 404
    assert Client(REMOTE_ADDR="172.18.0.5", HTTP_X_FORWARDED_FOR="8.8.8.8, 10.4.4.4").get(
        "/admin/login/").status_code == 200
    assert Client().get("/api/categories").status_code == 200  # сайт и API для всех


def test_two_factor_setup_then_code_on_next_login(founder, settings):
    settings.ADMIN_REQUIRE_2FA = True
    settings.OTP_TOTP_THROTTLE_FACTOR = 0
    client = Client()
    assert login(client, "Founder-pass-2026!").status_code == 302
    first = client.get("/admin/")
    assert first.status_code == 302 and first["Location"].startswith("/admin/2fa/")
    setup = client.get(first["Location"], follow=True)
    page = setup.content.decode()
    assert "Подключите приложение" in page and "<svg" in page
    device = TOTPDevice.objects.get(user=founder, confirmed=False)
    assert client.get("/admin/catalog/product/").status_code == 302  # без кода дальше не пускаем
    token = TOTP(device.bin_key, device.step, device.t0, device.digits).token()
    done = client.post("/admin/2fa/setup/", {"code": f"{token:06d}", "next": "/admin/catalog/product/"})
    assert done.status_code == 302 and done["Location"] == "/admin/catalog/product/"
    assert client.get("/admin/catalog/product/").status_code == 200

    again = Client()
    login(again, "Founder-pass-2026!")
    assert again.get("/admin/").status_code == 302
    wrong = again.post("/admin/2fa/", {"code": "000000"})
    assert "Код не подошёл" in wrong.content.decode()
    device.refresh_from_db()
    next_token = TOTP(device.bin_key, device.step, device.t0, device.digits, drift=1).token()
    ok = again.post("/admin/2fa/?next=/admin/", {"code": f"{next_token:06d}"})
    assert ok.status_code == 302 and again.get("/admin/").status_code == 200


def test_two_factor_never_redirects_to_other_sites(rf):
    from accounts.two_factor import _next_url
    assert _next_url(rf.post("/admin/2fa/", {"next": "https://evil.example/"})) == "/admin/"
    assert _next_url(rf.post("/admin/2fa/", {"next": "//evil.example/x"})) == "/admin/"
    assert _next_url(rf.post("/admin/2fa/", {"next": "/admin/orders/order/"})) == "/admin/orders/order/"


def test_health_and_api_limits(db):
    assert Client().get("/healthz").content == b"ok"
    client = Client()
    codes = [client.post("/api/orders", {"items": [], "contact": "@a"}, content_type="application/json",
                         HTTP_X_FORWARDED_FOR=f"10.0.0.{i}").status_code for i in range(21)]
    # Меняя X-Forwarded-For, лимит на оформление заказов не обойти.
    assert codes[-1] == 429 and 429 not in codes[:20]


def test_direct_login_page_leads_to_admin(founder):
    client = Client()
    resp = client.post("/admin/login/", {"username": "founder", "password": "Founder-pass-2026!"})
    assert resp.status_code == 302 and resp["Location"] == "/admin/"


def test_reset_two_factor_command(founder):
    from django.core.management import call_command
    TOTPDevice.objects.create(user=founder, name="Телефон", confirmed=True)
    call_command("reset_2fa", "founder")
    assert not TOTPDevice.objects.filter(user=founder).exists()
