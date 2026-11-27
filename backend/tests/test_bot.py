import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client

from accounts.models import User
from bot import services
from bot.tasks import notify_order_event
from orders.models import Order
from orders.services import CartLine, create_order, mark_paid, set_status
from tests.conftest import make_product

SECRET = "webhook-secret-123"


@pytest.fixture
def sent(settings, monkeypatch):
    settings.TELEGRAM_BOT_TOKEN = "123:TEST"
    settings.TELEGRAM_WEBHOOK_SECRET = SECRET
    settings.SITE_URL = "https://astta.ru"
    calls = []
    monkeypatch.setattr(services, "call", lambda method, **params: calls.append((method, params)) or {})
    return calls


def update(text, user_id=777, chat_type="private"):
    return {"update_id": 1, "message": {"message_id": 5, "text": text, "chat": {"id": user_id, "type": chat_type},
                                        "from": {"id": user_id, "first_name": "Анна"}}}


def hook(body, secret=SECRET):
    return Client().post("/api/tg/webhook", body, content_type="application/json",
                         HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN=secret)


def test_webhook_rejects_requests_without_secret(sent, db):
    assert hook(update("/start"), secret="wrong").status_code == 403
    assert hook(update("/start"), secret="").status_code == 403
    assert sent == []


def test_start_shows_customer_keyboard_and_catalog_opens_mini_app(sent, db):
    assert hook(update("/start")).status_code == 200
    method, params = sent[0]
    assert method == "sendMessage" and params["chat_id"] == 777 and params["reply_markup"]["is_persistent"]
    assert "Панель менеджера" not in params["reply_markup"]["keyboard"][0]
    hook(update("Каталог"))
    button = sent[-1][1]["reply_markup"]["inline_keyboard"][0][0]
    assert button == {"text": "Открыть каталог", "web_app": {"url": "https://astta.ru/#catalog"}}


def test_orders_command_lists_buyer_orders(sent, supplier, shoes, pricing_setup):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    buyer = User.objects.create_user("tg777", telegram_id=777)
    order = create_order([CartLine("hoodie", 1)], contact="@anna", buyer=buyer)
    hook(update("/orders"))
    assert order.number in sent[-1][1]["text"] and "Ждёт оплаты" in sent[-1][1]["text"]
    hook(update("/orders", user_id=999))
    assert "Заказов пока нет" in sent[-1][1]["text"]
    # Сотрудник с тем же Telegram ID чужие заказы через бота не получит — ищем только покупателей.
    User.objects.create_user("staff", telegram_id=555, is_staff=True)
    hook(update("/orders", user_id=555))
    assert "Заказов пока нет" in sent[-1][1]["text"]


def test_bot_ignores_groups_and_answers_honestly(sent, db):
    hook(update("/start", chat_type="group"))
    assert sent == []
    hook(update("Где мой заказ?"))
    assert "Пришлите ссылку" in sent[-1][1]["text"]


def test_status_change_notifies_buyer(sent, supplier, shoes, pricing_setup, django_capture_on_commit_callbacks,
                                      monkeypatch):
    make_product(supplier, shoes, "hoodie", 80, 1, [], title_ru="Худи")
    buyer = User.objects.create_user("tg777", telegram_id=777)
    queued = []
    monkeypatch.setattr(notify_order_event, "delay", lambda event_id: queued.append(event_id))
    with django_capture_on_commit_callbacks(execute=True):
        order = mark_paid(create_order([CartLine("hoodie", 1)], contact="@anna", buyer=buyer))
        set_status(order, Order.Status.SHIPPED, note="Партия TT-1031")
    assert len(queued) == 3  # оформлен, оплачен, отправлен
    notify_order_event(queued[-1])
    text = sent[-1][1]["text"]
    assert sent[-1][1]["chat_id"] == 777 and "отправлен в россию" in text and "TT-1031" in text
    # Гостю без Telegram писать некому.
    queued.clear()
    with django_capture_on_commit_callbacks(execute=True):
        create_order([CartLine("hoodie", 1)], contact="@guest")
    assert queued == []


