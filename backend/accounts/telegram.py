"""Вход покупателя через Telegram: на сайте (виджет «Войти через Telegram») и в мини-приложении внутри Telegram.

Пароля у покупателя нет. Telegram подписывает данные о человеке ключом нашего бота, мы проверяем подпись:
подделать вход, не зная токена бота, нельзя. Способы проверки у виджета и мини-приложения разные:
- виджет: ключ = SHA-256(токен бота);
- мини-приложение (initData): ключ = HMAC-SHA-256 с ключом "WebAppData" от токена бота.
Документация: core.telegram.org/widgets/login и core.telegram.org/bots/webapps.
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from django.conf import settings

from accounts.models import User


class TelegramAuthError(Exception):
    pass


@dataclass
class TelegramUser:
    id: int
    username: str = ""
    first_name: str = ""
    last_name: str = ""
    photo_url: str = ""


def _token() -> str:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise TelegramAuthError("Вход через Telegram не настроен: нет токена бота")
    return settings.TELEGRAM_BOT_TOKEN


def _check_hash(fields: dict, received: str, secret: bytes):
    check_string = "\n".join(f"{key}={fields[key]}" for key in sorted(fields))
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not received or not hmac.compare_digest(expected, received):
        raise TelegramAuthError("Подпись Telegram не сходится")


def _check_age(auth_date):
    try:
        signed_at = int(auth_date)
    except (TypeError, ValueError):
        raise TelegramAuthError("Нет даты входа") from None
    now = time.time()
    # Старые данные не принимаем: перехваченную ссылку входа нельзя использовать через сутки.
    if now - signed_at > settings.TELEGRAM_AUTH_MAX_AGE or signed_at - now > 60:
        raise TelegramAuthError("Данные входа устарели, войдите ещё раз")


def verify_login_widget(data: dict) -> TelegramUser:
    """Данные от виджета на сайте: id, first_name, last_name, username, photo_url, auth_date, hash."""
    fields = {key: str(value) for key, value in data.items() if value not in (None, "")}
    received = fields.pop("hash", "")
    _check_hash(fields, received, hashlib.sha256(_token().encode()).digest())
    _check_age(fields.get("auth_date"))
    try:
        user_id = int(fields["id"])
    except (KeyError, ValueError):
        raise TelegramAuthError("Нет Telegram ID") from None
    return TelegramUser(user_id, fields.get("username", ""), fields.get("first_name", ""),
                        fields.get("last_name", ""), fields.get("photo_url", ""))


def verify_webapp_init_data(init_data: str) -> TelegramUser:
    """Строка initData мини-приложения (window.Telegram.WebApp.initData)."""
    try:
        fields = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError:
        raise TelegramAuthError("Неверные данные мини-приложения") from None
    received = fields.pop("hash", "")
    secret = hmac.new(b"WebAppData", _token().encode(), hashlib.sha256).digest()
    _check_hash(fields, received, secret)
    _check_age(fields.get("auth_date"))
    try:
        user = json.loads(fields["user"])
        user_id = int(user["id"])
    except (KeyError, ValueError, TypeError):
        raise TelegramAuthError("Нет данных пользователя") from None
    return TelegramUser(user_id, user.get("username") or "", user.get("first_name") or "",
                        user.get("last_name") or "", user.get("photo_url") or "")


def buyer_for(tg: TelegramUser) -> User:
    """Покупатель по Telegram ID: при первом входе создаём, дальше обновляем имя и ник."""
    user = User.objects.filter(telegram_id=tg.id).first()
    if user is None:
        user = User(username=f"tg{tg.id}", telegram_id=tg.id, role=User.Role.BUYER)
        user.set_unusable_password()
    elif user.is_staff or user.is_superuser or user.role != User.Role.BUYER:
        # Иначе вход через Telegram открыл бы админку без пароля и кода из приложения.
        raise TelegramAuthError("Сотрудники входят в админку по паролю, а не через Telegram")
    if not user.is_active and user.pk:
        raise TelegramAuthError("Аккаунт отключён, напишите в поддержку")
    changed = {"first_name": tg.first_name[:150], "last_name": tg.last_name[:150],
               "telegram_username": tg.username[:64], "telegram_photo_url": tg.photo_url[:500]}
    if user.pk is None or any(getattr(user, key) != value for key, value in changed.items()):
        for key, value in changed.items():
            setattr(user, key, value)
        user.save()
    return user
