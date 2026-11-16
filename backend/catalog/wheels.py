"""Read explicit wheel specifications without guessing from photos or similar names."""
import re

WHEEL = re.compile(
    r"(?P<model>Кол[её]сный диск .+?)\s+R(?P<diameter>\d{2})\s+"
    r"(?P<size>(?P<rim>\d{2})[xх×](?P<width>\d+(?:[.,]\d+)?))\s+"
    r"PCD\s+(?P<pcd>\d+[xх×]\d+(?:[.,]\d+)?(?:[-–]\d+(?:[.,]\d+)?)?)\s+"
    r"ET\s*(?P<offset>-?\d+(?:[.,]\d+)?(?:[-–]\d+(?:[.,]\d+)?)?)",
    re.IGNORECASE,
)


def wheel_spec(product):
    if product.is_market:
        return None
    match = WHEEL.fullmatch(product.title_ru.strip())
    if not match or match['diameter'] != match['rim']:
        return None
    spec = match.groupdict()
    spec.pop('rim')
    spec['key'] = f"{product.supplier_id}|{product.category_id}|{spec['model'].casefold()}"
    spec['range'] = bool(re.search(r'\d[-–]\d', spec['pcd'] + ' ' + spec['offset']))
    spec['pcd'] = re.sub('[xх]', '×', spec['pcd'], flags=re.IGNORECASE)
    return spec
