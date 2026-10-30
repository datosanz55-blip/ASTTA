import pytest
from django.contrib.auth.models import Group
from django.test import Client

from accounts.models import User
from accounts.roles import setup_roles
from catalog.models import Product
from tests.conftest import make_product


@pytest.fixture
def supplier_client(supplier, other_supplier, shoes, pricing_setup):
    setup_roles()
    make_product(supplier, shoes, "mine", 100, 1, [(5, 80)], title_ru="Мой товар")
    make_product(other_supplier, shoes, "theirs", 100, 1, [(5, 80)], title_ru="Чужой товар")
    user = User.objects.create_user("sup", password="pw-123456!", role="supplier", supplier=supplier,
                                    is_staff=True, language="zh-hans")
    user.groups.add(Group.objects.get(name="Поставщики"))
    client = Client()
    client.force_login(user)
    return client


def test_supplier_sees_only_own_products(supplier_client):
    page = supplier_client.get("/admin/catalog/product/").content.decode()
    assert "Мой товар" in page
    assert "Чужой товар" not in page
    theirs = Product.objects.get(slug="theirs")
    assert supplier_client.get(f"/admin/catalog/product/{theirs.pk}/change/").status_code in (302, 404)


def test_supplier_cabinet_is_in_chinese(supplier_client):
    assert "商品" in supplier_client.get("/admin/catalog/product/").content.decode()


def test_supplier_cannot_see_orders(supplier_client):
    assert supplier_client.get("/admin/orders/order/").status_code == 403


def test_template_download(supplier_client):
    resp = supplier_client.get("/admin/catalog/product/template/")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/vnd.openxmlformats")


def test_moderator_edits_any_supplier_product(supplier, other_supplier, shoes, pricing_setup):
    setup_roles()
    theirs = make_product(other_supplier, shoes, "theirs", 100, 1, [(5, 80)], title_ru="Чужой товар",
                          status="moderation")
    moderator = User.objects.create_user("mod", password="pw-123456!", is_staff=True)
    moderator.groups.add(Group.objects.get(name="Модераторы"))
    client = Client()
    client.force_login(moderator)
    page = client.get("/admin/catalog/product/").content.decode()
    assert "Чужой товар" in page
    assert client.get(f"/admin/catalog/product/{theirs.pk}/change/").status_code == 200
    resp = client.post("/admin/catalog/product/", {"action": "publish", "_selected_action": [theirs.pk]})
    assert resp.status_code == 302
    theirs.refresh_from_db()
    assert theirs.status == Product.Status.PUBLISHED
    # Пользователей модератор только смотрит, менять права себе не может.
    assert client.get(f"/admin/accounts/user/{moderator.pk}/change/").status_code == 200
    assert client.post(f"/admin/accounts/user/{moderator.pk}/change/", {"is_superuser": "on"}).status_code == 403


@pytest.mark.parametrize("url", [
    "/admin/assistant/knowledgearticle/", "/admin/assistant/knowledgearticle/1/change/", "/admin/assistant/ailog/",
    "/admin/links/linkrequest/", "/admin/links/marketplace/", "/admin/pricing/commissionrule/",
    "/admin/catalog/supplierpost/add/", "/admin/orders/supplierorder/", "/admin/orders/supplierorder/purchase/",
    "/admin/catalog/product/import/",
])
def test_new_admin_pages_open(db, url):
    admin = User.objects.create_superuser("founder", password="pw-123456!")
    client = Client()
    client.force_login(admin)
    assert client.get(url).status_code == 200
