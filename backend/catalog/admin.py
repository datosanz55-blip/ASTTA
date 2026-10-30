from django.contrib import admin, messages
from django.db import models
from django.http import HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, StackedInline, TabularInline

from catalog.importer import build_template, import_catalog
from catalog.models import (
    Category,
    FactorySettings,
    PostImage,
    PriceTier,
    Product,
    ProductImage,
    Supplier,
    SupplierPost,
)


@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    list_display = ("name_ru", "name_zh", "slug", "position")
    list_editable = ("position",)
    search_fields = ("name_ru", "name_zh", "slug")
    prepopulated_fields = {"slug": ("name_ru",)}


class FactoryInline(StackedInline):
    model = FactorySettings
    can_delete = False


@admin.register(Supplier)
class SupplierAdmin(ModelAdmin):
    list_display = ("name", "name_zh", "code", "city", "wechat", "fact_days_min", "fact_days_max", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "name_zh", "code", "city", "wechat")
    inlines = [FactoryInline]
    actions = ["open_cabinet"]

    @admin.action(description=_("Открыть кабинет поставщика"))
    def open_cabinet(self, request, queryset):
        supplier = queryset.first()
        return redirect(f"/seller/?act={supplier.code}")


class PostImageInline(TabularInline):
    model = PostImage
    extra = 3
    max_num = 10


@admin.register(SupplierPost)
class SupplierPostAdmin(ModelAdmin):
    """Посты в ленту от имени поставщика: команда пишет текст для покупателей, прикладывает фото и публикует."""

    list_display = ("supplier", "product", "kind", "status", "author", "created_at")
    list_filter = ("status", "kind", "supplier")
    fields = ("supplier", "product", "kind", "text_ru", "text", "status")
    autocomplete_fields = ("product",)
    inlines = [PostImageInline]
    actions = ["publish", "reject"]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description=_("Опубликовать"))
    def publish(self, request, queryset):
        missing = queryset.filter(text_ru="").count()
        if missing:
            self.message_user(request, _("Сначала впишите текст для покупателей: %(n)s") % {"n": missing},
                              messages.WARNING)
            return
        n = queryset.update(status=SupplierPost.Status.PUBLISHED)
        self.message_user(request, _("Опубликовано: %(n)s") % {"n": n})

    @admin.action(description=_("Отклонить"))
    def reject(self, request, queryset):
        n = queryset.update(status=SupplierPost.Status.REJECTED)
        self.message_user(request, _("Отклонено: %(n)s") % {"n": n}, messages.WARNING)


class PriceTierInline(TabularInline):
    model = PriceTier
    extra = 1


class ProductImageInline(TabularInline):
    model = ProductImage
    extra = 1


@admin.register(Product)
class ProductAdmin(ModelAdmin):
    list_display = ("title_ru", "title_zh", "supplier", "category", "price_cny", "status")
    list_filter = ("status", "category", "supplier")
    search_fields = ("title_ru", "title_zh", "sku", "slug")
    inlines = [PriceTierInline, ProductImageInline]
    actions = ["publish", "reject"]
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
        return super().get_queryset(request).select_related("supplier", "category")

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
