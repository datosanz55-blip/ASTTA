from ninja import Router, Schema
from ninja.errors import HttpError

from assistant import llm, yandex
from assistant.chat import chat as run_chat
from assistant.models import AiLog
from assistant.services import MAX_QUESTION, answer_question
from config.throttles import per_ip

router = Router(tags=["ASTTA AI"])
# Один вопрос стоит денег: ограничиваем частоту, чтобы бот или шутник не съел бюджет.
LIMITS = [per_ip("ai_minute", "10/m"), per_ip("ai_day", "100/d")]


class AskIn(Schema):
    question: str


class SourceOut(Schema):
    id: int
    title: str


class AskOut(Schema):
    answer: str
    handoff: bool
    sources: list[SourceOut]
    log_id: int


class FeedbackIn(Schema):
    log_id: int
    helpful: bool


class ChatMessage(Schema):
    role: str
    content: str


class ChatIn(Schema):
    messages: list[ChatMessage]


class ChatOut(Schema):
    answer: str
    products: list[str]
    handoff: bool
    log_id: int | None
    memo: str = ""


@router.get("/status", summary="Подключён ли ИИ")
def status(request):
    return {"enabled": yandex.enabled(), "chat": llm.enabled()}


@router.post("/chat", response=ChatOut, throttle=LIMITS,
             summary="Чат ASTTA AI: подбор из каталога, ответы по базе знаний, расчёт по ссылке, статус заказа")
def chat_view(request, payload: ChatIn):
    from accounts.api import current_buyer

    if not llm.enabled():
        raise HttpError(503, "ИИ пока не подключён, напишите агенту в Telegram")
    history = [m.dict() for m in payload.messages if m.role in ("user", "assistant")][-12:]
    if not history or history[-1]["role"] != "user" or not history[-1]["content"].strip():
        raise HttpError(422, "Напишите вопрос")
    if len(history[-1]["content"]) > MAX_QUESTION:
        raise HttpError(422, f"Сообщение длиннее {MAX_QUESTION} символов")
    result = run_chat(history, buyer=current_buyer(request))
    return {"answer": result.text, "products": result.products, "handoff": result.handoff, "log_id": result.log_id,
            "memo": result.memo}


@router.post("/ask", response=AskOut, throttle=LIMITS, summary="Вопрос покупателя: ответ по базе знаний")
def ask(request, payload: AskIn):
    question = payload.question.strip()
    if not question:
        raise HttpError(422, "Напишите вопрос")
    if len(question) > MAX_QUESTION:
        raise HttpError(422, f"Вопрос длиннее {MAX_QUESTION} символов")
    if not yandex.enabled():
        raise HttpError(503, "ИИ пока не подключён, напишите агенту в чат")
    result = answer_question(question)
    return {"answer": result.text, "handoff": result.handoff, "log_id": result.log_id,
            "sources": [{"id": a.pk, "title": a.title} for a in result.articles]}


@router.post("/feedback", throttle=LIMITS, summary="Помог ли ответ: по таким отметкам доучиваем базу знаний")
def feedback(request, payload: FeedbackIn):
    kinds = [AiLog.Kind.ASK, AiLog.Kind.CHAT]
    updated = AiLog.objects.filter(pk=payload.log_id, kind__in=kinds, helpful__isnull=True).update(
        helpful=payload.helpful)
    return {"ok": bool(updated)}
