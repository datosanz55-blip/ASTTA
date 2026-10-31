from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path

from accounts import two_factor
from config.api import api


def healthz(request):
    return HttpResponse("ok")


urlpatterns = [
    path(f"{settings.ADMIN_URL}2fa/", two_factor.verify, name="two_factor"),
    path(f"{settings.ADMIN_URL}2fa/setup/", two_factor.setup, name="two_factor_setup"),
    path(settings.ADMIN_URL, admin.site.urls),
    path("healthz", healthz),
    path("api/", api.urls),
    path("i18n/", include("django.conf.urls.i18n")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
