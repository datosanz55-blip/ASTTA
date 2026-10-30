import json
from decimal import Decimal
from io import BytesIO

import httpx
import pytest
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import Client
from openpyxl import load_workbook
from PIL import Image

from accounts.models import User
from accounts.roles import setup_roles
from assistant import yandex
from assistant.models import AiLog, KnowledgeArticle
from assistant.services import answer_question, find_articles, find_prices, main_price, translate_cards
from catalog.importer import build_template, import_catalog
from catalog.models import Product
from links.models import LinkRequest
from tests.conftest import make_product


@pytest.fixture(autouse=True)
def _clear_throttle():
    cache.clear()


@pytest.fixture
def ai(settings, monkeypatch):
    """Подключённый ИИ с подменённым Яндексом: ответы задаёт тест, запросы складываются в calls."""
    settings.YANDEX_API_KEY, settings.YANDEX_FOLDER_ID = "secret", "b1gfolder"
    calls, replies = [], []

    def fake_post(url, payload):
        calls.append((url, payload))
        reply = replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(yandex, "_post", fake_post)
    return calls, replies


def gpt(data, tokens=42):
    return {"alternatives": [{"message": {"role": "assistant", "text": json.dumps(data, ensure_ascii=False)},
                              "status": "ALTERNATIVE_STATUS_FINAL"}], "usage": {"totalTokens": str(tokens)}}


def jpeg():
    buffer = BytesIO()
    Image.new("RGB", (900, 1600), "white").save(buffer, "JPEG")
    buffer.seek(0)
    buffer.name = "screen.jpg"
    return buffer


def test_request_format_and_headers(settings, monkeypatch):
    settings.YANDEX_API_KEY, settings.YANDEX_FOLDER_ID = "secret", "b1gfolder"
    seen = {}

    def fake_httpx_post(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        # Ответ с обёрткой result: так он выглядит в части примеров документации.
        return httpx.Response(200, json={"result": gpt({"ok": True})})

    monkeypatch.setattr(httpx, "post", fake_httpx_post)
    data, tokens = yandex.complete_json("system", "user", max_tokens=100)
    assert data == {"ok": True} and tokens == 42
    assert seen["url"] == yandex.GPT_URL
    assert seen["headers"]["Authorization"] == "Api-Key secret"
    assert seen["headers"]["x-folder-id"] == "b1gfolder"
    assert seen["headers"]["x-data-logging-enabled"] == "false"
    body = seen["json"]
    assert body["modelUri"] == "gpt://b1gfolder/yandexgpt/latest"
    assert body["completionOptions"]["maxTokens"] == "100" and body["jsonObject"] is True
    assert [m["role"] for m in body["messages"]] == ["system", "user"]

    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(401, text="bad key"))
    with pytest.raises(yandex.AIError, match="401"):
        yandex.complete("s", "u")


def test_disabled_without_keys(settings, db):
    settings.YANDEX_API_KEY = ""
    assert not yandex.enabled()
    with pytest.raises(yandex.AIUnavailable):
        yandex.complete("s", "u")
    client = Client()
    ask = client.post("/api/ai/ask", {"question": "когда платить?"}, content_type="application/json")
    assert ask.status_code == 503
    # Без ИИ фото всё равно принимаем: просим контакт и передаём менеджеру.
    no_contact = client.post("/api/link/photo", {"photo": jpeg()}).json()
    assert (no_contact["handoff"], no_contact["need_contact"], no_contact["request_id"]) == (True, True, None)
    sent = client.post("/api/link/photo", {"photo": jpeg(), "contact": "@buyer", "marketplace": "poizon"}).json()
    assert sent["handoff"] and not sent["need_contact"] and "менеджер" in sent["message"]
    ticket = LinkRequest.objects.get(pk=sent["request_id"])
    assert (ticket.contact, ticket.marketplace.code, ticket.photo.name.endswith(".webp")) == ("@buyer", "poizon", True)


def test_starter_articles_found_by_question(db):
    assert KnowledgeArticle.objects.count() >= 7  # стартовые статьи из миграции
    titles = [a.title for a in find_articles("Когда нужно оплатить заказ?")]
    assert titles[0] == "Когда платить за заказ"
    assert find_articles("абракадабра") == []


