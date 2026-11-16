"""Одноразовые коды: хеш в БД, привязка к браузеру/покупателю, лимиты и защита от повторного входа."""

import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from accounts.models import EmailChallenge, EmailIdentity, User
from config.budget import take

log = logging.getLogger(__name__)
CODE_MINUTES = 10
MAX_ATTEMPTS = 5
RESEND_SECONDS = 60
ADDRESS_HOURLY_LIMIT = 6
INVALID_CODE = "Код неверный или устарел. Запросите новый код."


class EmailAuthError(Exception):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


def enabled():
    return bool(settings.EMAIL_LOGIN_ENABLED and settings.EMAIL_HOST and settings.DEFAULT_FROM_EMAIL)


def digest(value):
    return salted_hmac("astta.email-login", value, algorithm="sha256").hexdigest()


def normalize_email(value):
    email = value.strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        raise EmailAuthError("Проверьте адрес почты") from None
    if len(email) > 254:
        raise EmailAuthError("Проверьте адрес почты")
    return email


def _buyer_allowed(user):
    return user.is_active and not user.is_staff and not user.is_superuser and user.role == User.Role.BUYER


def start(email, purpose, consent_at, *, browser_key="", buyer=None):
    if not enabled():
        raise EmailAuthError("Вход по почте пока не подключён", 503)
    email = normalize_email(email)
    if purpose == EmailChallenge.Purpose.LINK:
        if buyer is None or not _buyer_allowed(buyer):
            raise EmailAuthError("Сначала войдите в аккаунт", 401)
        if EmailIdentity.objects.filter(user=buyer).exists():
            raise EmailAuthError("К аккаунту уже привязана почта", 409)
    elif purpose != EmailChallenge.Purpose.LOGIN or not browser_key or buyer is not None:
        raise EmailAuthError("Недопустимый способ входа")

    key = digest(email)
    if not cache.add(f"email-code:cooldown:{key}", 1, RESEND_SECONDS):
        raise EmailAuthError("Новый код можно запросить через минуту", 429)
    hour_key = f"email-code:hour:{timezone.now():%Y%m%d%H}:{key}"
    cache.add(hour_key, 0, 3600)
    try:
        address_count = cache.incr(hour_key)
    except ValueError:
        cache.set(hour_key, 1, 3600)
        address_count = 1
    if address_count > ADDRESS_HOURLY_LIMIT:
        raise EmailAuthError("Слишком много писем на этот адрес. Попробуйте позже", 429)
    if not take("email-login", settings.EMAIL_LOGIN_DAILY_LIMIT):
        raise EmailAuthError("Отправка кодов временно недоступна. Попробуйте позже", 429)

    now = timezone.now()
    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        # Повторный запрос отменяет предыдущий код только из этого же контекста.
        EmailChallenge.objects.filter(email=email, purpose=purpose, browser_key=browser_key,
                                      buyer=buyer, consumed_at__isnull=True).update(consumed_at=now)
        challenge = EmailChallenge(email=email, purpose=purpose, buyer=buyer, browser_key=browser_key,
                                   consent_at=consent_at, expires_at=now + timedelta(minutes=CODE_MINUTES))
        challenge.code_hash = digest(f"{challenge.pk}:{code}")
        challenge.save()
    action = "привязки почты к аккаунту" if purpose == EmailChallenge.Purpose.LINK else "входа"
    try:
        sent = send_mail(
            "Код подтверждения ASTTA",
            f"Ваш код для {action} в ASTTA: {code}\n\n"
            f"Он действует {CODE_MINUTES} минут и подходит только для одного входа или привязки.\n"
            "Никому не сообщайте этот код. Если вы его не запрашивали, просто удалите письмо.",
            settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False,
        )
        if sent != 1:
            raise RuntimeError("mail-not-sent")
    except Exception as exc:  # SMTP не должен раскрывать адреса, настройки или код через ответ/журнал.
        EmailChallenge.objects.filter(pk=challenge.pk).update(consumed_at=timezone.now())
        cache.delete(f"email-code:cooldown:{key}")
        log.warning("Не удалось отправить код входа: %s", exc.__class__.__name__)
        raise EmailAuthError("Не удалось отправить письмо. Попробуйте позже", 503) from None
    return challenge


def _account(challenge, buyer):
    identity = EmailIdentity.objects.select_for_update().filter(email=challenge.email).first()
    if challenge.purpose == EmailChallenge.Purpose.LINK:
        # Блокировка покупателя сериализует одновременную привязку разных адресов.
        user = User.objects.select_for_update().get(pk=buyer.pk)
        if not _buyer_allowed(user):
            raise EmailAuthError("Аккаунт недоступен", 403)
        if identity is not None and identity.user_id != user.pk:
            raise EmailAuthError("Эта почта уже привязана к другому аккаунту. Войдите по ней; "
                                 "автоматического объединения аккаунтов нет", 409)
        if EmailIdentity.objects.filter(user=user).exclude(email=challenge.email).exists():
            raise EmailAuthError("К аккаунту уже привязана другая почта", 409)
    elif identity is not None:
        user = User.objects.select_for_update().get(pk=identity.user_id)
        if not _buyer_allowed(user):
            raise EmailAuthError("Вход в этот аккаунт недоступен", 403)
    else:
        # Никогда не связываем с User.email: старый адрес мог быть не подтверждён.
        user = User.objects.create_user(username=f"email_{secrets.token_hex(16)}", email=challenge.email,
                                        pd_consent_at=challenge.consent_at)
    if identity is None:
        EmailIdentity.objects.create(user=user, email=challenge.email)
    user.email = challenge.email
    user.pd_consent_at = challenge.consent_at
    user.save(update_fields=["email", "pd_consent_at"])
    return user


def verify(challenge_id, code, *, browser_key="", buyer=None):
    if not enabled():
        raise EmailAuthError("Вход по почте пока не подключён", 503)
    error, user = None, None
    now = timezone.now()
    with transaction.atomic():
        challenge = EmailChallenge.objects.select_for_update().filter(pk=challenge_id).first()
        if challenge is None:
            error = EmailAuthError(INVALID_CODE)
        elif (challenge.purpose == EmailChallenge.Purpose.LINK and
              (buyer is None or challenge.buyer_id != buyer.pk)) or \
                (challenge.purpose == EmailChallenge.Purpose.LOGIN and
                 (buyer is not None or not browser_key or
                  not constant_time_compare(challenge.browser_key, browser_key))):
            error = EmailAuthError(INVALID_CODE)
        elif challenge.consumed_at is not None or challenge.expires_at <= now or challenge.attempts >= MAX_ATTEMPTS:
            error = EmailAuthError(INVALID_CODE)
        else:
            challenge.attempts += 1
            if not constant_time_compare(challenge.code_hash, digest(f"{challenge.pk}:{code}")):
                if challenge.attempts >= MAX_ATTEMPTS:
                    challenge.consumed_at = now
                challenge.save(update_fields=["attempts", "consumed_at"])
                error = EmailAuthError(INVALID_CODE)
            else:
                try:
                    with transaction.atomic():
                        user = _account(challenge, buyer)
                except IntegrityError:
                    error = EmailAuthError("Аккаунт изменился. Запросите новый код", 409)
                except EmailAuthError as exc:
                    error = exc
                # Любой правильно введённый код становится недействительным, в том числе при конфликте.
                challenge.consumed_at = now
                challenge.save(update_fields=["attempts", "consumed_at"])
    # Ошибку поднимаем после транзакции: иначе счётчик попыток откатится.
    if error:
        raise error
    return user
