import json

import pytest
from django.test import Client

from accounts.models import User
from assistant import llm
from assistant.models import AiLog, KnowledgeArticle


@pytest.fixture
def ai_on(settings):
    settings.AI_BASE_URL = "https://llm.example"
    settings.AI_API_KEY = "test"
    settings.AI_MODEL = "test-model"


def fake_llm(monkeypatch, script):
    """Подменяем модель: по очереди отдаём заготовленные ответы и запоминаем, что ей прислали."""
    sent = []

    def chat(messages, tools=None, **kwargs):
        sent.append(json.loads(json.dumps(messages, default=str)))
        step = script.pop(0)
        return llm.Reply(content=step.get("content", ""), tool_calls=step.get("calls", []), tokens=10,
                         raw_message={"role": "assistant", "content": step.get("content", ""),
                                      "tool_calls": [{"id": c["id"], "type": "function",
                                                      "function": {"name": c["name"],
                                                                   "arguments": json.dumps(c["arguments"])}}
                                                     for c in step.get("calls", [])] or None})
    monkeypatch.setattr(llm, "chat", chat)
    return sent


def test_chat_off_without_keys(db):
    resp = Client().post("/api/ai/chat", {"messages": [{"role": "user", "content": "привет"}]},
                         content_type="application/json")
    assert resp.status_code == 503


def test_chat_searches_catalog_and_returns_cards(ai_on, monkeypatch, runner):
    sent = fake_llm(monkeypatch, [
        {"calls": [{"id": "1", "name": "search_catalog", "arguments": {"query": "кроссовки", "max_price_rub": 5000}}]},
        {"content": "Подойдут беговые кроссовки за 3 670 ₽ под ключ.\nТОВАРЫ: runner, invented-slug"},
    ])
    resp = Client().post("/api/ai/chat", {"messages": [{"role": "user", "content": "кроссовки до 5000"}]},
                         content_type="application/json")
    assert resp.status_code == 200, resp.content
    data = resp.json()
    assert data["products"] == ["runner"]  # придуманный slug отброшен: карточки только из реального поиска
    assert "ТОВАРЫ" not in data["answer"] and "3 670" in data["answer"]
    tool_result = json.loads(sent[1][-1]["content"])  # модель получила результат поиска с ценой под ключ
    assert tool_result[0]["slug"] == "runner" and tool_result[0]["price_rub"] == 3670
    log = AiLog.objects.get(pk=data["log_id"])
    assert log.kind == AiLog.Kind.CHAT and log.sources["tools"][0]["tool"] == "search_catalog"


def test_chat_handoff_and_order_needs_login(ai_on, monkeypatch, db):
    sent = fake_llm(monkeypatch, [
        {"calls": [{"id": "1", "name": "order_status", "arguments": {"number": "A-000001"}}]},
        {"content": "Войдите через Telegram, и я проверю заказ.\nАГЕНТ"},
    ])
    data = Client().post("/api/ai/chat", {"messages": [{"role": "user", "content": "где мой заказ A-000001"}]},
                         content_type="application/json").json()
    assert data["handoff"] is True and data["products"] == []
    assert "не вошёл" in sent[1][-1]["content"]  # чужие заказы гостю не показываем


def test_correction_in_log_becomes_knowledge_article(db):
    log = AiLog.objects.create(kind=AiLog.Kind.CHAT, request="Можно оплатить долями?", response="Не знаю")
    admin = User.objects.create_superuser("boss", "b@x.ru", "pw-123456!")
    client = Client()
    client.force_login(admin)
    resp = client.post(f"/admin/assistant/ailog/{log.pk}/change/", {"correct_answer": "Пока нет, только сразу."})
    assert resp.status_code == 302, resp.content.decode()[:1500]
    log.refresh_from_db()
    article = KnowledgeArticle.objects.get(pk=log.article_id)
    assert article.title == "Можно оплатить долями?" and article.answer == "Пока нет, только сразу."


def test_thinking_model_gets_its_reasoning_back(ai_on, monkeypatch, runner):
    sent = []
    steps = [
        llm.Reply(content="", tokens=5, tool_calls=[{"id": "1", "name": "search_catalog", "arguments": {"query": "x"}}],
                  raw_message={"role": "assistant", "content": "", "reasoning_content": "думаю о кроссовках",
                               "tool_calls": [{"id": "1", "type": "function",
                                               "function": {"name": "search_catalog", "arguments": "{}"}}]}),
        llm.Reply(content="Готово", tokens=5, tool_calls=[], raw_message={"role": "assistant", "content": "Готово"}),
    ]

    def chat(messages, tools=None, **kwargs):
        sent.append([dict(m) for m in messages])
        return steps.pop(0)
    monkeypatch.setattr(llm, "chat", chat)
    Client().post("/api/ai/chat", {"messages": [{"role": "user", "content": "кроссовки"}]},
                  content_type="application/json")
    assistant_step = [m for m in sent[1] if m["role"] == "assistant"][-1]
    assert assistant_step["reasoning_content"] == "думаю о кроссовках"  # DeepSeek в режиме thinking требует это


def test_deepseek_thinking_off_by_default(settings, monkeypatch):
    settings.AI_BASE_URL, settings.AI_API_KEY, settings.AI_MODEL = "https://api.deepseek.com", "k", "deepseek-flash"
    settings.AI_EXTRA_BODY = {}
    sent = {}

    class Resp:
        status_code = 200

        @staticmethod
        def json():
            return {"choices": [{"message": {"role": "assistant", "content": "ok"}}], "usage": {"total_tokens": 3}}

    def post(url, json=None, headers=None, timeout=None):
        sent.update(url=url, body=json, headers=headers)
        return Resp()
    monkeypatch.setattr(llm.httpx, "post", post)
    assert llm.chat([{"role": "user", "content": "привет"}]).content == "ok"
    assert sent["url"] == "https://api.deepseek.com/chat/completions"
    assert sent["body"]["thinking"] == {"type": "disabled"} and sent["headers"]["Authorization"] == "Bearer k"
