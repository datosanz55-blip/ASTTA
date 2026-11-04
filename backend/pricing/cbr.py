"""Курс юаня с сайта ЦБ РФ (открытый XML, без ключа)."""

import datetime as dt
import xml.etree.ElementTree as ET
from decimal import Decimal

import httpx

CBR_DAILY_URL = "https://www.cbr.ru/scripts/XML_daily.asp"


def parse_daily(xml_text: str, currency: str = "CNY") -> tuple[dt.date, Decimal]:
    root = ET.fromstring(xml_text)
    date = dt.datetime.strptime(root.attrib["Date"], "%d.%m.%Y").date()
    for valute in root.iter("Valute"):
        if valute.findtext("CharCode") == currency:
            nominal = Decimal(valute.findtext("Nominal"))
            value = Decimal(valute.findtext("Value").replace(",", "."))
            return date, (value / nominal).quantize(Decimal("0.0001"))
    raise ValueError(f"В ответе ЦБ нет валюты {currency}")


def fetch_daily(currency: str = "CNY", timeout: float = 10.0) -> tuple[dt.date, Decimal]:
    response = httpx.get(CBR_DAILY_URL, timeout=timeout)
    response.raise_for_status()
    # ЦБ отдаёт windows-1251, httpx берёт кодировку из XML-заголовка не всегда.
    return parse_daily(response.content.decode("windows-1251"), currency)