def test_setup_command_needs_settings(settings, db):
    settings.TELEGRAM_BOT_TOKEN = ""
    with pytest.raises(CommandError):
        call_command("telegram_setup")


def test_setup_command_configures_bot(sent, monkeypatch):
    from bot.management.commands import telegram_setup
    calls = []
    monkeypatch.setattr(telegram_setup, "call", lambda method, **params: calls.append((method, params)) or {})
    call_command("telegram_setup")
    methods = dict(calls)
    assert methods["setWebhook"]["url"] == "https://astta.ru/api/tg/webhook"
    assert methods["setWebhook"]["secret_token"] == SECRET
    assert methods["setWebhook"]["allowed_updates"] == ["message", "callback_query"]
    assert methods["setChatMenuButton"]["menu_button"]["web_app"]["url"] == "https://astta.ru"
    assert [c["command"] for c in methods["setMyCommands"]["commands"]] == ["start", "new", "orders", "help", "id"]


def test_help_opens_chat_request(sent, db):
    for text in ("/help", "/start help", "Написать менеджеру", "Уточнить цену"):
        hook(update(text))
        assert "Пришлите ссылку" in sent[-1][1]["text"]
        assert "keyboard" in sent[-1][1]["reply_markup"]


def test_empty_message_does_not_crash(sent, db):
    assert hook(update("   ")).status_code == 200
    assert sent == []


def test_order_start_prompts_for_message_with_order_number(sent, db):
    assert hook(update("/start order_A-000123")).status_code == 200
    _, params = sent[-1]
    assert "A-000123" in params["text"]
    assert "Пришлите ссылку" in params["text"]


def test_sent_order_draft_creates_one_manager_request(sent, db):
    from links.models import LinkRequest

    draft = update("Заявка ASTTA\nКроссовки\nКод товара: runner\nРазмер: 42\n"
                   "Согласен на обработку контактных данных для ответа на заявку.")
    draft["message"]["from"]["username"] = "buyer777"
    assert hook(draft).status_code == 200
    assert hook(draft).status_code == 200
    request = LinkRequest.objects.get()
    assert request.contact == "@buyer777"
    assert "Размер: 42" in request.text
    assert "принята" in sent[-1][1]["text"]


def test_bot_managers_share_inbox_and_reply_privately(sent, settings, db, monkeypatch):
    from bot.tasks import notify_manager_task
    from links.models import LinkRequest

    settings.TELEGRAM_MANAGER_IDS = (111, 222)
    queued = []
    monkeypatch.setattr(notify_manager_task, "delay", lambda *args: queued.append(args))

    assert hook(update("Уточнить цену")).status_code == 200
    assert "Пришлите ссылку" in sent[-1][1]["text"]
    assert hook(update("Нужны кроссовки Nike, размер 42")).status_code == 200
    request = LinkRequest.objects.get()
    assert request.telegram_chat_id == 777
    assert {args[0] for args in queued} == {111, 222}
    assert hook(update("Нужны кроссовки Nike, размер 42")).status_code == 200
    assert LinkRequest.objects.count() == 1 and len(queued) == 2

    for args in queued:
        notify_manager_task.run(*args)
    manager_alert = sent[-1][1]["text"]

    reply = update("Есть в наличии", user_id=222)
    reply["message"]["reply_to_message"] = {"text": manager_alert, "from": {"id": 123, "is_bot": True}}
    assert hook(reply).status_code == 200
    assert sent[-2][1]["chat_id"] == 777
    assert "Есть в наличии" in sent[-2][1]["text"]
    sent.clear()
    assert hook(reply).status_code == 200 and not sent

    hook(update("/inbox", user_id=333))
    assert "только менеджерам" in sent[-1][1]["text"]
    sent.clear()
    reply["message"]["chat"]["id"] = 333
    reply["message"]["from"]["id"] = 333
    hook(reply)
    assert {params["chat_id"] for _, params in sent} == {333}

    hook(update("/orders"))
    assert f"№{request.pk}" in sent[-1][1]["text"]


