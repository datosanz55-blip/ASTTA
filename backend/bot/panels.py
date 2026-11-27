"""Chat keyboards, manager views and confirmation of storefront requests."""
import re

from django.conf import settings
from django.core.cache import cache

from bot import inbox
from links.models import LinkRequest
from orders.models import Order

ORDERS = "Мои заказы и заявки"
PRICE = "Уточнить цену"
HELP = "Написать менеджеру"
CATALOG = "Каталог"
TEAM = "Панель менеджера"
IDENTITY = "Мой Telegram ID"


def keyboard(chat_id):
    rows = [[ORDERS, PRICE], [CATALOG, HELP], [IDENTITY]]
    if chat_id in inbox.manager_ids():
        rows.insert(0, [TEAM])
    return {"keyboard": rows, "resize_keyboard": True, "is_persistent": True}


def buttons(*rows):
    return {"inline_keyboard": [
        [{"text": label, "callback_data": action} for label, action in row] for row in rows
    ]}


def manager_panel(chat_id):
    from bot.services import send

    cache.delete(f"astta:bot:new:{chat_id}")
    send(chat_id, "Панель менеджера ASTTA", buttons(
        [("Новые обращения", "team:new:0"), ("Все обращения", "team:all:0")],
        [("Заказы покупателей", "team:orders:0")],
    ))


def manager_view(chat_id, action):
    from bot.services import send

    if chat_id not in inbox.manager_ids():
        return
    cache.delete(f"astta:bot:new:{chat_id}")
    if match := re.fullmatch(r"team:reply:(\d{1,18})", action):
        request = LinkRequest.objects.filter(pk=int(match[1]), telegram_chat_id__isnull=False).first()
        if request is None:
            send(chat_id, "По этой заявке ответ в Telegram недоступен.")
        else:
            send(chat_id, f"Заявка ASTTA №{request.pk}\nНапишите ответ или отправьте стикер.",
                 {"force_reply": True, "input_field_placeholder": f"Ответ по заявке №{request.pk}"})
        return
    if match := re.fullmatch(r"team:item:(\d{1,18})", action):
        item = LinkRequest.objects.filter(pk=int(match[1])).first()
        if item is None:
            send(chat_id, "Обращение больше недоступно.")
            return
        details = f"{item.get_status_display()}\nКонтакт: {item.contact}\n{item.url}\n{item.text}\n{item.comment}"
        if item.agent_note:
            details += f"\nПоследние ответы:\n{item.agent_note[-500:]}"
        inbox.send_manager_request(chat_id, item, details)
        return
    if match := re.fullmatch(r"team:order:(\d{1,18})", action):
        order = Order.objects.filter(pk=int(match[1])).first()
        if order is None:
            send(chat_id, "Заказ больше недоступен.")
            return
        items = list(order.items.order_by("pk")[:11])
        lines = []
        for item in items[:10]:
            variant = " · ".join(filter(None, [item.size, item.color]))
            lines.append(f"{item.title} × {item.qty}" + (f" · {variant}" if variant else ""))
        if len(items) > 10:
            lines.append("Остальные позиции доступны в CRM.")
        send(chat_id, "\n".join([f"{order.number} · {order.get_status_display()} · {order.total_rub:.0f} ₽",
                                f"Контакт: {order.contact}", "", *lines]),
             buttons([("К списку заказов", "team:orders:0")]))
        return
    match = re.fullmatch(r"team:(new|all|orders):(\d{1,4})", action)
    if not match:
        return
    section, page = match[1], int(match[2])
    start = page * 6
    rows = []
    if section == "orders":
        items = list(Order.objects.order_by("-created_at", "-pk")[start:start + 7])
        lines = [f"{item.number} · {item.get_status_display()} · {item.total_rub:.0f} ₽" for item in items[:6]]
        rows = [[(f"Открыть {item.number}", f"team:order:{item.pk}")] for item in items[:6]]
    else:
        query = LinkRequest.objects.order_by("-created_at", "-pk")
        if section == "new":
            query = query.filter(status=LinkRequest.Status.NEW)
        items = list(query[start:start + 7])
        lines = []
        for item in items[:6]:
            summary = next((line for line in item.text.splitlines() if line.strip() and line != "Заявка ASTTA"), "")
            lines.append(f"№{item.pk} · {item.get_status_display()} · {(summary or item.url or item.contact)[:95]}")
            rows.append([(f"Открыть №{item.pk}", f"team:item:{item.pk}")])
    nav = []
    if page:
        nav.append(("Назад", f"team:{section}:{page - 1}"))
    if len(items) > 6 and page < 9999:
        nav.append(("Дальше", f"team:{section}:{page + 1}"))
    if nav:
        rows.append(nav)
    rows.append([("Панель менеджера", "team:home")])
    title = {"new": "Новые обращения", "all": "Все обращения", "orders": "Заказы покупателей"}[section]
    send(chat_id, title + "\n\n" + ("\n".join(lines) or "Здесь пока пусто."), buttons(*rows))


def show_draft(chat_id, token):
    from bot.services import send

    text = cache.get(f"astta:bot:draft:{token}")
    if not text:
        send(chat_id, "Эта заявка уже отправлена или ссылка истекла. Откройте товар в каталоге ещё раз.",
             keyboard(chat_id))
        return
    send(chat_id, text + "\n\nНажимая «Отправить заявку», вы соглашаетесь на обработку контакта для ответа."
         f"\nПолитика: {settings.SITE_URL.rstrip('/')}/privacy.html",
         buttons([("Отправить заявку", f"draft:{token}")]))


def handle_callback(query):
    from bot.services import call, send

    message = query.get("message") or {}
    chat = message.get("chat") or {}
    sender = query.get("from") or {}
    chat_id = chat.get("id")
    if chat.get("type") != "private" or chat_id != sender.get("id") or not query.get("id"):
        return
    action = query.get("data", "")
    call("answerCallbackQuery", callback_query_id=query["id"])
    if action == "team:home" and chat_id in inbox.manager_ids():
        manager_panel(chat_id)
    elif action.startswith("team:"):
        manager_view(chat_id, action)
    elif match := re.fullmatch(r"draft:([0-9a-f]{32})", action):
        key = f"astta:bot:draft:{match[1]}"
        lock = key + ":sending"
        if not cache.add(lock, True, 60):
            return
        try:
            text = cache.get(key)
            if not text:
                send(chat_id, "Эта заявка уже отправлена или ссылка истекла.", keyboard(chat_id))
                return
            request = inbox.save_request(chat_id, sender, text + "\n" + inbox.CONSENT)
            cache.delete(key)
        finally:
            cache.delete(lock)
        inbox.enqueue_notifications(request, request.text)
        send(chat_id, f"Заявка №{request.pk} принята. Менеджер ответит в этом чате.", keyboard(chat_id))
