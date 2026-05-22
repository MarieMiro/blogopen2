from django.contrib import admin
from .models import Profile, BrandProfile, BloggerProfile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "verification_status",
        "city",
    )

    # Можно менять статус прямо в списке не заходя в профиль
    list_editable = ("verification_status",)

    # Чтобы list_editable работал — ссылка должна быть не на первое поле
    list_display_links = ("user",)

    list_filter = (
        "role",
        "verification_status",
    )

    search_fields = (
        "user__username",
        "user__email",
    )

    # Массовые действия — выделяешь несколько и меняешь статус сразу
    actions = ["approve_selected", "reject_selected", "set_pending"]

    @admin.action(description="✅ Одобрить выбранных")
    def approve_selected(self, request, queryset):
        queryset.update(verification_status="approved")

    @admin.action(description="❌ Отклонить выбранных")
    def reject_selected(self, request, queryset):
        queryset.update(verification_status="rejected")

    @admin.action(description="⏳ Поставить на ожидание")
    def set_pending(self, request, queryset):
        queryset.update(verification_status="pending")


@admin.register(BrandProfile)
class BrandProfileAdmin(admin.ModelAdmin):
    list_display = ("profile", "brand_name", "sphere", "inn")
    search_fields = ("brand_name", "profile__user__email")


@admin.register(BloggerProfile)
class BloggerProfileAdmin(admin.ModelAdmin):
    list_display = ("profile", "nickname", "platform", "followers")
    search_fields = ("nickname", "profile__user__email")