from celery import shared_task

from orders.services import cancel_expired_unpaid


@shared_task
def cancel_unpaid_orders():
    return f"Отменено неоплаченных заказов: {cancel_expired_unpaid()}"
