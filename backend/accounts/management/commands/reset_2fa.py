from django.core.management.base import BaseCommand, CommandError
from django_otp.plugins.otp_totp.models import TOTPDevice

from accounts.models import User


class Command(BaseCommand):
    help = "Сбросить вход по коду (2FA) сотрудника, если он потерял телефон: при входе подключит приложение заново."

    def add_arguments(self, parser):
        parser.add_argument("username")

    def handle(self, *args, username, **options):
        user = User.objects.filter(username=username).first()
        if user is None:
            raise CommandError(f"Нет пользователя {username}")
        n, _ = TOTPDevice.objects.filter(user=user).delete()
        self.stdout.write(self.style.SUCCESS(f"{username}: удалено приложений для входа — {n}. "
                                             f"При следующем входе подключит новое по QR-коду."))
