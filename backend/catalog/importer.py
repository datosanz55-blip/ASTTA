"""Загрузка каталога поставщика: Excel по шаблону и архив с фото.

Каталоги присылают поставщики, а на сайт их загружает команда ASTTA, поэтому шаблон на русском.
Фото кладут в ZIP: файл называется по артикулу (A-101.jpg, A-101_2.jpg) или лежит в папке с артикулом.
Если в файле или архиве есть хоть одна ошибка, не загружается ничего: исправили и загрузили заново.
"""

import re
import zipfile
import zlib
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import PurePosixPath

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.utils.text import slugify
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

from catalog.images import MAX_SOURCE_BYTES, ImageError, prepare_image
from catalog.models import Category, PriceTier, Product, ProductImage, Supplier

# (поле, заголовок в шаблоне, обязательное)
COLUMNS = [
    ("sku", "Артикул", True),
    ("title_ru", "Название", True),
    ("category", "Категория", True),
    ("price_cny", "Цена у поставщика, ¥", True),
    ("weight_kg", "Вес в упаковке, кг", True),
    ("tiers", "Опт: от шт.:цена ¥; … (можно пусто)", False),
    ("sizes", "Размеры через запятую (S, M, L или 36-45)", False),
    ("colors", "Цвета через запятую", False),
    ("bulky", "Крупногабарит (да/нет)", False),
    ("description_ru", "Описание", False),
    ("source_url", "Ссылка у поставщика", False),
    ("title_zh", "Название на китайском (можно пусто)", False),
]
EXAMPLE_ROW = ["RUN-001", "Кроссовки беговые, сетка", "Обувь", 268, 1.1, "6:198; 30:176", "36-45", "чёрный, белый",
               "нет", "Лёгкие, верх из сетки, подошва EVA", "https://detail.1688.com/offer/000000000.html",
               "轻便跑步鞋"]
YES = {"да", "yes", "y", "1", "true", "是"}

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTOS = 300
MAX_UNPACKED_BYTES = 1024 * 1024 * 1024
URL = URLValidator(schemes=["http", "https"])


@dataclass
class ImportResult:
    created: int = 0
    updated: int = 0
    photos: int = 0
    translated: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self):
        return not self.errors


def build_template() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Товары"
    ws.append([title for _, title, _ in COLUMNS])
    ws.append(EXAMPLE_ROW)
    header_fill = PatternFill("solid", fgColor="DCEF3A")
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 36
    for col, width in zip("ABCDEFGHIJKL", [14, 36, 16, 14, 14, 24, 22, 22, 14, 40, 36, 24], strict=True):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"

    cats = wb.create_sheet("Категории")
    cats.append(["Код", "Название"])
    for category in Category.objects.all():
        cats.append([category.slug, category.name_ru])

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _decimal(value, label, row, errors):
    try:
        number = Decimal(str(value).replace(",", ".").strip())
    except (InvalidOperation, AttributeError):
        errors.append(f"Строка {row}: {label} — не число")
        return None
    if number <= 0:
        errors.append(f"Строка {row}: {label} — должно быть больше 0")
        return None
    return number


def _tiers(value, row, errors):
    """Пустая ячейка — товар только в розницу. Иначе «от шт.:цена; …», самая маленькая ступень = минимальная партия."""
    tiers = []
    for part in str(value or "").replace("；", ";").replace("：", ":").split(";"):
        part = part.strip()
        if not part:
            continue
        try:
            qty, price = part.split(":")
            tiers.append((int(qty), Decimal(price.strip().replace(",", "."))))
        except (ValueError, InvalidOperation):
            errors.append(f"Строка {row}: опт «{part}» — нужен формат 6:198")
            return []
    if len({qty for qty, _ in tiers}) != len(tiers) or any(q < 1 or p <= 0 for q, p in tiers):
        errors.append(f"Строка {row}: оптовые ступени повторяются или меньше 1")
        return []
    return sorted(tiers)


def _category(value, row, errors, categories):
    key = str(value or "").strip().lower()
    category = categories.get(key)
    if category is None:
        errors.append(f"Строка {row}: категория «{value}» не найдена, см. лист «Категории»")
    return category


def _text(value, label, limit, row, errors):
    text = str(value or "").strip()
    if len(text) > limit:
        errors.append(f"Строка {row}: {label} длиннее {limit} символов")
        return ""
    return text


def _url(value, row, errors):
    url = str(value or "").strip()
    if not url:
        return ""
    try:
        URL(url)
    except ValidationError:
        errors.append(f"Строка {row}: ссылка «{url[:60]}» — нужен адрес вида https://…")
        return ""
    if len(url) > 500:
        errors.append(f"Строка {row}: ссылка длиннее 500 символов")
        return ""
    return url


def _read_rows(file, result, translate=False):
    try:
        ws = load_workbook(file, read_only=True, data_only=True).worksheets[0]
    except Exception:
        result.errors.append("Файл не читается: нужен .xlsx по шаблону")
        return []

    categories = {}
    for category in Category.objects.all():
        for key in (category.slug, category.name_ru, category.name_zh):
            if key:
                categories[key.lower()] = category

    # Колонки сверяем по заголовкам: файл по старому шаблону молча разложил бы значения не по своим полям.
    header = [str(v or "").strip() for v in next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())]
    titles = [title for _, title, _ in COLUMNS]
    if header[:len(titles)] != titles:
        result.errors.append("Колонки не совпадают с шаблоном: скачайте свежий шаблон и перенесите данные в него")
        return []

    names = [name for name, _, _ in COLUMNS]
    example = dict(zip(names, EXAMPLE_ROW, strict=True))
    rows = []
    for index, values in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not any(v not in (None, "") for v in values):
            continue
        data = dict(zip(names, values, strict=False))
        if data == example:
            continue  # строку-пример из шаблона пропускаем
        # С переводом можно оставить пустым русское название, если есть китайское: переведёт YandexGPT.
        optional = {"title_ru"} if translate and data.get("title_zh") not in (None, "") else set()
        missing = [title for name, title, required in COLUMNS
                   if required and name not in optional and data.get(name) in (None, "")]
        if missing:
            result.errors.append(f"Строка {index}: не заполнено: {', '.join(missing)}")
            continue
        rows.append({
            "row": index,
            "sku": str(data["sku"]).strip(),
            "title_ru": str(data.get("title_ru") or "").strip(),
            "category": _category(data["category"], index, result.errors, categories),
            "price_cny": _decimal(data["price_cny"], "цена", index, result.errors),
            "weight_kg": _decimal(data["weight_kg"], "вес", index, result.errors),
            "tiers": _tiers(data.get("tiers"), index, result.errors),
            "sizes": _text(data.get("sizes"), "размеры", 300, index, result.errors),
            "colors": _text(data.get("colors"), "цвета", 300, index, result.errors),
            "bulky": str(data.get("bulky") or "").strip().lower() in YES,
            "description_ru": str(data.get("description_ru") or "").strip(),
            "source_url": _url(data.get("source_url"), index, result.errors),
            "title_zh": str(data.get("title_zh") or "").strip(),
        })

    skus = [r["sku"] for r in rows]
    for sku in sorted({s for s in skus if skus.count(s) > 1}):
        result.errors.append(f"Артикул {sku} повторяется в файле")
    return rows


