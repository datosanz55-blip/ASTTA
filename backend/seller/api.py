"""API кабинета поставщика (/api/seller/...). Вход по сессии, запись только с CSRF-токеном.

Каталоги поставщиков загружает команда ASTTA (основатели и модераторы с правом catalog.change_supplier):
она открывает кабинет любого поставщика, передав его код в заголовке X-Act-As, пишет по-русски
и публикует сразу. Вход для самого поставщика остаётся: он видит и меняет только свой магазин,
а его правки проходят модерацию. Покупателей поставщик не видит: в заказах только товары и количество.
"""

import datetime as dt
from decimal import Decimal

from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Count, F, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import File, Form, Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.security import django_auth
from ninja.throttling import AnonRateThrottle

from catalog.images import ImageError, prepare_image
from catalog.importer import build_template, import_catalog, unique_slug
from catalog.models import (
    Category,
    FactorySettings,
    PostImage,
    PriceTier,
    Product,
    ProductImage,
    Supplier,
    SupplierPost,
)
from orders.models import OrderItem, Payout, SupplierOrder
from orders.services import SupplierOrderError, supplier_action, unpaid_received

router = Router(tags=["Кабинет поставщика"], auth=django_auth)

MAX_POST_IMAGES = 10
LANGUAGES = {"ru", "zh-hans"}


def can_act(user):
    return user.is_superuser or user.has_perm("catalog.change_supplier")


def is_team(request):
    """Команда ASTTA работает за поставщика: пишет по-русски и публикует без модерации."""
    return can_act(request.user) and not request.user.is_supplier


def current_supplier(request) -> Supplier:
    user = request.user
    if user.is_supplier and not user.is_superuser:
        if not user.supplier.is_active:
            raise HttpError(403, "Магазин заблокирован, напишите менеджеру TT / 店铺已被停用，请联系 TT 经理")
        return user.supplier
    if can_act(user):
        code = request.headers.get("X-Act-As", "")
        supplier = Supplier.objects.filter(code=code).first() if code else None
        if supplier is None:
            raise HttpError(400, "Выберите поставщика")
        return supplier
    raise HttpError(403, "Нет доступа к кабинету поставщика")


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
    name_zh: str


class MeOut(Schema):
    username: str
    language: str
    is_supplier: bool
    can_act: bool
    supplier: SupplierBrief | None
    suppliers: list[SupplierBrief]


def me_out(user):
    acting = can_act(user) and not user.is_supplier
    return {
        "username": user.get_username(),
        "language": user.language,
        "is_supplier": user.is_supplier,
        "can_act": acting,
        "supplier": user.supplier if user.is_supplier else None,
        "suppliers": list(Supplier.objects.all()) if acting else [],
    }


@router.post("/login", auth=None, response=MeOut, throttle=[AnonRateThrottle("10/m")],
             summary="Вход поставщика или модератора")
def login_view(request, payload: LoginIn):
    user = authenticate(request, username=payload.username.strip(), password=payload.password)
    if user is None or not (user.is_supplier or can_act(user)):
        raise HttpError(401, "Неверный логин или пароль / 用户名或密码错误")
    login(request, user)
    return me_out(user)


@router.post("/logout", summary="Выход")
def logout_view(request):
    logout(request)
    return {"ok": True}


@router.get("/me", response=MeOut, summary="Кто вошёл")
def me(request):
    if not (request.user.is_supplier or can_act(request.user)):
        raise HttpError(403, "Нет доступа к кабинету поставщика")
    return me_out(request.user)


class LanguageIn(Schema):
    language: str


@router.put("/me/language", summary="Язык кабинета")
def set_language(request, payload: LanguageIn):
    if payload.language not in LANGUAGES:
        raise HttpError(400, "Язык: ru или zh-hans")
    request.user.language = payload.language
    request.user.save(update_fields=["language"])
    return {"language": payload.language}


# ---------- Обзор ----------

