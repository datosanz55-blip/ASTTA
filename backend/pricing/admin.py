from django.contrib import admin
from unfold.admin import ModelAdmin

from pricing.models import CommissionRule, ExchangeRate, PricingConfig, ShippingMethod


@admin.register(ExchangeRate)
class ExchangeRateAdmin(ModelAdmin):
    list_display = ("currency", "date", "rub_per_unit", "source", "fetched_at")
    list_filter = ("currency", "source")


@admin.register(ShippingMethod)
class ShippingMethodAdmin(ModelAdmin):
    list_display = ("name", "code", "rub_per_kg", "days_min", "days_max", "for_bulky_only", "is_default",
                    "is_active")
    list_editable = ("rub_per_kg", "days_min", "days_max", "is_active")


@admin.register(PricingConfig)
class PricingConfigAdmin(ModelAdmin):
    list_display = ("__str__", "retail_fee", "wholesale_fee", "rate_markup", "link_rate", "link_delivery_rub")

    def has_add_permission(self, request):
        return not PricingConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CommissionRule)
class CommissionRuleAdmin(ModelAdmin):
    """Свой сбор для поставщика или категории. Поставщик важнее категории, пустое поле — общий сбор."""

    list_display = ("__str__", "category", "supplier", "retail_fee", "wholesale_fee", "note")
    list_filter = ("category",)
    autocomplete_fields = ("category", "supplier")
    search_fields = ("category__name_ru", "supplier__name", "note")
