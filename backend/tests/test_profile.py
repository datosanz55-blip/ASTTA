"""Профиль покупателя: избранное, недавно смотрели, «Для вас», аватар, способ оплаты, история чата с ИИ."""

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from PIL import Image

from accounts.models import User
from assistant.models import AiLog
from orders.models import Order
from tests.conftest import make_product
from tests.test_telegram import TOKEN, init_data


@pytest.fixture(autouse=True)
def _bot(settings):
    settings.TELEGRAM_BOT_TOKEN = TOKEN


def buyer_client():
    return Client(), {"HTTP_AUTHORIZATION": f"tma {init_data()}"}


def test_favorites_add_list_remove_and_sync(supplier, shoes, pricing_setup):
    for slug in ("a", "b", "c"):
        make_product(supplier, shoes, slug, 100, 1, [], title_ru=f"Товар {slug}")
    client, auth = buyer_client()
    assert client.put("/api/me/favorites/a", **auth).status_code == 200
    assert client.put("/api/me/favorites/a", **auth).status_code == 200  # повтор не ломает
    assert client.put("/api/me/favorites/nope", **auth).status_code == 404
    synced = client.post("/api/me/favorites", {"slugs": ["b", "a", "fake"]}, content_type="application/json",
                         **auth).json()
    assert sorted(synced["favorites"]) == ["a", "b"]  # из браузера добавилось «b», несуществующее отброшено
    cards = client.get("/api/me/favorites", **auth).json()
    assert [c["slug"] for c in cards] == ["b", "a"] and cards[0]["retail_rub"]  # новые сверху, с ценой под ключ
    assert client.delete("/api/me/favorites/b", **auth).status_code == 200
    assert client.get("/api/me", **auth).json()["favorites"] == ["a"]
    assert Client().get("/api/me/favorites").status_code == 401  # гостю — нет


def test_viewed_and_recommended(supplier, shoes, pricing_setup):
    from catalog.models import Category

    bags = Category.objects.create(slug="bags", name_ru="Сумки", name_zh="包")
    make_product(supplier, shoes, "runner", 100, 1, [], title_ru="Кроссовки", sold_count=5)
    make_product(supplier, shoes, "boots", 120, 1, [], title_ru="Ботинки", sold_count=50)
    make_product(supplier, bags, "bag", 90, 1, [], title_ru="Сумка", sold_count=999)
    client, auth = buyer_client()
    client.post("/api/me/viewed/runner", **auth)
    client.post("/api/me/viewed/bag", **auth)
    client.post("/api/me/viewed/runner", **auth)  # повторный просмотр поднимает наверх
    assert [c["slug"] for c in client.get("/api/me/viewed", **auth).json()] == ["runner", "bag"]
    client.put("/api/me/favorites/runner", **auth)
    rec = [c["slug"] for c in client.get("/api/me/recommended", **auth).json()]
    assert rec[0] == "boots"  # та же категория, что в избранном, и ещё не смотрели
    assert "runner" not in rec  # избранное в «Для вас» не повторяем
    client.delete("/api/me/viewed", **auth)
    assert client.get("/api/me/viewed", **auth).json() == []


def test_avatar_and_pay_method(db):
    client, auth = buyer_client()
    buf = BytesIO()
    Image.new("RGB", (400, 400), "red").save(buf, "PNG")
    resp = client.post("/api/me/avatar", {"photo": SimpleUploadedFile("моё фото.png", buf.getvalue(), "image/png")},
                       **auth)
    assert resp.status_code == 200, resp.content
    me = resp.json()
    assert me["avatar_url"].startswith("/media/avatars/") and "фото" not in me["avatar_url"]
    assert me["photo_url"] == me["avatar_url"]
    assert client.delete("/api/me/avatar", **auth).json()["avatar_url"] == ""
    assert client.patch("/api/me", {"pay_method": "sbp"}, content_type="application/json",
                        **auth).json()["pay_method"] == "sbp"
    assert client.patch("/api/me", {"pay_method": "bitcoin"}, content_type="application/json",
                        **auth).status_code == 422


def test_ai_history_is_private_and_clearable(db):
    client, auth = buyer_client()
    client.get("/api/me", **auth)
    buyer = User.objects.get(telegram_id__isnull=False)
    AiLog.objects.create(kind=AiLog.Kind.CHAT, request="[фото] сколько стоит?", response="≈ 5 000 ₽", buyer=buyer)
    AiLog.objects.create(kind=AiLog.Kind.CHAT, request="чужой вопрос", response="…")  # гость
    history = client.get("/api/me/ai-history", **auth).json()
    assert len(history) == 1 and history[0]["question"] == "сколько стоит?" and history[0]["photo"] is True
    client.delete("/api/me/ai-history", **auth)
    assert client.get("/api/me/ai-history", **auth).json() == []
    assert AiLog.objects.count() == 2  # для обучения ИИ записи остались, но без покупателя


def test_order_items_have_photo_and_link(supplier, shoes, pricing_setup):
    from catalog.models import ProductImage

    product = make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    buf = BytesIO()
    Image.new("RGB", (50, 50)).save(buf, "WEBP")
    ProductImage.objects.create(product=product, image=SimpleUploadedFile("h.webp", buf.getvalue(), "image/webp"))
    client, auth = buyer_client()
    order = client.post("/api/orders", {"items": [{"product": "hoodie"}], "consent": True},
                        content_type="application/json", **auth).json()
    item = order["items"][0]
    assert item["product_slug"] == "hoodie" and item["image"].endswith(".webp")
    assert Order.objects.count() == 1
