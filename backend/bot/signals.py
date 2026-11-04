import logging

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from orders.models import OrderEvent

log = logging.getLogger(__name__)


@receiver(post_save, sender=OrderEvent)
def _order_event_created(sender, instance, created, **kwargs):
    if not created or not settings.TELEGRAM_BOT_TOKEN or not instance.order.buyer_id:
        return
    from bot.tasks import notify_order_event

    def enqueue():
        try:
            notify_order_event.delay(instance.pk)
        except Exception:  # noqa: BLE001 — нет связи с очередью: заказ важнее уведомления
            log.warning("Не поставили уведомление о заказе %s в очередь", instance.order_id, exc_info=True)

    # Отправляем после записи в базу и в фоне: медленный Telegram не задерживает агента в админке.
    transaction.on_commit(enqueue)
