from django.test import Client


def test_catalog_cards_include_filter_attributes(runner):
    runner.brand = "Nike"
    runner.sizes = "41, 42, 43"
    runner.colors = "чёрный, белый"
    runner.save()
    card = Client().get("/api/products").json()["items"][0]
    assert card["brand"] == "Nike"
    assert card["sizes"] == ["41", "42", "43"]
    assert card["colors"] == ["чёрный", "белый"]
    detail = Client().get(f"/api/products/{runner.slug}").json()
    assert detail["brand"] == card["brand"] and detail["colors"] == card["colors"]


def test_market_brand_is_used_without_backfill(runner):
    runner.market = {"source": "poizon", "brand": "New Balance"}
    runner.save()
    assert Client().get("/api/products").json()["items"][0]["brand"] == "New Balance"
    runner.brand = "Manual brand"
    runner.save()
    assert Client().get("/api/products").json()["items"][0]["brand"] == "Manual brand"


def test_no_brand_is_invented_from_title(runner):
    runner.title_ru = "Nike lookalike"
    runner.save()
    assert Client().get("/api/products").json()["items"][0]["brand"] == ""


def test_import_brand_and_accept_old_template(supplier, shoes):
    from io import BytesIO

    from openpyxl import load_workbook

    from catalog.importer import build_template, import_catalog
    from catalog.models import Product
    from tests.test_importer import ROW

    wb = load_workbook(BytesIO(build_template()))
    ws = wb.worksheets[0]
    ws.append([*ROW, "Nike"])
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    result = import_catalog(stream, supplier)
    assert result.ok, result.errors
    assert Product.objects.get(sku="S-1").brand == "Nike"
    # Старые Excel без новой колонки принимаются и не стирают бренд.
    wb = load_workbook(BytesIO(build_template()))
    ws = wb.worksheets[0]
    ws.delete_cols(13)
    ws.append(ROW)
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    result = import_catalog(stream, supplier)
    assert result.ok, result.errors
    assert Product.objects.get(sku="S-1").brand == "Nike"
