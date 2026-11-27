"""ASTTA × TT Logistic workbook, sheets «Калькулятор» and «Шкалы»."""
from decimal import ROUND_CEILING, Decimal

POIZON_SHOES = (
    (4000, 18), (6000, 22), (9000, 25), (12000, 27), (17000, 27),
    (25000, 25), (36000, 23), (50000, 20), (100000, 14), (250000, 10),
)
TAOBAO_CLOTHING = ((500, 70), (1000, 55), (2000, 45), (5000, 35), (10000, 30), (20000, 25))
CLOTHING = {"clothes", "clothing", "odezhda", "jacket", "t-shirts", "pants", "hoodie"}


def workbook_scale(source, category):
    slug = category.slug.lower() if category else ""
    if source == "poizon" and slug in {"shoes", "obuv"}:
        return POIZON_SHOES, Decimal(400)
    if source == "taobao" and slug in CLOTHING:
        return TAOBAO_CLOTHING, Decimal(350)
    return None


def workbook_price(base: Decimal, scale) -> tuple[Decimal, bool]:
    points, minimum = scale
    percent = Decimal(points[-1][1])
    if base <= points[0][0]:
        percent = Decimal(points[0][1])
    else:
        for (left, low), (right, high) in zip(points, points[1:], strict=False):
            if base <= right:
                percent = low + (base - left) * (high - low) / (right - left)
                break
    total = base + max(minimum, base * percent / 100)
    return (total / 10).to_integral_value(rounding=ROUND_CEILING) * 10, base > points[-1][0]
