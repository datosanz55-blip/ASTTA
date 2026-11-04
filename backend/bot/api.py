import hmac
import json
import logging

from django.conf import settings
from ninja import Router
from ninja.errors import HttpError

from bot.services import handle_update
from bot.telegram_api import BotError

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
