import secrets

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


def avatar_path(instance, filename):
    # Случайное имя: адрес аватара нельзя угадать, исходное имя файла не сохраняем.
    return f"avatars/{secrets.token_hex(16)}.webp"


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
    avatar = models.ImageField(_("свой аватар"), upload_to=avatar_path, blank=True)

    class PayMethod(models.TextChoices):
        SBP = "sbp", _("СБП")
        CARD = "card", _("Банковская карта")

    pay_method = models.CharField(_("способ оплаты по умолчанию"), max_length=8, choices=PayMethod.choices,
                                  blank=True)

    class Meta:
        verbose_name = _("пользователь")
        verbose_name_plural = _("пользователи")

    @property
    def is_supplier(self):
        return self.role == self.Role.SUPPLIER and self.supplier_id is not None


class Favorite(models.Model):
    """Избранное покупателя."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="favorites")
    product = models.ForeignKey("catalog.Product", verbose_name=_("товар"), on_delete=models.CASCADE,
                                related_name="+")
    created_at = models.DateTimeField(_("добавлен"), auto_now_add=True)

    class Meta:
        verbose_name = _("избранное")
        verbose_name_plural = _("избранное")
        constraints = [models.UniqueConstraint(fields=["user", "product"], name="favorite_once")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} ♥ {self.product_id}"


class ProductView(models.Model):
    """Недавно смотрели: храним последние VIEWS_KEEP товаров покупателя."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="views")
    product = models.ForeignKey("catalog.Product", verbose_name=_("товар"), on_delete=models.CASCADE,
                                related_name="+")
    viewed_at = models.DateTimeField(_("смотрел"), default=timezone.now)

    class Meta:
        verbose_name = _("просмотр")
        verbose_name_plural = _("просмотры")
        constraints = [models.UniqueConstraint(fields=["user", "product"], name="view_once")]
        ordering = ["-viewed_at"]

    def __str__(self):
        return f"{self.user} смотрел {self.product_id}"
