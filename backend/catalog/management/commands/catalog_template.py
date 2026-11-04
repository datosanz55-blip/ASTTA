from pathlib import Path

from django.core.management.base import BaseCommand

from catalog.importer import build_template


class Command(BaseCommand):
    help = "Сохранить шаблон Excel для поставщиков"

    def add_arguments(self, parser):
        parser.add_argument("path", nargs="?", default="astta-catalog-template.xlsx")

    def handle(self, *args, path, **options):
        Path(path).write_bytes(build_template())
        self.stdout.write(self.style.SUCCESS(f"Шаблон сохранён: {path}"))
