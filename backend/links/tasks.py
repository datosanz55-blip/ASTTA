import hashlib
from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone


@shared_task(bind=True, max_retries=45, soft_time_limit=160, time_limit=175)
def lookup_market(self, job_id):
    from links.market_quotes import run_lookup
    from links.models import MarketLookup
    from links.services import parse_link

    job = MarketLookup.objects.filter(pk=job_id, status="pending").first()
    if not job:
        return
    if job.created_at < timezone.now() - timedelta(minutes=4):
        job.status, job.note = "failed", "Проверка устарела. Попробуйте ещё раз."
        job.save()
        return
    info = parse_link(job.url)
    resource = hashlib.sha256((info.code + ":" + (info.item_id or info.url)).encode()).hexdigest()
    key = f"market-lookup:{resource}"
    if not cache.add(key, job_id, timeout=180):
        raise self.retry(countdown=4)
    try:
        run_lookup(job)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).error("Market lookup %s failed: %s", job.pk, type(exc).__name__)
        job.status, job.note = "failed", "Проверка прервалась. Попробуйте ещё раз."
        job.save()
    finally:
        if cache.get(key) == job_id:
            cache.delete(key)


@shared_task
def cleanup_market_lookups():
    from links.models import MarketLookup

    return MarketLookup.objects.filter(created_at__lt=timezone.now() - timedelta(days=1)).delete()[0]
