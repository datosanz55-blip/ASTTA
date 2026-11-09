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
    assert data["item"]["price_cny"] == 329.0 and float(data["estimate"]["total_rub"]) > 0
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


def test_size_prices_only_when_believable():
    row = dict(POIZON_ROW, skus=[{"id": 1, "price": 59900, "properties": [{"value": "40"}]},
                                 {"id": 2, "price": 89900, "properties": [{"value": "42"}]}])
    assert apify.normalize("poizon", row)["size_prices"] == {"40": 599.0, "42": 899.0}
    retail = dict(POIZON_ROW, skus=[{"price": 79900, "size": "40"}, {"price": 79900, "size": "42"}])
    assert apify.normalize("poizon", retail)["size_prices"] == {}  # одна цена у всех — это розница, не цена размера


def test_chat_order_button_needs_buyer_price(token, pricing_setup, monkeypatch, settings):
    from assistant import llm

    settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL = "https://llm.example", "k", "m"
    url = "https://m.dewu.com/router/product/ProductDetail?spuId=1234567"
    MarketplaceItem.objects.create(code="poizon", item_id="1234567", found=True,
                                   data=apify.normalize("poizon", POIZON_ROW))
    answers = [f"Оформляйте кнопкой ниже.\nЗАКАЗ: {url} | 42 | 650 | 1",
               "Оформляйте.\nЗАКАЗ: https://item.taobao.com/item.htm?id=999 | - | 650 | 1",
               f"Ок.\nЗАКАЗ: {url} | 44 | 599 | 2"]

    def chat(messages, tools=None, **kwargs):
        return llm.Reply(content=answers.pop(0), tokens=1, tool_calls=[], raw_message={})
    monkeypatch.setattr(llm, "chat", chat)
    history = [{"role": "user", "content": url}, {"role": "assistant", "content": f"[Данные о товаре: ссылка {url}]"},
               {"role": "user", "content": "давай 42, в приложении 650 юаней"}]
    post = lambda: Client().post("/api/ai/chat", {"messages": history}, content_type="application/json").json()  # noqa: E731
    data = post()
    assert "ЗАКАЗ" not in data["answer"]
    order = data["order"]
    assert order["url"] == url and order["size"] == "42" and order["price_cny"] == 650.0  # цена покупателя
    assert order["title"].startswith("Nike Dunk") and order["total_rub"] > 650 * 11
    assert post()["order"] is None  # ссылки не было в разговоре — кнопку не показываем
    assert post()["order"] is None  # 599 ¥ — цена «от» с площадки, покупатель её не называл


def test_photo_form_reads_price_with_chat_model(pricing_setup, monkeypatch, settings, db):
    from io import BytesIO

    from PIL import Image

    from assistant import llm

    settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL = "https://llm.example", "k", "m"
    seen = []

    def chat(messages, tools=None, **kwargs):
        seen.append(messages)
        return llm.Reply(content='```json\n{"price_cny": 389, "title_ru": "Кроссовки Nike Air Max 90"}\n```',
                         tokens=5, tool_calls=[], raw_message={})
    monkeypatch.setattr(llm, "chat", chat)
    buf = BytesIO()
    Image.new("RGB", (300, 200), "white").save(buf, "PNG")
    from django.core.files.uploadedfile import SimpleUploadedFile
    resp = Client().post("/api/link/photo", {"photo": SimpleUploadedFile("s.png", buf.getvalue(), "image/png")})
    data = resp.json()
    assert resp.status_code == 200, data
    assert data["understood"] is True and float(data["price_cny"]) == 389 and float(data["estimate"]["total_rub"]) > 0
    assert seen[0][0]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
