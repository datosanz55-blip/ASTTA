import httpx

from assistant.chat import inspect_link
from links import services
from links.services import resolve_link, share_title

TAOBAO_SHARE = ("【淘宝】https://m.tb.cn/h.5abcdE?tk=xyz CZ0001 「2026秋冬新款 美式复古 微喇牛仔裤 女 高腰」 "
                "点击链接直接打开 或者 淘宝搜索直接打开")
POIZON_SHARE = "【得物】Nike Dunk Low 复古板鞋 https://dw4.co/t/A/1abcDEF 打开得物App查看"


class FakeResponse:
    def __init__(self, url, text="", content_type="text/html"):
        self.url = httpx.URL(url)
        self.text = text
        self.headers = {"content-type": content_type}


def test_share_title_without_noise():
    assert share_title(TAOBAO_SHARE) == "2026秋冬新款 美式复古 微喇牛仔裤 女 高腰"
    assert share_title(POIZON_SHARE) == "Nike Dunk Low 复古板鞋"


def test_short_taobao_link_resolved_from_redirect_page(monkeypatch):
    # m.tb.cn отдаёт страницу-переходник: настоящий адрес лежит в её коде.
    page = "<script>var url = 'https://item.taobao.com/item.htm?id=712345678901&ali_trackid=1';</script>"
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse("https://m.tb.cn/h.5abcdE?tk=xyz", page))
    info = resolve_link(TAOBAO_SHARE)
    assert (info.code, info.item_id) == ("taobao", "712345678901")


def test_short_poizon_link_resolved_by_redirect(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(
        "https://m.dewu.com/router/product/ProductDetail?spuId=1234567&sourceName=share"))
    info = resolve_link(POIZON_SHARE)
    assert (info.code, info.item_id) == ("poizon", "1234567")


def test_resolve_survives_marketplace_down(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectTimeout("timeout")
    monkeypatch.setattr(httpx, "get", boom)
    info = resolve_link(POIZON_SHARE)
    assert info.code == "poizon" and info.item_id == ""


def test_full_link_needs_no_network(monkeypatch):
    def forbidden(*a, **k):
        raise AssertionError("полная ссылка не должна ходить в сеть")
    monkeypatch.setattr(httpx, "get", forbidden)
    assert services.resolve_link("https://detail.1688.com/offer/6543210987.html").item_id == "6543210987"


def test_inspect_link_for_ai(monkeypatch, db):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(
        "https://m.dewu.com/router/product/ProductDetail?spuId=1234567"))
    result = inspect_link(POIZON_SHARE)
    assert result["marketplace"] == "Poizon (Dewu)" and result["item_id"] == "1234567"
    assert result["title_from_share"] == "Nike Dunk Low 复古板鞋" and result["in_catalog"] is None
    assert "юанях" in result["next_step"]
