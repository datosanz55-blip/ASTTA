from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class Category(models.Model):
    slug = models.SlugField(unique=True)
    name_ru = models.CharField(_("название (рус.)"), max_length=80)
    name_zh = models.CharField(_("название (кит.)"), max_length=80, blank=True)
    position = models.PositiveSmallIntegerField(_("порядок"), default=0)

    class Meta:
        ordering = ["position", "name_ru"]
        verbose_name = _("категория")
        verbose_name_plural = _("категории")

    def __str__(self):
        return self.name_ru


class Supplier(models.Model):
    code = models.SlugField(_("код"), unique=True)
    name = models.CharField(_("название"), max_length=120)
    city = models.CharField(_("город"), max_length=80, blank=True)
    about = models.CharField(_("коротко о поставщике"), max_length=200, blank=True)
    # Фактический срок доставки по последним заказам: показываем покупателю вместо обещаний.
    fact_days_min = models.PositiveSmallIntegerField(_("факт. срок от, дн."), null=True, blank=True)
    fact_days_max = models.PositiveSmallIntegerField(_("факт. срок до, дн."), null=True, blank=True)
    is_active = models.BooleanField(_("активен"), default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = _("поставщик")
        verbose_name_plural = _("поставщики")

    def __str__(self):
        return self.name


class Product(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", _("Черновик")
        MODERATION = "moderation", _("На модерации")
        PUBLISHED = "published", _("Опубликован")
        REJECTED = "rejected", _("Отклонён")

    class SizeGrid(models.TextChoices):
        NONE = "", _("Без размеров")
        CLOTHES = "clothes", _("Одежда")
        SHOES = "shoes", _("Обувь")

    supplier = models.ForeignKey(Supplier, verbose_name=_("поставщик"), on_delete=models.PROTECT,
                                 related_name="products")
    category = models.ForeignKey(Category, verbose_name=_("категория"), on_delete=models.PROTECT,
                                 related_name="products")
    slug = models.SlugField(unique=True)
    sku = models.CharField(_("артикул поставщика"), max_length=64, blank=True)
    title_ru = models.CharField(_("название (рус.)"), max_length=160)
    title_zh = models.CharField(_("название (кит.)"), max_length=160, blank=True)
    description_ru = models.TextField(_("описание (рус.)"), blank=True)
    description_zh = models.TextField(_("описание (кит.)"), blank=True)
    price_cny = models.DecimalField(_("розничная цена, ¥"), max_digits=10, decimal_places=2,
                                    validators=[MinValueValidator(Decimal("0.01"))])
    sale_percent = models.PositiveSmallIntegerField(_("скидка, %"), default=0,
                                                    validators=[MaxValueValidator(90)])
    weight_kg = models.DecimalField(_("вес в упаковке, кг"), max_digits=7, decimal_places=3,
                                    validators=[MinValueValidator(Decimal("0.001"))])
    # Крупногабарит (мебель) едет только сборным грузом.
    bulky = models.BooleanField(_("крупногабарит"), default=False)
    size_grid = models.CharField(_("размерная сетка"), max_length=16, choices=SizeGrid.choices, blank=True)
    is_new = models.BooleanField(_("новинка"), default=False)
    status = models.CharField(_("статус"), max_length=16, choices=Status.choices, default=Status.MODERATION)
    moderation_note = models.CharField(_("комментарий модератора"), max_length=300, blank=True)
    rating = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    reviews_count = models.PositiveIntegerField(default=0)
    sold_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("товар")
        verbose_name_plural = _("товары")
        constraints = [
            models.UniqueConstraint(fields=["supplier", "sku"], condition=~models.Q(sku=""),
                                    name="unique_sku_per_supplier"),
        ]
        indexes = [models.Index(fields=["status", "category"])]

    def __str__(self):
        return self.title_ru

    @property
    def unit_price_cny(self):
        """Цена за штуку в рознице с учётом скидки, в целых юанях, как в прототипе."""
        if not self.sale_percent:
            return self.price_cny
        return (self.price_cny * (100 - self.sale_percent) / 100).quantize(Decimal("1"))


class PriceTier(models.Model):
    """Оптовая ступень: от min_qty штук цена price_cny за штуку. Самая маленькая ступень = минимальная партия."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="tiers")
    min_qty = models.PositiveIntegerField(_("от, шт."), validators=[MinValueValidator(1)])
    price_cny = models.DecimalField(_("цена за шт., ¥"), max_digits=10, decimal_places=2,
                                    validators=[MinValueValidator(Decimal("0.01"))])

    class Meta:
        ordering = ["min_qty"]
        verbose_name = _("оптовая ступень")
        verbose_name_plural = _("оптовые ступени")
        constraints = [models.UniqueConstraint(fields=["product", "min_qty"], name="unique_tier")]

    def __str__(self):
        return f"от {self.min_qty} шт. — {self.price_cny} ¥"


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(_("фото"), upload_to="products/%Y/%m/")
    position = models.PositiveSmallIntegerField(_("порядок"), default=0)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = _("фото")
        verbose_name_plural = _("фото")

    def __str__(self):
        return f"{self.product} #{self.position}"
