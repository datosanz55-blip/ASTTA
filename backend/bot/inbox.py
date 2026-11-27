"""Two-way text and sticker messages between customers and an allowlisted Telegram team."""
import logging
import re

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from bot.telegram_api import BotError
from links.models import LinkRequest

log = logging.getLogger(__name__)
CONSENT = "Согласен на обработку контактных данных для ответа на заявку."
ACTIVE = (LinkRequest.Status.NEW, LinkRequest.Status.QUOTED)


def manager_ids():
    return set(settings.TELEGRAM_MANAGER_IDS)


def notify_manager(manager_id, request_id, text, sticker=None):
    from bot.services import send_sticker

    if manager_id not in manager_ids() or not LinkRequest.objects.filter(pk=request_id, status__in=ACTIVE).exists():
        return
    card = send_request(manager_id, request_id, text)
    if sticker:
        send_sticker(manager_id, sticker, reply_to=(card or {}).get("message_id"))


def send_request(chat_id, request_id, text, can_reply=True, *, can_delete=False):
    from bot.panels import buttons
    from bot.services import send

    rows = []
    if can_reply:
        rows.append([(f"Ответить по заявке №{request_id}", f"team:reply:{request_id}")])
    if can_delete:
        rows.append([("Удалить заявку", f"team:delete:{request_id}")])
    hint = "\n\nМожно также ответить на это сообщение через «Ответить»." if can_reply else ""
    return send(chat_id, f"Заявка ASTTA №{request_id}\n{text[:3300]}{hint}", buttons(*rows) if rows else None)


def send_manager_request(chat_id, request, text):
    send_request(chat_id, request.pk, text, request.telegram_chat_id is not None, can_delete=True)


def enqueue_notifications(request, text, exclude=None, *, sticker=None):
    from bot.tasks import notify_manager_task

    for manager_id in manager_ids() - {exclude}:
        try:
            args = (manager_id, request.pk, text)
            notify_manager_task.delay(*(args + (sticker,) if sticker else args))
        except Exception:
            log.exception("Не удалось поставить уведомление о заявке %s в очередь", request.pk)


def start_request(chat_id, order_number="", keyboard=None, *, price=False):
    from bot.services import send

    cache.set(f"astta:bot:new:{chat_id}", order_number or True, 900)
    prefix = f"Заказ {order_number}. " if order_number else ""
    prompt = ("Пришлите ссылку на товар и нужный размер одним сообщением. " if price else
              "Пришлите ссылку, размер или опишите вопрос одним сообщением. ")
    send(chat_id, prefix + prompt +
         "Отправляя его, вы соглашаетесь на обработку контакта для ответа. "
         f"Политика: {settings.SITE_URL.rstrip('/')}/privacy.html", keyboard)


def save_request(chat_id, sender, text):
    username = sender.get("username") or ""
    contact = f"@{username}" if re.fullmatch(r"[A-Za-z0-9_]+", username) else f"tg://user?id={chat_id}"
    return LinkRequest.objects.create(text=text[:2000], contact=contact, telegram_chat_id=chat_id,
                                      comment="Заявка из Telegram", pd_consent_at=timezone.now())


def message_content(message):
    sticker = message.get("sticker") or {}
    if file_id := sticker.get("file_id"):
        return f"[Стикер Telegram] {sticker.get('emoji', '')}".rstrip(), file_id
    return message["text"].strip(), None


def customer_message(chat_id, message, *, manager=False):
    from bot.services import send

    text, sticker = message_content(message)
    draft = text.startswith("Заявка ASTTA\n")
    if draft and not text.endswith(CONSENT):
        send(chat_id, "Отправьте заявку целиком или начните новую через /new.")
        return
    key = f"astta:bot:new:{chat_id}"
    pending = cache.get(key)
    if manager and not (draft or pending):
        send(chat_id, "Откройте нужную заявку и нажмите «Ответить по заявке». "
             "Чтобы создать своё обращение, выберите «Написать менеджеру».")
        return
    request = LinkRequest.objects.filter(telegram_chat_id=chat_id, status__in=ACTIVE).first()
    if not (draft or pending or request):
        from bot.panels import keyboard

        start_request(chat_id, keyboard=keyboard(chat_id))
        return
    message_id = message.get("message_id")
    seen = f"astta:bot:incoming:{chat_id}:{message_id}"
    if not message_id or not cache.add(seen, True, 86400):
        return
    rate_key = f"astta:bot:rate:{chat_id}"
    if not cache.add(rate_key, True, 2):
        send(chat_id, "Подождите пару секунд и отправьте сообщение снова.")
        return
    try:
        if draft or pending:
            if isinstance(pending, str) and not draft:
                text = f"Заказ {pending}\n{text}"
            request = save_request(chat_id, message.get("from") or {}, text)
            cache.delete(key)
            confirmation = f"Заявка №{request.pk} принята. Менеджер ответит в этом чате."
        else:
            confirmation = f"Сообщение добавлено к заявке №{request.pk}."
            # Keep follow-ups visible in the admin queue and in /inbox.
            request.comment = (request.comment + "\n\n" + text)[-6000:]
            request.save(update_fields=["comment"])
    except Exception:
        cache.delete(seen)
        cache.delete(rate_key)
        raise
    enqueue_notifications(request, text, sticker=sticker)
    send(chat_id, confirmation)


def manager_message(chat_id, message):
    from bot.services import send, send_sticker

    reply = message.get("reply_to_message") or {}
    match = re.match(r"^Заявка ASTTA №(\d{1,18})\n", reply.get("text", ""))
    bot_id = settings.TELEGRAM_BOT_TOKEN.split(":", 1)[0]
    if not match or str((reply.get("from") or {}).get("id")) != bot_id:
        return False
    request = LinkRequest.objects.filter(pk=int(match[1]), telegram_chat_id__isnull=False).first()
    if request is None:
        send(chat_id, "Заявка больше недоступна для ответа.")
        return True
    key = f"astta:bot:reply:{chat_id}:{message.get('message_id')}"
    if not cache.add(key, True, 86400):
        return True
    text, sticker = message_content(message)
    try:
        if sticker:
            send_sticker(request.telegram_chat_id, sticker)
        else:
            send(request.telegram_chat_id, f"Менеджер ASTTA · заявка №{request.pk}\n{text[:3700]}")
    except BotError:
        cache.delete(key)
        send(chat_id, "Ответ не доставлен. Проверьте, что клиент не заблокировал бота, и отправьте снова.")
        return True
    with transaction.atomic():
        saved_request = LinkRequest.objects.select_for_update().filter(pk=request.pk).first()
        if saved_request:
            saved_request.agent_note = (saved_request.agent_note + f"\n\n[{chat_id}] {text}")[-6000:].strip()
            saved_request.save(update_fields=["agent_note"])
    enqueue_notifications(request, f"Другой менеджер уже ответил клиенту:\n{text}", exclude=chat_id, sticker=sticker)
    send(chat_id, f"Ответ по заявке №{request.pk} доставлен.")
    return True


def requests_text(chat_id):
    requests = LinkRequest.objects.filter(telegram_chat_id=chat_id)[:10]
    lines = [f"№{item.pk} · {item.get_status_display()}" for item in requests]
    return "Ваши заявки:\n" + "\n".join(lines) if lines else ""
