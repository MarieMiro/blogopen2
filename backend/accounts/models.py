from django.db import models
from django.contrib.auth.models import User


# =============== PROFILES ===============

class Profile(models.Model):
    ROLE_CHOICES = (
        ("brand", "brand"),
        ("blogger", "blogger"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="brand")

    # старое (можно оставить, но больше не использовать на проде)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    # ✅ новое: храним в Postgres
    avatar_bytes = models.BinaryField(blank=True, null=True)
    avatar_mime = models.CharField(max_length=100, blank=True, default="")  # image/jpeg
    avatar_name = models.CharField(max_length=255, blank=True, default="")  # original name

    city = models.CharField(max_length=120, blank=True, default="")
    about = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.user.email} ({self.role})"


class BrandProfile(models.Model):
    profile = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name="brand")

    brand_name = models.CharField(max_length=200, blank=True, default="")
    sphere = models.CharField(max_length=120, blank=True, default="")
    budget = models.CharField(max_length=120, blank=True, default="")
    inn = models.CharField(max_length=20, blank=True, default="")
    contact_person = models.CharField(max_length=200, blank=True, default="")
    topics = models.JSONField(default=list, blank=True)
    def __str__(self):
        return f"BrandProfile: {self.profile.user.email}"


class BloggerProfile(models.Model):
    profile = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name="blogger")

    # публично
    nickname = models.CharField(max_length=80, blank=True, default="")
    platform = models.CharField(max_length=50, blank=True, default="")  # telegram/tiktok/youtube...
    platform_url = models.URLField(blank=True, default="")
    followers = models.PositiveIntegerField(default=0)
    topic = models.CharField(max_length=200, blank=True, default="")
    formats = models.CharField(max_length=200, blank=True, default="")

    topics = models.JSONField(default=list, blank=True)

    
    # для платформы
    inn = models.CharField(max_length=20, blank=True, default="")

    def __str__(self):
        return f"BloggerProfile: {self.profile.user.email}"


# =============== CHAT ===============

class Conversation(models.Model):
    """
    Диалог строго между BRAND Profile и BLOGGER Profile (1:1).
    """
    brand = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="brand_conversations",
        limit_choices_to={"role": "brand"},
    )
    blogger = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="blogger_conversations",
        limit_choices_to={"role": "blogger"},
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["brand", "blogger"], name="uniq_brand_blogger_conversation")
        ]
        indexes = [
            models.Index(fields=["updated_at"]),
            models.Index(fields=["brand", "blogger"]),
        ]

    def __str__(self):
        return f"Conversation {self.id}: {self.brand_id} <-> {self.blogger_id}"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="sent_messages")

    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    # отметка прочтения отдельно для каждой стороны
    read_by_brand = models.BooleanField(default=False)
    read_by_blogger = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"Msg {self.id} conv={self.conversation_id}"


