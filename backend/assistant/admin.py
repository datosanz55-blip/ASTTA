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
    """Журнал ИИ: вопросы без ответа (передано агенту) и отмеченные «не помог» — что дописать в базу знаний."""

    list_display = ("created_at", "kind", "short_request", "handoff", "helpful", "tokens", "error")
    list_filter = ("kind", "handoff", "helpful")
    search_fields = ("request", "response")
    readonly_fields = ("kind", "request", "response", "sources", "handoff", "helpful", "tokens", "error", "created_at")

    @admin.display(description=_("запрос"))
    def short_request(self, obj):
        return obj.request[:80]

    def has_add_permission(self, request):
        return False
