"""Покупатель: вход через Telegram на сайте и в мини-приложении, профиль и его заказы.

Сайт: GET /api/auth/csrf → POST /api/auth/telegram с данными виджета и заголовком X-CSRFToken → сессия в cookie.
После входа токен защиты меняется: перед следующим POST сайт снова берёт его через /api/auth/csrf.
Мини-приложение: каждый запрос с заголовком «Authorization: tma <initData>», сервер проверяет подпись каждый раз.
Cookie в мини-приложении не используем: в Telegram Web оно открыто во фрейме, и браузер их не сохранит.
"""

from django.conf import settings
from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError
from ninja.utils import check_csrf

from accounts.models import User
from accounts.telegram import TelegramAuthError, buyer_for, verify_login_widget, verify_webapp_init_data
from config.throttles import per_ip

router = Router(tags=["Покупатель"])
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def current_buyer(request) -> User | None:
    """Покупатель запроса или None. Сотрудник, вошедший в админку, на сайте считается гостем."""
    header = request.headers.get("Authorization", "")
    if header.startswith("tma "):
        try:
            return buyer_for(verify_webapp_init_data(header[4:]))
        except TelegramAuthError as exc:
            raise HttpError(401, str(exc)) from exc
    user = request.user
    if user.is_authenticated and not user.is_staff and user.role == User.Role.BUYER:
        # С сессией в cookie чужой сайт мог бы отправить запрос от имени покупателя — проверяем CSRF-токен.
        if request.method not in SAFE_METHODS and check_csrf(request):
            raise HttpError(403, "Обновите страницу и повторите: устарел токен защиты")
        return user
    return None


CONSENT_REQUIRED = "Нужно согласие на обработку персональных данных: отметьте галочку"


def require_consent(given: bool):
    """Без отметки согласия персональные данные не принимаем (152-ФЗ)."""
    if not given:
        raise HttpError(422, CONSENT_REQUIRED)
    return timezone.now()


def buyer_contact(buyer: User | None, contact: str) -> str:
    """Контакт для заказа: что ввёл покупатель, иначе его ник в Telegram."""
    contact = contact.strip()
    if not contact and buyer is not None:
        contact = f"@{buyer.telegram_username}" if buyer.telegram_username else f"tg://user?id={buyer.telegram_id}"
    return contact


class TelegramWidgetIn(Schema):
    id: int
    first_name: str = ""
    last_name: str = ""
    username: str = ""
    photo_url: str = ""
    auth_date: int
    hash: str
    consent: bool = False  # галочка согласия на сайте, в подпись Telegram не входит


class OrderBrief(Schema):
    number: str
    token: str
    status: str
    status_label: str
    total_rub: str
    created_at: str


class StatsOut(Schema):
    orders: int
    active: int
    delivered: int
    spent_rub: str


class MeOut(Schema):
    telegram_id: int | None
    username: str
    first_name: str
    last_name: str
    photo_url: str
    member_since: str
    phone: str
    city: str
    delivery_address: str
    measures: dict
    stats: StatsOut
    orders: list[OrderBrief]
    avatar_url: str = ""
    pay_method: str = ""
    favorites: list[str] = []


MEASURE_KEYS = {"height": (100, 230), "chest": (60, 160), "waist": (40, 160), "hips": (60, 180), "foot": (15, 35)}


class ProfileIn(Schema):
    pay_method: str | None = None
    phone: str | None = None
    city: str | None = None
    delivery_address: str | None = None
    measures: dict | None = None


def buyer_stats(user: User) -> dict:
    from django.db.models import F, Sum

    from orders.models import Order

    orders = Order.objects.filter(buyer=user)
    paid = orders.filter(paid_at__isnull=False).exclude(status=Order.Status.CANCELLED)
    spent = paid.aggregate(s=Sum(F("total_rub") - F("refund_rub")))["s"] or 0
    done = {Order.Status.DELIVERED, Order.Status.CANCELLED, Order.Status.AWAITING_PAYMENT}
    return {
        "orders": orders.count(),
        "active": orders.exclude(status__in=done).count(),
        "delivered": orders.filter(status=Order.Status.DELIVERED).count(),
        "spent_rub": str(spent),
    }


def me_out(user: User) -> dict:
    orders = user.orders.order_by("-created_at")[:50]
    return {
        "telegram_id": user.telegram_id, "username": user.telegram_username, "first_name": user.first_name,
        "last_name": user.last_name, "photo_url": user.avatar.url if user.avatar else user.telegram_photo_url,
        "avatar_url": user.avatar.url if user.avatar else "", "pay_method": user.pay_method,
        "favorites": list(user.favorites.values_list("product__slug", flat=True)[:500]),
        "member_since": user.date_joined.date().isoformat(),
        "phone": user.phone, "city": user.city, "delivery_address": user.delivery_address,
        "measures": user.measures or {}, "stats": buyer_stats(user),
        "orders": [{"number": o.number, "token": str(o.token), "status": o.status,
                    "status_label": o.get_status_display(), "total_rub": str(o.total_rub),
                    "created_at": o.created_at.isoformat()} for o in orders],
    }


