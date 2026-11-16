from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import EmailChallenge


class Command(BaseCommand):
    help = "Удалить одноразовые коды старше суток (включая адреса в неподтверждённых запросах)"

    def handle(self, *args, **options):
        count, _ = EmailChallenge.objects.filter(created_at__lt=timezone.now() - timedelta(days=1)).delete()
        self.stdout.write(f"Удалено записей: {count}")
