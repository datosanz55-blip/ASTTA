"""Audience metadata: use explicit labels, never infer gender from photos, colour or cut."""
import re

LABELS = {'men': 'Мужское', 'women': 'Женское', 'unisex': 'Унисекс',
          'boys': 'Для мальчиков', 'girls': 'Для девочек', 'kids': 'Детское', '': 'Не указан'}
PATTERNS = [
    ('boys', r'мальчик|\bboys?\b|男童'),
    ('girls', r'девочек|девочк|\bgirls?\b|女童'),
    ('kids', r'детск|реб[её]н|\bkids?\b|\bchildren\b|儿童|童装|童鞋'),
    ('unisex', r'унисекс|\bunisex\b|男女同款|男女通用|中性'),
    ('women', r'женск|женщин|\bwomen(?:s)?\b|\bfemale\b|女款|女士|女装|女鞋|女裤'),
    ('men', r'мужск|мужчин|\bmen(?:s)?\b|\bmale\b|男款|男士|男装|男鞋|男裤'),
]
WEARABLE = re.compile(r'одеж|обув|кроссов|кеды|ботин|джинс|брюк|штаны|юбк|плать|худи|толстов|куртк|футбол|'
                      r'рубаш|шорт|свитер|пальто|костюм|топ\b|sneaker|shoes|pants|jeans|hoodie|shirt|dress|衣|鞋|裤|裙',
                      re.I)


def normalize_gender(value):
    text = str(value or '').casefold().strip()
    if text in LABELS:
        return text
    if text in ('男', 'м', 'm'):
        return 'men'
    if text in ('女', 'ж', 'f'):
        return 'women'
    found = [gender for gender, pattern in PATTERNS if re.search(pattern, text)]
    if 'unisex' in found:
        return 'kids' if any(g in found for g in ('kids', 'boys', 'girls')) else 'unisex'
    if 'boys' in found:
        return 'boys'
    if 'girls' in found:
        return 'girls'
    if 'kids' in found:
        return 'kids'
    return found[0] if len(found) == 1 else ''


def product_gender(product):
    if gender := normalize_gender(product.gender):
        return gender
    market = product.market or {}
    for key in ('gender', 'poizonGender'):
        if gender := normalize_gender(market.get(key)):
            return gender
    # Titles and category labels carry explicit terms such as 女款 or «женские».
    title = f'{product.title_ru} {product.title_zh} {product.category.name_ru}'
    if gender := normalize_gender(title):
        return gender
    # In descriptions accept labelled metadata only, not incidental comparisons.
    match = re.search(r'(?:пол|gender|性别)\s*[:：]\s*([^\n.;]{1,40})', product.description_ru, re.I)
    return normalize_gender(match[1]) if match else ''


def is_wearable(product):
    text = f'{product.title_ru} {product.title_zh} {product.category.name_ru}'
    return bool(product.size_grid or WEARABLE.search(text))


def matches_audience(product, audience='', outfit=False):
    if outfit and not is_wearable(product):
        return False
    if not audience or not is_wearable(product):
        return True
    allowed = {audience, 'unisex'} if audience in ('men', 'women') else {audience}
    if audience in ('boys', 'girls'):
        allowed.add('kids')
    return product_gender(product) in allowed


def requested_audience(history):
    rules = [
        ('boys', r'для\s+мальчик\w*'), ('girls', r'для\s+девоч\w*'),
        ('men', r'для\s+(?:парн\w*|мужчин\w*|юнош\w*)|\bмужск\w*'),
        ('women', r'для\s+(?:девуш\w*|женщин\w*)|\bженск\w*'),
        ('unisex', r'\bунисекс\b'),
    ]
    for message in reversed(history):
        if message.get('role') != 'user':
            continue
        text = str(message.get('content', '')).casefold()
        matches = [(m.start(), gender) for gender, rule in rules for m in re.finditer(rule, text)
                   if not re.search(r'\bне\s+$', text[:m.start()])]
        if matches:
            return max(matches)[1]
    return ''


def requested_outfit(history):
    return any(re.search(r'\bобраз\w*|\bлук\b|гардероб|одень|наряд', str(m.get('content', '')).casefold())
               for m in history if m.get('role') == 'user')
