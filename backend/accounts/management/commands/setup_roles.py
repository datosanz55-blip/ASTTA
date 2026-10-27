from django.core.management.base import BaseCommand

from accounts.roles import setup_roles


class Command(BaseCommand):
    help = "Создать или обновить группы прав «Поставщики» и «Агенты»"

    def handle(self, *args, **options):
        setup_roles()
        self.stdout.write(self.style.SUCCESS("Группы прав обновлены"))
