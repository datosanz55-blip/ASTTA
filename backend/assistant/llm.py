"""Модель для чата ASTTA AI через OpenAI-совместимый API: DeepSeek, OpenRouter, YandexGPT и другие.

Какая модель — решают три переменные окружения, менять код не нужно:
    AI_BASE_URL  адрес API, например https://api.deepseek.com или https://openrouter.ai/api/v1
    AI_API_KEY   ключ
    AI_MODEL     имя модели, например deepseek-flash
    AI_EXTRA_BODY  необязательно: JSON с доп. полями запроса, например {"thinking": {"type": "disabled"}}
Если хостинг блокирует адрес модели, его можно пустить через посредника так же, как Telegram
(см. infra/telegram-proxy.js): тогда в AI_BASE_URL пишется адрес посредника.
"""

import json
from dataclasses import dataclass

import httpx
from django.conf import settings

TIMEOUT = 90


class LLMUnavailable(Exception):
    """Модель не подключена: нет адреса, ключа или имени модели."""


class LLMError(Exception):
    """Модель не ответила или ответила непонятно."""


def enabled() -> bool:
    return bool(settings.AI_BASE_URL and settings.AI_API_KEY and settings.AI_MODEL)


@dataclass
class Reply:
    content: str
    tool_calls: list[dict]  # [{"id", "name", "arguments": dict}]
    tokens: int
    raw_message: dict  # как пришло от модели: возвращаем его в историю перед результатами инструментов


def chat(messages: list[dict], tools: list[dict] | None = None, *, max_tokens: int = 900,
         temperature: float = 0.3) -> Reply:
    if not enabled():
        raise LLMUnavailable("ИИ не подключён: задайте AI_BASE_URL, AI_API_KEY и AI_MODEL")
    payload = {"model": settings.AI_MODEL, "messages": messages, "max_tokens": max_tokens,
               "temperature": temperature}
    if tools:
        payload["tools"] = tools
    if "api.deepseek.com" in settings.AI_BASE_URL and "thinking" not in settings.AI_EXTRA_BODY:
        # DeepSeek по умолчанию «размышляет». С инструментами он тогда требует вернуть размышления всех прошлых
        # ответов разговора, а в истории с сайта их нет — со второго вопроса был бы 400. Консультанту они не нужны.
        payload["thinking"] = {"type": "disabled"}
    payload.update(settings.AI_EXTRA_BODY)
    try:
        response = httpx.post(f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions", json=payload,
                              headers={"Authorization": f"Bearer {settings.AI_API_KEY}"}, timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        # Текст ошибки httpx может содержать адрес — наружу отдаём только тип.
        raise LLMError(f"Модель не ответила: {exc.__class__.__name__}") from None
    if response.status_code != 200:
        raise LLMError(f"Модель вернула {response.status_code}: {response.text[:200]}")
    try:
        data = response.json()
        message = data["choices"][0]["message"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise LLMError("Непонятный ответ модели") from None
    calls = []
    for call in message.get("tool_calls") or []:
        try:
            args = json.loads(call["function"].get("arguments") or "{}")
        except (KeyError, TypeError, json.JSONDecodeError):
            args = {}
        calls.append({"id": call.get("id", ""), "name": call.get("function", {}).get("name", ""),
                      "arguments": args if isinstance(args, dict) else {}})
    usage = data.get("usage") or {}
    return Reply(content=(message.get("content") or "").strip(), tool_calls=calls,
                 tokens=int(usage.get("total_tokens") or 0), raw_message=message)


def search_enabled() -> bool:
    # Поиск по интернету — API самого DeepSeek (/v1/tools/search, тот же ключ, ~0,75 $ за 1000 успешных запросов).
    return enabled() and "api.deepseek.com" in settings.AI_BASE_URL


def web_search(query: str, count: int = 5) -> list[dict]:
    """Обзоры и отзывы из интернета для ответа покупателю. Пустой список, если поиск недоступен или ничего нет."""
    if not search_enabled():
        return []
    try:
        response = httpx.post("https://api.deepseek.com/v1/tools/search",
                              json={"query": query[:128], "count": count},
                              headers={"Authorization": f"Bearer {settings.AI_API_KEY}"}, timeout=30)
        results = response.json().get("results") or [] if response.status_code == 200 else []
    except (httpx.HTTPError, ValueError):
        return []
    return [{"title": r.get("title") or "", "site": r.get("site_name") or "", "url": r.get("url") or "",
             "date": (r.get("date") or "")[:10], "summary": (r.get("summary") or r.get("snippet") or "")[:700]}
            for r in results if isinstance(r, dict)][:count]
