from django.contrib import admin, messages
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline

from orders.models import Order, OrderEvent, OrderItem, Payout, SupplierOrder
from orders.services import SupplierOrderError, create_payouts, mark_received


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


class SupplierOrderInline(TabularInline):
    model = SupplierOrder
    extra = 0
    can_delete = False
    fields = ("supplier", "status", "tracking", "received_at", "payout")
    readonly_fields = ("supplier", "received_at", "payout")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(ModelAdmin):
    list_display = ("number", "status", "mode", "contact", "total_rub", "agent", "created_at")
    list_filter = ("status", "mode", "agent")
    search_fields = ("number", "contact", "name")
    readonly_fields = ("number", "token", "rate", "total_rub", "created_at", "updated_at")
    inlines = [OrderItemInline, SupplierOrderInline, OrderEventInline]

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


@admin.register(SupplierOrder)
class SupplierOrderAdmin(ModelAdmin):
    """Склад TT отмечает здесь, что посылка поставщика пришла: сумма попадает в выплату."""

    list_display = ("order", "supplier", "status", "tracking", "received_at", "payout")
    list_filter = ("status", "supplier")
    search_fields = ("order__number", "tracking")
    readonly_fields = ("order", "supplier", "payout", "received_at", "created_at", "updated_at")
    actions = ["receive"]

    @admin.action(description=_("Принято складом TT"))
    def receive(self, request, queryset):
        done, failed = 0, []
        for so in queryset:
            try:
                mark_received(so)
                done += 1
            except SupplierOrderError as exc:
                failed.append(f"{so}: {exc}")
        self.message_user(request, _("Принято: %(n)s") % {"n": done})
        for line in failed:
            self.message_user(request, line, messages.WARNING)


@admin.register(Payout)
class PayoutAdmin(ModelAdmin):
    list_display = ("supplier", "amount_cny", "status", "created_at", "paid_at")
    list_filter = ("status", "supplier")
    readonly_fields = ("supplier", "amount_cny", "created_at")
    actions = ["collect", "mark_paid"]

    def has_add_permission(self, request):
        return False

    @admin.action(description=_("Собрать выплаты за принятые складом заказы"))
    def collect(self, request, queryset):
        payouts = create_payouts()
        self.message_user(request, _("Создано выплат: %(n)s") % {"n": len(payouts)})

    @admin.action(description=_("Отметить выплаченными"))
    def mark_paid(self, request, queryset):
        n = queryset.filter(status=Payout.Status.PENDING).update(status=Payout.Status.PAID, paid_at=timezone.now())
        self.message_user(request, _("Отмечено: %(n)s") % {"n": n})
