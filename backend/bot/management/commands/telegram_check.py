from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from bot.telegram_api import BotError, call


class Command(BaseCommand):
    help = "Проверить связь с Bot API и состояние вебхука без изменения настроек."

    def handle(self, *args, **options):
        try:
            me = call("getMe")
            webhook = call("getWebhookInfo")
        except BotError as exc:
            raise CommandError(str(exc)) from exc
        expected = settings.SITE_URL.rstrip("/") + "/api/tg/webhook"
        self.stdout.write(f"Bot API отвечает: @{me.get('username', '')}")
        webhook_status = "совпадает" if webhook.get("url") == expected else "не настроен или другой"
        self.stdout.write(f"Вебхук ASTTA: {webhook_status}")
        self.stdout.write(f"Входящих обновлений в очереди Telegram: {webhook.get('pending_update_count', 0)}")
        if webhook.get("last_error_message"):
            self.stdout.write(f"Последняя ошибка вебхука: {webhook['last_error_message']}")
