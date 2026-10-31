from django.contrib import admin
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin

from links.models import LinkRequest, Marketplace


@admin.register(Marketplace)
class MarketplaceAdmin(ModelAdmin):
    list_display = ("name", "code", "extra_fee", "china_delivery_cny", "note")
    list_editable = ("extra_fee", "china_delivery_cny")


@admin.register(LinkRequest)
class LinkRequestAdmin(ModelAdmin):
    """Заявки «закажите по ссылке»: агент проверяет товар и продавца и отвечает покупателю ценой."""

    list_display = ("id", "status", "marketplace", "open_link", "price_cny", "qty", "estimate_rub", "contact",
                    "agent", "created_at")
    list_filter = ("status", "marketplace")
    search_fields = ("contact", "url", "text", "item_id")
    readonly_fields = ("url", "text", "marketplace", "item_id", "photo_preview", "price_cny", "qty", "size", "color",
                       "category", "estimate_rub", "contact", "comment", "created_at")
    fields = ("status", "agent", "agent_note", *readonly_fields)
    actions = ["quoted", "rejected"]

    @admin.display(description=_("ссылка"))
    def open_link(self, obj):
        return format_html('<a href="{}" target="_blank" rel="noopener">открыть</a>', obj.url) if obj.url else "—"

    @admin.display(description=_("фото"))
    def photo_preview(self, obj):
        if not obj.photo:
            return "—"
        return format_html('<img src="{}" style="max-width:320px;border-radius:8px">', obj.photo.url)

    def save_model(self, request, obj, form, change):
        if not obj.agent_id:
            obj.agent = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description=_("Цена отправлена покупателю"))
    def quoted(self, request, queryset):
        n = queryset.update(status=LinkRequest.Status.QUOTED)
        self.message_user(request, _("Отмечено: %(n)s") % {"n": n})

    @admin.action(description=_("Не можем привезти"))
    def rejected(self, request, queryset):
        n = queryset.update(status=LinkRequest.Status.REJECTED)
        self.message_user(request, _("Отмечено: %(n)s") % {"n": n})
