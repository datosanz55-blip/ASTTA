import pytest
from django.test import Client

from orders.models import Order
from tests.conftest import make_product


@pytest.fixture
def client():
    return Client()


def test_catalog_lists_only_published(client, runner, supplier, shoes):
    make_product(supplier, shoes, "hidden", 100, 1, [(5, 80)], status="moderation")
    data = client.get("/api/products").json()
    assert data["total"] == 1
    card = data["items"][0]
    assert card["slug"] == "runner"
    assert card["retail_rub"] == "3670"
    assert card["min_qty"] == 6


def test_catalog_search_and_category(client, runner):
    assert client.get("/api/products", {"q": "кроссовки"}).json()["total"] == 1
    assert client.get("/api/products", {"category": "furniture"}).json()["total"] == 0
    assert client.get("/api/products", {"sort": "nope"}).status_code == 400


def test_product_detail(client, runner):
    data = client.get("/api/products/runner").json()
    assert [t["min_qty"] for t in data["tiers"]] == [6, 30]
    assert data["supplier_fact_days"] == [16, 21]
    assert client.get("/api/products/missing").status_code == 404


def test_quote_endpoint(client, runner):
    data = client.get("/api/quote", {"product": "runner", "qty": 30, "mode": "wholesale"}).json()
    assert data["unit_cny"] == "176.00"
    assert client.get("/api/quote", {"product": "runner", "qty": 2, "mode": "wholesale"}).status_code == 400


def test_place_order_snapshots_price_and_tracks(client, runner):
    resp = client.post("/api/orders", {"items": [{"product": "runner", "qty": 1, "size": "42"}],
                                       "contact": "@buyer"}, content_type="application/json")
    assert resp.status_code == 201
    data = resp.json()
    assert data["total_rub"] == "3670.00"
    assert data["status"] == "new"
    assert data["number"].startswith("A-")

    # Цена в заказе не меняется, даже если поставщик потом поднял цену.
    runner.price_cny = 999
    runner.save()
    tracked = client.get(f"/api/orders/{data['token']}").json()
    assert tracked["total_rub"] == "3670.00"
    assert tracked["events"][0]["status"] == "new"
    assert Order.objects.get().items.get().size == "42"


def test_order_validation(client, runner):
    bad = client.post("/api/orders", {"items": [{"product": "nope"}], "contact": "@b"},
                      content_type="application/json")
    assert bad.status_code == 400
    empty_contact = client.post("/api/orders", {"items": [{"product": "runner"}], "contact": " "},
                                content_type="application/json")
    assert empty_contact.status_code == 400