def _zip_name(info: zipfile.ZipInfo) -> str:
    """Архивы с Windows хранят русские и китайские имена файлов не в UTF-8: пробуем угадать кодировку."""
    if info.flag_bits & 0x800:
        return info.filename
    raw = info.filename.encode("cp437", errors="replace")
    for encoding in ("utf-8", "cp866", "gbk"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return info.filename


def _natural(name: str):
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", name.lower())]


def _match_sku(path: PurePosixPath, skus: dict[str, str]) -> str | None:
    """Папка с артикулом или имя файла, которое начинается с артикула: A-101.jpg, A-101_2.jpg, A-101 (3).png."""
    for folder in reversed(path.parts[:-1]):
        if folder.lower() in skus:
            return skus[folder.lower()]
    stem = path.stem.lower()
    best = None
    for key in skus:
        fits = stem == key or (stem.startswith(key) and stem[len(key)] in " _-(.,")
        if fits and (best is None or len(key) > len(best)):
            best = key
    return skus[best] if best else None


def read_photos(archive, skus: set[str], result: ImportResult) -> dict[str, list]:
    """Фото из архива по артикулам, уже уменьшенные и в WebP. Ошибки и предупреждения пишет в result."""
    try:
        zf = zipfile.ZipFile(archive)
    except (zipfile.BadZipFile, OSError):
        result.errors.append("Архив с фото не читается: нужен .zip")
        return {}
    lookup = {sku.lower(): sku for sku in skus}
    found: dict[str, list[tuple[str, zipfile.ZipInfo]]] = {}
    unmatched, total = [], 0
    with zf:
        for info in zf.infolist():
            name = _zip_name(info)
            path = PurePosixPath(name.replace("\\", "/"))
            if info.is_dir() or "__MACOSX" in path.parts or path.name.startswith("."):
                continue
            ext = path.suffix.lower()
            if ext not in PHOTO_EXT:
                hint = " Сохраните фото как JPG." if ext in (".heic", ".heif") else ""
                result.warnings.append(f"Пропущен файл {path.name}: это не jpg, png или webp.{hint}")
                continue
            sku = _match_sku(path, lookup)
            if sku is None:
                unmatched.append(path.name)
                continue
            if info.file_size > MAX_SOURCE_BYTES:
                result.errors.append(f"{path.name}: фото больше 15 МБ")
                continue
            total += info.file_size
            found.setdefault(sku, []).append((path.name, info))

        count = sum(len(v) for v in found.values())
        if count > MAX_PHOTOS:
            result.errors.append(f"В архиве {count} фото, за раз можно до {MAX_PHOTOS}: разбейте на несколько архивов")
        if total > MAX_UNPACKED_BYTES:
            result.errors.append("Фото в архиве весят больше 1 ГБ: разбейте на несколько архивов")
        if unmatched:
            shown = ", ".join(sorted(unmatched, key=_natural)[:10])
            more = f" и ещё {len(unmatched) - 10}" if len(unmatched) > 10 else ""
            result.warnings.append(f"Фото без товара (имя не совпало с артикулом): {shown}{more}")
        if result.errors:
            return {}

        photos = {}
        for sku, files in found.items():
            photos[sku] = []
            for name, info in sorted(files, key=lambda f: _natural(f[0])):
                try:
                    photos[sku].append(prepare_image(zf.read(info), name))
                except ImageError as exc:
                    result.errors.append(str(exc))
                except (zipfile.BadZipFile, zlib.error, EOFError, NotImplementedError):
                    result.errors.append(f"{name}: файл в архиве повреждён, пересоберите архив")
    return {} if result.errors else photos


def _translate_titles(rows, result):
    """Пустые русские названия переводим с китайского одним пакетом запросов к YandexGPT."""
    from assistant import yandex
    from assistant.services import translate_cards

    todo = [r for r in rows if not r["title_ru"] and r["title_zh"]]
    if not todo:
        return
    try:
        translated = translate_cards([{"title_zh": r["title_zh"]} for r in todo])
    except yandex.AIUnavailable:
        result.errors.append("ИИ не подключён: впишите русские названия или подключите YandexGPT")
        return
    except yandex.AIError as exc:
        result.errors.append(f"Перевод не получился ({exc}), попробуйте ещё раз или впишите названия")
        return
    for r, item in zip(todo, translated, strict=True):
        if not item["title"]:
            result.errors.append(f"Строка {r['row']}: не удалось перевести название «{r['title_zh']}»")
        r["title_ru"] = item["title"]
        result.translated += 1


def import_catalog(file, supplier: Supplier, photos=None, publish: bool = False,
                   translate: bool = False) -> ImportResult:
    """file — Excel (можно без него, если грузят только фото к уже заведённым товарам), photos — ZIP.
    publish=True — товары сразу видны покупателям, иначе уходят на модерацию.
    translate=True — пустые русские названия переводим с китайского через YandexGPT."""
    result = ImportResult()
    rows = _read_rows(file, result, translate) if file else []
    if file is None and photos is None:
        result.errors.append("Выберите файл Excel или архив с фото")
    elif file is not None and not rows and not result.errors:
        result.errors.append("В файле нет товаров")

    existing = set(Product.objects.filter(supplier=supplier).exclude(sku="").values_list("sku", flat=True))
    images = read_photos(photos, existing | {r["sku"] for r in rows}, result) if photos is not None else {}
    if result.errors:
        return result
    if translate:
        _translate_titles(rows, result)
        if result.errors:
            return result

    status = Product.Status.PUBLISHED if publish else Product.Status.MODERATION
    with transaction.atomic():
        for r in rows:
            product = Product.objects.filter(supplier=supplier, sku=r["sku"]).first()
            is_new = product is None
            if is_new:
                product = Product(supplier=supplier, sku=r["sku"], slug=unique_slug(supplier, r["sku"]))
            product.category = r["category"]
            product.title_ru = r["title_ru"]
            product.title_zh = r["title_zh"]
            product.description_ru = r["description_ru"]
            product.source_url = r["source_url"]
            product.sizes = r["sizes"]
            product.colors = r["colors"]
            product.price_cny = r["price_cny"]
            product.weight_kg = r["weight_kg"]
            product.bulky = r["bulky"]
            product.status = status
            product.moderation_note = ""
            product.full_clean(exclude=["slug"])
            product.save()
            product.tiers.all().delete()
            PriceTier.objects.bulk_create(
                [PriceTier(product=product, min_qty=q, price_cny=p) for q, p in r["tiers"]])
            if is_new:
                result.created += 1
            else:
                result.updated += 1

        # Новые фото товара заменяют старые: команда загружает каталог поставщика целиком.
        for sku, files in images.items():
            product = Product.objects.get(supplier=supplier, sku=sku)
            for old in product.images.all():
                # Файл удаляем только после успешной записи в базу, иначе при откате фото пропадут.
                transaction.on_commit(lambda name=old.image.name, storage=old.image.storage: storage.delete(name))
                old.delete()
            for position, content in enumerate(files):
                ProductImage.objects.create(product=product, image=content, position=position)
            result.photos += len(files)
    return result


def unique_slug(supplier: Supplier, sku: str) -> str:
    base = slugify(f"{supplier.code}-{sku}") or f"{supplier.code}-item"
    slug, n = base, 2
    while Product.objects.filter(slug=slug).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug
