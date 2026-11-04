import datetime as dt
from decimal import Decimal

import pytest

from catalog.models import Category, PriceTier, Product, Supplier
from pricing.models import ExchangeRate, PricingConfig, ShippingMethod


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"


@pytest.fixture
def pricing_setup(db):
    PricingConfig.load()
    ShippingMethod.objects.create(code="auto", name="Авто", rub_per_kg=Decimal("420"), days_min=18, days_max=25,
                                  is_default=True)
    ShippingMethod.objects.create(code="air", name="Авиа", rub_per_kg=Decimal("980"), days_min=8, days_max=12)
    ShippingMethod.objects.create(code="cargo", name="Сборный груз", rub_per_kg=Decimal("190"), days_min=25,
                                  days_max=35, for_bulky_only=True)
    ExchangeRate.objects.create(currency="CNY", date=dt.date(2026, 10, 1), rub_per_unit=Decimal("11.40"))


@pytest.fixture
def supplier(db):
    return Supplier.objects.create(code="jj", name="TT · Цзиньцзян", fact_days_min=16, fact_days_max=21)


@pytest.fixture
def other_supplier(db):
    return Supplier.objects.create(code="gz", name="TT · Гуанчжоу")


@pytest.fixture
def shoes(db):
    return Category.objects.create(slug="shoes", name_ru="Обувь", name_zh="鞋类")


def make_product(supplier, category, slug, cny, kg, tiers, **extra):
    product = Product.objects.create(supplier=supplier, category=category, slug=slug, sku=slug.upper(),
                                     title_ru=extra.pop("title_ru", slug), price_cny=Decimal(str(cny)),
                                     weight_kg=Decimal(str(kg)), status=extra.pop("status", "published"), **extra)
    PriceTier.objects.bulk_create([PriceTier(product=product, min_qty=q, price_cny=Decimal(str(p)))
                                   for q, p in tiers])
    return product


@pytest.fixture
def runner(supplier, shoes, pricing_setup):
    # Те же данные, что у «Кроссовки беговые Cloud» в прототипе.
    return make_product(supplier, shoes, "runner", 268, 1.1, [(6, 198), (30, 176)], title_ru="Кроссовки беговые Cloud")