@router.get("/auth/config", summary="Ник бота для кнопки «Войти через Telegram»")
def auth_config(request):
    return {"bot_username": settings.TELEGRAM_BOT_USERNAME, "enabled": bool(settings.TELEGRAM_BOT_TOKEN)}


@router.get("/auth/csrf", summary="Токен защиты от подделки запросов: передавайте его в заголовке X-CSRFToken")
def csrf(request):
    return {"csrf": get_token(request)}


@router.post("/auth/telegram", response=MeOut, throttle=[per_ip("tg_login", "20/m")],
             summary="Вход на сайте через виджет Telegram")
def telegram_login(request, payload: TelegramWidgetIn):
    # Без токена чужой сайт мог бы незаметно войти покупателем под своим аккаунтом и увидеть его заказы.
    if check_csrf(request):
        raise HttpError(403, "Обновите страницу и войдите ещё раз")
    consent_at = require_consent(payload.consent)
    try:
        user = buyer_for(verify_login_widget(payload.dict(exclude={"consent"})))
    except TelegramAuthError as exc:
        raise HttpError(401, str(exc)) from exc
    User.objects.filter(pk=user.pk).update(pd_consent_at=consent_at)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return me_out(user)


@router.post("/auth/logout", summary="Выйти на сайте")
def telegram_logout(request):
    if request.user.is_authenticated and check_csrf(request):
        raise HttpError(403, "Обновите страницу и повторите")
    logout(request)
    return {"ok": True}


@router.get("/me", response=MeOut, throttle=[per_ip("me", "120/m")], summary="Профиль покупателя и его заказы")
def me(request):
    buyer = current_buyer(request)
    if buyer is None:
        raise HttpError(401, "Войдите через Telegram")
    return me_out(buyer)


@router.patch("/me", response=MeOut, throttle=[per_ip("me_edit", "30/m")],
              summary="Изменить свои данные: телефон, город, пункт выдачи, мерки")
def me_update(request, payload: ProfileIn):
    buyer = current_buyer(request)
    if buyer is None:
        raise HttpError(401, "Войдите через Telegram")
    fields = []
    for name, limit in (("phone", 32), ("city", 80), ("delivery_address", 300)):
        value = getattr(payload, name)
        if value is not None:
            setattr(buyer, name, value.strip()[:limit])
            fields.append(name)
    if payload.pay_method is not None:
        if payload.pay_method not in ("", *User.PayMethod.values):
            raise HttpError(422, "Способ оплаты: sbp или card")
        buyer.pay_method = payload.pay_method
        fields.append("pay_method")
    if payload.measures is not None:
        clean = {}
        for key, (low, high) in MEASURE_KEYS.items():
            raw = payload.measures.get(key)
            if raw in (None, ""):
                continue
            try:
                value = float(raw)
            except (TypeError, ValueError):
                raise HttpError(422, "Мерки: только числа в сантиметрах") from None
            if not low <= value <= high:
                raise HttpError(422, f"Мерка {key}: от {low} до {high} см")
            clean[key] = value
        buyer.measures = clean
        fields.append("measures")
    if fields:
        buyer.save(update_fields=fields)
    return me_out(buyer)


# ---------- Избранное, недавно смотрели, рекомендации, аватар, история чата ----------

VIEWS_KEEP = 40


def _buyer_or_401(request) -> User:
    buyer = current_buyer(request)
    if buyer is None:
        raise HttpError(401, "Войдите через Telegram")
    return buyer


def _published():
    from catalog.models import Product

    return (Product.objects.filter(status=Product.Status.PUBLISHED, supplier__is_active=True)
            .select_related("category", "supplier").prefetch_related("tiers", "images"))


def _cards(request, products) -> list[dict]:
    from catalog.api import _card, _pricing_context

    ctx = _pricing_context()
    return [_card(request, p, ctx) for p in products]


def _product(slug: str):
    product = _published().filter(slug=slug).first()
    if product is None:
        raise HttpError(404, "Товар не найден")
    return product


class SlugsIn(Schema):
    slugs: list[str] = []


@router.get("/me/favorites", summary="Избранное: карточки товаров")
def favorites(request):
    buyer = _buyer_or_401(request)
    ids = list(buyer.favorites.values_list("product_id", flat=True)[:200])
    products = {p.pk: p for p in _published().filter(pk__in=ids)}
    return _cards(request, [products[i] for i in ids if i in products])


@router.put("/me/favorites/{slug}", throttle=[per_ip("fav", "120/m")], summary="Добавить в избранное")
def favorite_add(request, slug: str):
    from accounts.models import Favorite

    buyer = _buyer_or_401(request)
    Favorite.objects.get_or_create(user=buyer, product=_product(slug))
    return {"ok": True}


@router.delete("/me/favorites/{slug}", throttle=[per_ip("fav", "120/m")], summary="Убрать из избранного")
def favorite_remove(request, slug: str):
    buyer = _buyer_or_401(request)
    buyer.favorites.filter(product__slug=slug).delete()
    return {"ok": True}


