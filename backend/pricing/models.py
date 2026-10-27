from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class ExchangeRate(models.Model):
    """Курс ЦБ на дату. Цена для покупателя считается по нему плюс надбавка из PricingConfig."""

    currency = models.CharField(_("валюта"), max_length=3, default="CNY")
    date = models.DateField(_("дата"))
    rub_per_unit = models.DecimalField(_("₽ за 1 единицу"), max_digits=10, decimal_places=4)
    source = models.CharField(_("источник"), max_length=32, default="cbr")
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        verbose_name = _("курс валюты")
        verbose_name_plural = _("курсы валют")
        constraints = [models.UniqueConstraint(fields=["currency", "date"], name="unique_rate_per_day")]

    def __str__(self):
        return f"{self.currency} {self.date}: {self.rub_per_unit} ₽"


class ShippingMethod(models.Model):
    code = models.SlugField(_("код"), unique=True)
    name = models.CharField(_("название"), max_length=60)
    rub_per_kg = models.DecimalField(_("тариф, ₽/кг"), max_digits=8, decimal_places=2)
    days_min = models.PositiveSmallIntegerField(_("срок от, дн."))
    days_max = models.PositiveSmallIntegerField(_("срок до, дн."))
    # Сборный груз доступен только крупногабариту, обычные товары едут авто или авиа.
    for_bulky_only = models.BooleanField(_("только для крупногабарита"), default=False)
    is_default = models.BooleanField(_("по умолчанию"), default=False)
    is_active = models.BooleanField(_("доступен"), default=True)

    class Meta:
        ordering = ["rub_per_kg"]
        verbose_name = _("способ доставки")
        verbose_name_plural = _("способы доставки")

    def __str__(self):
        return f"{self.name} — {self.rub_per_kg} ₽/кг"


class PricingConfig(models.Model):
    """Одна запись с настройками цены. Меняется в админке без выкладки кода."""

    # Сбор платит покупатель сверх цены товара, поставщик получает свою цену полностью.
    retail_fee = models.DecimalField(_("сервисный сбор, розница"), max_digits=5, decimal_places=4,
                                     default=Decimal("0.05"),
                                     validators=[MinValueValidator(0), MaxValueValidator(1)],
                                     help_text=_("0.05 = 5% к стоимости товара сверху, платит покупатель"))
    wholesale_fee = models.DecimalField(_("сервисный сбор, опт"), max_digits=5, decimal_places=4,
                                        default=Decimal("0.03"),
                                        validators=[MinValueValidator(0), MaxValueValidator(1)],
                                        help_text=_("0.03 = 3% к стоимости товара сверху, платит покупатель"))
    rate_markup = models.DecimalField(_("надбавка к курсу ЦБ"), max_digits=5, decimal_places=4,
                                      default=Decimal("0"),
                                      validators=[MinValueValidator(0), MaxValueValidator(1)],
                                      help_text=_("0.02 = курс ЦБ + 2% на колебания между оплатой и выкупом"))

    class Meta:
        verbose_name = _("настройки цены")
        verbose_name_plural = _("настройки цены")

    def __str__(self):
        return str(_("Настройки цены"))

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj
