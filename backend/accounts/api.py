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


MEASURE_KEYS = {"height": (100, 230), "chest": (60, 160), "waist": (40, 160), "hips": (60, 180), "foot": (15, 35)}


class ProfileIn(Schema):
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
        "last_name": user.last_name, "photo_url": user.telegram_photo_url,
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
