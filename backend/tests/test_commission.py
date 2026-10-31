from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client

from accounts.models import User
from accounts.roles import setup_roles
from orders.services import CartLine, create_order
from pricing.models import CommissionRule
from pricing.services import quote


def test_default_fee_without_rules(runner):
    assert quote(runner).fee_share == Decimal("0.05")
    assert quote(runner, qty=6, mode="wholesale").fee_share == Decimal("0.03")


def test_supplier_rule_beats_category_rule(runner, shoes):
    CommissionRule.objects.create(category=shoes, retail_fee=Decimal("0.08"), wholesale_fee=Decimal("0.04"))
    assert quote(runner).fee_share == Decimal("0.08")
    CommissionRule.objects.create(supplier=runner.supplier, retail_fee=Decimal("0.10"))
    q = quote(runner)
    assert q.fee_share == Decimal("0.10")
    assert q.fee_rub == q.goods_rub * Decimal("0.10")
    # У правила поставщика опт не задан: берём правило категории.
    assert quote(runner, qty=6, mode="wholesale").fee_share == Decimal("0.04")


def test_zero_fee_is_allowed(runner):
    CommissionRule.objects.create(supplier=runner.supplier, retail_fee=Decimal("0"))
    assert quote(runner).fee_rub == 0


def test_order_remembers_fee_rate(runner, shoes):
    CommissionRule.objects.create(category=shoes, retail_fee=Decimal("0.07"))
    order = create_order([CartLine("runner", 1, "42")], contact="@b")
    item = order.items.get()
    assert item.fee_share == Decimal("0.07")
    # Потом ставку поменяли — в уже оформленном заказе она прежняя.
    CommissionRule.objects.filter(category=shoes).update(retail_fee=Decimal("0.01"))
    item.refresh_from_db()
    assert item.fee_share == Decimal("0.07")


def test_catalog_and_quote_show_rule(runner, shoes):
    CommissionRule.objects.create(supplier=runner.supplier, retail_fee=Decimal("0.10"))
    client = Client()
    # 268 ¥ × 11,40 + 1,1 кг × 420 ₽ + 10% от товара = 3822,72 → 3820 ₽
    assert client.get("/api/products").json()["items"][0]["retail_rub"] == "3820"
    assert client.get("/api/quote", {"product": "runner"}).json()["fee_percent"] == "10.00"


def test_rule_needs_exactly_one_target(supplier, shoes):
    with pytest.raises(ValidationError):
        CommissionRule(category=shoes, supplier=supplier, retail_fee=Decimal("0.1")).full_clean()
    with pytest.raises(ValidationError):
        CommissionRule(retail_fee=Decimal("0.1")).full_clean()
    with pytest.raises(ValidationError):
        CommissionRule(category=shoes).full_clean()  # ни одной ставки
    with pytest.raises(IntegrityError), transaction.atomic():
        CommissionRule.objects.create(retail_fee=Decimal("0.1"))


def test_moderator_manages_rules_in_admin(runner, shoes):
    setup_roles()
    user = User.objects.create_user("mod", password="pw-123456!", is_staff=True)
    user.groups.add(Group.objects.get(name="Модераторы"))
    client = Client()
    client.force_login(user)
    assert client.get("/admin/pricing/commissionrule/add/").status_code == 200
    resp = client.post("/admin/pricing/commissionrule/add/", {"category": shoes.pk, "retail_fee": "0.06",
                                                               "wholesale_fee": "", "note": "Обувь дороже возить"})
    assert resp.status_code == 302, resp.content.decode()[:500]
    assert quote(runner).fee_share == Decimal("0.06")
