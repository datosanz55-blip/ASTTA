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

    # Заказ по ссылке и по фото: простой расчёт «цена × свой курс + логистика за штуку».
    link_rate = models.DecimalField(_("курс для заказа по ссылке и фото, ₽ за ¥"), max_digits=8, decimal_places=4,
                                    null=True, blank=True, default=Decimal("13"),
                                    help_text=_("Пусто — считать по курсу ЦБ с надбавкой и сбором, как каталог"))
    link_delivery_rub = models.DecimalField(_("логистика для заказа по ссылке и фото, ₽ за штуку"), max_digits=10,
                                            decimal_places=2, null=True, blank=True, default=Decimal("1000"),
                                            help_text=_("Пусто — по весу и тарифу доставки"))

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


class CommissionRule(models.Model):
    """Свой сервисный сбор для категории или поставщика вместо общего из настроек цены.
    Если есть правило поставщика, берём его, иначе правило категории, иначе общий сбор."""

    category = models.OneToOneField("catalog.Category", verbose_name=_("категория"), null=True, blank=True,
                                    on_delete=models.CASCADE, related_name="commission")
    supplier = models.OneToOneField("catalog.Supplier", verbose_name=_("поставщик"), null=True, blank=True,
                                    on_delete=models.CASCADE, related_name="commission")
    retail_fee = models.DecimalField(_("сбор, розница"), max_digits=5, decimal_places=4, null=True, blank=True,
                                     validators=[MinValueValidator(0), MaxValueValidator(1)],
                                     help_text=_("0.07 = 7%. Пусто — общий сбор из настроек цены"))
    wholesale_fee = models.DecimalField(_("сбор, опт"), max_digits=5, decimal_places=4, null=True, blank=True,
                                        validators=[MinValueValidator(0), MaxValueValidator(1)],
                                        help_text=_("0.02 = 2%. Пусто — общий сбор из настроек цены"))
    note = models.CharField(_("почему такой сбор"), max_length=200, blank=True)

    class Meta:
        verbose_name = _("комиссия")
        verbose_name_plural = _("комиссии")
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(category__isnull=False, supplier__isnull=True)
                           | models.Q(category__isnull=True, supplier__isnull=False)),
                name="commission_for_category_or_supplier",
            ),
        ]

    def __str__(self):
        return str(self.supplier or self.category)

    def clean(self):
        from django.core.exceptions import ValidationError

        if bool(self.category_id) == bool(self.supplier_id):
            raise ValidationError(_("Выберите либо категорию, либо поставщика"))
        if self.retail_fee is None and self.wholesale_fee is None:
            raise ValidationError(_("Укажите сбор хотя бы для розницы или для опта"))