@router.get("/overview", summary="Цифры для главной кабинета")
def overview(request):
    supplier = current_supplier(request)
    orders = SupplierOrder.objects.filter(supplier=supplier)
    today = timezone.localdate()
    days = [today - dt.timedelta(days=i) for i in range(6, -1, -1)]
    per_day = dict(orders.filter(created_at__date__gte=days[0]).values_list("created_at__date")
                   .annotate(n=Count("id")).values_list("created_at__date", "n"))
    return {
        "today": per_day.get(today, 0),
        "week": [per_day.get(day, 0) for day in days],
        "week_labels": [day.strftime("%d.%m") for day in days],
        "pending_cny": _pending_sum(supplier),
    }


def _pending_sum(supplier):
    """Сколько юаней поставщик получит в ближайшую выплату: заказы, принятые складом и ещё не оплаченные."""
    total = Decimal("0")
    for so in unpaid_received(supplier).prefetch_related("items"):
        total += so.amount_cny
    return total


# ---------- Товары ----------

class ProductIn(Schema):
    zh: str = ""
    ru: str = ""
    sku: str = ""
    cat: str
    price: Decimal
    sale: int = 0
    kg: Decimal
    bulky: bool = False
    tiers: list[tuple[int, Decimal]] = []
    desc: str = ""
    src: str = ""


def product_out(request, p, orders_count=0):
    team = is_team(request)
    return {
        # Пока модератор не перевёл, title_ru совпадает с китайским: в форме поставщика показываем пустое поле.
        "id": p.pk, "slug": p.slug, "sku": p.sku, "zh": p.title_zh,
        "ru": p.title_ru if team or p.title_ru != p.title_zh else "",
        "cat": p.category.slug, "price": p.price_cny, "sale": p.sale_percent, "kg": p.weight_kg, "bulky": p.bulky,
        "tiers": [[t.min_qty, t.price_cny] for t in sorted(p.tiers.all(), key=lambda t: t.min_qty)],
        "status": p.status, "reason": p.moderation_note,
        "desc": p.description_ru if team else p.description_zh, "src": p.source_url,
        "img": image_url(request, p), "photos": len(p.images.all()), "orders": orders_count,
    }


def _my_products(supplier):
    return (Product.objects.filter(supplier=supplier).select_related("category")
            .prefetch_related("tiers", "images").order_by("-updated_at"))


@router.get("/products", summary="Мои товары")
def products(request):
    supplier = current_supplier(request)
    counts = dict(OrderItem.objects.filter(product__supplier=supplier).values_list("product")
                  .annotate(n=Count("order", distinct=True)).values_list("product", "n"))
    return [product_out(request, p, counts.get(p.pk, 0)) for p in _my_products(supplier)]


def _save_product(request, supplier, product, payload: ProductIn):
    team = is_team(request)
    errors = {}
    # Команда пишет по-русски, китайское название по желанию. Поставщик наоборот.
    if team and not payload.ru.strip():
        errors["ru"] = "required"
    if not team and not payload.zh.strip():
        errors["zh"] = "required"
    if payload.price <= 0:
        errors["price"] = "positive"
    if payload.kg <= 0:
        errors["kg"] = "positive"
    tiers = sorted({q: c for q, c in payload.tiers if q > 0 and c > 0}.items())
    # Без оптовых ступеней товар продаётся только в розницу. Поставщик указывает опт обязательно.
    if not tiers and not team:
        errors["tiers"] = "required"
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
        is_new = product is None
        if is_new:
            product = Product(supplier=supplier, slug=unique_slug(supplier, sku or "item"))
        product.category = category
        product.title_zh = payload.zh.strip()
        if team:
            product.title_ru = payload.ru.strip()
            product.description_ru = payload.desc.strip()
            product.sku = sku
            product.source_url = payload.src.strip()
            product.status = Product.Status.PUBLISHED
        else:
            # Без русского названия в карточке пока китайское, модератор переведёт перед публикацией.
            product.title_ru = payload.ru.strip() or (product.title_ru if not is_new else "") or product.title_zh
            product.description_zh = payload.desc.strip()
            if is_new:
                product.sku = sku
            # Любая правка поставщика снова проходит модерацию.
            product.status = Product.Status.MODERATION
        product.price_cny = payload.price
        product.sale_percent = payload.sale
        product.weight_kg = payload.kg
        product.bulky = payload.bulky
        product.moderation_note = ""
        product.full_clean(exclude=["slug"])
        product.save()
        product.tiers.all().delete()
        PriceTier.objects.bulk_create([PriceTier(product=product, min_qty=q, price_cny=c) for q, c in tiers])
    return product_out(request, _my_products(supplier).get(pk=product.pk))


@router.post("/products", summary="Добавить товар (от команды сразу на сайт, от поставщика на модерацию)")
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
        raise HttpError(400, f"{exc} / 不是图片文件或文件太大") from exc


@router.post("/products/{product_id}/image", summary="Загрузить главное фото товара")
def upload_image(request, product_id: int, file: UploadedFile = File(...)):
    supplier = current_supplier(request)
    product = get_object_or_404(Product, pk=product_id, supplier=supplier)
    content = _photo(file)
    with transaction.atomic():
        product.images.update(position=F("position") + 1)
        ProductImage.objects.create(product=product, image=content, position=0)
        if not is_team(request):
            product.status = Product.Status.MODERATION
            product.save(update_fields=["status", "updated_at"])
    return product_out(request, _my_products(supplier).get(pk=product.pk))


@router.post("/import", summary="Загрузить каталог: Excel и/или ZIP с фото по артикулам")
def import_view(request, file: UploadedFile | None = File(None), photos: UploadedFile | None = File(None),
                publish: Form[bool] = False):
    supplier = current_supplier(request)
    # Сразу на сайт может выложить только команда, у поставщика товары идут на модерацию.
    result = import_catalog(file, supplier, photos=photos, publish=publish and is_team(request))
    return {"ok": result.ok, "created": result.created, "updated": result.updated, "photos": result.photos,
            "errors": result.errors, "warnings": result.warnings}