def test_relay_webhook_preserves_storefront_url(sent, settings, monkeypatch):
    from bot.management.commands import telegram_setup

    settings.TELEGRAM_WEBHOOK_ORIGIN = "https://tg-relay.astta.ru"
    calls = {}
    monkeypatch.setattr(telegram_setup, "call", lambda method, **params: calls.update({method: params}))
    call_command("telegram_setup")
    assert calls["setWebhook"]["url"] == "https://tg-relay.astta.ru/api/tg/webhook"
    assert calls["setWebhook"]["secret_token"] == SECRET
    assert calls["setWebhook"]["drop_pending_updates"] is False
    assert calls["setChatMenuButton"]["menu_button"]["web_app"]["url"] == "https://astta.ru"


def callback(action, user_id=777, chat_type="private"):
    return {"callback_query": {"id": "test-query", "data": action, "from": {"id": user_id},
                               "message": {"chat": {"type": chat_type, "id": user_id}}}}


def test_storefront_deep_link_preserves_variant_and_requires_confirmation(sent, settings, db, monkeypatch):
    from bot.tasks import notify_manager_task
    from links.models import LinkRequest

    settings.TELEGRAM_MANAGER_IDS = (111, 222)
    notifications = []
    monkeypatch.setattr(notify_manager_task, "delay", lambda *args: notifications.append(args))
    resp = Client().post("/api/tg/order-draft", {"text": "Заявка ASTTA\nКроссовки\nРазмер: 47.5\nКоличество: 2"},
                         content_type="application/json")
    assert resp.status_code == 200
    start = resp.json()["start"]
    hook(update(f"/start {start}"))
    assert "47.5" in sent[-1][1]["text"]
    assert not LinkRequest.objects.exists()
    action = sent[-1][1]["reply_markup"]["inline_keyboard"][0][0]["callback_data"]
    hook(callback(action))
    hook(callback(action))
    request = LinkRequest.objects.get()
    assert request.telegram_chat_id == 777 and "Количество: 2" in request.text
    assert {args[0] for args in notifications} == {111, 222}
    hook(update("Мои заказы и заявки"))
    assert f"№{request.pk}" in sent[-1][1]["text"]


def test_manager_panel_requires_allowlist_on_every_action(sent, settings, db):
    from links.models import LinkRequest

    settings.TELEGRAM_MANAGER_IDS = (111, 222, 333, 444)
    request = LinkRequest.objects.create(text="Приватная заявка", contact="@buyer", telegram_chat_id=777)
    hook(update("/start", user_id=444))
    assert ["Панель менеджера"] in sent[-1][1]["reply_markup"]["keyboard"]
    hook(update("Панель менеджера", user_id=444))
    action = sent[-1][1]["reply_markup"]["inline_keyboard"][0][0]["callback_data"]
    hook(callback(action, user_id=444))
    assert "Приватная заявка" in sent[-1][1]["text"]
    detail = f"team:item:{request.pk}"
    hook(callback(detail, user_id=444))
    assert "@buyer" in sent[-1][1]["text"]
    sent.clear()
    hook(callback(detail))
    hook(callback(action, user_id=444, chat_type="group"))
    assert [method for method, _ in sent] == ["answerCallbackQuery"]


