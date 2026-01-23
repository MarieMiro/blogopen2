from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Profile, BrandProfile, BloggerProfile, Conversation, Message
from .auth import CsrfExemptSessionAuthentication
from django.db.models import Q, Count

from django.shortcuts import get_object_or_404
# ---------------- HELPERS ----------------

def ensure_profile_and_role_models(user: User, role_default="brand") -> Profile:
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={"role": role_default},
    )

    if not profile.role:
        profile.role = role_default
        profile.save()

    if profile.role == "brand":
        BrandProfile.objects.get_or_create(profile=profile)
    else:
        BloggerProfile.objects.get_or_create(profile=profile)

    return profile


def calc_blogger_progress(profile: Profile, bp: BloggerProfile) -> int:
    fields = [
        bool(get_avatar_url(profile)),
        bool((bp.nickname or "").strip()),
        bool((bp.platform or "").strip()),
        bool((bp.platform_url or "").strip()),
        bool(bp.followers),
        bool((bp.topic or "").strip()),
        bool((bp.formats or "").strip()),
        bool((bp.inn or "").strip()),
    ]
    filled = sum(fields)
    total = len(fields)
    return int(round((filled / total) * 100)) if total else 0


def get_avatar_url(p: Profile) -> str:
    """
    Возвращает URL аватарки:
    - если аватарка хранится в Postgres (avatar_blob) -> отдаём через /api/profiles/<id>/avatar/
    - иначе если ImageField -> отдаём p.avatar.url
    """
    if hasattr(p, "avatar_blob") and p.avatar_blob:
        return f"/api/profiles/{p.id}/avatar/"
    if getattr(p, "avatar", None):
        try:
            return p.avatar.url
        except Exception:
            return ""
    return ""


def save_avatar_to_profile(p: Profile, uploaded_file) -> None:
    """
    Сохраняем аватар:
    - если есть avatar_blob поля -> кладём в Postgres
    - иначе -> в ImageField
    """
    if not uploaded_file:
        return

    if hasattr(p, "avatar_blob"):
        p.avatar_blob = uploaded_file.read()
        p.avatar_mime = getattr(uploaded_file, "content_type", "") or "image/jpeg"
        p.avatar_name = getattr(uploaded_file, "name", "") or ""
        # если у тебя ещё остался ImageField avatar и он мешает — можно очистить:
        # p.avatar = None
        p.save()
    else:
        p.avatar = uploaded_file
        p.save()


# ---------------- AUTH ----------------

