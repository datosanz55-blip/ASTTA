from decimal import Decimal
from types import SimpleNamespace

import pytest

from catalog.models import Supplier
from catalog.wheels import wheel_spec
from orders.models import Order
from tests.conftest import make_product

TITLE = "Колёсный диск RUEIZU R117"


def wheel(supplier, shoes, slug, spec="R19 19x8.5 PCD 5×112 ET30", price=1950, **extra):
    return make_product(supplier, shoes, slug, price, 12, [], title_ru=f"{TITLE} {spec}",
                        sizes=spec.split()[1], **extra)


def test_parse_explicit_specs_only():
    def parse(title):
        return wheel_spec(SimpleNamespace(title_ru=title, is_market=False, supplier_id=1, category_id=2))
    data = parse(f"{TITLE} R19 19x8.5 PCD 5×112 ET-5")
    assert data['model'] == TITLE
    assert data['diameter'] == '19' and data['width'] == '8.5'
    assert data['pcd'] == '5×112' and data['offset'] == '-5'
    ranged = parse(f'{TITLE} R22 22x11.5 PCD 5×112-130 ET24-55')
    assert ranged['pcd'] == '5×112-130' and ranged['offset'] == '24-55' and ranged['range']
    for title in [TITLE, f"{TITLE} R19 20x9 PCD 5×112 ET30", "Чехол для диска R19"]:
        assert parse(title) is None


@pytest.mark.django_db
def test_detail_returns_complete_model_across_pages(client, supplier, shoes, pricing_setup):
    a = wheel(supplier, shoes, 'rim-19')
    b = wheel(supplier, shoes, 'rim-20', 'R20 20x9 PCD 5×108 ET40', 2080)
    c = wheel(supplier, shoes, 'rim-19-et43', 'R19 19x8.5 PCD 5×112 ET43')
    wheel(supplier, shoes, 'hidden-rim', status='moderation')
    different = wheel(supplier, shoes, 'different-model')
    different.title_ru = different.title_ru.replace('R117', 'R117S')
    different.save()
    other = Supplier.objects.create(code='other', name='Другой поставщик')
    wheel(other, shoes, 'other-supplier')
    page = client.get('/api/products', {'page_size': 1}).json()
    assert len(page['items']) == 1 and page['items'][0]['wheel']
    data = client.get(f'/api/products/{a.slug}').json()
    variants = {v['slug']: v for v in data['wheel_variants']}
    assert set(variants) == {a.slug, b.slug, c.slug}
    assert variants[b.slug]['price_cny'] == '2080.00'
    assert variants[b.slug]['sizes'] == ['20x9']
    assert variants[c.slug]['wheel']['offset'] == '43'
    assert len({v['wheel']['key'] for v in variants.values()}) == 1
    assert client.get('/api/products').json()['total'] == 5
    assert data['slug'] == a.slug
    response = client.post('/api/orders', {'consent': True, 'contact': '@buyer',
                           'items': [{'product': b.slug, 'size': '20x9', 'qty': 4}]},
                           content_type='application/json')
    assert response.status_code == 201
    line = Order.objects.get().items.get()
    assert line.product_id == b.pk and line.size == '20x9' and line.qty == 4
    assert line.unit_cny == Decimal('2080')
    invalid = client.post('/api/orders', {'consent': True, 'contact': '@buyer',
                          'items': [{'product': a.slug, 'size': '20x9'}]}, content_type='application/json')
    assert invalid.status_code == 400


@pytest.mark.django_db
def test_regular_product_unchanged(client, runner):
    data = client.get(f'/api/products/{runner.slug}').json()
    assert data['wheel'] is None and data['wheel_variants'] == []


@pytest.mark.django_db
def test_subsequent_uploads_extend_existing_model_automatically(client, supplier, shoes, pricing_setup):
    from catalog.importer import import_catalog
    from catalog.models import Product
    from tests.test_importer import filled_template

    def upload(sku, model, spec):
        row = [sku, f'Колёсный диск RUEIZU {model} {spec}', shoes.slug, 1950, 12, '',
               spec.split()[1], '', '', '', '', '']
        result = import_catalog(filled_template([row]), supplier, publish=True)
        assert result.ok, result.errors
        return Product.objects.get(supplier=supplier, sku=sku)

    first = upload('W-19', 'R117', 'R19 19x8.5 PCD 5×112 ET30')
    before = client.get(f'/api/products/{first.slug}').json()
    assert len(before['wheel_variants']) == 1
    second = upload('W-20', 'R117', 'R20 20x9 PCD 5×108 ET40')
    upload('W-OTHER', 'R118', 'R20 20x9 PCD 5×108 ET40')
    after = client.get(f'/api/products/{first.slug}').json()
    assert {v['slug'] for v in after['wheel_variants']} == {first.slug, second.slug}
    assert {v['wheel']['key'] for v in after['wheel_variants']} == {before['wheel']['key']}
