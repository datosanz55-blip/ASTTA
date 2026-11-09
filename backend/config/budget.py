"""Общий дневной лимит на платные сервисы (DeepSeek, Apify) для всего сайта.

Лимиты на один адрес (config/throttles.py) не спасают, если запросы идут с сотен адресов сразу:
так можно за ночь выжечь баланс. Здесь — общий счётчик на сутки по Москве в Redis.
Лимит задаётся в .env (AI_DAILY_LIMIT, APIFY_DAILY_LIMIT); 0 — без лимита.
"""

from django.core.cache import cache
from django.utils import timezone


def take(scope: str, limit: int) -> bool:
    """Списать один запрос из дневного лимита. False — лимит на сегодня исчерпан."""
    if limit <= 0:
        return True
    key = f"budget:{scope}:{timezone.localdate().isoformat()}"
    cache.add(key, 0, 60 * 60 * 26)
    try:
        used = cache.incr(key)
    except ValueError:  # ключ успел истечь между add и incr
        cache.set(key, 1, 60 * 60 * 26)
        used = 1
    return used <= limit


def used(scope: str) -> int:
    return cache.get(f"budget:{scope}:{timezone.localdate().isoformat()}") or 0
