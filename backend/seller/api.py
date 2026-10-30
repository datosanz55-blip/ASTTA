"""API кабинета команды (/api/seller/...). Вход по сессии, запись только с CSRF-токеном.

Поставщики из Китая в систему не заходят: они только источник товара. Каталоги, заказы у поставщиков
и посты ведёт команда TT и основатели (суперпользователи и группа «Модераторы»). Код поставщика,
с чьим каталогом работаем, передаётся в заголовке X-Act-As.
"""

import datetime as dt
from decimal import Decimal

from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Count, F, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from ninja import File, Form, Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.security import SessionAuth

from assistant import yandex
from assistant.services import translate_cards
from catalog.images import ImageError, prepare_image
from catalog.importer import build_template, import_catalog, unique_slug
from catalog.models import Category, PostImage, PriceTier, Product, ProductImage, Supplier, SupplierPost
from config.throttles import per_ip
from orders.models import OrderItem, SupplierOrder
from orders.services import SupplierOrderError, mark_ordered, purchase_for, supplier_action

MAX_POST_IMAGES = 10


def can_act(user):
    return user.is_authenticated and (user.is_superuser or user.has_perm("catalog.change_supplier"))


class TeamAuth(SessionAuth):
    """Пускаем только команду: основателей и модераторов."""

    def authenticate(self, request, key):
        user = super().authenticate(request, key)
        return user if user and can_act(user) else None


router = Router(tags=["Кабинет команды"], auth=TeamAuth())


def current_supplier(request) -> Supplier:
    code = request.headers.get("X-Act-As", "")
    supplier = Supplier.objects.filter(code=code).first() if code else None
    if supplier is None:
        raise HttpError(400, "Выберите поставщика")
    return supplier


def image_url(request, product):
    images = list(product.images.all())
    return request.build_absolute_uri(images[0].image.url) if images else None


# ---------- Вход ----------

class LoginIn(Schema):
    username: str
    password: str


class SupplierBrief(Schema):
    code: str
    name: str


class MeOut(Schema):
    username: str
    ai: bool
    suppliers: list[SupplierBrief]


def me_out(user):
    return {"username": user.get_username(), "ai": yandex.enabled(),
            "suppliers": list(Supplier.objects.filter(is_active=True))}


@router.post("/login", auth=None, response=MeOut, throttle=[per_ip("seller_login", "10/m")],
             summary="Вход команды")
def login_view(request, payload: LoginIn):
    user = authenticate(request, username=payload.username.strip(), password=payload.password)
    if user is None or not can_act(user):
        raise HttpError(401, "Неверный логин или пароль")
    login(request, user)
    return me_out(user)


@router.post("/logout", summary="Выход")
def logout_view(request):
    logout(request)
    return {"ok": True}


@router.get("/me", response=MeOut, summary="Кто вошёл и с какими поставщиками работаем")
def me(request):
    return me_out(request.user)


# ---------- Обзор ----------

