from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin

from accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ("username", "role", "telegram_username", "phone", "is_staff", "is_active")
    list_filter = ("role", "language", "is_active")
    search_fields = ("username", "phone", "email", "telegram_username", "telegram_id")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("ASTTA", {"fields": ("role", "phone", "telegram_id", "telegram_username", "telegram_photo_url")}),
    )
