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
