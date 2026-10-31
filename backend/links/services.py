"""Заказ по ссылке: распознать площадку и номер товара, найти его в нашем каталоге или посчитать цену заранее.

Покупатель вставляет ссылку или целиком сообщение «поделиться» из приложения (Taobao, Poizon и др.):
берём из текста первую ссылку. Если товар уже загружен в каталог с этой ссылкой, показываем его сразу.
Иначе считаем предварительную цену по цене в юанях, которую покупатель видит на площадке, и создаём
заявку агенту: точную цену пришлёт он.
"""

import re
from dataclasses import dataclass, field
from decimal import Decimal
from urllib.parse import parse_qs, urlparse

from django.db.models import Avg

from catalog.models import Category, Product
from links.models import Marketplace
from pricing.models import PricingConfig
from pricing.services import PricingContext, round10

URL_RE = re.compile(r"https?://[^\s<>\"'，。、】」）)]+", re.IGNORECASE)
# (код площадки, домены, как достать номер товара)
MARKETPLACES = [
    ("1688", ("1688.com",), ("path", r"/offer/(\d+)")),
    ("tmall", ("tmall.com", "tmall.hk"), ("query", "id")),
    ("taobao", ("taobao.com", "tb.cn"), ("query", "id")),
    ("pinduoduo", ("yangkeduo.com", "pinduoduo.com"), ("query", "goods_id")),
    ("poizon", ("dewu.com", "poizon.com", "dw4.co"), ("query", "spuId")),
]
DEFAULT_WEIGHT_KG = Decimal("1")


@dataclass
class LinkInfo:
    url: str = ""
    code: str = ""
    item_id: str = ""

    @property
    def marketplace(self) -> Marketplace | None:
        return Marketplace.objects.filter(code=self.code).first() if self.code else None


def parse_link(text: str) -> LinkInfo:
    match = URL_RE.search(text or "")
    if not match:
        return LinkInfo()
    url = match.group(0).rstrip(".,;!?")
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    for code, domains, (where, rule) in MARKETPLACES:
        if any(host == d or host.endswith(f".{d}") for d in domains):
            if where == "path":
                found = re.search(rule, parsed.path)
                item_id = found.group(1) if found else ""
            else:
                item_id = (parse_qs(parsed.query).get(rule) or [""])[0]
            return LinkInfo(url, code, item_id if item_id.isdigit() else "")
    return LinkInfo(url, "other", "")


def find_in_catalog(info: LinkInfo) -> Product | None:
    """Тот же товар уже есть у нас: совпали площадка и номер товара в ссылке у поставщика."""
    if not info.item_id:
        return None
    candidates = (Product.objects.filter(status=Product.Status.PUBLISHED, supplier__is_active=True,
                                         source_url__contains=info.item_id)
                  .select_related("category", "supplier").prefetch_related("tiers", "images"))
    for product in candidates:
        other = parse_link(product.source_url)
        if (other.code, other.item_id) == (info.code, info.item_id):
            return product
    return None


@dataclass
class Estimate:
    price_cny: Decimal
    qty: int
    rate: Decimal
    weight_kg: Decimal
    weight_source: str
    goods_rub: Decimal
    china_delivery_rub: Decimal
    marketplace_fee_rub: Decimal
    delivery_rub: Decimal
    fee_rub: Decimal
    notes: list[str] = field(default_factory=list)

    @property
    def total_rub(self) -> Decimal:
        return round10(self.goods_rub + self.china_delivery_rub + self.marketplace_fee_rub + self.delivery_rub
                       + self.fee_rub)


def category_weight(category: Category | None) -> Decimal | None:
    if category is None:
        return None
    avg = (Product.objects.filter(category=category, status=Product.Status.PUBLISHED)
           .aggregate(w=Avg("weight_kg"))["w"])
    return Decimal(avg).quantize(Decimal("0.01")) if avg else None


def estimate(price_cny: Decimal, qty: int = 1, marketplace: Marketplace | None = None,
             category: Category | None = None, weight_kg: Decimal | None = None, bulky: bool = False) -> Estimate:
    """Предварительная цена под ключ по цене с площадки.

    Если в настройках цены задан курс для заказа по ссылке, считаем просто: цена × этот курс + логистика за штуку
    (сбор уже в курсе). Иначе как товары каталога: курс ЦБ с надбавкой, доставка по весу, сервисный сбор.
    Надбавка площадки и доставка по Китаю добавляются в обоих случаях.
    """
    config = PricingConfig.load()
    simple = config.link_rate is not None
    ctx = PricingContext(config=config, rate=config.link_rate) if simple else PricingContext(config=config)
    notes = ["Цена предварительная: точную пришлёт агент после проверки товара и продавца."]
    if config.link_delivery_rub is not None:
        weight_kg = weight_kg or Decimal("0")
        weight_source = "логистика за штуку из настроек цены"
        delivery = config.link_delivery_rub * qty
    else:
        if weight_kg:
            weight_source = "указан"
        elif (weight_kg := category_weight(category)) is not None:
            weight_source = f"средний вес товаров «{category.name_ru}» у нас в каталоге"
        else:
            weight_kg, weight_source = DEFAULT_WEIGHT_KG, "не знаем вес, считаем 1 кг"
        delivery = weight_kg * ctx.default_shipping(bulky).rub_per_kg * qty
    goods = price_cny * qty * ctx.rate
    china = (marketplace.china_delivery_cny if marketplace else Decimal("0")) * ctx.rate
    extra = goods * (marketplace.extra_fee if marketplace else Decimal("0"))
    fee = Decimal("0") if simple else goods * ctx.fee_share(None, category.pk if category else None, "retail")
    return Estimate(price_cny=price_cny, qty=qty, rate=ctx.rate, weight_kg=weight_kg, weight_source=weight_source,
                    goods_rub=goods, china_delivery_rub=china, marketplace_fee_rub=extra,
                    delivery_rub=delivery, fee_rub=fee, notes=notes)
