from decimal import Decimal

import pytest

from catalog.models import Category
from pricing.models import PricingConfig
from pricing.services import PricingError, quote, round10
from tests.conftest import make_product


def test_round10_rounds_half_up():
    assert round10(Decimal("3669.96")) == 3670
    assert round10(Decimal("3665")) == 3670
    assert round10(Decimal("3664.99")) == 3660


def test_retail_matches_prototype(runner):
    # 268 ¥ × 11,40 + 1,1 кг × 420 ₽ + 5% от товара = 3669,96 → 3670 ₽, как в прототипе.
    q = quote(runner)
    assert q.goods_rub == Decimal("3055.2")
    assert q.delivery_rub == Decimal("462.0")
    assert q.fee_rub == Decimal("152.76")
    assert q.total_rub == 3670
    assert q.shipping.code == "auto"


def test_retail_air_and_qty(runner):
    q = quote(runner, qty=2, shipping="air")
    assert q.shipping.code == "air"
    assert q.total_rub == round10(Decimal("268") * 2 * Decimal("11.4") * Decimal("1.05") + Decimal("1.1") * 980 * 2)


def test_sale_price_is_rounded_to_whole_yuan(runner):
    runner.sale_percent = 15
    runner.save()
    assert runner.unit_price_cny == Decimal("228")  # 268 × 0,85 = 227,8 → 228, как Math.round в прототипе


def test_bulky_goes_by_cargo_even_if_air_requested(supplier, pricing_setup):
    furniture = Category.objects.create(slug="furniture", name_ru="Мебель")
    sofa = make_product(supplier, furniture, "sofa", 2400, 38, [(1, 2100)], bulky=True)
    assert quote(sofa, shipping="air").shipping.code == "cargo"


def test_cargo_is_not_offered_for_regular_goods(runner):
    assert quote(runner, shipping="cargo").shipping.code == "auto"


def test_wholesale_tiers_and_fee(runner):
    q = quote(runner, qty=30, mode="wholesale")
    assert q.unit_cny == Decimal("176")
    assert q.fee_rub == q.goods_rub * Decimal("0.03")
    assert quote(runner, qty=29, mode="wholesale").unit_cny == Decimal("198")


def test_wholesale_below_minimum_is_rejected(runner):
    with pytest.raises(PricingError, match="Минимальная партия 6"):
        quote(runner, qty=5, mode="wholesale")


def test_rate_markup_is_applied(runner):
    config = PricingConfig.load()
    config.rate_markup = Decimal("0.02")
    config.save()
    assert quote(runner).rate == Decimal("11.6280")


def test_no_rate_is_an_error(runner):
    from pricing.models import ExchangeRate

    ExchangeRate.objects.all().delete()
    with pytest.raises(PricingError, match="Нет курса"):
        quote(runner)
