from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin

from accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ("username", "nickname", "role", "telegram_username", "phone", "is_staff", "is_active")
    list_filter = ("role", "language", "is_active")
    search_fields = ("username", "nickname", "email_identity__email", "phone", "email",
                     "telegram_username", "telegram_id")
    readonly_fields = ("pd_consent_at", "verified_email", "nickname")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("ASTTA", {"fields": ("role", "nickname", "phone", "telegram_id", "telegram_username", "telegram_photo_url",
                              "pd_consent_at", "verified_email")}),
    )

    @admin.display(description="Подтверждённая почта для входа")
    def verified_email(self, obj):
        identity = getattr(obj, "email_identity", None)
        return identity.email if identity else "Не привязана"
