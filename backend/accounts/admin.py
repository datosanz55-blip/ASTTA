from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin

from accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ("username", "role", "supplier", "phone", "language", "is_active")
    list_filter = ("role", "language", "is_active")
    search_fields = ("username", "phone", "email")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("ASTTA", {"fields": ("role", "supplier", "phone", "telegram_id", "language")}),
    )
