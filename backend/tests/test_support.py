import pytest
from django.test import Client

from links.models import LinkRequest


@pytest.mark.django_db
def test_support_is_saved_without_pricing_or_marketplace_requests(monkeypatch):
    def unexpected(*args, **kwargs):
        raise AssertionError("Обращение не должно обращаться к площадкам")

    monkeypatch.setattr("links.api.resolve_link", unexpected)
    response = Client().post("/api/link/support", {
        "contact": " @anna ", "message": " Где заказ A-000123? ", "consent": True,
    }, content_type="application/json")
    assert response.status_code == 201
    item = LinkRequest.objects.get(pk=response.json()["id"])
    assert item.contact == "@anna" and item.text == "Где заказ A-000123?"
    assert item.status == LinkRequest.Status.NEW and item.pd_consent_at is not None
    assert item.comment == "Обращение к агенту с сайта"


@pytest.mark.django_db
@pytest.mark.parametrize("fields", [
    {"consent": False}, {"contact": " "}, {"message": " "},
    {"contact": "a" * 65}, {"message": "a" * 2001},
])
def test_support_requires_consent_contact_and_message(fields):
    payload = {"contact": "@anna", "message": "Помогите", "consent": True, **fields}
    assert Client().post("/api/link/support", payload, content_type="application/json").status_code == 422
    assert not LinkRequest.objects.exists()


@pytest.mark.django_db
def test_support_checks_csrf_for_buyer_sessions():
    from accounts.models import User

    buyer = User.objects.create_user("buyer")
    client = Client(enforce_csrf_checks=True)
    client.force_login(buyer)
    data = {"contact": "@anna", "message": "Помогите", "consent": True}
    assert client.post("/api/link/support", data, content_type="application/json").status_code == 403
    assert not LinkRequest.objects.exists()
    token = client.get("/api/auth/csrf").json()["csrf"]
    assert client.post("/api/link/support", data, content_type="application/json",
                       HTTP_X_CSRFTOKEN=token).status_code == 201
