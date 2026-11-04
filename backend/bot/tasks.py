from celery import shared_task

from bot.services import notify_status
from bot.telegram_api import BotError
from orders.models import OrderEvent


@shared_task(autoretry_for=(BotError,), retry_backoff=60, max_retries=3)
def notify_order_event(event_id: int):
    event = OrderEvent.objects.select_related("order__buyer").filter(pk=event_id).first()
    return bool(event) and notify_status(event)
