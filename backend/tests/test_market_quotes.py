from datetime import timedelta
from decimal import Decimal

import pytest
from django.test import Client
from django.utils import timezone

from links import apify
from links.market_quotes import image_url, job_out, run_lookup
from links.models import MarketLookup, MarketplaceItem
from orders.models import Order

URL = 'https://fast.dewu.com/page/productDetail?spuId=1234567'
ROW = {'spuId': '1234567', 'status': 'success', 'productTitle': 'Nike Dunk', 'priceCny': 599,
       'minSalePriceCny': 599, 'maxSalePriceCny': 899, 'lowestPriceSkuId': '1', 'sizes': ['40', '42'],
       'images': ['https://cdn.poizon.com/item.webp', 'https://evil.example/image'],
       'skus': [{'skuId': '1', 'size': '40', 'price': 79900},
                {'skuId': '2', 'size': '42', 'salePriceCny': 899}]}


@pytest.fixture
def market(monkeypatch, settings, db):
    from links.tasks import lookup_market

    settings.APIFY_TOKEN = 'test'
    calls = []

    def actor(*args):
        calls.append(args)
        return [ROW]
    monkeypatch.setattr(apify, 'run_actor', actor)
    monkeypatch.setattr(lookup_market, 'delay', lambda ident: lookup_market.run(ident))
    return calls


def test_live_ask_binding_never_uses_official_retail():
    item = apify.normalize('poizon', ROW)
    assert item['size_prices'] == {'40': 599, '42': 899}
    assert apify.price_for_size(item, 'EU 42') == 899
    assert apify.price_for_size(item, '43') is None
    retail = dict(ROW, lowestPriceSkuId='', skus=[{'size': '42', 'price': 79900, 'authPrice': 79900}])
    assert apify.normalize('poizon', retail)['size_prices'] == {}
    assert apify._num(float('nan')) is None
    assert apify._num(float('inf')) is None


def test_async_quote_bound_to_size_qty_url_and_price(market, pricing_setup):
    client = Client()
    response = client.post('/api/link/market-jobs', {'text': URL, 'size': '42', 'qty': 2},
                           content_type='application/json')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'ready' and Decimal(data['quote']['price_cny']) == Decimal('899')
    assert data['item']['images'][0].startswith('/api/link/image?token=')
    assert len(data['item']['images']) == 1
    assert client.get(f"/api/link/market-jobs/{data['id']}").json()['quote'] == data['quote']
    fields = {'text': URL, 'size': '42', 'qty': 2, 'price_cny': '899', 'quote_id': data['id'],
              'contact': '@buyer', 'consent': 'true'}
    for wrong in [{'size': '40'}, {'qty': 1}, {'text': URL.replace('1234567', '9999999')}, {'price_cny': '1'}]:
        assert client.post('/api/link/order', {**fields, **wrong}).status_code == 422
    assert client.post('/api/link/order', fields).status_code == 201
    line = Order.objects.get().items.get()
    assert line.size == '42' and line.qty == 2 and line.unit_cny == Decimal('899')
    MarketLookup.objects.filter(pk=data['id']).update(updated_at=timezone.now() - timedelta(minutes=6))
    assert client.post('/api/link/order', fields).status_code == 422
    assert client.get(f"/api/link/market-jobs/{data['id']}").json()['status'] == 'expired'


def test_missing_price_keeps_photos_but_cannot_order(market, pricing_setup):
    data = Client().post('/api/link/market-jobs', {'text': URL, 'size': '45'},
                         content_type='application/json').json()
    assert data['status'] == 'unavailable'
    assert data['item']['images'] and 'quote' not in data
    assert Client().post('/api/link/order', {'quote_id': data['id'], 'text': URL, 'size': '45',
                         'price_cny': '599', 'contact': '@buyer', 'consent': 'true'}).status_code == 422


def test_import_cache_does_not_certify_fresh_prices(market, pricing_setup):
    MarketplaceItem.objects.create(code='poizon', item_id='1234567',
                                   data={'price_cny': 1, 'size_prices': {'42': 1}})
    job = MarketLookup.objects.create(url=URL, size='42')
    run_lookup(job)
    assert job.status == 'ready' and Decimal(job.data['quote']['price_cny']) == Decimal('899')
    assert len(market) == 1
    second = MarketLookup.objects.create(url=URL, size='40')
    run_lookup(second)
    assert len(market) == 1  # Fresh same-product result reused across different sizes.
    assert Decimal(second.data['quote']['price_cny']) == Decimal('599')


def test_job_timeout_and_image_tokens(db, monkeypatch):
    from links.tasks import lookup_market

    monkeypatch.setattr(lookup_market, 'delay', lambda ident: None)
    data = Client().post('/api/link/market-jobs', {'text': URL, 'size': '42'},
                         content_type='application/json').json()
    assert data['status'] == 'pending'
    job = MarketLookup.objects.get(pk=data['id'])
    MarketLookup.objects.filter(pk=job.pk).update(created_at=timezone.now() - timedelta(minutes=5))
    job.refresh_from_db()
    assert job_out(job)['status'] == 'failed'
    assert image_url('http://127.0.0.1/image') == ''
    assert Client().get('/api/link/image?token=invalid').status_code == 404
    assert Client().get('/api/link/market-jobs/not-a-uuid').status_code == 404


def test_catalog_market_link_is_inspected(market, supplier, shoes, pricing_setup):
    from assistant.chat import inspect_link
    from tests.conftest import make_product

    make_product(supplier, shoes, 'known-market', 599, 1, [], source_url=URL,
                 market={'source': 'poizon', 'url': URL})
    result = inspect_link(URL)
    assert result['in_catalog']['slug'] == 'known-market'
    assert result['on_marketplace']['images']
    assert len(market) == 1


