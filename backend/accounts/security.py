"""Защита админки.

- Адрес админки задаётся в DJANGO_ADMIN_URL: по стандартному /admin/ её находят боты.
- ADMIN_ALLOWED_IPS: если задан, админка открывается только с этих адресов и подсетей, остальным — 404.
- После LOGIN_FAIL_LIMIT неверных паролей подряд вход с этого адреса и для этого логина закрыт на LOGIN_LOCK_MINUTES.
- ADMIN_REQUIRE_2FA: после пароля сотрудник вводит код из приложения-аутентификатора (Яндекс Ключ,
  Google Authenticator). При первом входе приложение подключается по QR-коду.
"""

import ipaddress

from django.conf import settings
from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.core.cache import cache
from django.dispatch import receiver
from django.http import Http404, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse


def client_ip(request) -> str:
    """Адрес покупателя или сотрудника. За прокси (Caddy) берём адрес, который дописал сам прокси:
    подставить чужой адрес в X-Forwarded-For клиент так не сможет."""
    proxies = settings.NUM_PROXIES
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if proxies and forwarded:
        addrs = [a.strip() for a in forwarded.split(",") if a.strip()]
        if addrs:
            return addrs[-min(proxies, len(addrs))]
    return request.META.get("REMOTE_ADDR", "")


def _allowed(ip: str) -> bool:
    if not settings.ADMIN_ALLOWED_IPS:
        return True
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(address in ipaddress.ip_network(net, strict=False) for net in settings.ADMIN_ALLOWED_IPS)


def _fail_keys(ip: str, username: str) -> list[str]:
    keys = [f"login-fail:ip:{ip}"]
    if username:
        keys.append(f"login-fail:user:{username.strip().lower()}")
    return keys


def is_locked(ip: str, username: str = "") -> bool:
    return any((cache.get(key) or 0) >= settings.LOGIN_FAIL_LIMIT for key in _fail_keys(ip, username))


@receiver(user_login_failed)
def _count_failure(sender, credentials, request=None, **kwargs):
    if request is None:
        return
    for key in _fail_keys(client_ip(request), credentials.get("username", "")):
        cache.add(key, 0, settings.LOGIN_LOCK_MINUTES * 60)
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, settings.LOGIN_LOCK_MINUTES * 60)


@receiver(user_logged_in)
def _reset_failures(sender, request, user, **kwargs):
    if request is not None:
        cache.delete_many(_fail_keys(client_ip(request), user.get_username()))


LOCKED_PAGE = """<!doctype html><meta charset="utf-8"><title>Вход временно закрыт</title>
<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px">
<h1 style="font-size:22px">Вход временно закрыт</h1>
<p>Слишком много неверных паролей. Попробуйте через {minutes} минут. Если забыли пароль, попросите основателя
сбросить его.</p></body>"""


class AdminGuardMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        prefix = "/" + settings.ADMIN_URL
        if not request.path.startswith(prefix):
            return self.get_response(request)
        ip = client_ip(request)
        if not _allowed(ip):
            raise Http404
        if request.path == reverse("admin:login") and request.method == "POST" and \
                is_locked(ip, request.POST.get("username", "")):
            return HttpResponse(LOCKED_PAGE.format(minutes=settings.LOGIN_LOCK_MINUTES), status=429)
        user = getattr(request, "user", None)
        if settings.ADMIN_REQUIRE_2FA and user is not None and user.is_authenticated and user.is_staff \
                and not user.is_verified():
            free = {reverse("two_factor"), reverse("two_factor_setup"), reverse("admin:logout"),
                    reverse("admin:jsi18n")}
            if request.path not in free:
                return redirect(f"{reverse('two_factor')}?next={request.get_full_path()}")
        return self.get_response(request)
