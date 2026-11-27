import secrets
from urllib.parse import urlsplit

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from bot.telegram_api import BotError, call

COMMANDS = [
    {"command": "start", "description": "Открыть ASTTA"},
    {"command": "new", "description": "Новая заявка менеджеру"},
    {"command": "orders", "description": "Мои заявки и заказы"},
    {"command": "help", "description": "Связаться с менеджером"},
    {"command": "id", "description": "Мой Telegram ID"},
]
DESCRIPTION = ("Товары из Китая с предварительной ценой в рублях: одежда, обувь, мебель, электроника. "
               "Каталог проверенных поставщиков, заказ по ссылке с Poizon, Taobao и 1688 или по скриншоту, "
               "фото с нашего склада и отслеживание до пункта выдачи.")
SHORT = "Товары из Китая с доставкой в Россию. Заказ по ссылке или фото."


class Command(BaseCommand):
    help = "Один раз после запуска сервера: вебхук, команды, описание и кнопка «ASTTA» у бота."

    def handle(self, *args, **options):
        if not settings.TELEGRAM_BOT_TOKEN or not settings.SITE_URL.startswith("https://"):
            raise CommandError("Нужны TELEGRAM_BOT_TOKEN и SITE_URL вида https://astta.ru")
        if not settings.TELEGRAM_WEBHOOK_SECRET:
            raise CommandError(f"Задайте TELEGRAM_WEBHOOK_SECRET в .env, например: {secrets.token_urlsafe(32)}")
        site = settings.SITE_URL.rstrip("/")
        origin = settings.TELEGRAM_WEBHOOK_ORIGIN or site
        parts = urlsplit(origin)
        prohibited = (parts.username, parts.path, parts.query, parts.fragment)
        if parts.scheme != "https" or not parts.hostname or any(prohibited):
            raise CommandError("Нужен HTTPS-адрес вебхука без пути, например https://tg-relay.astta.ru")
        webhook_url = f"{origin}/api/tg/webhook"
        try:
            call("setWebhook", url=webhook_url, secret_token=settings.TELEGRAM_WEBHOOK_SECRET,
                 allowed_updates=["message", "callback_query"], drop_pending_updates=False)
            call("setMyCommands", commands=COMMANDS)
            call("setMyDescription", description=DESCRIPTION)
            call("setMyShortDescription", short_description=SHORT)
            call("setChatMenuButton", menu_button={"type": "web_app", "text": "ASTTA", "web_app": {"url": site}})
        except BotError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(f"Бот настроен: вебхук {webhook_url}, команды, описание, "
                                             f"кнопка «ASTTA» открывает {site}"))