def test_image_proxy_validates_and_reencodes(monkeypatch):
    from contextlib import contextmanager
    from io import BytesIO

    import httpx
    from PIL import Image

    out = BytesIO()
    Image.new('RGB', (8, 8), 'red').save(out, 'PNG')

    @contextmanager
    def stream(*args, **kwargs):
        yield type('Response', (), {'status_code': 200, 'headers': {'content-type': 'image/png'},
                                   'iter_bytes': lambda self: iter([out.getvalue()])})()
    monkeypatch.setattr(httpx, 'stream', stream)
    response = Client().get(image_url('https://cdn.poizon.com/image.png'))
    assert response.status_code == 200 and response['Content-Type'] == 'image/webp'
    assert Image.open(BytesIO(response.content)).format == 'WEBP'
    assert image_url('https://cdn.poizon.com:bad/image.png') == ''
    assert image_url('https://cdn.poizon.com:8080/image.png') == ''


def test_duplicate_size_variants_are_not_merged_into_one_quote():
    row = dict(ROW, skus=[{'skuId': 'a', 'size': '42', 'salePriceCny': 899},
                          {'skuId': 'b', 'size': '42', 'salePriceCny': 899}])
    assert apify.normalize('poizon', row)['size_prices'] == {}


def test_ai_size_tool_returns_background_job(market, pricing_setup, monkeypatch, settings):
    import json

    from assistant import llm

    settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL = 'https://llm.example', 'test', 'test'
    args = {'text': URL, 'size': '42'}
    steps = [llm.Reply(content='', tokens=1, tool_calls=[{'id': 'lookup', 'name': 'check_market_price',
                                                       'arguments': args}],
                       raw_message={'role': 'assistant', 'tool_calls': [{'id': 'lookup', 'type': 'function',
                                    'function': {'name': 'check_market_price', 'arguments': json.dumps(args)}}]}),
             llm.Reply(content='Проверяю цену размера 42', tokens=1, tool_calls=[], raw_message={})]
    monkeypatch.setattr(llm, 'chat', lambda *a, **k: steps.pop(0))
    response = Client().post('/api/ai/chat', {'messages': [{'role': 'user', 'content': URL + ' размер 42'}]},
                             content_type='application/json')
    assert response.status_code == 200
    job_id = response.json()['market_jobs'][0]
    result = Client().get(f'/api/link/market-jobs/{job_id}').json()
    assert Decimal(result['quote']['price_cny']) == Decimal('899')
    assert result['item']['images'] and response.json()['order'] is None


def test_workbook_price_is_shared_by_catalog_size_quote_and_order(market, supplier, shoes, pricing_setup):
    from pricing.marketplace import POIZON_SHOES, TAOBAO_CLOTHING, workbook_price
    from tests.conftest import make_product

    assert workbook_price(Decimal("1000"), (POIZON_SHOES, Decimal(400))) == (1400, False)
    assert workbook_price(Decimal("10000"), (POIZON_SHOES, Decimal(400))) == (12570, False)
    assert workbook_price(Decimal("6200"), (POIZON_SHOES, Decimal(400))) == (7580, False)
    assert workbook_price(Decimal("1000"), (TAOBAO_CLOTHING, Decimal(350))) == (1550, False)
    assert workbook_price(Decimal("20001"), (TAOBAO_CLOTHING, Decimal(350))) == (25010, True)

    make_product(supplier, shoes, "known-market", 899, 1, [], source_url=URL,
                 market={"source": "poizon", "url": URL})
    client = Client()
    card = client.get("/api/products").json()["items"][0]
    assert card["market"]["excludes_delivery"]
    assert Decimal(card["retail_rub"]) == 14820
    data = client.post("/api/link/market-jobs", {"text": URL, "size": "42", "qty": 2},
                       content_type="application/json").json()
    assert data["quote"]["excludes_delivery"]
    assert Decimal(data["quote"]["total_rub"]) == 29640
    fields = {"text": URL, "size": "42", "qty": 2, "price_cny": "899", "quote_id": data["id"],
              "contact": "@buyer", "consent": "true"}
    assert client.post("/api/link/order", fields).status_code == 201
    assert Order.objects.get().total_rub == 29640
    assert client.post("/api/link/order", {**fields, "quote_id": "", "price_cny": "20000"}).status_code == 422


def test_telegram_only_checkout_and_workbook_catalog(settings, supplier, shoes, pricing_setup):
    from catalog.models import Category
    from tests.conftest import make_product

    settings.TELEGRAM_ONLY_ORDERS = True
    make_product(supplier, shoes, "covered", 899, 1, [], market={"source": "poizon", "url": URL})
    category = Category.objects.create(slug="accessories", name_ru="Аксессуары")
    make_product(supplier, category, "uncovered", 899, 1, [], market={"source": "poizon", "url": URL})
    make_product(supplier, shoes, "manual", 20000, 1, [], market={"source": "poizon", "url": URL})
    client = Client()
    cards = {card["slug"]: card for card in client.get("/api/products").json()["items"]}
    assert cards["covered"]["retail_rub"] == "14820"
    assert cards["uncovered"]["retail_rub"] is None
    assert cards["manual"]["retail_rub"] is None
    direct = client.post("/api/orders", {"items": [{"product": "covered"}], "contact": "@buyer", "consent": True},
                         content_type="application/json")
    link = client.post("/api/link/order", {"text": URL, "price_cny": "899", "consent": "true", "contact": "@buyer"})
    assert direct.status_code == link.status_code == 409
    assert not Order.objects.exists()
