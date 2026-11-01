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


def test_start_shows_mini_app_button(sent, db):
    assert hook(update("/start")).status_code == 200
    method, params = sent[0]
    assert method == "sendMessage" and params["chat_id"] == 777 and "Анна" in params["text"]
    button = params["reply_markup"]["inline_keyboard"][0][0]
    assert button == {"text": "Открыть ASTTA", "web_app": {"url": "https://astta.ru"}}


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
    assert "агент пока не читает" in sent[-1][1]["text"]


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
    assert methods["setChatMenuButton"]["menu_button"]["web_app"]["url"] == "https://astta.ru"
    assert [c["command"] for c in methods["setMyCommands"]["commands"]] == ["start", "orders", "help"]
