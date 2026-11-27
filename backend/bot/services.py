import re

from django.conf import settings

from accounts.models import User
from bot import inbox, panels
from bot.telegram_api import call


def open_button(text="Открыть ASTTA", path=""):
    url = settings.SITE_URL.rstrip("/") + path
    return {"inline_keyboard": [[{"text": text, "web_app": {"url": url}}]]}


def send(chat_id: int, text: str, keyboard: dict | None = None):
    params = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if keyboard:
        params["reply_markup"] = keyboard
    return call("sendMessage", **params)


def send_sticker(chat_id: int, file_id: str, *, reply_to: int | None = None):
    params = {"chat_id": chat_id, "sticker": file_id}
    if reply_to:
        params["reply_parameters"] = {"message_id": reply_to, "allow_sending_without_reply": True}
    return call("sendSticker", **params)


def orders_text(telegram_id: int) -> str:
    user = User.objects.filter(telegram_id=telegram_id, is_staff=False).first()
    orders = list(user.orders.order_by("-created_at")[:10]) if user else []
    if not orders:
        return "Заказов пока нет. Откройте каталог или пришлите ссылку на товар с Poizon, Taobao или 1688."
    lines = [f"{o.number} · {o.get_status_display()} · {o.total_rub:.0f} ₽" for o in orders]
    return "Ваши заказы:\n" + "\n".join(lines)


def handle_update(update: dict):
    if query := update.get("callback_query"):
        panels.handle_callback(query)
        return
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    sender = message.get("from") or {}
    text = message.get("text", "").strip()
    sticker = (message.get("sticker") or {}).get("file_id")
    if chat.get("type") != "private" or chat.get("id") != sender.get("id") or not (text or sticker):
        return

    chat_id = chat["id"]
    parts = text.split()
    command = parts[0].split("@")[0].lower() if text.startswith("/") else text
    is_manager = chat_id in inbox.manager_ids()
    if is_manager and message.get("reply_to_message") and inbox.manager_message(chat_id, message):
        return
    if command == "/start" and len(parts) == 2:
        if match := re.fullmatch(r"request_([0-9a-f]{32})", parts[1]):
            panels.show_draft(chat_id, match[1])
            return
        if re.fullmatch(r"order_A-[0-9]{6,20}", parts[1]):
            inbox.start_request(chat_id, parts[1].removeprefix("order_"), panels.keyboard(chat_id))
            return
    if command in ("/new", "/help", panels.HELP, panels.PRICE) or (
        command == "/start" and parts[1:] == ["help"]
    ):
        inbox.start_request(chat_id, keyboard=panels.keyboard(chat_id), price=command == panels.PRICE)
    elif command == "/start":
        send(chat_id, "ASTTA · выберите действие в меню ниже.", panels.keyboard(chat_id))
    elif command in ("/orders", panels.ORDERS):
        requests = inbox.requests_text(chat_id)
        send(chat_id, "\n\n".join(filter(None, [requests, orders_text(chat_id)])),
             open_button("Открыть заказы", "/#profile"))
    elif command == panels.CATALOG:
        send(chat_id, "Каталог ASTTA", open_button("Открыть каталог", "/#catalog"))
    elif command in ("/id", panels.IDENTITY):
        send(chat_id, f"Ваш Telegram ID: {chat_id}", panels.keyboard(chat_id))
    elif command in ("/inbox", panels.TEAM):
        if is_manager:
            panels.manager_panel(chat_id)
        else:
            send(chat_id, "Панель доступна только менеджерам.", panels.keyboard(chat_id))
    elif text.startswith("/"):
        send(chat_id, "Выберите действие в меню ниже.", panels.keyboard(chat_id))
    else:
        inbox.customer_message(chat_id, message, manager=is_manager)


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
