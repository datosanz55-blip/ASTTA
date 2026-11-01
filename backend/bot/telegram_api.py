"""Запросы к Bot API Telegram."""

import httpx
from django.conf import settings


class BotError(Exception):
    pass


def call(method: str, **params) -> dict:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise BotError("Бот не настроен: нет TELEGRAM_BOT_TOKEN")
    try:
        resp = httpx.post(f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}", json=params,
                          timeout=10)
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        # Текст ошибки httpx содержит адрес с токеном — наружу его не отдаём.
        raise BotError(f"Telegram не ответил на {method}: {type(exc).__name__}") from None
    if not data.get("ok"):
        raise BotError(f"Telegram отказал в {method}: {data.get('description', 'без описания')}")
    return data.get("result")
