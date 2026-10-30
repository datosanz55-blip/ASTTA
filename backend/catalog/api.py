from datetime import datetime
from decimal import Decimal

from django.db.models import Q
from django.shortcuts import get_object_or_404
from ninja import Router, Schema
from ninja.errors import HttpError

from catalog.models import Category, Product, SupplierPost
from pricing.services import PricingContext, PricingError, quote

router = Router(tags=["Каталог"])

PAGE_SIZE_MAX = 60


class CategoryOut(Schema):
    slug: str
    name_ru: str
    name_zh: str


class TierOut(Schema):
    min_qty: int
    price_cny: Decimal


class ProductCard(Schema):
    slug: str
    title: str
    category: str
    supplier: str
    price_cny: Decimal
    unit_price_cny: Decimal
    sale_percent: int
    is_new: bool
    image: str | None
    retail_rub: Decimal | None
    min_qty: int | None
    rating: Decimal | None
    reviews_count: int


class ProductDetail(ProductCard):
    description: str
    weight_kg: Decimal
    bulky: bool
    size_grid: str
    images: list[str]
    tiers: list[TierOut]
    supplier_fact_days: list[int] | None


class ProductPage(Schema):
    items: list[ProductCard]
    total: int
    page: int
    page_size: int


class FeedPost(Schema):
    id: int
    kind: str
    text: str
    images: list[str]
    supplier: str
    supplier_code: str
    product: ProductCard | None
    created_at: datetime


class FeedPage(Schema):
    items: list[FeedPost]
    total: int
    page: int
    page_size: int


def _image_urls(request, product):
    return [request.build_absolute_uri(img.image.url) for img in product.images.all()]


def _card(request, product, ctx):
    try:
        retail = quote(product, ctx=ctx).total_rub if ctx else None
    except PricingError:
        retail = None
    tiers = sorted(product.tiers.all(), key=lambda t: t.min_qty)
    images = _image_urls(request, product)
    return {
        "slug": product.slug,
        "title": product.title_ru,
        "category": product.category.slug,
        "supplier": product.supplier.name,
        "price_cny": product.price_cny,
        "unit_price_cny": product.unit_price_cny,
        "sale_percent": product.sale_percent,
        "is_new": product.is_new,
        "image": images[0] if images else None,
        "retail_rub": retail,
        "min_qty": tiers[0].min_qty if tiers else None,
        "rating": product.rating,
        "reviews_count": product.reviews_count,
    }


def _published():
    return (Product.objects.filter(status=Product.Status.PUBLISHED, supplier__is_active=True)
            .select_related("category", "supplier").prefetch_related("tiers", "images"))


def _pricing_context():
    try:
        return PricingContext()
    except PricingError:
        return None  # нет курса: каталог показываем, цену в рублях нет


@router.get("/categories", response=list[CategoryOut], summary="Категории")
def categories(request):
    return Category.objects.all()


@router.get("/products", response=ProductPage, summary="Товары каталога")
def products(request, category: str | None = None, q: str | None = None, sale: bool = False,
             new: bool = False, sort: str = "new", page: int = 1, page_size: int = 24):
    page = max(page, 1)
    page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
    qs = _published()
    if category:
        qs = qs.filter(category__slug=category)
    if q:
        qs = qs.filter(Q(title_ru__icontains=q) | Q(title_zh__icontains=q) | Q(description_ru__icontains=q))
    if sale:
        qs = qs.filter(sale_percent__gt=0)
    if new:
        qs = qs.filter(is_new=True)
    order = {"new": "-created_at", "popular": "-sold_count", "cheap": "price_cny", "expensive": "-price_cny"}
    if sort not in order:
        raise HttpError(400, f"sort: одно из {', '.join(order)}")
    qs = qs.order_by(order[sort], "id")

    total = qs.count()
    ctx = _pricing_context()
    start = (page - 1) * page_size
    items = [_card(request, p, ctx) for p in qs[start:start + page_size]]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/products/{slug}", response=ProductDetail, summary="Карточка товара")
def product_detail(request, slug: str):
    product = get_object_or_404(_published(), slug=slug)
    data = _card(request, product, _pricing_context())
    supplier = product.supplier
    data.update({
        "description": product.description_ru,
        "weight_kg": product.weight_kg,
        "bulky": product.bulky,
        "size_grid": product.size_grid,
        "images": _image_urls(request, product),
        "tiers": sorted(product.tiers.all(), key=lambda t: t.min_qty),
        "supplier_fact_days": ([supplier.fact_days_min, supplier.fact_days_max]
                               if supplier.fact_days_min and supplier.fact_days_max else None),
    })
    return data


@router.get("/feed", response=FeedPage, summary="Лента поставщиков: посты с фото")
def feed(request, supplier: str | None = None, page: int = 1, page_size: int = 20):
    page = max(page, 1)
    page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
    qs = (SupplierPost.objects.filter(status=SupplierPost.Status.PUBLISHED, supplier__is_active=True)
          .select_related("supplier", "product__category", "product__supplier")
          .prefetch_related("images", "product__tiers", "product__images").order_by("-created_at", "-id"))
    if supplier:
        qs = qs.filter(supplier__code=supplier)
    total = qs.count()
    ctx = _pricing_context()
    start = (page - 1) * page_size
    items = []
    for post in qs[start:start + page_size]:
        product = post.product
        # Снятый с продажи товар в посте не показываем, сам пост остаётся.
        shown = product and product.status == Product.Status.PUBLISHED
        items.append({
            "id": post.pk,
            "kind": post.kind,
            "text": post.text_ru,
            "images": [request.build_absolute_uri(img.image.url) for img in post.images.all()],
            "supplier": post.supplier.name,
            "supplier_code": post.supplier.code,
            "product": _card(request, product, ctx) if shown else None,
            "created_at": post.created_at,
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size}
