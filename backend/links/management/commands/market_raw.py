"""Показать сырой ответ скрапера Apify по ссылке: проверить, какие поля он отдаёт (цены по размерам и т. п.).

    docker compose -f infra/docker-compose.yml --env-file infra/.env exec backend python manage.py market_raw "<ссылка>"

Один запуск стоит как один просмотр товара (меньше цента). Кэш не трогает.
"""

import json

from django.core.management.base import BaseCommand, CommandError

from links import apify
from links.services import resolve_link


class Command(BaseCommand):
    help = "Сырой ответ Apify по ссылке на Poizon или Taobao"

    def add_arguments(self, parser):
        parser.add_argument("link")

    def handle(self, link, **options):
        info = resolve_link(link)
        if not (info.item_id and apify.supported(info.code)):
            raise CommandError("В ссылке не нашёлся номер товара Poizon или Taobao")
        try:
            rows = apify.run_actor(info.code, info.item_id)
        except apify.ApifyError as exc:
            raise CommandError(str(exc)) from exc
        for row in rows[:1]:
            skus = row.get("skus") if isinstance(row, dict) else None
            head = {k: v for k, v in row.items() if k != "skus"}
            self.stdout.write(json.dumps(head, ensure_ascii=False, indent=1)[:3000])
            self.stdout.write(f"\nskus: {len(skus) if isinstance(skus, list) else 'нет'}, первые три:")
            self.stdout.write(json.dumps((skus or [])[:3], ensure_ascii=False, indent=1))
            item = apify.normalize(info.code, row)
            self.stdout.write(f"\nЦены по размерам, которые увидел сайт: {item.get('size_prices') if item else None}")
        if not rows:
            self.stdout.write("Скрапер ничего не вернул")
