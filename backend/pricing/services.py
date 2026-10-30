"""Цена под ключ. Формулы те же, что в прототипе (assets/js/app.js), только в Decimal и с данными из базы.

Розница: цена ¥ × курс + вес × тариф + сервисный сбор с товара.
Опт:     ступень ¥ × кол-во × курс + вес × тариф + оптовый сбор с товара.
Итог округляется до 10 ₽. Сбор свой у поставщика или категории (CommissionRule), иначе общий.
"""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from catalog.models import Product
from pricing.models import CommissionRule, ExchangeRate, PricingConfig, ShippingMethod


class PricingError(Exception):
    pass


def round10(value: Decimal) -> Decimal:
    return (value / 10).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * 10


def current_rate(currency="CNY", config: PricingConfig | None = None) -> Decimal:
    """Курс для покупателя: последний курс ЦБ плюс надбавка из настроек."""
    rate = ExchangeRate.objects.filter(currency=currency).order_by("-date").first()
    if rate is None:
        raise PricingError(f"Нет курса {currency}: запустите update_rate или задайте курс в админке")
    markup = (config or PricingConfig.load()).rate_markup
    return (rate.rub_per_unit * (1 + markup)).quantize(Decimal("0.0001"))


@dataclass
class PricingContext:
    """Курс, настройки и тарифы, загруженные один раз на запрос, чтобы не ходить в базу на каждый товар."""

    config: PricingConfig = field(default_factory=PricingConfig.load)
    rate: Decimal | None = None
    methods: list[ShippingMethod] = field(
        default_factory=lambda: list(ShippingMethod.objects.filter(is_active=True)))
    rules: list[CommissionRule] = field(default_factory=lambda: list(CommissionRule.objects.all()))

    def __post_init__(self):
        if self.rate is None:
            self.rate = current_rate(config=self.config)
        self._by_supplier = {r.supplier_id: r for r in self.rules if r.supplier_id}
        self._by_category = {r.category_id: r for r in self.rules if r.category_id}

    def fee_for(self, product: Product, mode: str) -> Decimal:
        """Сбор поставщика важнее сбора категории, пустое поле в правиле значит «как обычно»."""
        attr = "retail_fee" if mode == "retail" else "wholesale_fee"
        for rule in (self._by_supplier.get(product.supplier_id), self._by_category.get(product.category_id)):
            if rule is not None and getattr(rule, attr) is not None:
                return getattr(rule, attr)
        return getattr(self.config, attr)

    def shipping_for(self, product: Product, wanted: str | None = None) -> ShippingMethod:
        if product.bulky:
            candidates = [m for m in self.methods if m.for_bulky_only]
        else:
            regular = [m for m in self.methods if not m.for_bulky_only]
            candidates = [m for m in regular if m.code == wanted] or [m for m in regular if m.is_default]
        if not candidates:
            raise PricingError("Нет подходящего способа доставки")
        return candidates[0]


def tiers_of(product: Product):
    tiers = sorted(product.tiers.all(), key=lambda t: t.min_qty)
    if not tiers:
        raise PricingError("Этот товар продаётся только в розницу")
    return tiers


def tier_price(product: Product, qty: int) -> Decimal:
    tiers = tiers_of(product)
    price = tiers[0].price_cny
    for tier in tiers:
        if qty >= tier.min_qty:
            price = tier.price_cny
    return price


@dataclass(frozen=True)
class Quote:
    mode: str
    qty: int
    unit_cny: Decimal
    rate: Decimal
    shipping: ShippingMethod
    goods_rub: Decimal
    delivery_rub: Decimal
    fee_rub: Decimal
    fee_share: Decimal = Decimal("0")

    @property
    def total_rub(self) -> Decimal:
        return round10(self.goods_rub + self.delivery_rub + self.fee_rub)

    @property
    def each_rub(self) -> Decimal:
        return round10((self.goods_rub + self.delivery_rub + self.fee_rub) / self.qty)


def quote(product: Product, qty: int = 1, mode: str = "retail", shipping: str | None = None,
          ctx: PricingContext | None = None) -> Quote:
    if qty < 1:
        raise PricingError("Количество должно быть не меньше 1")
    ctx = ctx or PricingContext()
    method = ctx.shipping_for(product, shipping)

    if mode == "retail":
        unit = product.unit_price_cny
    elif mode == "wholesale":
        min_qty = tiers_of(product)[0].min_qty
        if qty < min_qty:
            raise PricingError(f"Минимальная партия {min_qty} шт.")
        unit = tier_price(product, qty)
    else:
        raise PricingError(f"Неизвестный режим {mode}")
    fee_share = ctx.fee_for(product, mode)

    goods = unit * qty * ctx.rate
    return Quote(
        mode=mode,
        qty=qty,
        unit_cny=unit,
        rate=ctx.rate,
        shipping=method,
        goods_rub=goods,
        delivery_rub=product.weight_kg * method.rub_per_kg * qty,
        fee_rub=goods * fee_share,
        fee_share=fee_share,
    )
