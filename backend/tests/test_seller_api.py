import json
import zipfile
from decimal import Decimal
from io import BytesIO

import pytest
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import Client
from openpyxl import load_workbook
from PIL import Image

from accounts.models import User
from accounts.roles import setup_roles
from catalog.importer import build_template
from catalog.models import Product, Supplier, SupplierPost
from orders.models import SupplierOrder
from orders.services import CartLine, create_order, mark_paid
from tests.conftest import make_product

API = "/api/seller"


def as_json(client, method, path, data=None, **extra):
    return getattr(client, method)(f"{API}{path}", data=json.dumps(data) if data is not None else None,
                                   content_type="application/json", **extra)


@pytest.fixture(autouse=True)
def _clear_throttle():
    cache.clear()


@pytest.fixture
def setup(supplier, other_supplier, shoes, pricing_setup):
    setup_roles()
    mine = make_product(supplier, shoes, "mine", 100, 1, [(5, 80), (20, 70)], title_ru="Мой товар", title_zh="我的鞋")
    theirs = make_product(other_supplier, shoes, "theirs", 200, 1, [(5, 150)], title_ru="Чужой товар")
    moderator = User.objects.create_user("mod", password="pw-123456!", is_staff=True)
    moderator.groups.add(Group.objects.get(name="Модераторы"))
    return {"mine": mine, "theirs": theirs, "moderator": moderator, "supplier": supplier, "other": other_supplier}


@pytest.fixture
def team(setup):
    client = Client()
    client.force_login(setup["moderator"])
    return client


def png(color="white"):
    buffer = BytesIO()
    Image.new("RGB", (40, 30), color).save(buffer, "PNG")
    buffer.seek(0)
    buffer.name = f"{color}.png"
    return buffer


def test_page_is_served_in_live_mode():
    resp = Client().get("/seller/")
    html = resp.content.decode()
    assert resp.status_code == 200
    assert 'data-api="/api/seller"' in html
    assert 'src="assets/' not in html  # пути переписаны на static
    assert "csrftoken" in resp.cookies
    # Кабинет только для команды и только на русском.
    assert 'lang="ru"' in html
    assert not any("一" <= ch <= "鿿" for ch in html)


def test_login_requires_csrf_and_team_account(setup):
    client = Client(enforce_csrf_checks=True)
    client.get("/seller/")
    token = client.cookies["csrftoken"].value
    bad = as_json(client, "post", "/login", {"username": "mod", "password": "wrong"}, HTTP_X_CSRFTOKEN=token)
    assert bad.status_code == 401
    ok = as_json(client, "post", "/login", {"username": "mod", "password": "pw-123456!"}, HTTP_X_CSRFTOKEN=token)
    assert ok.status_code == 200
    assert {s["code"] for s in ok.json()["suppliers"]} == {"jj", "gz"}
    # Запись без свежего CSRF-токена отклоняется: после входа Django выдаёт новый, кабинет читает его из cookie.
    payload = {"name": "Рынок Baima", "city": "Гуанчжоу"}
    assert as_json(client, "post", "/suppliers", payload, HTTP_X_CSRFTOKEN=token).status_code == 403
    fresh = client.cookies["csrftoken"].value
    assert as_json(client, "post", "/suppliers", payload, HTTP_X_CSRFTOKEN=fresh).status_code == 200


def test_login_is_throttled(setup):
    client = Client()
    codes = [as_json(client, "post", "/login", {"username": "x", "password": "y"}).status_code for _ in range(12)]
    assert codes[-1] == 429


def test_only_team_gets_in(setup, supplier):
    buyer = User.objects.create_user("buyer", password="pw-123456!")
    old_supplier = User.objects.create_user("jj_supplier", password="pw-123456!", role="supplier", supplier=supplier)
    for user in (buyer, old_supplier):
        client = Client()
        client.force_login(user)
        assert client.get(f"{API}/me").status_code == 401
    assert as_json(Client(), "post", "/login", {"username": "jj_supplier", "password": "pw-123456!"}).status_code == 401
    assert Client().get(f"{API}/products").status_code == 401


def test_products_per_supplier(team, setup):
    assert team.get(f"{API}/products").status_code == 400  # нужно выбрать поставщика
    data = team.get(f"{API}/products", HTTP_X_ACT_AS="jj").json()
    assert [p["ru"] for p in data] == ["Мой товар"]
    payload = {"ru": "Другое", "cat": "shoes", "price": "1", "kg": "1"}
    assert as_json(team, "put", f"/products/{setup['theirs'].pk}", payload, HTTP_X_ACT_AS="jj").status_code == 404


