from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    class Role(models.TextChoices):
        BUYER = "buyer", _("Покупатель")
        SUPPLIER = "supplier", _("Поставщик")
        AGENT = "agent", _("Агент TT")
        ADMIN = "admin", _("Администратор")

    role = models.CharField(_("роль"), max_length=16, choices=Role.choices, default=Role.BUYER)
    phone = models.CharField(_("телефон"), max_length=32, blank=True)
    telegram_id = models.BigIntegerField("Telegram ID", null=True, blank=True, unique=True)
    telegram_username = models.CharField(_("ник в Telegram"), max_length=64, blank=True)
    telegram_photo_url = models.URLField(_("аватар в Telegram"), max_length=500, blank=True)
    # Профиль покупателя на сайте: подставляем в заказ, чтобы не вводить каждый раз.
    city = models.CharField(_("город"), max_length=80, blank=True)
    delivery_address = models.CharField(_("пункт выдачи или адрес"), max_length=300, blank=True)
    measures = models.JSONField(_("мерки"), default=dict, blank=True,
                                help_text=_("рост, грудь, талия, бёдра, стопа в см: для подбора размера"))
    pd_consent_at = models.DateTimeField(_("согласие на обработку ПДн"), null=True, blank=True)
    # Поставщик из Китая видит кабинет на китайском, если выбрал zh-hans.
    language = models.CharField(_("язык интерфейса"), max_length=8, default="ru",
                                choices=[("ru", "Русский"), ("zh-hans", "中文"), ("en", "English")])
    supplier = models.ForeignKey("catalog.Supplier", verbose_name="поставщик", null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name="members")

    class Meta:
        verbose_name = _("пользователь")
        verbose_name_plural = _("пользователи")

    @property
    def is_supplier(self):
        return self.role == self.Role.SUPPLIER and self.supplier_id is not None
