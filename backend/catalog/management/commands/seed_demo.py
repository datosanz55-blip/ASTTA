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
from orders.services import CartLine, create_order, mark_paid
from pricing.models import ExchangeRate, PricingConfig, ShippingMethod

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "demo.json"
PROTOTYPE_IMAGES = settings.BASE_DIR.parent / "assets" / "img"
CATEGORY_ZH = {"clothes": "服装", "shoes": "鞋类", "furniture": "家具", "home": "家居", "tech": "电子产品",
               "acc": "配饰", "bags": "箱包"}
SUPPLIER_CITY = {"gz": "Гуанчжоу", "jj": "Цзиньцзян", "fs": "Фошань", "sz": "Шэньчжэнь", "yw": "Иу"}
SUPPLIER_ZH = {"gz": "TT · 广州", "jj": "TT · 晋江", "fs": "TT · 佛山", "sz": "TT · 深圳", "yw": "TT · 义乌"}
TITLE_ZH = {
    "runner": "轻便跑步鞋 Cloud", "loafers": "麂皮乐福鞋", "leather-jacket": "真皮机车夹克", "bomber": "宽松飞行员夹克",
    "tee-white": "基础款纯棉T恤 240克", "sweatshirt": "三线毛圈卫衣", "tee-black": "印花T恤", "sofa": "三人位丝绒沙发",
    "lounge-chair": "旋转休闲椅", "stool": "白蜡木吧台凳", "lamp": "可调灯头落地灯", "headphones": "头戴式蓝牙耳机 5.3",
    "headphones-anc": "主动降噪耳机", "watch": "石英手表 40毫米表盘", "sunglasses": "太阳镜 UV400",
    "bag": "环保皮革公文包", "backpack": "城市双肩包 20升", "armchair": "拉扣单人沙发椅",
}
# Демо-заказы, чтобы в кабинете поставщика было что подтверждать и отправлять.
DEMO_ORDERS = [
    ("@ivan_k", "retail", [("bomber", "L", 1)]),
    ("+7 916 000-00-21", "wholesale", [("tee-white", "", 50), ("tee-black", "", 30)]),
    ("@marina.shop", "retail", [("leather-jacket", "M", 1), ("runner", "42", 1)]),
    ("@optika_msk", "wholesale", [("sunglasses", "", 20)]),
]
SHIPPING = [
    ("auto", "Авто", "420", 18, 25, False, True),
    ("air", "Авиа", "980", 8, 12, False, False),
    ("cargo", "Сборный груз", "190", 25, 35, True, False),
]


class Command(BaseCommand):
    help = "Загрузить демо-каталог из прототипа (повторный запуск обновляет данные)"

    def add_arguments(self, parser):
        parser.add_argument("--orders", action="store_true", help="создать демо-заказы")

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
                "name": sup["name"], "name_zh": SUPPLIER_ZH.get(code, ""), "about": sup["about"],
                "city": SUPPLIER_CITY.get(code, ""), "wechat": f"tt_{code}",
                "fact_days_min": sup["fact"][0], "fact_days_max": sup["fact"][1]})

        for p in data["products"]:
            product, _ = Product.objects.update_or_create(slug=p["id"], defaults={
                "supplier": suppliers[p["sup"]], "category": categories[p["cat"]], "sku": p["id"].upper(),
                "title_ru": p["t"], "title_zh": TITLE_ZH.get(p["id"], ""), "description_ru": p.get("desc", ""),
                "price_cny": Decimal(str(p["cny"])),
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

        if options["orders"]:
            for n, (contact, mode, lines) in enumerate(DEMO_ORDERS):
                order = create_order([CartLine(product=slug, qty=qty, size=size) for slug, size, qty in lines],
                                     contact=contact, mode=mode)
                # Последний заказ оставляем неоплаченным, остальные уже ждут выкупа у поставщика.
                if n < len(DEMO_ORDERS) - 1:
                    mark_paid(order, note="Демо: оплата получена")
        self.stdout.write(self.style.SUCCESS(f"Готово: {len(data['products'])} товаров"))
