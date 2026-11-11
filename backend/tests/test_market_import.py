"""Импорт товаров с Poizon и Taobao через Apify: разбор, перевод, фото, обновление цен."""

import json
from io import BytesIO

import httpx
import pytest
from django.test import Client
from PIL import Image

from catalog import market
from catalog.models import MarketImport, Product
from links.models import MarketplaceItem

POIZON_ROW = {
    "status": "ok", "spuId": 33425209, "url": "https://fast.dewu.com/page/productDetail?spuId=33425209",
    "poizonUrl": "https://www.thepoizon.ru/product/nike-a-one-8900209171995936",
    "title": "Nike A'One EP 篮球鞋", "poizonTitle": "NIKE A'One Баскетбольные кроссовки Унисекс Розовый",
    "brandName": "Nike", "articleNumber": "FZ8606-200", "poizonCategory": "Баскетбольные кроссовки",
    "thumbnailUrl": "https://cdn.poizon.com/pro-img/a.jpg", "images": ["https://cdn.poizon.com/pro-img/b.jpg",
                                                                      "https://evil.example/c.jpg"],
    "lowestAskCny": 248.0, "highestAskCny": 1505.0, "poizonMinPriceRub": 5302.0, "soldLabel": "Продано 895",
    "poizonFitAdvice": "Размер меньше, возьмите размер +0,5.",
    "sizes": [{"size": "38", "skuStatus": 1, "poizonSizes": {"RU": "37", "EU": "38"}, "poizonPriceRub": 7621.0},
              {"size": "39", "skuStatus": 1, "poizonSizes": {"RU": "38"}, "poizonPriceRub": None},
              {"size": "40", "skuStatus": 0}],
}


def jpeg():
    buf = BytesIO()
    Image.new("RGB", (64, 64), "white").save(buf, "JPEG")
    return buf.getvalue()


@pytest.fixture
def apify(settings, monkeypatch):
    """Apify и CDN площадок без сети: запоминаем, куда ходили и что отправили."""
    settings.APIFY_TOKEN = "t"
    monkeypatch.setattr(market, "SLEEP", lambda s: None)
    state = {"rows": [POIZON_ROW], "seen": [], "payloads": []}

    def handler(request):
        url = str(request.url)
        state["seen"].append(url)
        if url.endswith("/runs"):
            state["payloads"].append(json.loads(request.content))
            return httpx.Response(201, json={"data": {"id": "r1", "status": "RUNNING", "defaultDatasetId": "d1"}})
        if "/actor-runs/r1" in url:
            return httpx.Response(200, json={"data": {"id": "r1", "status": "SUCCEEDED", "defaultDatasetId": "d1"}})
        if "/datasets/d1/items" in url:
            return httpx.Response(200, json=state["rows"])
        if "cdn.poizon.com" in url:
            return httpx.Response(200, headers={"content-type": "image/jpeg"}, content=jpeg())
        return httpx.Response(404)
    monkeypatch.setattr(market, "TRANSPORT", httpx.MockTransport(handler))
    return state


def test_poizon_import_creates_product_with_photos_and_market_data(apify, shoes, pricing_setup):
    job = MarketImport.objects.create(source="poizon", queries="nike a'one\n", category=shoes, per_query=5,
                                      publish=True)
    market.run_import(job)
    job.refresh_from_db()
    assert job.status == "done" and job.created == 1, job.log
    assert apify["payloads"][0] == {"queries": ["nike a'one"], "maxResultsPerQuery": 5}
    product = Product.objects.get(sku="33425209")
    assert product.title_ru.startswith("NIKE A'One") and product.status == "published"
    assert product.supplier.code == "poizon" and product.price_cny == 248 and product.sizes == "38, 39"
    assert product.market["price_cny_max"] == 1505.0 and product.market["sizes"][0] == {
        "size": "38", "ru": "37", "poizon_rub": 7621.0}
    assert product.images.count() == 2  # фото с чужого сайта не скачиваем
    assert not any("evil.example" in u for u in apify["seen"])
    assert MarketplaceItem.objects.get(code="poizon", item_id="33425209").found  # форма заказа не платит повторно

    card = Client().get("/api/products").json()["items"][0]
    assert card["market"]["source"] == "poizon" and card["market"]["poizon_rub_min"] == 5302.0
    assert float(card["retail_rub"]) < float(card["market"]["retail_max_rub"])  # «от» и «до» по формуле ссылки

    again = MarketImport.objects.create(source="poizon", queries="nike", category=shoes)
    apify["rows"] = [dict(POIZON_ROW, lowestAskCny=300.0)]
    market.run_import(again)
    again.refresh_from_db()
    assert again.updated == 1 and Product.objects.get(sku="33425209").price_cny == 300  # не дубль, а обновление


