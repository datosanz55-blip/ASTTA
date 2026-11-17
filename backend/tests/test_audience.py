import json
from io import BytesIO

import pytest
from openpyxl import load_workbook

from assistant.chat import chat, search_catalog
from catalog.audience import normalize_gender, requested_audience
from catalog.importer import build_template, import_catalog
from catalog.models import Category, Product
from tests.conftest import make_product


@pytest.mark.parametrize(('label', 'expected'), [
    ('женские', 'women'), ('Women', 'women'), ('女款', 'women'), ('男士', 'men'),
    ('男女同款', 'unisex'), ('Unisex Kids', 'kids'), ('для мальчиков', 'boys'),
    ('чёрные flare', ''), ('мужское и женское', ''),
])
def test_explicit_audience_labels_only(label, expected):
    assert normalize_gender(label) == expected


@pytest.fixture
def wardrobe(supplier, shoes, pricing_setup):
    specs = [('men', 'синие джинсы', 'men'), ('women', 'синие джинсы', 'women'),
             ('unisex', 'синие джинсы', 'unisex'), ('unknown', 'синие джинсы flare', ''),
             ('child', 'синие джинсы', 'boys')]
    return {slug: make_product(supplier, shoes, slug, 100, 1, [], title_ru=title, gender=gender)
            for slug, title, gender in specs}


def test_gender_is_enforced_before_ranking_and_budget(wardrobe):
    men = search_catalog('джинсы', audience='men', outfit=True)
    assert {p['slug'] for p in men} == {'men', 'unisex'}
    women = search_catalog('джинсы', audience='women', outfit=True)
    assert {p['slug'] for p in women} == {'women', 'unisex'}
    assert all(p['gender_label'] for p in men)
    assert search_catalog('джинсы', max_price_rub=1, audience='men') == []


def test_existing_chinese_metadata_and_manual_override(wardrobe):
    p = wardrobe['unknown']
    p.title_zh = 'ZHUFEI 女款 牛仔裤'
    p.save()
    assert p.audience == 'women'
    p.gender = 'unisex'
    assert p.audience == 'unisex'
    p.gender, p.title_zh = '', ''
    p.market = {'source': 'poizon', 'gender': 'Men'}
    assert p.audience == 'men'
    p.market = {}
    assert p.audience == ''  # The flare cut and colour are not evidence of gender.


def test_non_clothing_gifts_are_not_assigned_a_gender(wardrobe, supplier):
    tech = Category.objects.create(slug='tech', name_ru='Электроника')
    make_product(supplier, tech, 'headphones', 50, .2, [], title_ru='headphones')
    assert search_catalog('headphones', audience='men')[0]['slug'] == 'headphones'
    assert search_catalog('headphones', audience='men', outfit=True) == []


def test_audience_persists_in_followups_and_can_be_changed():
    history = [{'role': 'user', 'content': 'Собери образ для парня 20 лет'},
               {'role': 'assistant', 'content': 'Могу предложить женские джинсы'},
               {'role': 'user', 'content': 'Другой вариант, подешевле'}]
    assert requested_audience(history) == 'men'
    history.append({'role': 'user', 'content': 'А теперь для девушки'})
    assert requested_audience(history) == 'women'
    assert requested_audience([{'role': 'user', 'content': 'не женские, а мужские'}]) == 'men'


def test_llm_cannot_force_incompatible_cards(wardrobe, monkeypatch, settings):
    from assistant import llm

    settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL = 'https://llm.example', 'test', 'test'
    calls = [{'id': 'a', 'name': 'search_catalog', 'arguments': {'query': 'джинсы'}},
             {'id': 'b', 'name': 'get_product', 'arguments': {'slug': 'women'}}]
    steps = [llm.Reply(content='', tokens=1, tool_calls=calls,
                       raw_message={'role': 'assistant', 'tool_calls': [
                           {'id': c['id'], 'type': 'function', 'function': {
                               'name': c['name'], 'arguments': json.dumps(c['arguments'])}} for c in calls]}),
             llm.Reply(content='Подборка\nТОВАРЫ: men, women, child, unknown, unisex',
                       tokens=1, tool_calls=[], raw_message={})]
    monkeypatch.setattr(llm, 'chat', lambda *a, **k: steps.pop(0))
    result = chat([{'role': 'user', 'content': 'собери синий образ для парня 20 лет'}])
    assert set(result.products) == {'men', 'unisex'}


def test_gender_import_and_legacy_files_preserve_existing_value(supplier, shoes):
    wb = load_workbook(BytesIO(build_template()))
    wb.worksheets[0].append(['P-1', 'джинсы', 'shoes', 100, 1, '', 'M', '', '', '', '', '', '', 'мужское'])
    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    result = import_catalog(stream, supplier, publish=True)
    assert result.ok, result.errors
    p = Product.objects.get(sku='P-1')
    assert p.gender == 'men'
    # Both previous templates (with brand, and without brand) remain valid.
    for length in (13, 12):
        wb = load_workbook(BytesIO(build_template()))
        wb.worksheets[0].delete_cols(length + 1, 14 - length)
        wb.worksheets[0].append(['P-1', 'джинсы', 'shoes', 120, 1, '', 'M', '', '', '', '', ''])
        stream = BytesIO()
        wb.save(stream)
        stream.seek(0)
        result = import_catalog(stream, supplier, publish=True)
        assert result.ok, result.errors
        p.refresh_from_db()
        assert p.gender == 'men'
