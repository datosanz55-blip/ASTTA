import re
from datetime import timedelta

import pytest
from django.core import mail
from django.core.cache import cache
from django.test import Client
from django.utils import timezone

from accounts import email_auth
from accounts.models import EmailChallenge, EmailIdentity, Favorite, User
from tests.test_telegram import init_data, site_client, widget


@pytest.fixture(autouse=True)
def email_settings(settings):
    settings.EMAIL_LOGIN_ENABLED = True
    settings.EMAIL_HOST = "smtp.test"
    settings.DEFAULT_FROM_EMAIL = "ASTTA <login@astta.test>"
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.EMAIL_LOGIN_DAILY_LIMIT = 1000


def request_code(client, email="anna@example.com", purpose="login", **headers):
    csrf = client.get("/api/auth/csrf").json()["csrf"]
    response = client.post("/api/auth/email/request", {"email": email, "purpose": purpose, "consent": True},
                           content_type="application/json", HTTP_X_CSRFTOKEN=csrf, **headers)
    code = re.search(r": ([0-9]{6})\n", mail.outbox[-1].body).group(1) if response.status_code == 200 else None
    return response, code


def verify(client, challenge, code, purpose="login", **headers):
    csrf = client.get("/api/auth/csrf").json()["csrf"]
    return client.post("/api/auth/email/verify", {"challenge_id": str(challenge), "code": code, "purpose": purpose},
                       content_type="application/json", HTTP_X_CSRFTOKEN=csrf, **headers)


def fresh_code(client, email="anna@example.com", purpose="login", **headers):
    cache.delete(f"email-code:cooldown:{email_auth.digest(email.strip().lower())}")
    response, code = request_code(client, email, purpose, **headers)
    assert response.status_code == 200, response.content
    return response.json()["challenge_id"], code


