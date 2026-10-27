"""Загрузка каталога поставщика из Excel.

Шаблон двуязычный (китайский и русский), чтобы поставщик из Китая заполнял его без переводчика.
Если в файле есть хоть одна ошибка, не загружается ничего: поставщик исправляет файл и загружает заново.
Новые и изменённые товары уходят на модерацию.
"""

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from io import BytesIO

from django.db import transaction
from django.utils.text import slugify
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

from catalog.models import Category, PriceTier, Product, Supplier

# (поле, заголовок в шаблоне, обязательное)
COLUMNS = [
    ("sku", "货号\nАртикул", True),
    ("title_zh", "商品名称（中文）\nНазвание (кит.)", True),
    ("title_ru", "商品名称（俄语，可不填）\nНазвание (рус., можно пусто)", False),
    ("category", "类目\nКатегория", True),
    ("price_cny", "零售价（元）\nЦена в рознице, ¥", True),
    ("weight_kg", "包装后重量（公斤）\nВес в упаковке, кг", True),
    ("tiers", "批发价：起批量:单价; …\nОпт: от шт.:цена ¥; …", True),
    ("bulky", "大件（是/否）\nКрупногабарит (да/нет)", False),
    ("description_zh", "商品描述（中文）\nОписание (кит.)", False),
]
EXAMPLE_ROW = ["RUN-001", "轻便跑步鞋", "Кроссовки беговые", "shoes", 268, 1.1, "6:198; 30:176", "否",
               "透气网面，EVA 鞋底"]
YES = {"是", "да", "yes", "y", "1", "true"}


@dataclass
class ImportResult:
    created: int = 0
    updated: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self):
        return not self.errors


def build_template() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "商品 Товары"
    ws.append([title for _, title, _ in COLUMNS])
    ws.append(EXAMPLE_ROW)
    header_fill = PatternFill("solid", fgColor="DCEF3A")
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 48
    for col, width in zip("ABCDEFGHI", [14, 30, 30, 14, 14, 16, 26, 14, 40], strict=True):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"

    cats = wb.create_sheet("类目 Категории")
    cats.append(["代码 Код", "中文", "Русский"])
    for category in Category.objects.all():
        cats.append([category.slug, category.name_zh, category.name_ru])

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _decimal(value, label, row, errors, positive=True):
    try:
        number = Decimal(str(value).replace(",", ".").strip())
    except (InvalidOperation, AttributeError):
        errors.append(f"第 {row} 行 / строка {row}: {label} — не число")
        return None
    if positive and number <= 0:
        errors.append(f"第 {row} 行 / строка {row}: {label} — должно быть больше 0")
        return None
    return number


def _tiers(value, row, errors):
    tiers = []
    for part in str(value or "").replace("；", ";").replace("：", ":").split(";"):
        part = part.strip()
        if not part:
            continue
        try:
            qty, price = part.split(":")
            tiers.append((int(qty), Decimal(price.strip().replace(",", "."))))
        except (ValueError, InvalidOperation):
            errors.append(f"第 {row} 行 / строка {row}: опт «{part}» — нужен формат 6:198")
            return []
    if not tiers:
        errors.append(f"第 {row} 行 / строка {row}: нет оптовых цен")
    if len({qty for qty, _ in tiers}) != len(tiers) or any(q < 1 or p <= 0 for q, p in tiers):
        errors.append(f"第 {row} 行 / строка {row}: оптовые ступени повторяются или меньше 1")
        return []
    return sorted(tiers)


def _category(value, row, errors, categories):
    key = str(value or "").strip().lower()
    category = categories.get(key)
    if category is None:
        errors.append(f"第 {row} 行 / строка {row}: категория «{value}» не найдена, см. лист «类目 Категории»")
    return category


def import_catalog(file, supplier: Supplier) -> ImportResult:
    result = ImportResult()
    try:
        ws = load_workbook(file, read_only=True, data_only=True).worksheets[0]
    except Exception:
        result.errors.append("文件无法读取 / Файл не читается: нужен .xlsx по шаблону")
        return result

    categories = {}
    for category in Category.objects.all():
        for key in (category.slug, category.name_ru, category.name_zh):
            if key:
                categories[key.lower()] = category

    rows = []
    for index, values in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(v not in (None, "") for v in values):
            continue
        data = dict(zip([name for name, _, _ in COLUMNS], values, strict=False))
        if data == dict(zip([name for name, _, _ in COLUMNS], EXAMPLE_ROW, strict=True)):
            continue  # строку-пример из шаблона пропускаем
        missing = [title.splitlines()[-1] for name, title, required in COLUMNS
                   if required and data.get(name) in (None, "")]
        if missing:
            result.errors.append(f"第 {index} 行 / строка {index}: не заполнено: {', '.join(missing)}")
            continue
        rows.append({
            "row": index,
            "sku": str(data["sku"]).strip(),
            "title_zh": str(data["title_zh"]).strip(),
            "title_ru": str(data.get("title_ru") or "").strip(),
            "category": _category(data["category"], index, result.errors, categories),
            "price_cny": _decimal(data["price_cny"], "цена", index, result.errors),
            "weight_kg": _decimal(data["weight_kg"], "вес", index, result.errors),
            "tiers": _tiers(data["tiers"], index, result.errors),
            "bulky": str(data.get("bulky") or "").strip().lower() in YES,
            "description_zh": str(data.get("description_zh") or "").strip(),
        })

    skus = [r["sku"] for r in rows]
    for sku in {s for s in skus if skus.count(s) > 1}:
        result.errors.append(f"货号重复 / Артикул {sku} повторяется в файле")
    if not rows and not result.errors:
        result.errors.append("文件中没有商品 / В файле нет товаров")
    if result.errors:
        return result

    with transaction.atomic():
        for r in rows:
            product = Product.objects.filter(supplier=supplier, sku=r["sku"]).first()
            is_new = product is None
            if is_new:
                product = Product(supplier=supplier, sku=r["sku"], slug=unique_slug(supplier, r["sku"]))
            product.category = r["category"]
            product.title_zh = r["title_zh"]
            # Без русского названия товар уйдёт на модерацию с китайским, агент переведёт.
            product.title_ru = r["title_ru"] or product.title_ru or r["title_zh"]
            product.description_zh = r["description_zh"]
            product.price_cny = r["price_cny"]
            product.weight_kg = r["weight_kg"]
            product.bulky = r["bulky"]
            product.status = Product.Status.MODERATION
            product.full_clean(exclude=["slug"])
            product.save()
            product.tiers.all().delete()
            PriceTier.objects.bulk_create(
                [PriceTier(product=product, min_qty=q, price_cny=p) for q, p in r["tiers"]])
            if is_new:
                result.created += 1
            else:
                result.updated += 1
    return result


def unique_slug(supplier: Supplier, sku: str) -> str:
    base = slugify(f"{supplier.code}-{sku}") or f"{supplier.code}-item"
    slug, n = base, 2
    while Product.objects.filter(slug=slug).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug
