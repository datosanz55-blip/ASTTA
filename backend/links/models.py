from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class Marketplace(models.Model):
    """Площадка, с которой покупатель присылает ссылку. Надбавки задаются в админке по тарифам TT."""

    code = models.SlugField(_("код"), unique=True)
    name = models.CharField(_("название"), max_length=40)
    # Например, у Poizon свой сбор за проверку подлинности и выкуп.
    extra_fee = models.DecimalField(_("надбавка площадки"), max_digits=5, decimal_places=4, default=Decimal("0"),
                                    validators=[MinValueValidator(0), MaxValueValidator(1)],
                                    help_text=_("0.03 = 3% к цене товара"))
    china_delivery_cny = models.DecimalField(_("доставка по Китаю до склада, ¥"), max_digits=8, decimal_places=2,
                                             default=Decimal("0"), validators=[MinValueValidator(0)],
                                             help_text=_("За одну позицию заказа"))
    note = models.CharField(_("комментарий"), max_length=200, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = _("площадка")
        verbose_name_plural = _("площадки")

    def __str__(self):
        return self.name


class LinkRequest(models.Model):
    """Заявка «закажите по ссылке»: товара нет в нашем каталоге, агент находит и считает его вручную."""

    class Status(models.TextChoices):
        NEW = "new", _("Новая")
        QUOTED = "quoted", _("Цена отправлена покупателю")
        ORDERED = "ordered", _("Оформлен заказ")
        REJECTED = "rejected", _("Не можем привезти")

    url = models.URLField(_("ссылка"), max_length=1000, blank=True)
    text = models.TextField(_("что прислал покупатель"), blank=True)
    marketplace = models.ForeignKey(Marketplace, verbose_name=_("площадка"), null=True, blank=True,
                                    on_delete=models.SET_NULL)
    item_id = models.CharField(_("номер товара на площадке"), max_length=64, blank=True)
    photo = models.ImageField(_("фото или скриншот"), upload_to="links/%Y/%m/", blank=True)
    price_cny = models.DecimalField(_("цена на площадке, ¥"), max_digits=10, decimal_places=2, null=True,
                                    blank=True)
    qty = models.PositiveIntegerField(_("кол-во"), default=1)
    size = models.CharField(_("размер"), max_length=32, blank=True)
    color = models.CharField(_("цвет"), max_length=40, blank=True)
    category = models.ForeignKey("catalog.Category", verbose_name=_("категория"), null=True, blank=True,
                                 on_delete=models.SET_NULL)
    estimate_rub = models.DecimalField(_("предварительная цена, ₽"), max_digits=12, decimal_places=2, null=True,
                                       blank=True)
    contact = models.CharField(_("телефон или Telegram"), max_length=64)
    comment = models.TextField(_("комментарий покупателя"), blank=True)
    status = models.CharField(_("статус"), max_length=16, choices=Status.choices, default=Status.NEW)
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name=_("агент"), null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="link_requests")
    agent_note = models.TextField(_("ответ агента"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("заявка по ссылке")
        verbose_name_plural = _("заявки по ссылке")

    def __str__(self):
        return f"#{self.pk} {self.marketplace or ''} {self.contact}".strip()
