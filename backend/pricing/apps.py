from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class PricingConfig(AppConfig):
    name = "pricing"
    verbose_name = _("Цены и доставка")
