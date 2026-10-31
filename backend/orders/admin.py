from django.contrib import admin, messages
from django.shortcuts import get_object_or_404, redirect
from django.template.response import TemplateResponse
from django.urls import path
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline

from catalog.models import Supplier
from orders.models import Order, OrderEvent, OrderItem, Payout, SupplierOrder
from orders.services import (
    OrderError,
    SupplierOrderError,
    cancel_unpaid,
    create_payouts,
    mark_ordered,
    mark_paid,
    mark_received,
    purchase_for,
    supplier_action,
)


class OrderItemInline(TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ("product", "title", "source_url", "photo", "size", "color", "qty", "unit_cny",
                       "shipping_code", "goods_rub", "delivery_rub", "fee_rub", "fee_share", "total_rub")

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
    fields = ("supplier", "marketplace", "status", "tracking", "received_at", "payout")
    readonly_fields = ("supplier", "marketplace", "status", "received_at", "payout")

    def has_add_permission(self, request, obj=None):
        return False


def _report(modeladmin, request, done, failed, label):
    modeladmin.message_user(request, _("%(label)s: %(n)s") % {"label": label, "n": done})
    for line in failed:
        modeladmin.message_user(request, line, messages.WARNING)


@admin.register(Order)
class OrderAdmin(ModelAdmin):
    list_display = ("number", "status", "mode", "contact", "total_rub", "paid_at", "refund_rub", "agent", "created_at")
    list_filter = ("status", "mode", "agent")
    search_fields = ("number", "contact", "name")
    readonly_fields = ("number", "token", "rate", "total_rub", "paid_at", "refund_rub", "created_at", "updated_at")
    inlines = [OrderItemInline, SupplierOrderInline, OrderEventInline]
    actions = ["paid", "cancel"]

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

    @admin.action(description=_("Оплата получена: заказать у поставщиков"))
    def paid(self, request, queryset):
        done, failed = 0, []
        for order in queryset:
            try:
                mark_paid(order, author=request.user)
                done += 1
            except OrderError as exc:
                failed.append(str(exc))
        _report(self, request, done, failed, _("Отмечено оплаченными"))

    @admin.action(description=_("Отменить неоплаченный заказ"))
    def cancel(self, request, queryset):
        done, failed = 0, []
        for order in queryset:
            try:
                cancel_unpaid(order, "Заказ отменён командой ASTTA", author=request.user)
                done += 1
            except OrderError as exc:
                failed.append(str(exc))
        _report(self, request, done, failed, _("Отменено"))


@admin.register(SupplierOrder)
class SupplierOrderAdmin(ModelAdmin):
    """Выкуп у поставщиков: сводный заказ поставщику, трек до склада, приёмка на складе TT."""

    list_display = ("order", "vendor_name", "status", "tracking", "received_at", "payout")
    list_filter = ("status", ("supplier", admin.EmptyFieldListFilter), "supplier", "marketplace")
    search_fields = ("order__number", "tracking")
    readonly_fields = ("order", "supplier", "marketplace", "what_to_buy", "status", "payout", "received_at",
                       "created_at", "updated_at")

    @admin.display(description=_("поставщик"))
    def vendor_name(self, obj):
        return obj.vendor

    @admin.display(description=_("что выкупить"))
    def what_to_buy(self, obj):
        # Для заказа по ссылке агенту нужны ссылка, скриншот и цена, которую назвал покупатель: сверить перед выкупом.
        return format_html_join(mark_safe("<br>"), "{} · {} · {} шт. · ¥{} {} {}", (
            (item.title, " ".join(filter(None, [item.size, item.color])) or "—", item.qty, item.unit_cny,
             format_html('<a href="{}" target="_blank" rel="noopener">ссылка</a>', item.source_url)
             if item.source_url else "",
             format_html('<a href="{}" target="_blank" rel="noopener">скриншот</a>', item.photo.url)
             if item.photo else "")
            for item in obj.items.all()))
    actions = ["ordered", "out_of_stock", "receive"]
    change_list_template = "admin/orders/supplierorder/change_list.html"

    def save_model(self, request, obj, form, change):
        # Вписали трек к заказанной у поставщика части: значит, поставщик отправил её на склад.
        if change and "tracking" in form.changed_data and obj.tracking.strip():
            current = SupplierOrder.objects.get(pk=obj.pk)
            if current.status == SupplierOrder.Status.ORDERED:
                try:
                    supplier_action(current, "ship", obj.tracking, author=request.user)
                except SupplierOrderError as exc:
                    self.message_user(request, str(exc), messages.WARNING)
                return
        super().save_model(request, obj, form, change)

    def _bulk(self, request, queryset, func, label):
        done, failed = 0, []
        for so in queryset:
            try:
                func(so)
                done += 1
            except SupplierOrderError as exc:
                failed.append(f"{so}: {exc}")
        _report(self, request, done, failed, label)

    @admin.action(description=_("Заказано у поставщика"))
    def ordered(self, request, queryset):
        self._bulk(request, queryset, lambda so: supplier_action(so, "confirm", author=request.user), _("Заказано"))

    @admin.action(description=_("Нет в наличии: отменить и вернуть деньги"))
    def out_of_stock(self, request, queryset):
        self._bulk(request, queryset, lambda so: supplier_action(so, "cancel", author=request.user), _("Отменено"))

    @admin.action(description=_("Принято складом TT"))
    def receive(self, request, queryset):
        self._bulk(request, queryset, lambda so: mark_received(so, author=request.user), _("Принято"))

    def get_urls(self):
        return [
            path("purchase/", self.admin_site.admin_view(self.purchase_view), name="orders_supplierorder_purchase"),
        ] + super().get_urls()

    def purchase_view(self, request):
        """Что заказать у каждого поставщика по оплаченным заказам и готовое сообщение для WeChat."""
        if not self.has_change_permission(request):
            return redirect("admin:index")
        if request.method == "POST":
            supplier = get_object_or_404(Supplier, pk=request.POST.get("supplier"))
            ids = [int(x) for x in request.POST.getlist("orders") if x.isdigit()]
            n = mark_ordered(supplier, ids, author=request.user)
            self.message_user(request, _("%(s)s: заказано частей заказов — %(n)s") % {"s": supplier, "n": n})
            return redirect("admin:orders_supplierorder_purchase")
        waiting = (SupplierOrder.objects.filter(status=SupplierOrder.Status.TO_ORDER)
                   .values_list("supplier", flat=True).distinct())
        purchases = [purchase_for(s) for s in Supplier.objects.filter(pk__in=waiting)]
        context = {
            **self.admin_site.each_context(request),
            "title": _("Заказать у поставщиков"),
            "opts": self.model._meta,
            "purchases": purchases,
        }
        return TemplateResponse(request, "admin/orders/supplierorder/purchase.html", context)


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
