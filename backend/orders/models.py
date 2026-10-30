import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Order(models.Model):
    class Mode(models.TextChoices):
        RETAIL = "retail", _("Розница")
        WHOLESALE = "wholesale", _("Опт")

    class Status(models.TextChoices):
        # Покупатель платит сразу при заказе, после оплаты заказ сразу уходит на выкуп у поставщика.
        AWAITING_PAYMENT = "awaiting_payment", _("Ждёт оплаты")
        PAID = "paid", _("Оплачен: заказываем у поставщика")
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
    status = models.CharField(_("статус"), max_length=20, choices=Status.choices, default=Status.AWAITING_PAYMENT)
    rate = models.DecimalField(_("курс ¥ на момент заказа"), max_digits=10, decimal_places=4)
    total_rub = models.DecimalField(_("итого, ₽"), max_digits=12, decimal_places=2)
    paid_at = models.DateTimeField(_("оплачен"), null=True, blank=True)
    # Если у поставщика не оказалось товара, деньги за эту часть заказа возвращаем.
    refund_rub = models.DecimalField(_("к возврату, ₽"), max_digits=12, decimal_places=2, default=0)
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


class Payout(models.Model):
    """Выплата поставщику в юанях за заказы, принятые складом TT. Сбор ASTTA платит покупатель,
    поэтому поставщик получает свою цену полностью."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Готовится")
        PAID = "paid", _("Выплачено")

    supplier = models.ForeignKey("catalog.Supplier", verbose_name=_("поставщик"), on_delete=models.PROTECT,
                                 related_name="payouts")
    amount_cny = models.DecimalField(_("сумма, ¥"), max_digits=12, decimal_places=2)
    status = models.CharField(_("статус"), max_length=16, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(_("выплачено"), null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("выплата")
        verbose_name_plural = _("выплаты")

    def __str__(self):
        return f"{self.supplier}: {self.amount_cny} ¥"


class SupplierOrder(models.Model):
    """Часть заказа у одного поставщика: что выкупить у него и получить на склад TT.
    Заказывает команда TT (поставщик в систему не заходит), покупателя поставщик не видит."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Ждёт оплаты покупателем")
        TO_ORDER = "to_order", _("Заказать у поставщика")
        ORDERED = "ordered", _("Заказано у поставщика")
        SHIPPED = "shipped", _("Отправлено на склад")
        RECEIVED = "received", _("Принято складом")
        CANCELLED = "cancelled", _("Отменено: нет в наличии")

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="supplier_orders")
    supplier = models.ForeignKey("catalog.Supplier", verbose_name=_("поставщик"), on_delete=models.PROTECT,
                                 related_name="supplier_orders")
    status = models.CharField(_("статус у поставщика"), max_length=16, choices=Status.choices,
                              default=Status.PENDING)
    tracking = models.CharField(_("трек-номер до склада"), max_length=64, blank=True)
    payout = models.ForeignKey(Payout, verbose_name=_("выплата"), null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="supplier_orders")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    received_at = models.DateTimeField(_("принято складом"), null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("заказ поставщику")
        verbose_name_plural = _("заказы поставщикам")
        constraints = [models.UniqueConstraint(fields=["order", "supplier"], name="one_supplier_order_per_order")]

    def __str__(self):
        return f"{self.order} · {self.supplier}"

    @property
    def amount_cny(self):
        return sum((item.unit_cny * item.qty for item in self.items.all()), 0)


class OrderItem(models.Model):
    """Строка заказа. Цена фиксируется в момент заказа и потом не пересчитывается."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    supplier_order = models.ForeignKey(SupplierOrder, on_delete=models.CASCADE, related_name="items", null=True,
                                       blank=True)
    product = models.ForeignKey("catalog.Product", verbose_name=_("товар"), on_delete=models.PROTECT)
    title = models.CharField(_("название на момент заказа"), max_length=160)
    size = models.CharField(_("размер"), max_length=32, blank=True)
    color = models.CharField(_("цвет"), max_length=40, blank=True)
    qty = models.PositiveIntegerField(_("кол-во"))
    unit_cny = models.DecimalField(_("цена за шт., ¥"), max_digits=10, decimal_places=2)
    shipping_code = models.CharField(_("доставка"), max_length=32)
    goods_rub = models.DecimalField(_("товар, ₽"), max_digits=12, decimal_places=2)
    delivery_rub = models.DecimalField(_("доставка, ₽"), max_digits=12, decimal_places=2)
    fee_rub = models.DecimalField(_("сбор ASTTA, ₽"), max_digits=12, decimal_places=2)
    # Сбор у категорий и поставщиков бывает разный: запоминаем, по какой ставке посчитан этот заказ.
    fee_share = models.DecimalField(_("ставка сбора"), max_digits=5, decimal_places=4, default=0)
    total_rub = models.DecimalField(_("итого, ₽"), max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = _("позиция")
        verbose_name_plural = _("позиции")

    def __str__(self):
        return f"{self.title} × {self.qty}"


class OrderEvent(models.Model):
    """История заказа: смена статуса, фото со склада, вес. Покупатель видит её как трекинг."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(_("статус"), max_length=20, choices=Order.Status.choices)
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
