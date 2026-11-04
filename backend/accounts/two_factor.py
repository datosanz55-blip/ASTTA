"""Второй шаг входа в админку: код из приложения-аутентификатора (Яндекс Ключ, Google Authenticator)."""

import base64
from io import BytesIO

import qrcode
import qrcode.image.svg
from django import forms
from django.contrib import admin
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.safestring import mark_safe
from django.views.decorators.cache import never_cache
from django_otp import login as otp_login
from django_otp import match_token
from django_otp.plugins.otp_totp.models import TOTPDevice
from unfold.widgets import UnfoldAdminTextInputWidget


class CodeForm(forms.Form):
    code = forms.CharField(label="Код из приложения", max_length=8, min_length=6, widget=UnfoldAdminTextInputWidget(
        attrs={"autocomplete": "one-time-code", "inputmode": "numeric", "autofocus": True}))

    def clean_code(self):
        return self.cleaned_data["code"].replace(" ", "")


def _next_url(request) -> str:
    target = request.POST.get("next") or request.GET.get("next") or ""
    if url_has_allowed_host_and_scheme(target, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        return target
    return reverse("admin:index")


def _with_next(name: str, request) -> str:
    target = request.GET.get("next")
    return f"{reverse(name)}?next={target}" if target else reverse(name)


def _render(request, template, **context):
    return render(request, template, {**admin.site.each_context(request), "next": request.GET.get("next", ""),
                                      **context})


def _has_device(user) -> bool:
    return TOTPDevice.objects.filter(user=user, confirmed=True).exists()


@never_cache
@login_required(login_url="admin:login")
def verify(request):
    if not request.user.is_staff:
        return redirect("admin:login")
    if not _has_device(request.user):
        return redirect(_with_next("two_factor_setup", request))
    form = CodeForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        # У TOTP-устройства своя защита от подбора: после неверного кода пауза растёт.
        device = match_token(request.user, form.cleaned_data["code"])
        if device is not None:
            otp_login(request, device)
            return redirect(_next_url(request))
        form.add_error("code", "Код не подошёл. Проверьте время на телефоне и введите новый код.")
    return _render(request, "accounts/two_factor.html", form=form, title="Код из приложения")


@never_cache
@login_required(login_url="admin:login")
def setup(request):
    if not request.user.is_staff:
        return redirect("admin:login")
    if _has_device(request.user):
        return redirect(_with_next("two_factor", request))
    device = (TOTPDevice.objects.filter(user=request.user, confirmed=False).first()
              or TOTPDevice.objects.create(user=request.user, name="Телефон", confirmed=False))
    form = CodeForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        if device.verify_token(form.cleaned_data["code"]):
            device.confirmed = True
            device.save(update_fields=["confirmed"])
            otp_login(request, device)
            return redirect(_next_url(request))
        form.add_error("code", "Код не подошёл. Отсканируйте QR-код ещё раз и введите свежий код.")
    buffer = BytesIO()
    qrcode.make(device.config_url, image_factory=qrcode.image.svg.SvgPathImage, box_size=8).save(buffer)
    secret = base64.b32encode(device.bin_key).decode().rstrip("=")
    return _render(request, "accounts/two_factor_setup.html", form=form, title="Подключите приложение",
                   qr=mark_safe(buffer.getvalue().decode()),
                   secret=" ".join(secret[i:i + 4] for i in range(0, len(secret), 4)))