def test_team_creates_product_published_or_draft(team, setup):
    payload = {"ru": "Тапки домашние", "zh": "拖鞋", "sku": "T-1", "cat": "shoes", "price": "12", "kg": "0.3",
               "desc": "Мягкие", "src": "https://detail.1688.com/offer/2.html", "sizes": "36-40", "colors": "серый"}
    resp = as_json(team, "post", "/products", payload, HTTP_X_ACT_AS="jj")
    assert resp.status_code == 200, resp.content
    data = resp.json()
    assert (data["status"], data["ru"], data["zh"], data["desc"], data["sizes"]) == (
        "published", "Тапки домашние", "拖鞋", "Мягкие", "36-40")
    product = Product.objects.get(pk=data["id"])
    assert (product.sku, product.source_url, product.tiers.count()) == ("T-1", payload["src"], 0)
    draft = as_json(team, "put", f"/products/{product.pk}", {**payload, "publish": False}, HTTP_X_ACT_AS="jj")
    assert draft.json()["status"] == "draft"
    assert as_json(team, "post", "/products", {**payload, "ru": " "}, HTTP_X_ACT_AS="jj").status_code == 422
    duplicate = as_json(team, "post", "/products", payload, HTTP_X_ACT_AS="jj")
    assert duplicate.status_code == 422 and "sku" in duplicate.json()["detail"]


def test_product_validation(team):
    bad = {"ru": " ", "cat": "nope", "price": "0", "kg": "0", "sale": 95}
    resp = as_json(team, "post", "/products", bad, HTTP_X_ACT_AS="jj")
    assert resp.status_code == 422
    for key in ("ru", "cat", "price", "kg", "sale"):
        assert key in resp.json()["detail"]


def test_image_upload(team, setup):
    resp = team.post(f"{API}/products/{setup['mine'].pk}/image", {"file": png()}, HTTP_X_ACT_AS="jj")
    assert resp.status_code == 200
    assert resp.json()["img"].endswith(".webp") and resp.json()["status"] == "published"
    not_image = BytesIO(b"not an image")
    not_image.name = "x.png"
    bad = team.post(f"{API}/products/{setup['mine'].pk}/image", {"file": not_image}, HTTP_X_ACT_AS="jj")
    assert bad.status_code == 400


def test_import_with_photos(team, setup):
    wb = load_workbook(BytesIO(build_template()))
    wb.worksheets[0].append(["S-9", "Шлёпанцы", "shoes", 30, 0.4, "", "", "", "", "", "", ""])
    sheet = BytesIO()
    wb.save(sheet)
    sheet.seek(0)
    sheet.name = "catalog.xlsx"
    photos = BytesIO()
    with zipfile.ZipFile(photos, "w") as zf:
        zf.writestr("S-9.png", png().getvalue())
        zf.writestr("other.png", png().getvalue())
    photos.seek(0)
    photos.name = "photos.zip"
    result = team.post(f"{API}/import", {"file": sheet, "photos": photos, "publish": "true"}, HTTP_X_ACT_AS="jj").json()
    assert (result["ok"], result["created"], result["photos"]) == (True, 1, 1), result
    assert any("other.png" in w for w in result["warnings"])
    product = Product.objects.get(sku="S-9")
    assert product.status == Product.Status.PUBLISHED and product.supplier == setup["supplier"]
    assert team.get(f"{API}/template", HTTP_X_ACT_AS="jj")["Content-Type"].startswith("application/vnd.openxmlformats")


