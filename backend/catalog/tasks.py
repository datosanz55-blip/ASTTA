from celery import shared_task


@shared_task
def run_market_import(job_id: int):
    """Импорт с Poizon или Taobao: запускается из админки, идёт в фоне до 30 минут."""
    from catalog.market import run_import
    from catalog.models import MarketImport

    job = MarketImport.objects.filter(pk=job_id).first()
    if job is not None:
        return run_import(job).status


@shared_task
def refresh_market_prices():
    """Раз в неделю: новые цены товаров с площадок, снятые с продажи — в черновики."""
    from catalog.market import refresh_prices

    return {source: refresh_prices(source) for source in ("poizon", "taobao")}
