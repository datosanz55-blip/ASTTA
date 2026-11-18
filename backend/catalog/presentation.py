"""Buyer-facing labels. Original supplier values remain unchanged for quotes and orders."""
import re
from decimal import Decimal

BRAND_FAMILIES = {
    'adidas': 'Adidas', 'adidas neo': 'Adidas', 'adidas originals': 'Adidas', 'adidas terrex': 'Adidas',
    'adidas performance': 'Adidas', 'adidas sportswear': 'Adidas', 'adidas neo label': 'Adidas',
    '阿迪达斯': 'Adidas', '耐克': 'Nike', 'nike': 'Nike', 'nike acg': 'Nike', 'nike sb': 'Nike',
    'nike sportswear': 'Nike', 'nike running': 'Nike', 'new balance': 'New Balance', 'newbalance': 'New Balance',
}


def brand_family(value):
    text = str(value or '').strip()
    key = re.sub(r'\s+', ' ', text.casefold().replace('®', '').replace('™', ''))
    return BRAND_FAMILIES.get(key, text)


TRANSLATIONS = [
    ('一对装', 'Пара'), ('一双装', 'Пара'), ('均码', 'Единый размер'), ('通用码', 'Единый размер'),
    ('特大码', 'Очень большой размер'), ('加大码', 'Большой размер'), ('大码', 'Большой размер'),
    ('小码', 'Маленький размер'), ('中码', 'Средний размер'), ('可调节', 'регулируется'),
    ('不可调节', 'не регулируется'), ('体重', 'Вес '), ('适合', 'для'), ('建议', 'рекомендуется'),
    ('身高', 'Рост '), ('厘米', ' см'), ('公斤', ' кг'), ('千克', ' кг'),
]


def variant_label(value, index=0):
    text = str(value or '').strip()
    # 斤 is half a kilogram. This is a weight recommendation, not a clothing-size conversion.
    text = re.sub(r'(\d+(?:\.\d+)?)\s*[-–~至]\s*(\d+(?:\.\d+)?)\s*斤',
                  lambda m: f'{Decimal(m[1]) / 2:g}–{Decimal(m[2]) / 2:g} кг', text)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*斤', lambda m: f'{Decimal(m[1]) / 2:g} кг', text)
    for original, translated in sorted(TRANSLATIONS, key=lambda pair: -len(pair[0])):
        text = text.replace(original, translated)
    text = re.sub(r'(\d)\s*[-~]\s*(\d)', r'\1–\2', text).replace('（', ' (').replace('）', ')')
    text = re.sub(r'(регулируется)(?=\d)', r'\1 ', text)
    if re.search(r'[\u3400-\u9fff]', text):
        return f'Вариант {index + 1} · уточните у агента'
    return re.sub(r'\s+', ' ', text).strip()


def size_options(product):
    market_sizes = (product.market or {}).get('sizes') or []
    raw = ([s.get('size') if isinstance(s, dict) else s for s in market_sizes]
           if product.is_market else product.size_list)
    if not raw:
        raw = product.size_list
    return [{'value': str(value), 'label': variant_label(value, i)} for i, value in enumerate(dict.fromkeys(raw))
            if value]
