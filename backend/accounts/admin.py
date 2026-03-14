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

    list_filter = (
        "role",
        "verification_status",
    )

    search_fields = (
        "user__username",
        "user__email",
    )
admin.site.register(BrandProfile)
admin.site.register(BloggerProfile)