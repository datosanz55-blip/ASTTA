from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class AccountsConfig(AppConfig):
    name = "accounts"
    verbose_name = _("Пользователи")

    def ready(self):
        from accounts import security  # noqa: F401 — подписка на неудачные входы
