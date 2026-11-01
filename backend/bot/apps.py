from django.apps import AppConfig


class BotConfig(AppConfig):
    name = "bot"
    verbose_name = "Бот Telegram"

    def ready(self):
        from bot import signals  # noqa: F401 — уведомления о статусах заказов
