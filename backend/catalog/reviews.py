"""Public service reviews. Submitted reviews require an authenticated buyer and moderation."""
from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError
from pydantic import Field, field_validator

from accounts.api import current_buyer, require_consent
from accounts.models import User
from catalog.models import CustomerReview
from config.throttles import per_ip

router = Router(tags=["Отзывы"])


class ReviewIn(Schema):
    rating: int = Field(ge=1, le=5, strict=True)
    text: str = Field(min_length=10, max_length=2000)
    consent: bool = False

    @field_validator("text")
    @classmethod
    def trim_text(cls, value):
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Напишите хотя бы 10 символов")
        return value


class ReviewOut(Schema):
    id: int
    author: str
    rating: int
    text: str
    created_at: str


class ReviewPage(Schema):
    items: list[ReviewOut]
    total: int
    average: float | None
    page: int
    has_more: bool


class SubmittedReview(Schema):
    id: int
    status: str
    message: str


@router.get("", response=ReviewPage)
def list_reviews(request, page: int = 1):
    if not 1 <= page <= 10000:
        raise HttpError(422, "Неверная страница")
    queryset = CustomerReview.objects.filter(status=CustomerReview.Status.PUBLISHED)
    stats = queryset.aggregate(total=Count("pk"), average=Avg("rating"))
    offset = (page - 1) * 6
    items = queryset.select_related("user")[offset:offset + 6]
    return {"items": [{"id": r.pk, "author": r.user.first_name.strip() or "Покупатель ASTTA",
                       "rating": r.rating, "text": r.text, "created_at": r.created_at.isoformat()} for r in items],
            "total": stats["total"], "average": round(stats["average"], 1) if stats["average"] else None,
            "page": page, "has_more": offset + 6 < stats["total"]}


@router.post("", response={201: SubmittedReview}, throttle=[per_ip("reviews", "10/h")])
def submit_review(request, payload: ReviewIn):
    buyer = current_buyer(request)
    if buyer is None:
        raise HttpError(401, "Войдите, чтобы оставить отзыв")
    consent_at = require_consent(payload.consent)
    with transaction.atomic():
        # Serialize this buyer's submissions, including requests from different IP addresses.
        User.objects.select_for_update().get(pk=buyer.pk)
        recent = CustomerReview.objects.filter(user=buyer, created_at__gte=timezone.now() - timedelta(days=1))
        if recent.count() >= 3:
            raise HttpError(429, "Можно оставить не больше трёх отзывов за сутки")
        if recent.filter(text=payload.text).exists():
            raise HttpError(409, "Этот отзыв уже отправлен на проверку")
        review = CustomerReview.objects.create(user=buyer, rating=payload.rating, text=payload.text,
                                               consent_at=consent_at)
    return 201, {"id": review.pk, "status": review.status,
                 "message": "Спасибо! Отзыв отправлен на проверку перед публикацией."}
