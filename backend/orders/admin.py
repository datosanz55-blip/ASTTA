from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from orders.models import Order, OrderEvent, OrderItem


class OrderItemInline(TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ("product", "title", "size", "qty", "unit_cny", "shipping_code", "goods_rub", "delivery_rub",
                       "fee_rub", "total_rub")

    def has_add_permission(self, request, obj=None):
        return False


class OrderEventInline(TabularInline):
    """Агент добавляет событие: новый статус, фото со склада, фактический вес."""

    model = OrderEvent
    extra = 1
    fields = ("status", "note", "photo", "weight_kg", "author", "created_at")
    readonly_fields = ("author", "created_at")


@admin.register(Order)
class OrderAdmin(ModelAdmin):
    list_display = ("number", "status", "mode", "contact", "total_rub", "agent", "created_at")
    list_filter = ("status", "mode", "agent")
    search_fields = ("number", "contact", "name")
    readonly_fields = ("number", "token", "rate", "total_rub", "created_at", "updated_at")
    inlines = [OrderItemInline, OrderEventInline]

    def save_formset(self, request, form, formset, change):
        events = formset.save(commit=False)
        for event in events:
            if isinstance(event, OrderEvent):
                event.author = event.author or request.user
                # Последнее добавленное событие и есть текущий статус заказа.
                form.instance.status = event.status
            event.save()
        formset.save_m2m()
        form.instance.save(update_fields=["status", "updated_at"])
