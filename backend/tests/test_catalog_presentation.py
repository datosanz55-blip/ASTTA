import pytest
from django.core.files.base import ContentFile
from django.test import Client

from catalog.models import ProductImage
from catalog.presentation import brand_family, variant_label
from tests.conftest import make_product


@pytest.mark.parametrize('original,expected', [('Adidas Originals', 'Adidas'), ('ADIDAS NEO', 'Adidas'),
    ('Adidas TERREX', 'Adidas'), ('Adidas', 'Adidas'), ('Nike ACG', 'Nike'), ('Nike SB', 'Nike'),
    ('Nike', 'Nike'), ('NewBalance', 'New Balance'), ('Air Jordan', 'Air Jordan'),
    ('Adidas x Other', 'Adidas x Other')])
def test_brand_families(original, expected):
    assert brand_family(original) == expected


@pytest.mark.parametrize('original,expected', [('一对装', 'Пара'), ('体重100斤', 'Вес 50 кг'),
    ('体重146斤', 'Вес 73 кг'), ('加大码', 'Большой размер'),
    ('加大码（可调节57-62）', 'Большой размер (регулируется 57–62)'),
    ('体重100-146斤', 'Вес 50–73 кг'), ('均码', 'Единый размер'), ('42.5', '42.5'), ('XL', 'XL'),
    ('加大码（不可调节）', 'Большой размер (не регулируется)')])
def test_variant_labels(original, expected):
    assert variant_label(original) == expected


def test_unknown_variant_is_not_guessed():
    assert variant_label('未知规格', 2) == 'Вариант 3 · уточните у агента'


def test_labels_preserve_supplier_values(runner):
    raw = '加大码（可调节57-62）'
    runner.market = {'source': 'poizon', 'brand': 'Adidas Originals', 'sizes': [{'size': raw}, {'size': '体重100斤'}]}
    runner.sizes = raw + ', 体重100斤'
    runner.save()
    data = Client().get('/api/products/runner').json()
    assert data['brand_group'] == 'Adidas' and data['brand'] == 'Adidas Originals'
    assert data['size_options'][0]['value'] == raw
    assert data['size_options'][1]['label'] == 'Вес 50 кг'
    assert data['market']['sizes'][0]['size'] == raw
    assert data['market']['sizes'][0]['label'].startswith('Большой размер')
    runner.refresh_from_db()
    assert runner.market['sizes'][0] == {'size': raw}


def test_taobao_without_photos_hidden_from_catalog_and_ai(supplier, shoes, pricing_setup):
    from assistant.chat import get_product, search_catalog

    direct = make_product(supplier, shoes, 'direct', 100, 1, [])
    poizon = make_product(supplier, shoes, 'poizon', 100, 1, [], market={'source': 'poizon'})
    hidden = make_product(supplier, shoes, 'no-photo', 100, 1, [], market={'source': 'taobao'})
    good = make_product(supplier, shoes, 'with-photo', 100, 1, [], market={'source': 'taobao'})
    hidden.market['images'] = ['https://img.alicdn.com/remote.jpg']
    hidden.save()
    ProductImage.objects.create(product=good, image=ContentFile(b'fixture', name='fixture.webp'))
    client = Client()
    data = client.get('/api/products').json()
    assert data['total'] == 3
    assert {p['slug'] for p in data['items']} == {direct.slug, poizon.slug, good.slug}
    assert client.get('/api/products/no-photo').status_code == 404
    assert 'error' in get_product('no-photo')
    assert 'no-photo' not in {p['slug'] for p in search_catalog('')}
    assert hidden.__class__.objects.filter(pk=hidden.pk, status='published').exists()
    ProductImage.objects.create(product=hidden, image=ContentFile(b'fixture', name='fixed.webp'))
    assert client.get('/api/products').json()['total'] == 4
    assert client.get('/api/products/no-photo').status_code == 200


def test_import_does_not_cut_chinese_variant_to_twelve_characters():
    from catalog.market import poizon_item
    from tests.test_market_import import POIZON_ROW

    raw = '加大码（可调节57-62）'
    item = poizon_item({**POIZON_ROW, 'sizes': [{'size': raw, 'skuStatus': 1}]})
    assert item['sizes'][0]['size'] == raw
