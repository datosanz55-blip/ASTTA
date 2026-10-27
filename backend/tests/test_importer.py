from io import BytesIO

from openpyxl import load_workbook

from catalog.importer import build_template, import_catalog
from catalog.models import Product


def filled_template(rows):
    wb = load_workbook(BytesIO(build_template()))
    ws = wb.worksheets[0]
    for row in rows:
        ws.append(row)
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def test_import_creates_products_for_moderation(supplier, shoes):
    result = import_catalog(filled_template([
        ["S-1", "跑步鞋", "", "鞋类", 120, "0,9", "5:100；20:90", "否", "描述"],
        ["S-2", "拖鞋", "Шлёпанцы", "shoes", 30, 0.4, "10:25", "", ""],
    ]), supplier)
    assert result.ok, result.errors
    assert result.created == 2
    first = Product.objects.get(sku="S-1")
    assert first.status == Product.Status.MODERATION
    assert first.title_ru == "跑步鞋"  # без русского названия — китайское, агент переведёт
    assert [(t.min_qty, int(t.price_cny)) for t in first.tiers.all()] == [(5, 100), (20, 90)]


def test_import_with_error_loads_nothing(supplier, shoes):
    result = import_catalog(filled_template([
        ["S-1", "跑步鞋", "", "shoes", 120, 0.9, "5:100", "", ""],
        ["S-2", "拖鞋", "", "unknown", "abc", 0.4, "10-25", "", ""],
    ]), supplier)
    assert not result.ok
    assert any("категория" in e for e in result.errors)
    assert any("цена" in e for e in result.errors)
    assert any("6:198" in e for e in result.errors)
    assert Product.objects.count() == 0


def test_reimport_updates_same_sku(supplier, shoes):
    import_catalog(filled_template([["S-1", "跑步鞋", "", "shoes", 120, 0.9, "5:100", "", ""]]), supplier)
    result = import_catalog(filled_template([["S-1", "跑步鞋", "", "shoes", 150, 0.9, "5:130", "", ""]]), supplier)
    assert (result.created, result.updated) == (0, 1)
    assert Product.objects.get(sku="S-1").price_cny == 150


def test_broken_file(supplier):
    result = import_catalog(BytesIO(b"not excel"), supplier)
    assert not result.ok