@router.get("/template", summary="Шаблон Excel")
def template(request):
    response = HttpResponse(build_template(),
                            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = 'attachment; filename="astta-catalog-template.xlsx"'
    return response


# ---------- Заказы ----------

class ShipIn(Schema):
    tracking: str


def supplier_order_out(request, so):
    return {
        "id": so.pk, "num": so.order.number, "date": timezone.localtime(so.created_at).strftime("%d.%m %H:%M"),
        "mode": so.order.mode, "status": so.status, "tracking": so.tracking,
        "items": [{
            "product": item.product_id, "zh": item.product.title_zh, "ru": item.title,
            "img": image_url(request, item.product),
            "size": item.size, "qty": item.qty, "unit": item.unit_cny,
        } for item in so.items.all()],
    }


def _my_orders(supplier):
    return (SupplierOrder.objects.filter(supplier=supplier).select_related("order")
            .prefetch_related("items__product__images"))


@router.get("/orders", summary="Заказы поставщику (последние 200)")
def orders(request):
    supplier = current_supplier(request)
    return [supplier_order_out(request, so) for so in _my_orders(supplier)[:200]]


def _act(request, order_id, action, tracking=""):
    supplier = current_supplier(request)
    so = get_object_or_404(_my_orders(supplier), pk=order_id)
    try:
        supplier_action(so, action, tracking)
    except SupplierOrderError as exc:
        raise HttpError(409, str(exc)) from exc
    return supplier_order_out(request, _my_orders(supplier).get(pk=so.pk))


@router.post("/orders/{order_id}/confirm", summary="Товар в наличии")
def confirm_order(request, order_id: int):
    return _act(request, order_id, "confirm")


@router.post("/orders/{order_id}/cancel", summary="Нет в наличии")
def cancel_order(request, order_id: int):
    return _act(request, order_id, "cancel")


@router.post("/orders/{order_id}/ship", summary="Отправлено на склад TT")
def ship_order(request, order_id: int, payload: ShipIn):
    return _act(request, order_id, "ship", payload.tracking)


# ---------- Выплаты ----------

@router.get("/payouts", summary="Выплаты в юанях")
def payouts(request):
    supplier = current_supplier(request)
    items = (Payout.objects.filter(supplier=supplier).annotate(orders=Count("supplier_orders"))
             .order_by("-created_at")[:50])
    paid = Payout.objects.filter(supplier=supplier, status=Payout.Status.PAID).aggregate(s=Sum("amount_cny"))["s"]
    return {
        "pending_cny": _pending_sum(supplier),
        "paid_total_cny": paid or Decimal("0"),
        "payout_details": supplier.payout_details,
        "items": [{
            "date": timezone.localtime(p.paid_at or p.created_at).strftime("%d.%m.%Y"), "orders": p.orders,
            "amount": p.amount_cny, "status": p.status,
        } for p in items],
    }


# ---------- Магазин ----------

class ShopIn(Schema):
    name_zh: str = ""
    city: str = ""
    about: str = ""
    wechat: str = ""
    phone: str = ""
    payout_details: str = ""


def shop_out(s):
    return {
        "code": s.code, "name": s.name, "name_zh": s.name_zh, "city": s.city, "about": s.about, "wechat": s.wechat,
        "phone": s.phone, "payout_details": s.payout_details,
        "fact": [s.fact_days_min, s.fact_days_max] if s.fact_days_min and s.fact_days_max else None,
    }


@router.get("/shop", summary="Настройки магазина")
def shop(request):
    return shop_out(current_supplier(request))


@router.put("/shop", summary="Сохранить настройки магазина")
def save_shop(request, payload: ShopIn):
    supplier = current_supplier(request)
    # Русское название видят покупатели, его меняет только модератор.
    for field in ("name_zh", "city", "about", "wechat", "phone", "payout_details"):
        setattr(supplier, field, getattr(payload, field).strip())
    supplier.full_clean()
    supplier.save()
    return shop_out(supplier)


# ---------- Контент-завод ----------

class FactoryIn(Schema):
    new_items: bool
    weekly: bool
    restock: bool
    per_day: int


class PostIn(Schema):
    product: int | None = None
    kind: str = SupplierPost.Kind.NEW
    text: str


def factory_out(f):
    return {"new_items": f.new_items, "weekly": f.weekly, "restock": f.restock, "per_day": f.per_day}


@router.get("/factory", summary="Настройки контент-завода")
def factory(request):
    settings_, _ = FactorySettings.objects.get_or_create(supplier=current_supplier(request))
    return factory_out(settings_)


@router.put("/factory", summary="Сохранить настройки контент-завода")
def save_factory(request, payload: FactoryIn):
    settings_, _ = FactorySettings.objects.get_or_create(supplier=current_supplier(request))
    settings_.new_items, settings_.weekly, settings_.restock = payload.new_items, payload.weekly, payload.restock
    settings_.per_day = payload.per_day
    settings_.full_clean()
    settings_.save()
    return factory_out(settings_)


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


@router.post("/posts", summary="Пост в ленту: текст и до 10 фото")
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
        raise HttpError(422, "Добавьте текст или фото / 内容不能为空")
    if len(images) > MAX_POST_IMAGES:
        raise HttpError(422, f"Не больше {MAX_POST_IMAGES} фото в посте")
    contents = [_photo(f) for f in images]
    team = is_team(request)
    with transaction.atomic():
        # Пост команды сразу в ленте и на русском. Пост поставщика ждёт перевода и модерации.
        post = SupplierPost.objects.create(
            supplier=supplier, product=product, kind=payload.kind, author=request.user,
            text="" if team else text, text_ru=text if team else "",
            status=SupplierPost.Status.PUBLISHED if team else SupplierPost.Status.MODERATION,
        )
        for position, content in enumerate(contents):
            PostImage.objects.create(post=post, image=content, position=position)
    return post_out(request, post)


@router.delete("/posts/{post_id}", summary="Удалить пост")
def delete_post(request, post_id: int):
    supplier = current_supplier(request)
    post = get_object_or_404(SupplierPost, pk=post_id, supplier=supplier)
    if not is_team(request) and post.status == SupplierPost.Status.PUBLISHED:
        raise HttpError(403, "Опубликованный пост удаляет модератор")
    files = [(img.image.storage, img.image.name) for img in post.images.all()]
    post.delete()
    for storage, name in files:
        storage.delete(name)
    return {"ok": True}