def test_purchase_flow(team, setup):
    order = create_order([CartLine("mine", 2, "42"), CartLine("theirs", 1)], contact="@secret_buyer")
    assert team.get(f"{API}/orders", HTTP_X_ACT_AS="jj").json() == []  # до оплаты заказывать нечего
    mark_paid(order)
    data = team.get(f"{API}/orders", HTTP_X_ACT_AS="jj").json()
    assert len(data) == 1 and data[0]["status"] == "to_order"
    assert "secret_buyer" not in json.dumps(data)
    so = data[0]
    assert team.get(f"{API}/overview", HTTP_X_ACT_AS="jj").json()["to_order"] == 1

    purchase = team.get(f"{API}/purchase", HTTP_X_ACT_AS="jj").json()
    assert purchase["total_qty"] == 2 and "我的鞋" in purchase["text_zh"]
    assert as_json(team, "post", "/purchase/ordered", {"orders": purchase["orders"]},
                   HTTP_X_ACT_AS="jj").json() == {"ordered": 1}
    assert as_json(team, "post", f"/orders/{so['id']}/ship", {"tracking": " "}, HTTP_X_ACT_AS="jj").status_code == 409
    shipped = as_json(team, "post", f"/orders/{so['id']}/ship", {"tracking": "YT1"}, HTTP_X_ACT_AS="jj").json()
    assert (shipped["status"], shipped["tracking"]) == ("shipped", "YT1")
    assert order.events.filter(note__contains="YT1").exists()

    theirs = SupplierOrder.objects.get(order=order, supplier=setup["other"])
    assert team.post(f"{API}/orders/{theirs.pk}/cancel", HTTP_X_ACT_AS="jj").status_code == 404
    cancelled = team.post(f"{API}/orders/{theirs.pk}/cancel", HTTP_X_ACT_AS="gz").json()
    assert cancelled["status"] == "cancelled"
    order.refresh_from_db()
    assert order.refund_rub > 0


def test_posts_and_feed(team, setup):
    resp = team.post(f"{API}/posts", {"product": setup["mine"].pk, "kind": "new", "text": "Новинка: мягкие тапки",
                                      "images": [png("red"), png("blue")]}, HTTP_X_ACT_AS="jj")
    assert resp.status_code == 200, resp.content
    post = resp.json()
    assert post["status"] == "published" and len(post["images"]) == 2
    assert SupplierPost.objects.get().text_ru == "Новинка: мягкие тапки"

    feed = Client().get("/api/feed").json()
    assert feed["total"] == 1
    item = feed["items"][0]
    assert item["text"] == "Новинка: мягкие тапки" and len(item["images"]) == 2
    assert item["product"]["slug"] == "mine" and item["product"]["retail_rub"]
    Product.objects.filter(pk=setup["mine"].pk).update(status=Product.Status.DRAFT)
    assert Client().get("/api/feed").json()["items"][0]["product"] is None

    assert team.post(f"{API}/posts", {"text": "", "images": [png()]}, HTTP_X_ACT_AS="jj").status_code == 200
    assert team.post(f"{API}/posts", {"text": " "}, HTTP_X_ACT_AS="jj").status_code == 422
    foreign = team.post(f"{API}/posts", {"product": setup["theirs"].pk, "text": "x"}, HTTP_X_ACT_AS="jj")
    assert foreign.status_code == 404
    assert team.delete(f"{API}/posts/{post['id']}", HTTP_X_ACT_AS="jj").status_code == 200
    assert Client().get("/api/feed").json()["total"] == 1


def test_suppliers_managed_by_team(team, setup):
    data = team.get(f"{API}/suppliers").json()
    jj = next(s for s in data if s["code"] == "jj")
    assert (jj["published"], jj["drafts"], jj["to_order"]) == (1, 0, 0)
    created = as_json(team, "post", "/suppliers", {"name": "Fashion Factory", "city": "Гуанчжоу", "wechat": "ff_gz",
                                                   "pay": "Alipay через TT"}).json()
    assert created["code"] == "fashion-factory" and created["pay"] == "Alipay через TT"
    cyrillic = as_json(team, "post", "/suppliers", {"name": "Рынок Байма"}).json()
    assert cyrillic["code"]  # кириллица в slug не попадает, код всё равно выдаётся
    updated = as_json(team, "put", f"/suppliers/{created['code']}", {"name": "Fashion Factory GZ",
                                                                     "is_active": False}).json()
    assert (updated["name"], updated["is_active"]) == ("Fashion Factory GZ", False)
    assert Supplier.objects.get(code="fashion-factory").city == ""
    assert "fashion-factory" not in {s["code"] for s in team.get(f"{API}/me").json()["suppliers"]}
    assert as_json(team, "post", "/suppliers", {"name": " "}).status_code == 422


def test_overview_counts(team, setup):
    make_product(setup["supplier"], setup["mine"].category, "draft", 10, 1, [], status="draft")
    data = team.get(f"{API}/overview", HTTP_X_ACT_AS="jj").json()
    assert (data["published"], data["drafts"], data["to_order"]) == (1, 1, 0)
    assert Decimal(str(data["posts"])) == 0
