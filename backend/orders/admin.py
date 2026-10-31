from django import forms
from django.contrib import admin, messages
from django.core.files.uploadedfile import UploadedFile
from django.shortcuts import get_object_or_404, redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display

from catalog.images import ImageError, prepare_image
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
    set_status,
    supplier_action,
)

S = Order.Status
STATUS_COLORS = {
    S.AWAITING_PAYMENT.label: "warning", S.PAID.label: "info", S.PURCHASED.label: "info",
    S.AT_WAREHOUSE.label: "info", S.SHIPPED.label: "primary", S.BORDER.label: "primary",
    S.IN_RUSSIA.label: "primary", S.READY.label: "success", S.DELIVERED.label: "success", S.CANCELLED.label: "danger",
}
# Дальше склада в Китае статусы ведёт агент: обычно сразу всей партией, поэтому это действия над списком.
MOVES = [
    (S.SHIPPED, "Отправлен в Россию"),
    (S.BORDER, "На границе"),
    (S.IN_RUSSIA, "Приехал в Россию"),
    (S.READY, "В пункте выдачи"),
    (S.DELIVERED, "Получен покупателем"),
]
MOVABLE = {S.PAID, S.PURCHASED, S.AT_WAREHOUSE, S.SHIPPED, S.BORDER, S.IN_RUSSIA, S.READY}


def _move_action(status, label):
    def action(modeladmin, request, queryset):
        done, skipped = 0, []
        for order in queryset:
            if order.status not in MOVABLE or order.status == status:
                skipped.append(f"{order.number}: «{order.get_status_display()}»")
                continue
            set_status(order, status, author=request.user)
            done += 1
        _report(modeladmin, request, done, skipped, _("Статус «%(s)s»") % {"s": label})

    action.__name__ = f"move_{status}"
    return admin.action(description=_("Статус → %(s)s") % {"s": label})(action)


class OrderItemInline(TabularInline):
    """Что заказано. Цена зафиксирована в момент заказа, поэтому здесь ничего не меняется."""

    model = OrderItem
    extra = 0
    can_delete = False
    fields = ("title", "where", "size", "color", "qty", "unit_cny", "total_rub")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description=_("товар или ссылка"))
    def where(self, obj):
        if obj.product_id:
            return format_html('<a href="{}">{}</a>', reverse("admin:catalog_product_change", args=[obj.product_id]),
                               _("в каталоге"))
        links = [format_html('<a href="{}" target="_blank" rel="noopener">{}</a>', obj.source_url, _("ссылка"))
                 if obj.source_url else "",
                 format_html('<a href="{}" target="_blank" rel="noopener">{}</a>', obj.photo.url, _("скриншот"))
                 if obj.photo else ""]
        return format_html_join(" · ", "{}", ((x,) for x in links if x)) or "—"


class OrderEventInline(TabularInline):
    """История заказа как её видит покупатель. Прошлые события не правятся и не удаляются."""

    model = OrderEvent
    extra = 0
    can_delete = False
    verbose_name_plural = _("история заказа")
    fields = ("when", "status", "note", "photo_preview", "weight_kg", "who")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description=_("когда"))
    def when(self, obj):
        return timezone.localtime(obj.created_at).strftime("%d.%m.%Y %H:%M")

    @admin.display(description=_("кто"))
    def who(self, obj):
        return obj.author or _("система")

    @admin.display(description=_("фото со склада"))
    def photo_preview(self, obj):
        if not obj.photo:
            return "—"
        return format_html('<a href="{0}" target="_blank" rel="noopener"><img src="{0}" alt="" '
                           'style="width:72px;height:72px;object-fit:cover;border-radius:8px"></a>', obj.photo.url)


AGENT_STATUSES = [S.AT_WAREHOUSE, S.SHIPPED, S.BORDER, S.IN_RUSSIA, S.READY, S.DELIVERED]


class NewEventForm(forms.ModelForm):
    class Meta:
        model = OrderEvent
        fields = ("status", "note", "photo", "weight_kg")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Оплату, выкуп и отмену ставят кнопки и действия, здесь только движение заказа после склада.
        self.fields["status"].choices = [("", _("— новый статус —"))] + [(s.value, s.label) for s in AGENT_STATUSES]
        self.fields["status"].initial = ""

    def clean_photo(self):
        photo = self.cleaned_data.get("photo")
        if isinstance(photo, UploadedFile):
            try:
                return prepare_image(photo.read(), photo.name or "photo")
            except ImageError as exc:
                raise forms.ValidationError(str(exc)) from exc
        return photo


class NewEventInline(TabularInline):
    """Новое событие: статус, комментарий для покупателя, фото со склада, фактический вес."""

    model = OrderEvent
    form = NewEventForm
    extra = 1
    max_num = 1
    can_delete = False
    verbose_name = _("новое событие")
    verbose_name_plural = _("добавить событие в историю")
    fields = ("status", "note", "photo", "weight_kg")

    def get_queryset(self, request):
        return super().get_queryset(request).none()


class SupplierOrderInline(TabularInline):
    model = SupplierOrder
    extra = 0
    can_delete = False
    # Трек вписывают в самой части заказа: там же она переходит в «отправлено на склад».
    fields = ("part", "status", "tracking", "received_at", "payout")
    readonly_fields = fields

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description=_("у кого"))
    def part(self, obj):
        return format_html('<a href="{}">{}</a>', reverse("admin:orders_supplierorder_change", args=[obj.pk]),
                           obj.vendor)

    def has_add_permission(self, request, obj=None):
        return False


def _report(modeladmin, request, done, failed, label):
    modeladmin.message_user(request, _("%(label)s: %(n)s") % {"label": label, "n": done})
    for line in failed:
        modeladmin.message_user(request, line, messages.WARNING)


@admin.register(Order)
class OrderAdmin(ModelAdmin):
    """Отслеживание заказов. Каждое изменение статуса — событие в истории: покупатель видит его как трекинг.
    Фото со склада и фактический вес добавляются строкой в «Историю заказа» внизу карточки."""

    list_display = ("number", "status_label", "what", "contact", "total_rub", "refund_rub", "created")
    list_filter = ("status", "mode", "agent")
    search_fields = ("number", "contact", "name", "items__title")
    date_hierarchy = "created_at"
    list_per_page = 50
    readonly_fields = ("number", "status_label", "rate", "total_rub", "paid_at", "refund_rub", "created_at",
                       "updated_at")
    fieldsets = (
        (None, {"fields": ("number", "status_label", "contact", "name", "comment", "agent")}),
        (_("Деньги"), {"fields": ("mode", "rate", "total_rub", "paid_at", "refund_rub")}),
        (_("Служебное"), {"fields": ("created_at", "updated_at"), "classes": ["collapse"]}),
    )
    inlines = [OrderItemInline, SupplierOrderInline, OrderEventInline, NewEventInline]
    actions = ["paid", "cancel", *[_move_action(status, label) for status, label in MOVES]]

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("items")

    @display(description=_("статус"), ordering="status", label=STATUS_COLORS)
    def status_label(self, obj):
        return obj.get_status_display()

    @admin.display(description=_("создан"), ordering="created_at")
    def created(self, obj):
        return timezone.localtime(obj.created_at).strftime("%d.%m.%Y %H:%M")

    @admin.display(description=_("что заказано"))
    def what(self, obj):
        items = list(obj.items.all())
        if not items:
            return "—"
        first = f"{items[0].title} × {items[0].qty}"
        return f"{first} и ещё {len(items) - 1}" if len(items) > 1 else first

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
