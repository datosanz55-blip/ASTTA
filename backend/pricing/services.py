"""Цена под ключ. Формулы те же, что в прототипе (assets/js/app.js), только в Decimal и с данными из базы.

Розница: цена ¥ × курс + вес × тариф + сервисный сбор с товара.
Опт:     ступень ¥ × кол-во × курс + вес × тариф + оптовый сбор с товара.
Итог округляется до 10 ₽.
"""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from catalog.models import Product
from pricing.models import ExchangeRate, PricingConfig, ShippingMethod


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

    def __post_init__(self):
        if self.rate is None:
            self.rate = current_rate(config=self.config)

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
        raise PricingError("У товара нет оптовых ступеней")
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
        fee_share = ctx.config.retail_fee
    elif mode == "wholesale":
        min_qty = tiers_of(product)[0].min_qty
        if qty < min_qty:
            raise PricingError(f"Минимальная партия {min_qty} шт.")
        unit = tier_price(product, qty)
        fee_share = ctx.config.wholesale_fee
    else:
        raise PricingError(f"Неизвестный режим {mode}")

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
    )
