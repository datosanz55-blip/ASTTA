"""Демо-данные из прототипа: категории, поставщики TT, 18 товаров, тарифы и курс 11,40 ₽."""

import datetime as dt
import json
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.roles import setup_roles
from catalog.models import Category, PriceTier, Product, ProductImage, Supplier
from pricing.models import ExchangeRate, PricingConfig, ShippingMethod

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "demo.json"
PROTOTYPE_IMAGES = settings.BASE_DIR.parent / "assets" / "img"
CATEGORY_ZH = {"clothes": "服装", "shoes": "鞋类", "furniture": "家具", "home": "家居", "tech": "电子产品",
               "acc": "配饰", "bags": "箱包"}
SUPPLIER_CITY = {"gz": "Гуанчжоу", "jj": "Цзиньцзян", "fs": "Фошань", "sz": "Шэньчжэнь", "yw": "Иу"}
SHIPPING = [
    ("auto", "Авто", "420", 18, 25, False, True),
    ("air", "Авиа", "980", 8, 12, False, False),
    ("cargo", "Сборный груз", "190", 25, 35, True, False),
]


class Command(BaseCommand):
    help = "Загрузить демо-каталог из прототипа (повторный запуск обновляет данные)"

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads(FIXTURE.read_text())
        setup_roles()
        PricingConfig.load()
        for code, name, per_kg, dmin, dmax, bulky, default in SHIPPING:
            ShippingMethod.objects.update_or_create(code=code, defaults={
                "name": name, "rub_per_kg": Decimal(per_kg), "days_min": dmin, "days_max": dmax,
                "for_bulky_only": bulky, "is_default": default})
        if not ExchangeRate.objects.exists():
            ExchangeRate.objects.create(currency="CNY", date=dt.date.today(), rub_per_unit=Decimal("11.40"),
                                        source="demo")

        categories = {}
        for position, cat in enumerate(data["cats"]):
            categories[cat["id"]], _ = Category.objects.update_or_create(slug=cat["id"], defaults={
                "name_ru": cat["name"], "name_zh": CATEGORY_ZH.get(cat["id"], ""), "position": position})
        suppliers = {}
        for code, sup in data["suppliers"].items():
            suppliers[code], _ = Supplier.objects.update_or_create(code=code, defaults={
                "name": sup["name"], "about": sup["about"], "city": SUPPLIER_CITY.get(code, ""),
                "fact_days_min": sup["fact"][0], "fact_days_max": sup["fact"][1]})

        for p in data["products"]:
            product, _ = Product.objects.update_or_create(slug=p["id"], defaults={
                "supplier": suppliers[p["sup"]], "category": categories[p["cat"]], "sku": p["id"].upper(),
                "title_ru": p["t"], "description_ru": p.get("desc", ""), "price_cny": Decimal(str(p["cny"])),
                "sale_percent": p.get("sale", 0), "weight_kg": Decimal(str(p["kg"])), "bulky": bool(p.get("bulky")),
                "size_grid": p.get("sizes") or "", "is_new": bool(p.get("isNew")),
                "status": Product.Status.PUBLISHED, "rating": p.get("rating"),
                "reviews_count": p.get("reviews", 0), "sold_count": p.get("sold", 0)})
            product.tiers.all().delete()
            PriceTier.objects.bulk_create([PriceTier(product=product, min_qty=q, price_cny=Decimal(str(c)))
                                           for q, c in p["tiers"]])
            source = PROTOTYPE_IMAGES / f"{p['id']}.jpg"
            if source.exists() and not product.images.exists():
                with source.open("rb") as fh:
                    ProductImage.objects.create(product=product, image=File(fh, name=source.name))

        self.stdout.write(self.style.SUCCESS(f"Готово: {len(data['products'])} товаров"))
