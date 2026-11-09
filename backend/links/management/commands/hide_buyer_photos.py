"""Переименовать уже загруженные скриншоты покупателей в случайные имена.

Раньше файл сохранялся под исходным именем («IMG_1234.webp», «photo.webp»), и адрес в /media/ можно было
угадать. Новые фото уже получают случайное имя; эта команда переименовывает старые. Запускать один раз:

    docker compose -f infra/docker-compose.yml --env-file infra/.env exec backend python manage.py hide_buyer_photos
"""

import re

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from catalog.images import private_name
from links.models import LinkRequest
from orders.models import OrderItem

RANDOM = re.compile(r"/[0-9a-f]{32}(_\w+)?\.webp$")


class Command(BaseCommand):
    help = "Случайные имена для старых скриншотов покупателей"

    def handle(self, **options):
        moved = 0
        for model in (LinkRequest, OrderItem):
            for obj in model.objects.exclude(photo="").iterator():
                field = obj.photo
                if RANDOM.search(field.name):
                    continue
                try:
                    with field.open("rb") as source:
                        data = source.read()
                except (FileNotFoundError, OSError):
                    self.stdout.write(f"нет файла: {field.name}")
                    continue
                old = field.name
                field.save(f"{private_name()}.webp", ContentFile(data), save=False)
                model.objects.filter(pk=obj.pk).update(photo=field.name)
                field.storage.delete(old)
                moved += 1
        self.stdout.write(self.style.SUCCESS(f"Переименовано фото: {moved}"))