def test_answer_uses_facts_and_filters_sources(ai, pricing_setup):
    calls, replies = ai
    article = KnowledgeArticle.objects.get(title="Когда платить за заказ")
    replies.append(gpt({"answer": "Сразу при оформлении.", "handoff": False, "sources": [article.pk, 99999]}))
    result = answer_question("Когда платить за заказ?")
    assert (result.text, result.handoff, [a.pk for a in result.articles]) == ("Сразу при оформлении.", False,
                                                                               [article.pk])
    system = calls[0][1]["messages"][0]["text"]
    assert "Доставка «Авто»: 18–25 дней" in system and "24 часа" in system and article.answer in system
    log = AiLog.objects.get(pk=result.log_id)
    assert (log.kind, log.tokens, log.sources) == ("ask", 42, [article.pk])


def test_answer_hands_off_when_yandex_fails(ai, pricing_setup):
    _, replies = ai
    replies.append(yandex.AIError("Яндекс вернул 500"))
    result = answer_question("Где мой заказ A-000123?")
    assert result.handoff and "агенту" in result.text
    assert AiLog.objects.get(pk=result.log_id).error


def test_ask_api_and_feedback(ai, pricing_setup):
    _, replies = ai
    replies.append(gpt({"answer": "Это вопрос к агенту.", "handoff": True, "sources": []}))
    client = Client()
    data = client.post("/api/ai/ask", {"question": "Можно вернуть товар?"}, content_type="application/json").json()
    assert data["handoff"] is True
    feedback = {"log_id": data["log_id"], "helpful": False}
    assert client.post("/api/ai/feedback", feedback, content_type="application/json").json() == {"ok": True}
    assert client.post("/api/ai/feedback", feedback, content_type="application/json").json() == {"ok": False}
    assert AiLog.objects.get(pk=data["log_id"]).helpful is False
    too_long = client.post("/api/ai/ask", {"question": "а" * 1001}, content_type="application/json")
    assert too_long.status_code == 422


def test_main_price_is_the_biggest_line():
    lines = [yandex.OcrLine("券后价", 20), yandex.OcrLine("¥1,299", 80), yandex.OcrLine("原价 ¥1599.50", 30),
             yandex.OcrLine("运费 10元", 20)]
    assert [p for p, _ in find_prices(lines)] == [Decimal("1299"), Decimal("1599.50"), Decimal("10")]
    assert main_price(lines) == Decimal("1299")
    assert main_price([yandex.OcrLine("без цены", 50)]) is None


def test_photo_reading_api(ai, supplier, shoes, pricing_setup):
    calls, replies = ai
    make_product(supplier, shoes, "sneaker", 400, "1.2", [], title_ru="Кроссовки беговые сетка")
    # _post уже снимает обёртку result, поэтому здесь ответ без неё.
    ocr = {"textAnnotation": {"fullText": "李宁 跑步鞋\n¥ 899\n运费 10元", "blocks": [{"lines": [
        {"text": "李宁 跑步鞋", "boundingBox": {"vertices": [{"x": "0", "y": "10"}, {"x": "0", "y": "40"}]}},
        {"text": "¥ 899", "boundingBox": {"vertices": [{"x": "0", "y": "50"}, {"x": "0", "y": "130"}]}},
        {"text": "运费 10元", "boundingBox": {"vertices": [{"x": "0", "y": "140"}, {"x": "0", "y": "160"}]}},
    ]}]}}
    replies.extend([ocr, gpt({"title_ru": "Беговые кроссовки Li-Ning", "category": "shoes", "price_cny": 10,
                              "keywords": ["кроссовки", "беговые"]})])
    resp = Client().post("/api/link/photo", {"photo": jpeg(), "marketplace": "poizon"})
    assert resp.status_code == 200, resp.content
    data = resp.json()
    # Цену берём с самой крупной строки, а не ту, что предложил YandexGPT.
    assert (Decimal(data["price_cny"]), data["category"]) == (Decimal("899"), "shoes")
    assert data["understood"] and not data["handoff"] and data["request_id"] is None
    assert data["similar"][0]["slug"] == "sneaker"
    assert data["estimate"]["weight_kg"] == "1.20"
    ocr_request = calls[0][1]
    assert ocr_request["languageCodes"] == ["zh", "ru", "en"] and ocr_request["mimeType"] == "JPEG"
    assert AiLog.objects.filter(kind="photo").count() == 1
    assert Client().post("/api/link/photo", {"photo": BytesIO(b"not image")}).status_code == 400


