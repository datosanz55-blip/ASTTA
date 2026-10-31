from django import forms
from django.contrib import admin, messages
from django.core.files.uploadedfile import UploadedFile
from django.db import models
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.text import Truncator
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display

from catalog.images import ImageError, prepare_image
from catalog.importer import build_template, import_catalog
from catalog.models import (
    Category,
    PostImage,
    PriceTier,
    Product,
    ProductImage,
    Supplier,
    SupplierPost,
)
from orders.models import SupplierOrder


def thumb(image, size=56):
    if not image:
        return "—"
    return format_html('<img src="{}" alt="" style="width:{}px;height:{}px;object-fit:cover;border-radius:8px">',
                       image.url, size, size)


class PhotoForm(forms.ModelForm):
    """Фото из админки сохраняем так же, как из Excel: повёрнутое по EXIF, до 1600 px, в WebP."""

    def clean_image(self):
        image = self.cleaned_data.get("image")
        if isinstance(image, UploadedFile):
            try:
                return prepare_image(image.read(), image.name or "photo")
            except ImageError as exc:
                raise forms.ValidationError(str(exc)) from exc
        return image


class PhotoInline(TabularInline):
    form = PhotoForm
    extra = 3
    fields = ("preview", "image", "position")
    readonly_fields = ("preview",)

    @admin.display(description=_("превью"))
    def preview(self, obj):
        return thumb(obj.image, 72) if obj.pk else "—"


@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    list_display = ("name_ru", "name_zh", "slug", "position")
    list_editable = ("position",)
    search_fields = ("name_ru", "name_zh", "slug")
    prepopulated_fields = {"slug": ("name_ru",)}


