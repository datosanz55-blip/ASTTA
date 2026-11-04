"""Способы доставки по умолчанию: без них заказ из каталога не оформить. Тарифы меняются в админке."""

from decimal import Decimal

from django.db import migrations

DEFAULTS = [
    ("auto", "Авто", "420", 18, 25, False, True),
    ("air", "Авиа", "980", 8, 12, False, False),
    ("cargo", "Сборный груз", "190", 25, 35, True, False),
]


def create(apps, schema_editor):
    ShippingMethod = apps.get_model("pricing", "ShippingMethod")
    if ShippingMethod.objects.exists():
        return  # уже настроены вручную — не трогаем
    for code, name, per_kg, dmin, dmax, bulky, default in DEFAULTS:
        ShippingMethod.objects.create(code=code, name=name, rub_per_kg=Decimal(per_kg), days_min=dmin,
                                      days_max=dmax, for_bulky_only=bulky, is_default=default)


class Migration(migrations.Migration):
    dependencies = [("pricing", "0004_link_rate")]
    operations = [migrations.RunPython(create, migrations.RunPython.noop)]