@router.get("/overview", summary="Цифры для главной кабинета по поставщику")
def overview(request):
    supplier = current_supplier(request)
    orders = SupplierOrder.objects.filter(supplier=supplier)
    counts = dict(orders.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
    products = dict(Product.objects.filter(supplier=supplier).values_list("status").annotate(n=Count("id"))
                    .values_list("status", "n"))
    return {
        "to_order": counts.get(SupplierOrder.Status.TO_ORDER, 0),
        "ordered": counts.get(SupplierOrder.Status.ORDERED, 0),
        "shipped": counts.get(SupplierOrder.Status.SHIPPED, 0),
        "received_week": orders.filter(status=SupplierOrder.Status.RECEIVED,
                                       received_at__gte=timezone.now() - dt.timedelta(days=7)).count(),
        "published": products.get(Product.Status.PUBLISHED, 0),
        "drafts": sum(n for status, n in products.items() if status != Product.Status.PUBLISHED),
        "posts": supplier.posts.filter(status=SupplierPost.Status.PUBLISHED).count(),
    }


# ---------- Товары ----------

class ProductIn(Schema):
    ru: str
    zh: str = ""
    sku: str = ""
    cat: str
    price: Decimal
    sale: int = 0
    kg: Decimal
    bulky: bool = False
    tiers: list[tuple[int, Decimal]] = []
    desc: str = ""
    src: str = ""
    sizes: str = ""
    colors: str = ""
    publish: bool = True


def product_out(request, p, orders_count=0):
    return {
        "id": p.pk, "slug": p.slug, "sku": p.sku, "ru": p.title_ru, "zh": p.title_zh,
        "cat": p.category.slug, "price": p.price_cny, "sale": p.sale_percent, "kg": p.weight_kg, "bulky": p.bulky,
        "tiers": [[t.min_qty, t.price_cny] for t in sorted(p.tiers.all(), key=lambda t: t.min_qty)],
        "status": p.status, "desc": p.description_ru, "src": p.source_url, "sizes": p.sizes, "colors": p.colors,
        "img": image_url(request, p), "photos": len(p.images.all()), "orders": orders_count,
    }


def _products(supplier):
    return (Product.objects.filter(supplier=supplier).select_related("category")
            .prefetch_related("tiers", "images").order_by("-updated_at"))


@router.get("/products", summary="Товары поставщика")
def products(request):
    supplier = current_supplier(request)
    counts = dict(OrderItem.objects.filter(product__supplier=supplier).values_list("product")
                  .annotate(n=Count("order", distinct=True)).values_list("product", "n"))
    return [product_out(request, p, counts.get(p.pk, 0)) for p in _products(supplier)]


def _save_product(request, supplier, product, payload: ProductIn):
    errors = {}
    if not payload.ru.strip():
        errors["ru"] = "required"
    if payload.price <= 0:
        errors["price"] = "positive"
    if payload.kg <= 0:
        errors["kg"] = "positive"
    tiers = sorted({q: c for q, c in payload.tiers if q > 0 and c > 0}.items())
    if not 0 <= payload.sale <= 90:
        errors["sale"] = "range"
    category = Category.objects.filter(slug=payload.cat).first()
    if category is None:
        errors["cat"] = "unknown"
    sku = payload.sku.strip()[:64]
    if sku and Product.objects.filter(supplier=supplier, sku=sku).exclude(pk=getattr(product, "pk", None)).exists():
        errors["sku"] = "duplicate"
    if errors:
        raise HttpError(422, str(errors))

    with transaction.atomic():
        if product is None:
            product = Product(supplier=supplier, slug=unique_slug(supplier, sku or "item"))
        product.category = category
        product.title_ru = payload.ru.strip()
        product.title_zh = payload.zh.strip()
        product.description_ru = payload.desc.strip()
        product.sku = sku
        product.source_url = payload.src.strip()
        product.sizes = payload.sizes.strip()
        product.colors = payload.colors.strip()
        product.price_cny = payload.price
        product.sale_percent = payload.sale
        product.weight_kg = payload.kg
        product.bulky = payload.bulky
        # Черновик не виден покупателям: пригодится, пока ждём фото или цену от поставщика.
        product.status = Product.Status.PUBLISHED if payload.publish else Product.Status.DRAFT
        product.moderation_note = ""
        product.full_clean(exclude=["slug"])
        product.save()
        product.tiers.all().delete()
        PriceTier.objects.bulk_create([PriceTier(product=product, min_qty=q, price_cny=c) for q, c in tiers])
    return product_out(request, _products(supplier).get(pk=product.pk))


@router.post("/products", summary="Добавить товар")
def create_product(request, payload: ProductIn):
    return _save_product(request, current_supplier(request), None, payload)


@router.put("/products/{product_id}", summary="Изменить товар")
def update_product(request, product_id: int, payload: ProductIn):
    supplier = current_supplier(request)
    product = get_object_or_404(Product, pk=product_id, supplier=supplier)
    return _save_product(request, supplier, product, payload)


def _photo(file: UploadedFile):
    try:
        return prepare_image(file.read(), file.name or "photo")
    except ImageError as exc:
        raise HttpError(400, str(exc)) from exc


@router.post("/products/{product_id}/image", summary="Загрузить главное фото товара")
def upload_image(request, product_id: int, file: UploadedFile = File(...)):
    supplier = current_supplier(request)
    product = get_object_or_404(Product, pk=product_id, supplier=supplier)
    content = _photo(file)
    with transaction.atomic():
        product.images.update(position=F("position") + 1)
        ProductImage.objects.create(product=product, image=content, position=0)
    return product_out(request, _products(supplier).get(pk=product.pk))


class TranslateItem(Schema):
    zh: str
    desc: str = ""


class TranslateIn(Schema):
    items: list[TranslateItem]


@router.post("/translate", summary="Перевести китайские названия и описания на русский (YandexGPT)")
def translate(request, payload: TranslateIn):
    if not payload.items or len(payload.items) > 50:
        raise HttpError(422, "От 1 до 50 товаров за раз")
    try:
        result = translate_cards([{"title_zh": i.zh, "description_zh": i.desc} for i in payload.items])
    except yandex.AIUnavailable as exc:
        raise HttpError(503, "ИИ пока не подключён: впишите название по-русски") from exc
    except yandex.AIError as exc:
        raise HttpError(502, f"Перевод не получился: {exc}") from exc
    return {"items": [{"ru": r["title"], "desc": r["description"]} for r in result]}


@router.post("/import", summary="Загрузить каталог: Excel и/или ZIP с фото по артикулам")
def import_view(request, file: UploadedFile | None = File(None), photos: UploadedFile | None = File(None),
                publish: Form[bool] = False, translate: Form[bool] = False):
    result = import_catalog(file, current_supplier(request), photos=photos, publish=publish, translate=translate)
    return {"ok": result.ok, "created": result.created, "updated": result.updated, "photos": result.photos,
            "translated": result.translated, "errors": result.errors, "warnings": result.warnings}


@router.get("/template", summary="Шаблон Excel")
def template(request):
    response = HttpResponse(build_template(),
                            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = 'attachment; filename="astta-catalog-template.xlsx"'
    return response


# ---------- Заказы у поставщика ----------

class ShipIn(Schema):
    tracking: str


def supplier_order_out(request, so):
    return {
        "id": so.pk, "num": so.order.number, "date": timezone.localtime(so.created_at).strftime("%d.%m %H:%M"),
        "mode": so.order.mode, "status": so.status, "tracking": so.tracking,
        "items": [{
            "product": item.product_id, "ru": item.title, "zh": item.product.title_zh, "sku": item.product.sku,
            "img": image_url(request, item.product),
            "size": item.size, "color": item.color, "qty": item.qty, "unit": item.unit_cny,
        } for item in so.items.all()],
    }


def _orders(supplier):
    # Неоплаченные заказы не показываем: заказывать у поставщика можно только после оплаты.
    return (SupplierOrder.objects.filter(supplier=supplier).exclude(status=SupplierOrder.Status.PENDING)
            .select_related("order").prefetch_related("items__product__images"))


@router.get("/orders", summary="Заказы у поставщика (последние 200)")
def orders(request):
    return [supplier_order_out(request, so) for so in _orders(current_supplier(request))[:200]]


def _act(request, order_id, action, tracking=""):
    supplier = current_supplier(request)
    so = get_object_or_404(_orders(supplier), pk=order_id)
    try:
        supplier_action(so, action, tracking, author=request.user)
    except SupplierOrderError as exc:
        raise HttpError(409, str(exc)) from exc
    return supplier_order_out(request, _orders(supplier).get(pk=so.pk))


@router.post("/orders/{order_id}/confirm", summary="Заказано у поставщика")
def confirm_order(request, order_id: int):
    return _act(request, order_id, "confirm")


@router.post("/orders/{order_id}/cancel", summary="Нет в наличии: отменить и вернуть деньги покупателю")
def cancel_order(request, order_id: int):
    return _act(request, order_id, "cancel")


@router.post("/orders/{order_id}/ship", summary="Поставщик отправил на склад TT")
def ship_order(request, order_id: int, payload: ShipIn):
    return _act(request, order_id, "ship", payload.tracking)


class OrderIdsIn(Schema):
    orders: list[int]


@router.get("/purchase", summary="Что заказать у поставщика: сводка и сообщение для WeChat")
def purchase(request):
    p = purchase_for(current_supplier(request))
    return {
        "text_zh": p.text_zh if p.lines else "", "total_qty": p.total_qty, "total_cny": p.total_cny,
        "orders": [so.pk for so in p.orders],
        "lines": [{"title": line.title, "sku": line.sku, "size": line.size, "color": line.color, "qty": line.qty,
                   "unit": line.unit_cny, "src": line.source_url} for line in p.lines],
    }


@router.post("/purchase/ordered", summary="Сводный заказ отправлен поставщику")
def purchase_ordered(request, payload: OrderIdsIn):
    return {"ordered": mark_ordered(current_supplier(request), payload.orders, author=request.user)}


# ---------- Посты ----------

class PostIn(Schema):
    product: int | None = None
    kind: str = SupplierPost.Kind.NEW
    text: str = ""


def post_out(request, post):
    return {
        "id": post.pk, "product": post.product_id, "kind": post.kind, "status": post.status,
        "text": post.text_ru or post.text,
        "images": [request.build_absolute_uri(img.image.url) for img in post.images.all()],
        "date": timezone.localtime(post.created_at).strftime("%d.%m.%Y"),
    }


@router.get("/posts", summary="Посты поставщика в ленту")
def posts(request):
    supplier = current_supplier(request)
    return [post_out(request, p) for p in supplier.posts.prefetch_related("images")[:50]]


@router.post("/posts", summary="Пост в ленту: текст и до 10 фото, сразу публикуется")
def create_post(request, payload: Form[PostIn], images: list[UploadedFile] | None = File(None)):
    supplier = current_supplier(request)
    product = None
    if payload.product:
        product = get_object_or_404(Product, pk=payload.product, supplier=supplier, status=Product.Status.PUBLISHED)
    if payload.kind not in SupplierPost.Kind.values:
        raise HttpError(400, "Неизвестный тип поста")
    text = payload.text.strip()
    images = images or []
    if not text and not images:
        raise HttpError(422, "Добавьте текст или фото")
    if len(images) > MAX_POST_IMAGES:
        raise HttpError(422, f"Не больше {MAX_POST_IMAGES} фото в посте")
    contents = [_photo(f) for f in images]
    with transaction.atomic():
        post = SupplierPost.objects.create(supplier=supplier, product=product, kind=payload.kind, author=request.user,
                                           text_ru=text, status=SupplierPost.Status.PUBLISHED)
        for position, content in enumerate(contents):
            PostImage.objects.create(post=post, image=content, position=position)
    return post_out(request, post)


@router.delete("/posts/{post_id}", summary="Удалить пост")
def delete_post(request, post_id: int):
    post = get_object_or_404(SupplierPost, pk=post_id, supplier=current_supplier(request))
    files = [(img.image.storage, img.image.name) for img in post.images.all()]
    post.delete()
    for storage, name in files:
        storage.delete(name)
    return {"ok": True}


# ---------- Поставщики ----------

class SupplierIn(Schema):
    name: str
    city: str = ""
    about: str = ""
    wechat: str = ""
    phone: str = ""
    pay: str = ""
    is_active: bool = True


def supplier_out(s):
    return {
        "code": s.code, "name": s.name, "city": s.city, "about": s.about, "wechat": s.wechat, "phone": s.phone,
        "pay": s.payout_details, "is_active": s.is_active,
        "published": getattr(s, "published", 0), "drafts": getattr(s, "drafts", 0),
        "to_order": getattr(s, "to_order", 0),
    }


def _suppliers():
    return Supplier.objects.annotate(
        published=Count("products", filter=Q(products__status=Product.Status.PUBLISHED), distinct=True),
        drafts=Count("products", filter=~Q(products__status=Product.Status.PUBLISHED), distinct=True),
        to_order=Count("supplier_orders", filter=Q(supplier_orders__status=SupplierOrder.Status.TO_ORDER),
                       distinct=True),
    )


def _fill_supplier(supplier, payload: SupplierIn):
    if not payload.name.strip():
        raise HttpError(422, "Впишите название поставщика")
    supplier.name = payload.name.strip()
    for field, value in (("city", payload.city), ("about", payload.about), ("wechat", payload.wechat),
                         ("phone", payload.phone), ("payout_details", payload.pay)):
        setattr(supplier, field, value.strip())
    supplier.is_active = payload.is_active
    supplier.full_clean()
    supplier.save()


@router.get("/suppliers", summary="Поставщики: откуда берём товар")
def suppliers(request):
    return [supplier_out(s) for s in _suppliers().order_by("-is_active", "name")]


@router.post("/suppliers", summary="Добавить поставщика")
def create_supplier(request, payload: SupplierIn):
    base = slugify(payload.name)[:40] or "sup"
    code, n = base, 2
    while Supplier.objects.filter(code=code).exists():
        code, n = f"{base}-{n}", n + 1
    supplier = Supplier(code=code)
    _fill_supplier(supplier, payload)
    return supplier_out(_suppliers().get(pk=supplier.pk))


@router.put("/suppliers/{code}", summary="Изменить поставщика")
def update_supplier(request, code: str, payload: SupplierIn):
    supplier = get_object_or_404(Supplier, code=code)
    _fill_supplier(supplier, payload)
    return supplier_out(_suppliers().get(pk=supplier.pk))
