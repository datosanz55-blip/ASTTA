from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin

from assistant.models import AiLog, KnowledgeArticle


@admin.register(KnowledgeArticle)
class KnowledgeArticleAdmin(ModelAdmin):
    """ИИ отвечает покупателям только по этим статьям. Чего нет в статьях, он передаёт агенту."""

    list_display = ("title", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("title", "answer", "keywords")
    list_editable = ("is_active",)


@admin.register(AiLog)
class AiLogAdmin(ModelAdmin):
    """Журнал ИИ — это и есть обучение: открываете ответ, который не понравился, пишете, как надо было,
    сохраняете — и исправление становится статьёй базы знаний. В следующий раз ИИ ответит правильно."""

    list_display = ("created_at", "kind", "short_request", "short_response", "helpful", "handoff", "corrected")
    list_filter = ("kind", "helpful", "handoff", ("article", admin.EmptyFieldListFilter))
    search_fields = ("request", "response", "correct_answer")
    readonly_fields = ("kind", "request", "response", "sources", "handoff", "helpful", "tokens", "error",
                       "created_at", "article")
    fieldsets = (
        (_("Что спросили и что ответил ИИ"), {"fields": ("created_at", "kind", "request", "response", "helpful",
                                                         "handoff")}),
        (_("Исправить ответ"), {"fields": ("correct_answer", "article")}),
        (_("Технически"), {"classes": ["collapse"], "fields": ("sources", "tokens", "error")}),
    )

    @admin.display(description=_("вопрос"))
    def short_request(self, obj):
        return obj.request[:80]

    @admin.display(description=_("ответ ИИ"))
    def short_response(self, obj):
        return obj.response[:80]

    @admin.display(description=_("исправлен"), boolean=True)
    def corrected(self, obj):
        return obj.article_id is not None

    def save_model(self, request, obj, form, change):
        answer = obj.correct_answer.strip()
        if answer:
            title = obj.request.strip()[:200] or _("Вопрос покупателя")
            if obj.article_id:
                KnowledgeArticle.objects.filter(pk=obj.article_id).update(answer=answer, is_active=True)
            else:
                obj.article = KnowledgeArticle.objects.create(title=title, answer=answer)
        super().save_model(request, obj, form, change)

    def has_add_permission(self, request):
        return False
