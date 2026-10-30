from decimal import Decimal

from ninja import File, Form, Router, Schema, Status
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.throttling import AnonRateThrottle

from catalog.api import ProductCard, _card, _pricing_context
from catalog.images import ImageError, prepare_image
from catalog.models import Category
from links.models import LinkRequest, Marketplace
from links.services import estimate, find_in_catalog, parse_link
from pricing.services import PricingError

router = Router(tags=["Заказ по ссылке"])


class LookupIn(Schema):
    text: str


class MarketplaceOut(Schema):
    code: str
    name: str


class LookupOut(Schema):
    url: str
    marketplace: MarketplaceOut | None
    item_id: str
    product: ProductCard | None


class EstimateIn(Schema):
    price_cny: Decimal
    qty: int = 1
    marketplace: str = ""
    category: str = ""
    weight_kg: Decimal | None = None


class EstimateOut(Schema):
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
    total_rub: Decimal
    notes: list[str]


class RequestIn(Schema):
    text: str = ""
    price_cny: Decimal | None = None
    qty: int = 1
    size: str = ""
    color: str = ""
    category: str = ""
    contact: str
    comment: str = ""


class RequestOut(Schema):
    id: int
    estimate: EstimateOut | None
    product: ProductCard | None


def _estimate_out(e) -> dict:
    money = Decimal("0.01")
    return {
        "price_cny": e.price_cny, "qty": e.qty, "rate": e.rate, "weight_kg": e.weight_kg,
        "weight_source": e.weight_source, "goods_rub": e.goods_rub.quantize(money),
        "china_delivery_rub": e.china_delivery_rub.quantize(money),
        "marketplace_fee_rub": e.marketplace_fee_rub.quantize(money),
        "delivery_rub": e.delivery_rub.quantize(money), "fee_rub": e.fee_rub.quantize(money),
        "total_rub": e.total_rub, "notes": e.notes,
    }


def _check(price_cny, qty, weight_kg=None):
    if price_cny is not None and not Decimal("0") < price_cny <= Decimal("1000000"):
        raise HttpError(422, "Цена в юанях: больше 0")
    if not 1 <= qty <= 10_000:
        raise HttpError(422, "Количество от 1 до 10 000")
    if weight_kg is not None and not Decimal("0") < weight_kg <= Decimal("1000"):
        raise HttpError(422, "Вес: от 0 до 1000 кг")


def _category(slug):
    return Category.objects.filter(slug=slug).first() if slug else None


@router.post("/lookup", response=LookupOut, throttle=[AnonRateThrottle("60/m")],
             summary="Распознать ссылку и найти товар в каталоге")
def lookup(request, payload: LookupIn):
    info = parse_link(payload.text)
    if not info.url:
        raise HttpError(422, "Не нашли ссылку: вставьте адрес товара или сообщение «поделиться» из приложения")
    product = find_in_catalog(info)
    return {
        "url": info.url, "marketplace": info.marketplace, "item_id": info.item_id,
        "product": _card(request, product, _pricing_context()) if product else None,
    }


@router.post("/estimate", response=EstimateOut, throttle=[AnonRateThrottle("60/m")],
             summary="Предварительная цена под ключ по цене на площадке")
def estimate_view(request, payload: EstimateIn):
    _check(payload.price_cny, payload.qty, payload.weight_kg)
    marketplace = Marketplace.objects.filter(code=payload.marketplace).first() if payload.marketplace else None
    try:
        result = estimate(payload.price_cny, payload.qty, marketplace, _category(payload.category), payload.weight_kg)
    except PricingError as exc:
        raise HttpError(503, str(exc)) from exc
    return _estimate_out(result)


@router.post("/requests", response={201: RequestOut}, throttle=[AnonRateThrottle("20/h")],
             summary="Заявка агенту: товар по ссылке или по фото")
def create_request(request, payload: Form[RequestIn], photo: UploadedFile | None = File(None)):
    if not payload.contact.strip():
        raise HttpError(422, "Укажите телефон или Telegram")
    if not payload.text.strip() and photo is None:
        raise HttpError(422, "Пришлите ссылку или фото товара")
    _check(payload.price_cny, payload.qty)
    info = parse_link(payload.text)
    product = find_in_catalog(info)
    category = _category(payload.category)
    content = None
    if photo is not None:
        try:
            content = prepare_image(photo.read(), photo.name or "photo")
        except ImageError as exc:
            raise HttpError(400, str(exc)) from exc
    result = None
    if payload.price_cny:
        try:
            result = estimate(payload.price_cny, payload.qty, info.marketplace, category)
        except PricingError:
            result = None  # нет курса: заявку всё равно принимаем, посчитает агент
    item = LinkRequest.objects.create(
        url=info.url, text=payload.text.strip()[:2000], marketplace=info.marketplace, item_id=info.item_id,
        photo=content or "", price_cny=payload.price_cny, qty=payload.qty, size=payload.size.strip()[:32],
        color=payload.color.strip()[:40], category=category, contact=payload.contact.strip()[:64],
        comment=payload.comment.strip()[:2000], estimate_rub=result.total_rub if result else None,
    )
    return Status(201, {
        "id": item.pk, "estimate": _estimate_out(result) if result else None,
        "product": _card(request, product, _pricing_context()) if product else None,
    })