def test_translate_in_batches_and_checks_count(ai, db):
    _, replies = ai
    replies.append(gpt({"items": [{"title": f"Товар {i}", "description": ""} for i in range(20)]}))
    replies.append(gpt({"items": [{"title": f"Товар {i}", "description": ""} for i in range(5)]}))
    result = translate_cards([{"title_zh": f"商品{i}"} for i in range(25)])
    assert len(result) == 25 and result[24]["title"] == "Товар 4"
    replies.append(gpt({"items": [{"title": "Один"}]}))
    with pytest.raises(yandex.AIError, match="не столько"):
        translate_cards([{"title_zh": "一"}, {"title_zh": "二"}])


def filled(rows):
    wb = load_workbook(BytesIO(build_template()))
    for row in rows:
        wb.worksheets[0].append(row)
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def test_import_translates_missing_russian_titles(ai, supplier, shoes):
    _, replies = ai
    replies.append(gpt({"items": [{"title": "Кроссовки беговые лёгкие", "description": ""}]}))
    row = ["S-1", "", "shoes", 120, 0.9, "", "", "", "", "", "", "轻便跑步鞋"]
    assert not import_catalog(filled([row]), supplier).ok  # без перевода русское название обязательно
    result = import_catalog(filled([row]), supplier, translate=True, publish=True)
    assert result.ok and result.translated == 1, result.errors
    assert Product.objects.get(sku="S-1").title_ru == "Кроссовки беговые лёгкие"


def test_import_translate_without_ai(settings, supplier, shoes):
    settings.YANDEX_API_KEY = ""
    row = ["S-1", "", "shoes", 120, 0.9, "", "", "", "", "", "", "轻便跑步鞋"]
    result = import_catalog(filled([row]), supplier, translate=True)
    assert any("ИИ не подключён" in e for e in result.errors)
    assert not Product.objects.exists()


def test_cabinet_translate_for_team_only(ai, supplier, shoes):
    _, replies = ai
    setup_roles()
    moderator = User.objects.create_user("mod", password="pw-123456!", is_staff=True)
    moderator.groups.add(Group.objects.get(name="Модераторы"))
    team = Client()
    team.force_login(moderator)
    assert team.get("/api/seller/me").json()["ai"] is True
    replies.append(gpt({"items": [{"title": "Худи оверсайз", "description": "Плотный хлопок"}]}))
    resp = team.post("/api/seller/translate", {"items": [{"zh": "加厚卫衣", "desc": "纯棉"}]},
                     content_type="application/json", HTTP_X_ACT_AS="jj")
    assert resp.json() == {"items": [{"ru": "Худи оверсайз", "desc": "Плотный хлопок"}]}
    seller = User.objects.create_user("jj_supplier", password="pw-123456!", role="supplier", supplier=supplier)
    own = Client()
    own.force_login(seller)
    assert own.post("/api/seller/translate", {"items": [{"zh": "卫衣"}]},
                    content_type="application/json").status_code == 401  # поставщиков в кабинет не пускаем


def test_photo_not_understood_goes_to_manager(ai, supplier, shoes, pricing_setup):
    _, replies = ai
    # На фото нет ни цены, ни понятного товара: ИИ не угадывает, а передаёт менеджеру.
    replies.extend([{"textAnnotation": {"fullText": "好看", "blocks": [{"lines": [{"text": "好看"}]}]}},
                    gpt({"title_ru": "", "category": "", "price_cny": None, "keywords": []})])
    data = Client().post("/api/link/photo", {"photo": jpeg(), "contact": "+7 900 000-00-00"}).json()
    assert (data["understood"], data["handoff"]) == (False, True)
    assert LinkRequest.objects.get(pk=data["request_id"]).text.startswith("Фото без ссылки")
    assert AiLog.objects.get(kind="photo").handoff is True


def test_photo_when_yandex_fails_goes_to_manager(ai, supplier, shoes, pricing_setup):
    _, replies = ai
    replies.append(yandex.AIError("Яндекс вернул 500"))
    data = Client().post("/api/link/photo", {"photo": jpeg(), "contact": "@b"}).json()
    assert data["handoff"] and data["request_id"]