@router.post("/me/favorites", throttle=[per_ip("fav_sync", "20/m")],
             summary="После входа: добавить избранное, собранное до входа, и вернуть всё избранное")
def favorites_sync(request, payload: SlugsIn):
    from accounts.models import Favorite

    buyer = _buyer_or_401(request)
    have = set(buyer.favorites.values_list("product__slug", flat=True))
    new = [p for p in _published().filter(slug__in=payload.slugs[:200]) if p.slug not in have]
    Favorite.objects.bulk_create([Favorite(user=buyer, product=p) for p in new], ignore_conflicts=True)
    return {"favorites": list(buyer.favorites.values_list("product__slug", flat=True)[:500])}


@router.post("/me/viewed/{slug}", throttle=[per_ip("viewed", "120/m")], summary="Отметить, что товар смотрели")
def viewed_add(request, slug: str):
    from accounts.models import ProductView

    buyer = _buyer_or_401(request)
    ProductView.objects.update_or_create(user=buyer, product=_product(slug), defaults={"viewed_at": timezone.now()})
    stale = list(buyer.views.values_list("pk", flat=True)[VIEWS_KEEP:])
    if stale:
        ProductView.objects.filter(pk__in=stale).delete()
    return {"ok": True}


@router.get("/me/viewed", summary="Недавно смотрели")
def viewed(request):
    buyer = _buyer_or_401(request)
    ids = list(buyer.views.values_list("product_id", flat=True)[:VIEWS_KEEP])
    products = {p.pk: p for p in _published().filter(pk__in=ids)}
    return _cards(request, [products[i] for i in ids if i in products])


@router.delete("/me/viewed", summary="Очистить «Недавно смотрели»")
def viewed_clear(request):
    buyer = _buyer_or_401(request)
    buyer.views.all().delete()
    return {"ok": True}


@router.get("/me/recommended", summary="Для вас: по избранному, просмотрам и покупкам")
def recommended(request):
    from collections import Counter

    from orders.models import OrderItem

    buyer = _buyer_or_401(request)
    bought = set(OrderItem.objects.filter(order__buyer=buyer, product__isnull=False)
                 .values_list("product_id", flat=True))
    liked = set(buyer.favorites.values_list("product_id", flat=True))
    seen = list(buyer.views.values_list("product_id", flat=True)[:VIEWS_KEEP])
    weights = Counter()
    for ids, weight in ((liked, 3), (bought, 3), (seen, 1)):
        for cat in _published().filter(pk__in=ids).values_list("category_id", flat=True):
            weights[cat] += weight
    skip = bought | liked
    picked = []
    top = [cat for cat, _ in weights.most_common(4)]
    if top:
        pool = _published().filter(category_id__in=top).exclude(pk__in=skip).order_by("-sold_count", "-pk")[:60]
        rank = {cat: i for i, cat in enumerate(top)}
        # Сначала то, что ещё не смотрели, из самых любимых категорий.
        picked = sorted(pool, key=lambda p: (p.pk in seen, rank[p.category_id]))[:12]
    if len(picked) < 12:
        more = _published().exclude(pk__in=skip | {p.pk for p in picked}).order_by("-sold_count", "-pk")
        picked += list(more[:12 - len(picked)])
    return _cards(request, picked)


@router.post("/me/avatar", throttle=[per_ip("avatar", "10/m")], summary="Поставить свой аватар")
def avatar_upload(request):
    from catalog.images import ImageError, prepare_image, private_name

    buyer = _buyer_or_401(request)
    photo = request.FILES.get("photo")
    if photo is None:
        raise HttpError(422, "Выберите фото")
    if photo.size and photo.size > 10 * 1024 * 1024:
        raise HttpError(413, "Фото больше 10 МБ")
    try:
        content = prepare_image(photo.read(), private_name())
    except ImageError as exc:
        raise HttpError(400, str(exc)) from exc
    old = buyer.avatar.name if buyer.avatar else ""
    buyer.avatar.save(content.name, content, save=True)
    if old:
        buyer.avatar.storage.delete(old)
    return me_out(buyer)


@router.delete("/me/avatar", summary="Убрать свой аватар (вернётся аватар из Telegram)")
def avatar_remove(request):
    buyer = _buyer_or_401(request)
    if buyer.avatar:
        buyer.avatar.delete(save=True)
    return me_out(buyer)


@router.get("/me/ai-history", summary="История вопросов к ASTTA AI")
def ai_history(request):
    buyer = _buyer_or_401(request)
    logs = buyer.ai_logs.filter(kind="chat").order_by("-created_at")[:60]
    return [{"id": log.pk, "question": log.request.removeprefix("[фото] "), "photo": log.request.startswith("[фото]"),
             "answer": log.response, "at": log.created_at.isoformat()} for log in logs]


@router.delete("/me/ai-history", summary="Очистить историю чата с ИИ")
def ai_history_clear(request):
    buyer = _buyer_or_401(request)
    # Записи нужны команде, чтобы учить ИИ, поэтому не удаляем, а отвязываем от покупателя: в профиле их больше нет.
    buyer.ai_logs.update(buyer=None)
    return {"ok": True}
