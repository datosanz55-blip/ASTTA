import re
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


def parse_sizes(value: str) -> list[str]:
    """«S, M L/XL» → [S, M, L, XL]; «36-45» → 36…45 (диапазон размеров обуви)."""
    sizes = []
    for part in re.split(r"[,;/\s]+", value or ""):
        part = part.strip()
        if not part:
            continue
        span = re.fullmatch(r"(\d{1,3})[-–](\d{1,3})", part)
        if span and int(span[1]) < int(span[2]) <= int(span[1]) + 30:
            sizes.extend(str(n) for n in range(int(span[1]), int(span[2]) + 1))
        else:
            sizes.append(part)
    return list(dict.fromkeys(sizes))


def parse_colors(value: str) -> list[str]:
    return list(dict.fromkeys(c.strip() for c in re.split(r"[,;\n]+", value or "") if c.strip()))


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
    name_zh = models.CharField(_("название (кит.)"), max_length=120, blank=True)
    city = models.CharField(_("город"), max_length=80, blank=True)
    about = models.CharField(_("коротко о поставщике"), max_length=200, blank=True)
    wechat = models.CharField(_("WeChat"), max_length=64, blank=True)
    phone = models.CharField(_("телефон"), max_length=32, blank=True)
    payout_details = models.CharField(_("реквизиты для выплат"), max_length=200, blank=True,
                                      help_text=_("Alipay, карта или счёт: куда платёжный агент TT переводит юани"))
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
    # Покупатель выбирает размер и цвет только из этих списков, поставщик получает заказ без ошибок.
    sizes = models.CharField(_("размеры"), max_length=300, blank=True,
                             help_text=_("Через запятую или пробел: S, M, L, XL. Диапазон обуви: 36-45"))
    colors = models.CharField(_("цвета"), max_length=300, blank=True,
                              help_text=_("Через запятую: чёрный, белый, тёмно-синий"))
    is_new = models.BooleanField(_("новинка"), default=False)
    # По ссылке агент перезаказывает товар у поставщика, а покупатель находит его, вставив ту же ссылку.
    source_url = models.URLField(_("ссылка у поставщика"), max_length=500, blank=True,
                                 help_text=_("1688, Taobao, Poizon или сайт поставщика"))
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
    def size_list(self) -> list[str]:
        return parse_sizes(self.sizes)

    @property
    def color_list(self) -> list[str]:
        return parse_colors(self.colors)

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


class FactorySettings(models.Model):
    """Контент-завод: какие посты в ленту поставщиков собирать из карточек автоматически."""

    supplier = models.OneToOneField(Supplier, on_delete=models.CASCADE, related_name="factory")
    new_items = models.BooleanField(_("посты о новых товарах"), default=True)
    weekly = models.BooleanField(_("подборка недели"), default=True)
    restock = models.BooleanField(_("поступления"), default=False)
    per_day = models.PositiveSmallIntegerField(_("постов в день, не больше"), default=3,
                                               validators=[MinValueValidator(1), MaxValueValidator(10)])

    class Meta:
        verbose_name = _("контент-завод")
        verbose_name_plural = _("контент-завод")

    def __str__(self):
        return str(self.supplier)


class SupplierPost(models.Model):
    """Пост в ленту от имени поставщика. Пишет и публикует команда ASTTA: фото и текст на русском."""

    class Kind(models.TextChoices):
        NEW = "new", _("Новинка")
        RESTOCK = "restock", _("Поступление")
        OPT = "opt", _("Оптовое предложение")

    class Status(models.TextChoices):
        MODERATION = "moderation", _("На модерации")
        PUBLISHED = "published", _("Опубликован")
        REJECTED = "rejected", _("Отклонён")

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="posts")
    product = models.ForeignKey(Product, verbose_name=_("товар"), on_delete=models.CASCADE, related_name="posts",
                                null=True, blank=True)
    kind = models.CharField(_("тип"), max_length=16, choices=Kind.choices, default=Kind.NEW)
    text = models.TextField(_("текст поставщика (кит.)"), blank=True)
    text_ru = models.TextField(_("текст для покупателей"), blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, verbose_name=_("автор"), null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="+")
    status = models.CharField(_("статус"), max_length=16, choices=Status.choices, default=Status.MODERATION)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("пост поставщика")
        verbose_name_plural = _("посты поставщиков")

    def __str__(self):
        return f"{self.supplier}: {self.get_kind_display()}"


class PostImage(models.Model):
    post = models.ForeignKey(SupplierPost, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(_("фото"), upload_to="posts/%Y/%m/")
    position = models.PositiveSmallIntegerField(_("порядок"), default=0)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = _("фото поста")
        verbose_name_plural = _("фото поста")

    def __str__(self):
        return f"{self.post} #{self.position}"
