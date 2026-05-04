from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    ROLE_CHOICES = (
        ("brand", "brand"),
        ("blogger", "blogger"),
    )
    VERIFICATION_STATUS = (
        ("pending", "Не проверен"),
        ("approved", "Проверен"),
        ("rejected", "Не одобрен"),
    )
    GENDER_CHOICES = (
        ("", "—"),
        ("female", "female"),
        ("male", "male"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="brand")
    verification_status = models.CharField(
        max_length=10, choices=VERIFICATION_STATUS, default="pending"
    )

    # Старое поле — оставь пока есть данные, но не используй
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)

    # Новое: blob в Postgres (переименовано с avatar_bytes → avatar_blob)
    avatar_blob = models.BinaryField(blank=True, null=True)
    avatar_mime = models.CharField(max_length=100, blank=True, default="")
    avatar_name = models.CharField(max_length=255, blank=True, default="")

    city = models.CharField(max_length=120, blank=True, default="")
    about = models.TextField(blank=True, default="")
    gender = models.CharField(
        max_length=10, choices=GENDER_CHOICES, blank=True, default=""
    )

    def __str__(self):
        return f"{self.user.email} ({self.role})"


class BrandProfile(models.Model):
    profile = models.OneToOneField(
        Profile, on_delete=models.CASCADE, related_name="brand"
    )
    brand_name = models.CharField(max_length=200, blank=True, default="")
    sphere = models.CharField(max_length=120, blank=True, default="")
    budget = models.CharField(max_length=120, blank=True, default="")
    inn = models.CharField(max_length=20, blank=True, default="")
    contact_person = models.CharField(max_length=200, blank=True, default="")
    topics = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"BrandProfile: {self.profile.user.email}"


class BloggerProfile(models.Model):
    profile = models.OneToOneField(
        Profile, on_delete=models.CASCADE, related_name="blogger"
    )
    nickname = models.CharField(max_length=80, blank=True, default="")
    platform = models.CharField(max_length=50, blank=True, default="")
    platform_url = models.URLField(blank=True, default="")
    followers = models.PositiveIntegerField(default=0)
    topic = models.CharField(max_length=200, blank=True, default="")
    formats = models.CharField(max_length=200, blank=True, default="")
    topics = models.JSONField(default=list, blank=True)
    inn = models.CharField(max_length=20, blank=True, default="")

    def __str__(self):
        return f"BloggerProfile: {self.profile.user.email}"


class Conversation(models.Model):
    brand = models.ForeignKey(
        Profile, on_delete=models.CASCADE,
        related_name="brand_conversations",
        limit_choices_to={"role": "brand"},
    )
    blogger = models.ForeignKey(
        Profile, on_delete=models.CASCADE,
        related_name="blogger_conversations",
        limit_choices_to={"role": "blogger"},
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "blogger"],
                name="uniq_brand_blogger_conversation"
            )
        ]
        indexes = [
            models.Index(fields=["updated_at"]),
            models.Index(fields=["brand", "blogger"]),
        ]

    def __str__(self):
        return f"Conversation {self.id}: {self.brand_id} <-> {self.blogger_id}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        Profile, on_delete=models.CASCADE, related_name="sent_messages"
    )
    # Ограничение длины и на уровне БД
    text = models.TextField(max_length=5000)
    created_at = models.DateTimeField(auto_now_add=True)
    read_by_brand = models.BooleanField(default=False)
    read_by_blogger = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"Msg {self.id} conv={self.conversation_id}"