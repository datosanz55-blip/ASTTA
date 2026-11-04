from django.core.management.base import BaseCommand, CommandError

from catalog.importer import import_catalog
from catalog.models import Supplier


class Command(BaseCommand):
    help = "Загрузить каталог поставщика из Excel"

    def add_arguments(self, parser):
        parser.add_argument("path")
        parser.add_argument("--supplier", required=True, help="код поставщика")

    def handle(self, *args, path, supplier, **options):
        sup = Supplier.objects.filter(code=supplier).first()
        if sup is None:
            raise CommandError(f"Нет поставщика с кодом {supplier}")
        with open(path, "rb") as fh:
            result = import_catalog(fh, sup)
        if not result.ok:
            raise CommandError("\n".join(result.errors))
        self.stdout.write(self.style.SUCCESS(f"Новых: {result.created}, обновлено: {result.updated}"))
