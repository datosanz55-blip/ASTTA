import httpx
import pytest
from django.test import Client

from assistant.chat import inspect_link
from links import apify
from links.models import MarketplaceItem

POIZON_ROW = {"status": "success", "productTitle": "Nike Dunk Low 复古板鞋", "brandName": "Nike",
              "articleNumber": "DD1391-100", "priceCny": 599.0, "minSalePriceCny": 599.0, "maxSalePriceCny": 899.0,
              "sizes": ["40", "41", "42"], "images": ["https://cdn.example/1.jpg"]}


class Resp:
    def __init__(self, status=200, data=None):
        self.status_code = status
        self._data = data if data is not None else []

    def json(self):
        return self._data


@pytest.fixture
def token(settings):
    settings.APIFY_TOKEN = "apify-test"


def test_poizon_item_fetched_normalized_and_cached(token, db, monkeypatch):
    calls = []

    def post(url, params=None, json=None, headers=None, timeout=None):
        calls.append((url, json, headers))
        return Resp(201, [POIZON_ROW])
    monkeypatch.setattr(httpx, "post", post)
    item = apify.fetch_item("poizon", "1234567")
    assert item["price_cny"] == 599.0 and item["price_cny_max"] == 899.0 and item["sizes"] == ["40", "41", "42"]
    assert calls[0][0].endswith("/v2/actors/sian.agency~dewu-poizon-price-tracker/run-sync-get-dataset-items")
    assert calls[0][1] == {"spuIds": ["1234567"]} and calls[0][2]["Authorization"] == "Bearer apify-test"
    assert apify.fetch_item("poizon", "1234567") == item and len(calls) == 1  # второй раз из кэша, бесплатно


def test_not_found_is_cached_too(token, db, monkeypatch):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: Resp(200, [{"status": "not_found"}]))
    assert apify.fetch_item("poizon", "1") is None
    assert MarketplaceItem.objects.get(code="poizon", item_id="1").found is False


def test_errors_are_explained(db, settings, monkeypatch):
    settings.APIFY_TOKEN = ""
    with pytest.raises(apify.ApifyError, match="APIFY_TOKEN"):
        apify.fetch_item("taobao", "730344766230")
    settings.APIFY_TOKEN = "t"
    monkeypatch.setattr(httpx, "post", lambda *a, **k: Resp(402))
    with pytest.raises(apify.ApifyError, match="закончились деньги"):
        apify.fetch_item("taobao", "730344766230")
    assert apify.fetch_item("1688", "123") is None  # 1688 этими скраперами не смотрим


def test_inspect_link_gives_price_under_key(token, pricing_setup, monkeypatch):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: Resp(200, [POIZON_ROW]))
    result = inspect_link("https://m.dewu.com/router/product/ProductDetail?spuId=1234567")
    assert result["on_marketplace"]["title"].startswith("Nike Dunk")
    assert result["estimate"]["for_price_cny"] == 599.0 and result["estimate"]["total_rub"] > 599 * 11


def test_market_endpoint_for_site(token, pricing_setup, monkeypatch):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: Resp(200, [{"title": "Пуховик", "priceCny": 329}]))
    data = Client().post("/api/link/market", {"text": "https://item.taobao.com/item.htm?id=730344766230"},
                         content_type="application/json").json()
    assert data["item"]["price_cny"] == 329.0 and data["estimate"]["total_rub"] > 0
    assert Client().get("/api/site").json()["market"] is True


def test_chat_returns_memo_with_price_range(token, pricing_setup, monkeypatch, settings):
    import json as _json

    from assistant import llm

    settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL = "https://llm.example", "k", "m"
    monkeypatch.setattr(httpx, "post", lambda *a, **k: Resp(200, [POIZON_ROW]))
    url = "https://m.dewu.com/router/product/ProductDetail?spuId=1234567"
    steps = [
        llm.Reply(content="", tokens=1, tool_calls=[{"id": "1", "name": "inspect_link", "arguments": {"text": url}}],
                  raw_message={"role": "assistant", "content": "", "tool_calls": [
                      {"id": "1", "type": "function", "function": {"name": "inspect_link",
                                                                    "arguments": _json.dumps({"text": url})}}]}),
        llm.Reply(content="Nike Dunk Low, под ключ от … ₽", tokens=1, tool_calls=[], raw_message={}),
    ]
    sent = []

    def chat(messages, tools=None, **kwargs):
        sent.append(messages)
        return steps.pop(0)
    monkeypatch.setattr(llm, "chat", chat)
    data = Client().post("/api/ai/chat", {"messages": [{"role": "user", "content": url}]},
                         content_type="application/json").json()
    assert "[Данные о товаре:" in data["memo"] and "599–899 ¥" in data["memo"]
    assert "под ключ" in data["memo"] and "–" in data["memo"].split("под ключ")[1]  # диапазон в рублях
    estimate = _json.loads(sent[1][-1]["content"])["estimate"]
    assert estimate["max_for_price_cny"] == 899.0 and estimate["max_total_rub"] > estimate["total_rub"]