@admin.register(Supplier)
class SupplierAdmin(ModelAdmin):
    """Поставщики — только карточки для команды: сами они в систему не заходят, каталоги присылают в WeChat."""

    list_display = ("name", "city", "wechat", "on_site", "drafts", "to_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "name_zh", "code", "city", "wechat")
    prepopulated_fields = {"code": ("name",)}
    fieldsets = (
        (None, {"fields": ("name", "code", "city", "about", "is_active")}),
        (_("Связь и оплата"), {"fields": ("wechat", "phone", "payout_details", "name_zh")}),
        (_("Сроки до склада"), {"fields": ("fact_days_min", "fact_days_max")}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            n_published=Count("products", filter=Q(products__status=Product.Status.PUBLISHED), distinct=True),
            n_drafts=Count("products", filter=~Q(products__status=Product.Status.PUBLISHED), distinct=True),
            n_to_order=Count("supplier_orders", filter=Q(supplier_orders__status=SupplierOrder.Status.TO_ORDER),
                             distinct=True),
        )

    @admin.display(description=_("на сайте"), ordering="n_published")
    def on_site(self, obj):
        url = reverse("admin:catalog_product_changelist")
        return format_html('<a href="{}?supplier__id__exact={}&status__exact=published">{}</a>', url, obj.pk,
                           obj.n_published)

    @admin.display(description=_("черновики"), ordering="n_drafts")
    def drafts(self, obj):
        return obj.n_drafts

    @admin.display(description=_("заказать"), ordering="n_to_order")
    def to_order(self, obj):
        if not obj.n_to_order:
            return 0
        return format_html('<a class="font-semibold text-primary-600" href="{}">{}</a>',
                           reverse("admin:orders_supplierorder_purchase"), obj.n_to_order)


class PostImageInline(PhotoInline):
    model = PostImage
    max_num = 10


class PostForm(forms.ModelForm):
    class Meta:
        model = SupplierPost
        fields = ("supplier", "product", "kind", "text_ru", "status")
        labels = {"supplier": _("От имени поставщика"), "product": _("Товар (необязательно)"),
                  "text_ru": _("Текст поста")}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Пост пишет команда, проверять его некому: по умолчанию сразу в ленту.
        if not self.instance.pk:
            self.initial.setdefault("status", SupplierPost.Status.PUBLISHED)
        self.fields["text_ru"].required = True


@admin.register(SupplierPost)
class SupplierPostAdmin(ModelAdmin):
    """Посты в ленту от имени поставщика: команда пишет текст, прикладывает до 10 фото и сразу публикует."""

    form = PostForm
    list_display = ("cover", "short_text", "supplier", "kind", "status_label", "created_at")
    list_display_links = ("cover", "short_text")
    list_filter = ("status", "kind", "supplier")
    search_fields = ("text_ru", "supplier__name", "product__title_ru")
    autocomplete_fields = ("product",)
    inlines = [PostImageInline]
    actions = ["publish", "hide"]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("supplier").prefetch_related("images")

    @admin.display(description=_("фото"))
    def cover(self, obj):
        images = list(obj.images.all())
        return thumb(images[0].image if images else None)

    @admin.display(description=_("текст"))
    def short_text(self, obj):
        return Truncator(obj.text_ru or "—").chars(90)

    @display(description=_("статус"), ordering="status", label={
        SupplierPost.Status.PUBLISHED.label: "success", SupplierPost.Status.MODERATION.label: "warning",
        SupplierPost.Status.REJECTED.label: "danger"})
    def status_label(self, obj):
        return obj.get_status_display()

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description=_("Опубликовать в ленте"))
    def publish(self, request, queryset):
        missing = queryset.filter(text_ru="").count()
        if missing:
            self.message_user(request, _("Сначала впишите текст поста: %(n)s") % {"n": missing}, messages.WARNING)
            return
        n = queryset.update(status=SupplierPost.Status.PUBLISHED)
        self.message_user(request, _("Опубликовано: %(n)s") % {"n": n})

    @admin.action(description=_("Убрать из ленты"))
    def hide(self, request, queryset):
        n = queryset.update(status=SupplierPost.Status.REJECTED)
        self.message_user(request, _("Убрано из ленты: %(n)s") % {"n": n}, messages.WARNING)


class PriceTierInline(TabularInline):
    model = PriceTier
    extra = 1


class ProductImageInline(PhotoInline):
    model = ProductImage


@admin.register(Product)
class ProductAdmin(ModelAdmin):
    list_display = ("cover", "title_ru", "supplier", "category", "price_cny", "status_label")
    list_display_links = ("cover", "title_ru")
    list_filter = ("status", "category", "supplier")
    search_fields = ("title_ru", "title_zh", "sku", "slug")
    list_per_page = 50
    inlines = [ProductImageInline, PriceTierInline]
    actions = ["publish", "reject", "translate"]
    # Ссылку без схемы считаем https://, как будет по умолчанию в Django 6.
    formfield_overrides = {models.URLField: {"assume_scheme": "https"}}
    change_list_template = "admin/catalog/product/change_list.html"
    fieldsets = (
        (None, {"fields": ("supplier", "category", "sku", "slug", "status", "moderation_note")}),
        (_("Название и описание"), {"fields": ("title_ru", "description_ru", "title_zh", "description_zh",
                                                "source_url")}),
        (_("Цена и доставка"), {"fields": ("price_cny", "sale_percent", "weight_kg", "bulky", "is_new")}),
        (_("Размеры и цвета"), {"fields": ("sizes", "colors", "size_grid")}),
    )
    prepopulated_fields = {"slug": ("title_ru",)}

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("supplier", "category").prefetch_related("images")

    @admin.display(description=_("фото"))
    def cover(self, obj):
        images = list(obj.images.all())
        return thumb(images[0].image if images else None)

    @display(description=_("статус"), ordering="status", label={
        Product.Status.PUBLISHED.label: "success", Product.Status.DRAFT.label: "info",
        Product.Status.MODERATION.label: "warning", Product.Status.REJECTED.label: "danger"})
    def status_label(self, obj):
        return obj.get_status_display()

    @admin.action(description=_("Перевести с китайского (YandexGPT)"))
    def translate(self, request, queryset):
        from assistant import yandex
        from assistant.services import translate_cards

        todo = [p for p in queryset if p.title_zh or p.description_zh]
        if not todo:
            self.message_user(request, _("У выбранных товаров нет китайского текста"), messages.WARNING)
            return
        try:
            result = translate_cards([{"title_zh": p.title_zh, "description_zh": p.description_zh} for p in todo])
        except (yandex.AIError, yandex.AIUnavailable) as exc:
            self.message_user(request, str(exc), messages.ERROR)
            return
        for product, item in zip(todo, result, strict=True):
            product.title_ru = (item.get("title") or product.title_ru)[:160]
            if item.get("description"):
                product.description_ru = item["description"]
            product.save(update_fields=["title_ru", "description_ru"])
        self.message_user(request, _("Переведено: %(n)s. Проверьте названия перед публикацией.") % {"n": len(todo)})

    @admin.action(description=_("Опубликовать"))
    def publish(self, request, queryset):
        updated = queryset.update(status=Product.Status.PUBLISHED, moderation_note="")
        self.message_user(request, _("Опубликовано: %(n)s") % {"n": updated})

    @admin.action(description=_("Снять с сайта"))
    def reject(self, request, queryset):
        updated = queryset.update(status=Product.Status.DRAFT)
        self.message_user(request, _("Снято с сайта: %(n)s") % {"n": updated}, messages.WARNING)

    def get_urls(self):
        return [
            path("import/", self.admin_site.admin_view(self.import_view), name="catalog_product_import"),
            path("template/", self.admin_site.admin_view(self.template_view), name="catalog_product_template"),
        ] + super().get_urls()

    def template_view(self, request):
        response = HttpResponse(build_template(),
                                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = 'attachment; filename="astta-catalog-template.xlsx"'
        return response

    def import_view(self, request):
        if not self.has_add_permission(request):
            return redirect("admin:catalog_product_changelist")
        chosen = request.POST.get("supplier")
        supplier = Supplier.objects.filter(pk=chosen).first() if chosen else None
        result = None
        if request.method == "POST" and (request.FILES.get("file") or request.FILES.get("photos")):
            if supplier is None:
                messages.error(request, _("Выберите поставщика"))
            else:
                publish = bool(request.POST.get("publish"))
                translate = bool(request.POST.get("translate"))
                result = import_catalog(request.FILES.get("file"), supplier, photos=request.FILES.get("photos"),
                                        publish=publish, translate=translate)
                if result.ok:
                    where = _("Товары уже на сайте.") if publish else _("Товары сохранены черновиками.")
                    messages.success(request, _("Загружено: новых %(c)s, обновлено %(u)s, фото %(p)s. %(where)s")
                                     % {"c": result.created, "u": result.updated, "p": result.photos, "where": where})
                    for warning in result.warnings:
                        messages.warning(request, warning)
                    return redirect("admin:catalog_product_changelist")
        context = {
            **self.admin_site.each_context(request),
            "title": _("Загрузка каталога из Excel"),
            "opts": self.model._meta,
            "result": result,
            "suppliers": Supplier.objects.filter(is_active=True),
        }
        return TemplateResponse(request, "admin/catalog/product/import.html", context)
