from io import BytesIO

import pytest
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from PIL import Image

from accounts.models import User
from accounts.roles import setup_roles
from catalog.models import Product, SupplierPost
from orders.models import Order, OrderEvent
from orders.services import CartLine, create_order, mark_paid
from tests.conftest import make_product


def team_client(group="Модераторы"):
    setup_roles()
    user = User.objects.create_user("mod", password="pw-123456!", is_staff=True)
    user.groups.add(Group.objects.get(name=group))
    client = Client()
    client.force_login(user)
    return client


def jpeg(size=(3000, 2000)):
    buffer = BytesIO()
    Image.new("RGB", size, "red").save(buffer, "JPEG")
    return SimpleUploadedFile("photo.jpg", buffer.getvalue(), content_type="image/jpeg")


def test_template_download(db):
    admin = User.objects.create_superuser("founder", password="pw-123456!")
    client = Client()
    client.force_login(admin)
    resp = client.get("/admin/catalog/product/template/")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/vnd.openxmlformats")


def test_no_supplier_role_and_russian_admin(db):
    setup_roles()
    assert not Group.objects.filter(name="Поставщики").exists()
    admin = User.objects.create_superuser("founder", password="pw-123456!")
    client = Client()
    client.force_login(admin)
    page = client.get("/admin/catalog/product/").content.decode()
    assert "中文" not in page


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


def test_sidebar_sections_and_counters(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    mark_paid(create_order([CartLine("hoodie", 1)], contact="@a"))
    create_order([CartLine("hoodie", 1)], contact="@b")
    client = team_client()
    page = client.get("/admin/").content.decode()
    for title in ("Заказы покупателей", "Заказать у поставщиков", "Загрузить каталог из Excel", "Посты",
                  "Настройки цены", "База знаний"):
        assert title in page
    assert "Группы прав" not in page  # права модератору не выдаются
    assert "Кабинет" not in page and client.get("/seller/").status_code == 404


def test_post_in_admin_goes_live_with_light_photos(supplier):
    client = team_client()
    assert 'value="published" selected' in client.get("/admin/catalog/supplierpost/add/").content.decode()
    resp = client.post("/admin/catalog/supplierpost/add/", {
        "supplier": supplier.pk, "product": "", "kind": "new", "text_ru": "Новые худи уже на складе",
        "status": "published",
        "images-TOTAL_FORMS": "3", "images-INITIAL_FORMS": "0", "images-MIN_NUM_FORMS": "0",
        "images-MAX_NUM_FORMS": "10", "images-0-image": jpeg(), "images-0-position": "0",
        "images-1-position": "0", "images-2-position": "0",  # пустые строки фото, как их отправляет браузер
    })
    assert resp.status_code == 302, resp.content.decode()[:2000]
    post = SupplierPost.objects.get()
    assert post.status == SupplierPost.Status.PUBLISHED
    image = post.images.get().image
    assert image.name.endswith(".webp")
    with Image.open(image.path) as saved:
        assert max(saved.size) == 1600  # из админки фото тоже уменьшаем, как при загрузке из Excel
    assert "Новые худи" in client.get("/admin/catalog/supplierpost/").content.decode()
    empty = client.post("/admin/catalog/supplierpost/add/", {
        "supplier": supplier.pk, "kind": "new", "text_ru": "", "status": "published",
        "images-TOTAL_FORMS": "0", "images-INITIAL_FORMS": "0", "images-MIN_NUM_FORMS": "0",
        "images-MAX_NUM_FORMS": "10"})
    assert empty.status_code == 200 and SupplierPost.objects.count() == 1  # без текста не сохраняем


def test_orders_move_by_batch_and_show_items(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    paid = mark_paid(create_order([CartLine("hoodie", 2)], contact="@a"))
    unpaid = create_order([CartLine("hoodie", 1)], contact="@b")
    client = team_client("Агенты")
    page = client.get("/admin/orders/order/").content.decode()
    assert "Худи × 2" in page and "Статус → Отправлен в Россию" in page
    resp = client.post("/admin/orders/order/", {"action": "move_shipped",
                                                "_selected_action": [paid.pk, unpaid.pk]})
    assert resp.status_code == 302
    paid.refresh_from_db()
    unpaid.refresh_from_db()
    assert paid.status == Order.Status.SHIPPED and unpaid.status == Order.Status.AWAITING_PAYMENT
    assert OrderEvent.objects.filter(order=paid, status=Order.Status.SHIPPED).exists()
    assert client.get(f"/admin/orders/order/{paid.pk}/change/").status_code == 200


def test_supplier_list_counts(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "a", 80, 1, [], title_ru="А")
    make_product(supplier, shoes, "b", 80, 1, [], title_ru="Б", status="draft")
    mark_paid(create_order([CartLine("a", 1)], contact="@a"))
    page = team_client().get("/admin/catalog/supplier/").content.decode()
    assert f'supplier__id__exact={supplier.pk}&status__exact=published">1</a>' in page  # на сайте
    assert 'supplierorder/purchase/">1</a>' in page  # заказать у поставщика, ссылка на сводку


def test_agent_adds_event_with_warehouse_photo(supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    order = mark_paid(create_order([CartLine("hoodie", 1)], contact="@a"))
    client = team_client("Агенты")
    url = f"/admin/orders/order/{order.pk}/change/"
    page = client.get(url)
    assert "— новый статус —" in page.content.decode()
    data = {"contact": "@a", "name": "", "comment": "", "agent": "", "mode": "retail"}
    for inline in page.context["inline_admin_formsets"]:
        fs = inline.formset
        mf = fs.management_form
        for key in ("TOTAL_FORMS", "INITIAL_FORMS", "MIN_NUM_FORMS", "MAX_NUM_FORMS"):
            data[f"{fs.prefix}-{key}"] = mf[key].value()
        for i, form in enumerate(fs.forms):
            if form.instance.pk:
                data[f"{fs.prefix}-{i}-id"] = form.instance.pk
                data[f"{fs.prefix}-{i}-{fs.fk.name}"] = order.pk
        if "status" in fs.form.base_fields and not fs.get_queryset().exists():
            new = fs.prefix
    data.update({f"{new}-0-status": "at_warehouse", f"{new}-0-note": "Приехало, всё целое",
                 f"{new}-0-weight_kg": "0.82", f"{new}-0-photo": jpeg()})
    resp = client.post(url, data)
    assert resp.status_code == 302, resp.content.decode()[-3000:]
    order.refresh_from_db()
    assert order.status == Order.Status.AT_WAREHOUSE
    event = order.events.last()
    assert (event.note, str(event.weight_kg)) == ("Приехало, всё целое", "0.820")
    assert event.photo.name.endswith(".webp") and event.author.username == "mod"
    events_before = order.events.count()
    client.post(url, {**data, f"{new}-0-status": "", f"{new}-0-note": "", f"{new}-0-weight_kg": "",
                      f"{new}-0-photo": ""})
    assert order.events.count() == events_before  # пустая строка не создаёт событие
