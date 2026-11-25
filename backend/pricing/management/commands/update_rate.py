from django.core.management.base import BaseCommand

from pricing.tasks import update_cny_rate


class Command(BaseCommand):
    help = "Загрузить курсы юаня и доллара с сайта ЦБ РФ"

    def handle(self, *args, **options):
        self.stdout.write(update_cny_rate.run())