@pytest.mark.django_db
def test_registration_and_email_order_contact(runner):
    from orders.models import Order

    client, _ = site_client()
    address = "a" * 60 + "@example.com"
    response, code = request_code(client, address.upper())
    assert set(response.json()) == {"challenge_id", "expires_in", "resend_after"}
    assert code not in response.content.decode()
    challenge = EmailChallenge.objects.get()
    assert challenge.email == address and challenge.code_hash != code
    assert not User.objects.exists()
    result = verify(client, challenge.pk, code)
    assert result.status_code == 200, result.content
    assert result.json()["email"] == address and result.json()["email_verified"] is True
    buyer = User.objects.get()
    assert not buyer.has_usable_password() and not buyer.is_staff and buyer.telegram_id is None
    assert buyer.pd_consent_at and EmailIdentity.objects.get().user_id == buyer.pk
    csrf = client.get("/api/auth/csrf").json()["csrf"]
    order = client.post("/api/orders", {"consent": True, "items": [{"product": runner.slug, "size": "42"}]},
                        content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
    assert order.status_code == 201, order.content
    assert Order.objects.get().contact == address


@pytest.mark.django_db
def test_link_keeps_telegram_account_and_favorites(runner, settings):
    settings.TELEGRAM_BOT_TOKEN = "123456:TEST-bot-token"
    client, csrf = site_client()
    assert client.post("/api/auth/telegram", widget(), content_type="application/json",
                       HTTP_X_CSRFTOKEN=csrf).status_code == 200
    buyer = User.objects.get(telegram_id=777)
    Favorite.objects.create(user=buyer, product=runner)
    challenge, code = fresh_code(client, purpose="link")
    assert verify(client, challenge, code, "link").status_code == 200
    fresh, _ = site_client()
    challenge, code = fresh_code(fresh)
    assert verify(fresh, challenge, code).status_code == 200
    data = fresh.get("/api/me").json()
    assert data["telegram_id"] == 777 and data["favorites"] == [runner.slug]
    assert User.objects.count() == 1


@pytest.mark.django_db
def test_other_browser_and_replay_are_rejected():
    owner, _ = site_client()
    challenge, code = fresh_code(owner)
    other, _ = site_client()
    assert verify(other, challenge, code).status_code == 422
    saved = EmailChallenge.objects.get()
    assert verify(owner, challenge, code).status_code == 200
    with pytest.raises(email_auth.EmailAuthError):
        email_auth.verify(challenge, code, browser_key=saved.browser_key)


@pytest.mark.django_db
def test_expired_codes_and_five_failed_attempts():
    client, _ = site_client()
    challenge, code = fresh_code(client)
    EmailChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert verify(client, challenge, code).status_code == 422
    challenge, code = fresh_code(client)
    wrong = f"{(int(code) + 1) % 1_000_000:06d}"
    for n in range(1, 6):
        assert verify(client, challenge, wrong).status_code == 422
        assert EmailChallenge.objects.get(pk=challenge).attempts == n
    assert verify(client, challenge, code).status_code == 422
    assert not User.objects.exists()


@pytest.mark.django_db
def test_resend_and_limits(settings):
    client, _ = site_client()
    first, old_code = fresh_code(client)
    assert request_code(client)[0].status_code == 429
    second, code = fresh_code(client)
    assert verify(client, first, old_code).status_code == 422
    for _ in range(email_auth.ADDRESS_HOURLY_LIMIT - 2):
        fresh_code(client)
    cache.delete(f"email-code:cooldown:{email_auth.digest('anna@example.com')}")
    assert request_code(client)[0].status_code == 429
    cache.clear()
    settings.EMAIL_LOGIN_DAILY_LIMIT = 1
    fresh_code(client, "first@example.com")
    assert request_code(client, "second@example.com")[0].status_code == 429


@pytest.mark.django_db
@pytest.mark.parametrize("body", [
    {"email": "not-email", "consent": True}, {"email": "anna@example.com", "consent": False},
    {"email": "anna@example.com", "purpose": "admin", "consent": True},
])
def test_invalid_request_never_sends_mail(body):
    client, csrf = site_client()
    assert client.post("/api/auth/email/request", body, content_type="application/json",
                       HTTP_X_CSRFTOKEN=csrf).status_code == 422
    assert not EmailChallenge.objects.exists()
    assert not getattr(mail, "outbox", [])


@pytest.mark.django_db
def test_both_steps_require_csrf():
    client, _ = site_client()
    assert client.post("/api/auth/email/request", {"email": "a@example.com", "consent": True},
                       content_type="application/json").status_code == 403
    challenge, code = fresh_code(client)
    assert client.post("/api/auth/email/verify", {"challenge_id": challenge, "code": code},
                       content_type="application/json").status_code == 403
    assert not User.objects.exists()


@pytest.mark.django_db
def test_disabled_and_smtp_failure(settings, monkeypatch):
    client, _ = site_client()
    settings.EMAIL_LOGIN_ENABLED = False
    assert client.get("/api/site").json()["email_login"] is False
    assert request_code(client)[0].status_code == 503
    settings.EMAIL_LOGIN_ENABLED = True

    def fail(*a, **k):
        raise OSError("SMTP failed")
    monkeypatch.setattr(email_auth, "send_mail", fail)
    assert request_code(client)[0].status_code == 503
    assert EmailChallenge.objects.get().consumed_at is not None
    assert not User.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("flag", ["is_staff", "is_superuser", "is_active", "role"])
def test_email_never_authenticates_staff_or_disabled_accounts(flag):
    user = User.objects.create_user("protected", **{flag: False if flag == "is_active" else
                                                   "agent" if flag == "role" else True})
    EmailIdentity.objects.create(user=user, email="anna@example.com")
    client, _ = site_client()
    challenge, code = fresh_code(client)
    assert verify(client, challenge, code).status_code == 403
    assert client.get("/api/me").status_code == 401


@pytest.mark.django_db
def test_unverified_email_does_not_merge_accounts():
    original = User.objects.create_user("legacy", email="anna@example.com")
    client, _ = site_client()
    challenge, code = fresh_code(client)
    assert verify(client, challenge, code).status_code == 200
    assert EmailIdentity.objects.get().user_id != original.pk


@pytest.mark.django_db
def test_link_does_not_merge_or_replace_session():
    first = User.objects.create_user("first")
    other = User.objects.create_user("other")
    EmailIdentity.objects.create(user=other, email="anna@example.com")
    client = Client(enforce_csrf_checks=True)
    client.force_login(first)
    assert request_code(client)[0].status_code == 409
    challenge, code = fresh_code(client, purpose="link")
    assert verify(client, challenge, code, "link").status_code == 409
    assert EmailIdentity.objects.get().user_id == other.pk
    assert int(client.session["_auth_user_id"]) == first.pk


@pytest.mark.django_db
def test_link_requires_same_buyer_and_mini_app_works_without_cookie(settings):
    settings.TELEGRAM_BOT_TOKEN = "123456:TEST-bot-token"
    auth = {"HTTP_AUTHORIZATION": "tma " + init_data()}
    challenge, code = fresh_code(Client(), purpose="link", **auth)
    other = User.objects.create_user("other")
    another = Client(enforce_csrf_checks=True)
    another.force_login(other)
    assert verify(another, challenge, code, "link").status_code == 422
    assert verify(Client(), challenge, code, "link", **auth).status_code == 200
    assert EmailIdentity.objects.get().user.telegram_id == 888
    assert request_code(Client(), purpose="login", **auth)[0].status_code == 409


@pytest.mark.django_db(transaction=True)
def test_concurrent_verification_consumes_code_once():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import close_old_connections, connections

    challenge = email_auth.start("race@example.com", "login", timezone.now(), browser_key="browser")
    code = re.search(r": ([0-9]{6})\n", mail.outbox[-1].body).group(1)
    barrier = Barrier(2)

    def attempt():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            try:
                email_auth.verify(challenge.pk, code, browser_key="browser")
                return "ok"
            except email_auth.EmailAuthError:
                return "used"
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(lambda _: attempt(), range(2))) == ["ok", "used"]
    assert User.objects.count() == 1 and EmailIdentity.objects.count() == 1


@pytest.mark.django_db
def test_cleanup_preserves_identity_and_removes_old_challenges():
    from django.core.management import call_command

    challenge = email_auth.start("cleanup@example.com", "login", timezone.now(), browser_key="browser")
    user = User.objects.create_user("keep")
    EmailIdentity.objects.create(user=user, email="confirmed@example.com")
    EmailChallenge.objects.filter(pk=challenge.pk).update(created_at=timezone.now() - timedelta(days=2))
    call_command("cleanup_email_codes")
    assert not EmailChallenge.objects.exists() and EmailIdentity.objects.get().user_id == user.pk
