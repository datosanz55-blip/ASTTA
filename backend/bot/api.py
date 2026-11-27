import hmac
import json
import logging
import uuid

from django.conf import settings
from django.core.cache import cache
from ninja import Field, Router, Schema
from ninja.errors import HttpError

from bot.services import handle_update
from bot.telegram_api import BotError
from config.throttles import per_ip

router = Router(tags=["Бот Telegram"])
log = logging.getLogger(__name__)


@router.post("/webhook", throttle=[], include_in_schema=False)
def webhook(request):
    # Telegram присылает секрет, заданный в setWebhook: без него любой мог бы слать боту поддельные сообщения.
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not settings.TELEGRAM_WEBHOOK_SECRET or not hmac.compare_digest(secret, settings.TELEGRAM_WEBHOOK_SECRET):
        raise HttpError(403, "forbidden")
    try:
        update = json.loads(request.body or b"{}")
    except ValueError:
        return {"ok": True}
    try:
        handle_update(update)
    except BotError as exc:
        # Отвечаем Telegram «принято» в любом случае, иначе он будет повторять это сообщение.
        log.warning("Бот не смог ответить: %s", exc)
    return {"ok": True}


class OrderDraft(Schema):
    text: str = Field(min_length=15, max_length=1900)


@router.post("/order-draft", throttle=[per_ip("tg_order_draft", "30/m")])
def create_order_draft(request, payload: OrderDraft):
    text = payload.text.strip()
    if not text.startswith("Заявка ASTTA\n"):
        raise HttpError(422, "Не удалось подготовить заявку. Откройте товар ещё раз.")
    token = uuid.uuid4().hex
    cache.set(f"astta:bot:draft:{token}", text, 3600)
    return {"start": f"request_{token}"}
