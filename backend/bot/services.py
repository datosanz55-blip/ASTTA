"""Что умеет бот ASTTA.

- /start — приветствие и кнопка «Открыть ASTTA»: сайт открывается мини-приложением прямо в Telegram.
- /orders — заказы покупателя со статусами (покупатель узнаётся по Telegram ID, как при входе на сайт).
- /help — как задать вопрос агенту.
- Сам пишет покупателю, когда у заказа меняется статус. Telegram разрешает писать только тем, кто уже нажал
  «Старт» в боте или разрешил это при входе на сайт через Telegram.
"""

from django.conf import settings

from accounts.models import User
from bot.telegram_api import call

HELP = ("Вопрос по товару или заказу задайте агенту в ASTTA: откройте по кнопке ниже и нажмите «Написать агенту». "
        "Здесь бот показывает заказы (/orders) и присылает, когда у заказа меняется статус.")


def open_button(text="Открыть ASTTA", path=""):
    url = settings.SITE_URL.rstrip("/") + path
    return {"inline_keyboard": [[{"text": text, "web_app": {"url": url}}]]}


def send(chat_id: int, text: str, keyboard: dict | None = None):
    params = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if keyboard:
        params["reply_markup"] = keyboard
    return call("sendMessage", **params)


def orders_text(telegram_id: int) -> str:
    user = User.objects.filter(telegram_id=telegram_id, is_staff=False).first()
    orders = list(user.orders.order_by("-created_at")[:10]) if user else []
    if not orders:
        return "Заказов пока нет. Откройте каталог или пришлите ссылку на товар с Poizon, Taobao или 1688."
    lines = [f"{o.number} · {o.get_status_display()} · {o.total_rub:.0f} ₽" for o in orders]
    return "Ваши заказы:\n" + "\n".join(lines)


def handle_update(update: dict):
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    # Отвечаем только в личных сообщениях: в группах кнопка мини-приложения не работает.
    if chat.get("type") != "private" or "text" not in message:
        return
    command = message["text"].strip().split()[0].split("@")[0].lower()
    chat_id = chat["id"]
    first_name = (message.get("from") or {}).get("first_name") or ""
    if command == "/start":
        send(chat_id, f"Здравствуйте{', ' + first_name if first_name else ''}! Это ASTTA — товары из Китая "
                      "с ценой в рублях сразу с доставкой. Каталог, заказ по ссылке или фото и отслеживание — "
                      "по кнопке ниже.", open_button())
    elif command == "/orders":
        send(chat_id, orders_text(message["from"]["id"]), open_button("Открыть заказы", "/#profile"))
    elif command == "/help":
        send(chat_id, HELP, open_button())
    else:
        # Переписки с агентом в боте пока нет: честно отправляем туда, где она есть.
        send(chat_id, "Сообщения здесь агент пока не читает. " + HELP, open_button())


def notify_status(event) -> bool:
    """Сообщение покупателю о новом статусе заказа. False — некому писать."""
    order = event.order
    buyer = order.buyer
    if buyer is None or not buyer.telegram_id:
        return False
    text = f"Заказ {order.number}: {event.get_status_display().lower()}."
    if event.note:
        text += f"\n{event.note}"
    send(buyer.telegram_id, text, open_button("Посмотреть заказ", "/#profile"))
    return True