def test_market_product_cannot_go_through_cart(apify, shoes, pricing_setup):
    market.run_import(MarketImport.objects.create(source="poizon", queries="x", category=shoes, publish=True))
    slug = Product.objects.get(sku="33425209").slug
    resp = Client().post("/api/orders", {"items": [{"product": slug}], "consent": True, "contact": "@me"},
                         content_type="application/json")
    assert resp.status_code == 400 and "цена зависит от размера" in resp.json()["detail"]


def test_refresh_hides_gone_and_restores(apify, shoes, pricing_setup):
    market.run_import(MarketImport.objects.create(source="poizon", queries="x", category=shoes, publish=True))
    apify["rows"] = [dict(POIZON_ROW, status="no_live_ask")]
    assert market.refresh_prices("poizon") == {"updated": 0, "hidden": 1}
    product = Product.objects.get(sku="33425209")
    assert product.status == "draft" and product.moderation_note == market.GONE_NOTE
    apify["rows"] = [dict(POIZON_ROW, lowestAskCny=260.0)]
    assert market.refresh_prices("poizon")["updated"] == 1
    product.refresh_from_db()
    assert product.status == "published" and product.price_cny == 260


def test_taobao_import_translates(apify, shoes, pricing_setup, monkeypatch, settings):
    from assistant import llm

    settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL = "https://llm.example", "k", "m"
    answers = iter(['{"items": ["卫衣 oversize"]}', '{"items": ["Худи оверсайз хлопок"]}'])
    monkeypatch.setattr(llm, "chat", lambda *a, **k: llm.Reply(content=next(answers), tool_calls=[], tokens=1,
                                                               raw_message={}))
    apify["rows"] = [{"title": "卫衣 oversize 纯棉", "priceCny": 89, "itemId": "730344766230",
                      "url": "https://item.taobao.com/item.htm?id=730344766230", "images": []}]
    job = MarketImport.objects.create(source="taobao", queries="худи оверсайз", category=shoes)
    market.run_import(job)
    assert apify["payloads"][0]["keywords"] == ["卫衣 oversize"]  # запрос переведён на китайский
    product = Product.objects.get(sku="730344766230")
    assert product.title_ru == "Худи оверсайз хлопок" and product.status == "draft"


def test_import_fails_cleanly_without_money(settings, shoes, monkeypatch):
    settings.APIFY_TOKEN = "t"
    monkeypatch.setattr(market, "TRANSPORT", httpx.MockTransport(lambda r: httpx.Response(402)))
    job = market.run_import(MarketImport.objects.create(source="poizon", queries="x", category=shoes))
    assert job.status == "failed" and "закончились деньги" in job.log


def test_admin_starts_import(db, shoes, monkeypatch, django_capture_on_commit_callbacks):
    from accounts.models import User
    from catalog import tasks

    started = []
    monkeypatch.setattr(tasks.run_market_import, "delay", lambda pk: started.append(pk))
    admin = User.objects.create_superuser("boss", "b@x.ru", "pw-123456!")
    client = Client()
    client.force_login(admin)
    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post("/admin/catalog/marketimport/add/", {"source": "poizon", "queries": "nike dunk",
                                                                "category": shoes.pk, "per_query": 10})
    assert resp.status_code == 302, resp.content.decode()[:2000]
    job = MarketImport.objects.get()
    assert job.created_by == admin and started == [job.pk]
