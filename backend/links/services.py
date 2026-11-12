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
# Короткие ссылки из кнопки «поделиться»: номера товара в них нет, он появляется после перехода по ссылке.
SHORT_HOSTS = ("m.tb.cn", "e.tb.cn", "tb.cn", "dw4.co", "qr.1688.com", "m.1688.com", "s.click.taobao.com",
               "mobile.yangkeduo.com")
# Запасные места, где площадки прячут номер товара (в адресе после перехода или в коде страницы-переходника).
ID_PATTERNS = {
    "taobao": [r"[?&]id=(\d{6,})", r"item\.htm\?.*?id=(\d{6,})", r"itemId=(\d{6,})"],
    "tmall": [r"[?&]id=(\d{6,})"],
    "1688": [r"/offer/(\d{6,})", r"offerId=(\d{6,})"],
    "poizon": [r"spuId=(\d+)", r"productId=(\d+)"],
    "pinduoduo": [r"goods_id=(\d+)"],
}
# Служебные фразы из текста «поделиться», которые не являются названием товара.
SHARE_NOISE = re.compile(r"打开得物\s*App\s*查看?|点击链接直接打开|或者|淘宝搜索直接打开|复制这条信息|"
                         r"打开【?手机淘宝】?|打开得物|得物App|"
                         r"【[^】]*】|\$\w+\$|￥\w+￥|\(\w+\)|CZ\d+|MF\d+|\d+:/+|/+", re.IGNORECASE)
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


def share_title(text: str) -> str:
    """Название товара из сообщения «поделиться»: 「…」 у Taobao или текст рядом со ссылкой, без служебных фраз."""
    quoted = re.search(r"「([^」]{3,120})」", text or "")
    if quoted:
        return quoted.group(1).strip()
    rest = SHARE_NOISE.sub(" ", URL_RE.sub(" ", text or ""))
    rest = re.sub(r"\s+", " ", rest).strip(" ,.;:-—")
    return rest[:120] if len(rest) >= 3 else ""


MAX_REDIRECTS = 5
MAX_BODY = 200_000
TRANSPORT = None  # в тестах подменяется на httpx.MockTransport


def _marketplace_host(url: str) -> bool:
    """Адрес площадки или её короткой ссылки. Только https/http и только эти домены — так сервер нельзя
    заставить обратиться к своим внутренним адресам (localhost, база, облачные метаданные) через редирект."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in ("http", "https") or not host:
        return False
    domains = [d for _, ds, _ in MARKETPLACES for d in ds] + list(SHORT_HOSTS)
    return any(host == d or host.endswith(f".{d}") for d in domains)


def _fetch_marketplace(url: str, timeout: float) -> tuple[str, str] | None:
    """GET с ручными переходами: каждый редирект проверяем, тело читаем не больше MAX_BODY.
    Возвращает (адрес после переходов, текст страницы) или None, если редирект ведёт не на площадку
    или переходов слишком много."""
    import httpx

    headers = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                             "AppleWebKit/605.1.15 Mobile/15E148"}
    with httpx.Client(follow_redirects=False, timeout=timeout, headers=headers, transport=TRANSPORT) as client:
        for _ in range(MAX_REDIRECTS + 1):
            if not _marketplace_host(url):
                return None
            with client.stream("GET", url) as response:
                if response.is_redirect:
                    url = str(response.url.join(response.headers.get("location", "")))
                    continue
                body = b""
                if "text" in response.headers.get("content-type", "text"):
                    for chunk in response.iter_bytes():
                        body += chunk
                        if len(body) >= MAX_BODY:
                            break
                return str(response.url), body[:MAX_BODY].decode(response.encoding or "utf-8", "replace")
    return None


def resolve_link(text: str, timeout: float = 6.0) -> LinkInfo:
    """Как parse_link, но короткую ссылку «поделиться» (m.tb.cn, dw4.co…) раскрываем переходом и ищем номер товара."""
    import httpx

    info = parse_link(text)
    host = (urlparse(info.url).hostname or "").lower() if info.url else ""
    if not info.url or info.item_id or not any(host == h or host.endswith(f".{h}") for h in SHORT_HOSTS):
        return info
    try:
        fetched = _fetch_marketplace(info.url, timeout)
    except httpx.HTTPError:
        return info  # площадка не ответила: остаёмся с тем, что есть, агент разберётся
    if fetched is None:
        return info  # переход увёл с площадки: дальше не идём
    final, body = fetched
    full = parse_link(final)
    if full.item_id:
        return LinkInfo(info.url, full.code, full.item_id)
    # Taobao отдаёт страницу-переходник, где настоящий адрес лежит в коде страницы.
    code = full.code if full.code != "other" else info.code
    for pattern in ID_PATTERNS.get(code, []):
        found = re.search(pattern, final) or re.search(pattern, body)
        if found:
            return LinkInfo(info.url, code, found.group(1))
    return LinkInfo(info.url, code, "")


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


def link_pricing() -> tuple:
    """Настройки цены для заказа по ссылке: (PricingConfig, PricingContext)."""
    config = PricingConfig.load()
    ctx = PricingContext(config=config, rate=config.link_rate) if config.link_rate is not None \
        else PricingContext(config=config)
    return config, ctx


def estimate(price_cny: Decimal, qty: int = 1, marketplace: Marketplace | None = None,
             category: Category | None = None, weight_kg: Decimal | None = None, bulky: bool = False,
             pricing: tuple | None = None) -> Estimate:
    """Предварительная цена под ключ по цене с площадки.

    Если в настройках цены задан курс для заказа по ссылке, считаем просто: цена × этот курс + логистика за штуку
    (сбор уже в курсе). Иначе как товары каталога: курс ЦБ с надбавкой, доставка по весу, сервисный сбор.
    Надбавка площадки и доставка по Китаю добавляются в обоих случаях.
    """
    # pricing — (config, ctx) из link_pricing(): для списка товаров настройки читаем один раз, а не на каждый товар.
    config, ctx = pricing or link_pricing()
    simple = config.link_rate is not None
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
