from celery import shared_task

from pricing.cbr import fetch_daily
from pricing.models import ExchangeRate


@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def update_cny_rate():
    date, value = fetch_daily("CNY")
    ExchangeRate.objects.update_or_create(currency="CNY", date=date,
                                          defaults={"rub_per_unit": value, "source": "cbr"})
    return f"CNY {date}: {value}"