@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
def register(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    role = (request.data.get("role") or "brand").strip()

    if role not in ("brand", "blogger"):
        role = "brand"

    if not email or not password:
        return Response({"error": "email и password обязательны"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=email).exists():
        return Response({"error": "Пользователь уже существует"}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=email, email=email, password=password)

    profile = Profile.objects.create(user=user, role=role)
    if role == "brand":
        BrandProfile.objects.create(profile=profile)
    else:
        BloggerProfile.objects.create(profile=profile)

    login(request, user)

    return Response(
        {"ok": True, "user_id": user.id, "email": user.email, "role": role},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
def login_view(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response({"error": "Неверный email или пароль"}, status=status.HTTP_400_BAD_REQUEST)

    login(request, user)

    profile = ensure_profile_and_role_models(user, role_default="brand")
    return Response({"ok": True, "email": user.email, "role": profile.role})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
def logout_view(request):
    logout(request)
    return Response({"ok": True})


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    profile = ensure_profile_and_role_models(request.user, role_default="brand")
    return Response({"ok": True, "email": request.user.email, "role": profile.role})


# ---------------- BRAND PROFILE ----------------

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def brand_profile_get(request):
    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    bp, _ = BrandProfile.objects.get_or_create(profile=p)

    return Response({
        "role": p.role,
        "email": request.user.email,

        "city": p.city,
        "about": p.about,
        "avatar_url": get_avatar_url(p),

        "brand_name": bp.brand_name,
        "sphere": bp.sphere,
        "budget": bp.budget,
        "inn": bp.inn,
        "contact_person": bp.contact_person,
    })


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def brand_profile_update(request):
    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    bp, _ = BrandProfile.objects.get_or_create(profile=p)
    data = request.data

    # avatar
    avatar = request.FILES.get("avatar")
    if avatar:
        save_avatar_to_profile(p, avatar)

    # общие
    p.city = data.get("city", p.city)
    p.about = data.get("about", p.about)
    p.save()

    # брендовые
    bp.brand_name = data.get("brand_name", bp.brand_name)
    bp.sphere = data.get("sphere", bp.sphere)
    bp.budget = data.get("budget", bp.budget)
    bp.inn = data.get("inn", bp.inn)
    bp.contact_person = data.get("contact_person", bp.contact_person)
    bp.save()

    return Response({"ok": True, "avatar_url": get_avatar_url(p)})


# ---------------- BLOGGER PROFILE ----------------

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def blogger_profile_get(request):
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    bp, _ = BloggerProfile.objects.get_or_create(profile=p)
    progress = calc_blogger_progress(p, bp)

    return Response({
        "role": p.role,
        "email": request.user.email,
        "avatar_url": get_avatar_url(p),

        "nickname": bp.nickname,
        "platform": bp.platform,
        "platform_url": bp.platform_url,
        "followers": bp.followers,
        "topic": bp.topic,
        "formats": bp.formats,
        "inn": bp.inn,

        "progress": progress,
    })


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def blogger_profile_update(request):
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    bp, _ = BloggerProfile.objects.get_or_create(profile=p)
    data = request.data

    # ---------- АВАТАР (общий Profile.avatar) ----------
    avatar = request.FILES.get("avatar")
    if avatar:
        p.avatar = avatar
        p.save()

    # ---------- поля блогера ----------
    bp.nickname = data.get("nickname", bp.nickname)
    bp.platform = data.get("platform", bp.platform)
    bp.platform_url = data.get("platform_url", bp.platform_url)

    followers = data.get("followers", bp.followers)
    try:
        bp.followers = int(followers) if followers not in (None, "") else 0
    except (TypeError, ValueError):
        pass

    bp.topic = data.get("topic", bp.topic)
    bp.formats = data.get("formats", bp.formats)
    bp.inn = data.get("inn", bp.inn)
    bp.save()

    progress = calc_blogger_progress(p, bp)

    return Response({
        "ok": True,
        "avatar_url": p.avatar.url if p.avatar else "",
        "progress": progress,
    })


# =============== CHAT HELPERS + CHAT API ===============

from django.shortcuts import get_object_or_404
from django.db.models import Q

# ---------- CHAT HELPERS ----------

def other_party(me: Profile, conv: Conversation) -> Profile:
    return conv.blogger if me.role == "brand" else conv.brand


def display_name(p: Profile) -> str:
    """
    Как показывать имя в списке диалогов.
    """
    if p.role == "brand":
        bp = getattr(p, "brand", None)
        return (bp.brand_name if bp and bp.brand_name else "") or p.user.email
    else:
        bp = getattr(p, "blogger", None)
        return (bp.nickname if bp and bp.nickname else "") or p.user.email


def _supports_read_flags() -> bool:
    """
    True если в модели Message есть read_by_brand/read_by_blogger.
    Иначе считаем что есть только is_read.
    """
    return hasattr(Message, "read_by_brand") and hasattr(Message, "read_by_blogger")


def unread_count_for(me: Profile, conv: Conversation) -> int:
    """
    Сколько непрочитанных для текущей стороны.
    """
    qs = Message.objects.filter(conversation=conv).exclude(sender=me)

    if _supports_read_flags():
        if me.role == "brand":
            return qs.filter(read_by_brand=False).count()
        else:
            return qs.filter(read_by_blogger=False).count()

    # fallback: если есть только is_read
    if hasattr(Message, "is_read"):
        return qs.filter(is_read=False).count()

    return 0


def mark_read_for(me: Profile, conv: Conversation):
    """
    Помечает все входящие сообщения как прочитанные для текущей стороны.
    """
    qs = Message.objects.filter(conversation=conv).exclude(sender=me)

    if _supports_read_flags():
        if me.role == "brand":
            qs.update(read_by_brand=True)
        else:
            qs.update(read_by_blogger=True)
        return

    if hasattr(Message, "is_read"):
        qs.update(is_read=True)


# ---------- CHAT API ----------

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversations_list(request):
    me = ensure_profile_and_role_models(request.user, role_default="brand")

    qs = (
        Conversation.objects
        .filter(Q(brand=me) | Q(blogger=me))
        .select_related("brand__user", "blogger__user", "brand__brand", "blogger__blogger")
        .order_by("-updated_at")
    )

    results = []
    for c in qs:
        other = other_party(me, c)

        last_msg = c.messages.order_by("-created_at").first()
        last_text = last_msg.text if last_msg else ""
        last_at = last_msg.created_at if last_msg else None

        results.append({
            "id": c.id,
            "avatar_url": other.avatar.url if other.avatar else "",
            "title": display_name(other),
            "last_message": last_text,
            "last_message_at": last_at,
            "unread_count": unread_count_for(me, c),
        })

    return Response({"ok": True, "results": results})


@api_view(["GET", "POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conv_id: int):
    me = ensure_profile_and_role_models(request.user, role_default="brand")
    conv = get_object_or_404(Conversation, id=conv_id)

    if me.id not in (conv.brand_id, conv.blogger_id):
        return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    # POST = отправка (под твой фронт: POST .../messages/)
    if request.method == "POST":
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"error": "text is required"}, status=status.HTTP_400_BAD_REQUEST)

        create_kwargs = dict(
            conversation=conv,
            sender=me,
            text=text,
        )

        # если у тебя read_by_* поля — выставим корректно
        if _supports_read_flags():
            create_kwargs["read_by_brand"] = (me.role == "brand")
            create_kwargs["read_by_blogger"] = (me.role == "blogger")
        elif hasattr(Message, "is_read"):
            # отправитель “прочитал” своё сообщение
            create_kwargs["is_read"] = True

        msg = Message.objects.create(**create_kwargs)

        # чтобы диалог поднялся наверх
        conv.save()

        return Response({
            "ok": True,
            "message": {
                "id": msg.id,
                "text": msg.text,
                "created_at": msg.created_at,
                "sender_id": msg.sender_id,
                "is_mine": True,
            }
        }, status=status.HTTP_201_CREATED)

    # GET = список сообщений
    qs = conv.messages.select_related("sender__user").order_by("created_at")
    results = []
    for m in qs:
        results.append({
            "id": m.id,
            "text": m.text,
            "created_at": m.created_at,
            "sender_id": m.sender_id,
            "is_mine": (m.sender_id == me.id),
        })

    return Response({"ok": True, "results": results})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversation_mark_read(request, conv_id: int):
    me = ensure_profile_and_role_models(request.user, role_default="brand")
    conv = get_object_or_404(Conversation, id=conv_id)

    if me.id not in (conv.brand_id, conv.blogger_id):
        return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    mark_read_for(me, conv)
    return Response({"ok": True})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversation_with_profile(request, profile_id: int):
    """
    Создать/получить диалог с конкретным профилем.
    - бренд может открыть чат с блогером
    - блогер может открыть чат с брендом
    """
    me = ensure_profile_and_role_models(request.user, role_default="brand")
    other = get_object_or_404(Profile, id=profile_id)

    if me.role == other.role:
        return Response({"error": "Same role chat not allowed"}, status=status.HTTP_400_BAD_REQUEST)

    if me.role == "brand":
        brand, blogger = me, other
    else:
        brand, blogger = other, me

    conv, _ = Conversation.objects.get_or_create(brand=brand, blogger=blogger)
    return Response({"ok": True, "conversation_id": conv.id})


@api_view(["GET"])
@permission_classes([AllowAny])
def profile_avatar(request, profile_id):
    profile = get_object_or_404(Profile, id=profile_id)

    if not profile.avatar_blob:
        return HttpResponse(status=404)

    content_type = profile.avatar_mime or "image/jpeg"
    return HttpResponse(profile.avatar_blob, content_type=content_type)