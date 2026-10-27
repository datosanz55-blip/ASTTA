import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Order(models.Model):
    class Mode(models.TextChoices):
        RETAIL = "retail", _("Розница")
        WHOLESALE = "wholesale", _("Опт")

    class Status(models.TextChoices):
        NEW = "new", _("Новый: агент проверяет наличие")
        CONFIRMED = "confirmed", _("Подтверждён: ждёт оплаты")
        PAID = "paid", _("Оплачен")
        PURCHASED = "purchased", _("Выкуплен у поставщика")
        AT_WAREHOUSE = "at_warehouse", _("На складе в Китае")
        SHIPPED = "shipped", _("Отправлен в Россию")
        BORDER = "border", _("На границе")
        IN_RUSSIA = "in_russia", _("В России")
        READY = "ready", _("В пункте выдачи")
        DELIVERED = "delivered", _("Получен")
        CANCELLED = "cancelled", _("Отменён")

    number = models.CharField(_("номер"), max_length=20, unique=True, editable=False)
    # По токену покупатель смотрит заказ без входа в аккаунт.
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name=_("покупатель"), null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="orders")
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name=_("агент"), null=True, blank=True,
                              on_delete=models.SET_NULL, related_name="agent_orders")
    contact = models.CharField(_("телефон или Telegram"), max_length=64)
    name = models.CharField(_("имя"), max_length=80, blank=True)
    comment = models.TextField(_("комментарий покупателя"), blank=True)
    mode = models.CharField(_("режим"), max_length=16, choices=Mode.choices, default=Mode.RETAIL)
    status = models.CharField(_("статус"), max_length=16, choices=Status.choices, default=Status.NEW)
    rate = models.DecimalField(_("курс ¥ на момент заказа"), max_digits=10, decimal_places=4)
    total_rub = models.DecimalField(_("итого, ₽"), max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("заказ")
        verbose_name_plural = _("заказы")

    def __str__(self):
        return self.number

    def save(self, *args, **kwargs):
        if not self.number:
            # Номер выдаём после первого сохранения, чтобы он совпадал с id и не повторялся.
            self.number = f"tmp-{uuid.uuid4().hex[:12]}"
            super().save(*args, **kwargs)
            self.number = f"A-{self.pk:06d}"
            kwargs = {"update_fields": ["number"]}
        super().save(*args, **kwargs)


class OrderItem(models.Model):
    """Строка заказа. Цена фиксируется в момент заказа и потом не пересчитывается."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", verbose_name=_("товар"), on_delete=models.PROTECT)
    title = models.CharField(_("название на момент заказа"), max_length=160)
    size = models.CharField(_("размер"), max_length=16, blank=True)
    qty = models.PositiveIntegerField(_("кол-во"))
    unit_cny = models.DecimalField(_("цена за шт., ¥"), max_digits=10, decimal_places=2)
    shipping_code = models.CharField(_("доставка"), max_length=32)
    goods_rub = models.DecimalField(_("товар, ₽"), max_digits=12, decimal_places=2)
    delivery_rub = models.DecimalField(_("доставка, ₽"), max_digits=12, decimal_places=2)
    fee_rub = models.DecimalField(_("сбор ASTTA, ₽"), max_digits=12, decimal_places=2)
    total_rub = models.DecimalField(_("итого, ₽"), max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = _("позиция")
        verbose_name_plural = _("позиции")

    def __str__(self):
        return f"{self.title} × {self.qty}"


class OrderEvent(models.Model):
    """История заказа: смена статуса, фото со склада, вес. Покупатель видит её как трекинг."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(_("статус"), max_length=16, choices=Order.Status.choices)
    note = models.CharField(_("комментарий"), max_length=300, blank=True)
    photo = models.ImageField(_("фото со склада"), upload_to="orders/%Y/%m/", blank=True)
    weight_kg = models.DecimalField(_("фактический вес, кг"), max_digits=7, decimal_places=3, null=True,
                                    blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = _("событие")
        verbose_name_plural = _("история заказа")

    def __str__(self):
        return f"{self.order} — {self.get_status_display()}"
