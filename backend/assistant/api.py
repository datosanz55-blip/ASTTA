from ninja import Router, Schema
from ninja.errors import HttpError

from assistant import yandex
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


@router.get("/status", summary="Подключён ли ИИ")
def status(request):
    return {"enabled": yandex.enabled()}


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
    updated = AiLog.objects.filter(pk=payload.log_id, kind=AiLog.Kind.ASK, helpful__isnull=True).update(
        helpful=payload.helpful)
    return {"ok": bool(updated)}