def test_manager_reply_button_routes_to_selected_customer(sent, settings, db, monkeypatch):
    from bot.tasks import notify_manager_task
    from links.models import LinkRequest

    settings.TELEGRAM_MANAGER_IDS = (111,)
    monkeypatch.setattr(notify_manager_task, "delay", lambda *args: None)
    own = LinkRequest.objects.create(text="Моя старая заявка", contact="@manager", telegram_chat_id=111)
    selected = LinkRequest.objects.create(text="Заявка клиента", contact="@buyer", telegram_chat_id=777)
    hook(callback(f"team:item:{selected.pk}", user_id=111))
    button = sent[-1][1]["reply_markup"]["inline_keyboard"][0][0]
    hook(update("Обычный текст без привязки", user_id=111))
    assert "Откройте нужную заявку" in sent[-1][1]["text"]
    hook(callback(button["callback_data"], user_id=111))
    prompt = sent[-1][1]
    assert prompt["reply_markup"]["force_reply"]
    reply = update("Есть в наличии", user_id=111)
    reply["message"]["reply_to_message"] = {"text": prompt["text"], "from": {"id": 123}}
    hook(reply)
    assert sent[-2][1]["chat_id"] == 777
    assert f"№{selected.pk}" in sent[-2][1]["text"]
    own.refresh_from_db()
    assert own.comment == "" and own.agent_note == ""


def test_sticker_is_delivered_in_both_directions(sent, settings, db, monkeypatch):
    from bot.tasks import notify_manager_task
    from links.models import LinkRequest

    settings.TELEGRAM_MANAGER_IDS = (111, 222)
    notifications = []
    monkeypatch.setattr(notify_manager_task, "delay", lambda *args: notifications.append(args))
    request = LinkRequest.objects.create(text="Заявка клиента", contact="@buyer", telegram_chat_id=777)
    sticker = {"file_id": "telegram-sticker", "emoji": "👍", "is_animated": True}

    buyer_update = update("")
    buyer_update["message"].pop("text")
    buyer_update["message"]["sticker"] = sticker
    assert hook(buyer_update).status_code == 200
    assert hook(buyer_update).status_code == 200
    assert len(notifications) == 2
    notify_manager_task.run(*notifications[0])
    manager_id = notifications[0][0]
    card, forwarded = sent[-2:]
    assert f"№{request.pk}" in card[1]["text"]
    assert forwarded == ("sendSticker", {"chat_id": manager_id, "sticker": "telegram-sticker"})

    reply = update("", user_id=manager_id)
    reply["message"].pop("text")
    reply["message"]["sticker"] = sticker
    reply["message"]["reply_to_message"] = {"text": card[1]["text"], "from": {"id": 123}}
    assert hook(reply).status_code == 200
    assert sent[-2] == ("sendSticker", {"chat_id": 777, "sticker": "telegram-sticker"})
    assert notifications[-1][0] != manager_id
    request.refresh_from_db()
    assert "[Стикер Telegram]" in request.comment and "[Стикер Telegram]" in request.agent_note


def test_only_manager_can_delete_request_after_confirmation(sent, settings, db):
    from links.models import LinkRequest

    settings.TELEGRAM_MANAGER_IDS = (111, 222)
    ticket = LinkRequest.objects.create(text="Удаляемая заявка", contact="@buyer", telegram_chat_id=777)
    other = LinkRequest.objects.create(text="Другая заявка", contact="@other", telegram_chat_id=778)
    hook(callback(f"team:item:{ticket.pk}", user_id=111))
    delete = sent[-1][1]["reply_markup"]["inline_keyboard"][-1][0]["callback_data"]
    hook(callback(delete, user_id=111))
    confirm, cancel = [button["callback_data"] for button in sent[-1][1]["reply_markup"]["inline_keyboard"][0]]
    hook(callback(cancel, user_id=111))
    hook(callback(confirm, user_id=111))
    assert LinkRequest.objects.filter(pk=ticket.pk).exists()

    hook(callback(delete, user_id=111))
    confirm = sent[-1][1]["reply_markup"]["inline_keyboard"][0][0]["callback_data"]
    hook(callback(confirm, user_id=777))
    hook(callback(confirm, user_id=222))
    assert LinkRequest.objects.filter(pk=ticket.pk).exists()

    hook(callback(confirm, user_id=111))
    hook(callback(confirm, user_id=111))
    assert list(LinkRequest.objects.values_list("pk", flat=True)) == [other.pk]
