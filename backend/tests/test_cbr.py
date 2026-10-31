import datetime as dt
from decimal import Decimal

import pytest

from pricing.cbr import parse_daily

SAMPLE = """<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="27.10.2026" name="Foreign Currency Market">
  <Valute ID="R01235"><NumCode>840</NumCode><CharCode>USD</CharCode><Nominal>1</Nominal>
    <Name>Доллар США</Name><Value>81,2500</Value></Valute>
  <Valute ID="R01375"><NumCode>156</NumCode><CharCode>CNY</CharCode><Nominal>10</Nominal>
    <Name>Китайский юань</Name><Value>114,5230</Value></Valute>
</ValCurs>"""


def test_parse_cny_with_nominal():
    date, value = parse_daily(SAMPLE)
    assert date == dt.date(2026, 10, 27)
    assert value == Decimal("11.4523")


def test_missing_currency():
    with pytest.raises(ValueError):
        parse_daily(SAMPLE, "EUR")
