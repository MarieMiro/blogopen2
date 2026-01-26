from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.http import HttpResponse

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from django.db.models import Q
from django.shortcuts import get_object_or_404

from .models import Profile, BrandProfile, BloggerProfile, Conversation, Message
from .auth import CsrfExemptSessionAuthentication


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


def get_avatar_url(request, p: Profile) -> str:
    """
    Возвращает ABSOLUTE URL аватарки (чтобы фронт не пытался грузить /media с домена фронта).
    Поддержка двух вариантов:
    1) avatar_blob в Postgres -> /api/profiles/<id>/avatar/
    2) ImageField avatar -> /media/...
    """
    if hasattr(p, "avatar_blob") and p.avatar_blob:
        return request.build_absolute_uri(f"/api/profiles/{p.id}/avatar/")

    avatar_field = getattr(p, "avatar", None)
    if avatar_field:
        try:
            return request.build_absolute_uri(avatar_field.url)
        except Exception:
            return ""

    return ""


def save_avatar_to_profile(p: Profile, uploaded_file) -> None:
    """
    Если есть avatar_blob -> кладём байты в Postgres.
    Иначе -> сохраняем в ImageField (как сейчас у тебя).
    """
    if not uploaded_file:
        return

    if hasattr(p, "avatar_blob"):
        p.avatar_blob = uploaded_file.read()
        p.avatar_mime = getattr(uploaded_file, "content_type", "") or "image/jpeg"
        p.avatar_name = getattr(uploaded_file, "name", "") or ""
        p.save()
    else:
        p.avatar = uploaded_file
        p.save()


def calc_blogger_progress(profile: Profile, bp: BloggerProfile, request=None) -> int:
    avatar_ok = bool(get_avatar_url(request, profile)) if request else bool(profile.avatar)

    fields = [
        avatar_ok,
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

    # авто-логин чтобы сессия сразу появилась
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
        "avatar_url": get_avatar_url(request, p),

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

    # avatar (общий)
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

    return Response({
        "ok": True,
        "avatar_url": get_avatar_url(request, p),
    })


# ---------------- BLOGGER PROFILE ----------------

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def blogger_profile_get(request):
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    bp, _ = BloggerProfile.objects.get_or_create(profile=p)
    progress = calc_blogger_progress(p, bp, request=request)

    return Response({
        "role": p.role,
        "email": request.user.email,

        "avatar_url": get_avatar_url(request, p),

        "nickname": bp.nickname,
        "platform": bp.platform,
        "platform_url": bp.platform_url,
        "followers": bp.followers,
        "topic": bp.topic,
        "formats": bp.formats,
        "inn": bp.inn,

        "topics": bp.topics or [],
        "progress": progress,
    })


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def blogger_profile_update(request):
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response(
            {"error": "Not a blogger"}, 
            status=status.HTTP_403_FORBIDDEN
            )

    bp, _ = BloggerProfile.objects.get_or_create(profile=p)
    data = request.data

    topics = data.get("topics")
    if isinstance(topics, str):
        # если фронт вдруг прислал строку JSON
        try:
            import json
            topics = json.loads(topics)
        except Exception:
            topics = None

    if isinstance(topics, list):
        bp.topics = topics

    avatar = request.FILES.get("avatar")
    if avatar:
        save_avatar_to_profile(p, avatar)

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

    progress = calc_blogger_progress(p, bp, request=request)

    return Response({
        "ok": True,
        "avatar_url": get_avatar_url(request, p),
        "progress": progress,
        "topics": bp.topics or [],
    })


# ---------------- LISTS / PUBLIC PROFILES ----------------

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def bloggers_list(request):
    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    city = (request.GET.get("city") or "").strip()
    platform = (request.GET.get("platform") or "").strip()
    topic = (request.GET.get("topic") or "").strip()
    followers_min = (request.GET.get("followers_min") or "").strip()
    followers_max = (request.GET.get("followers_max") or "").strip()

    qs = Profile.objects.filter(role="blogger").select_related("user", "blogger")

    if city:
        qs = qs.filter(city__iexact=city)
    if platform:
        qs = qs.filter(blogger__platform__iexact=platform)
    if topic:
        qs = qs.filter(blogger__topic__icontains=topic)

    try:
        if followers_min != "":
            qs = qs.filter(blogger__followers__gte=int(followers_min))
    except ValueError:
        pass

    try:
        if followers_max != "":
            qs = qs.filter(blogger__followers__lte=int(followers_max))
    except ValueError:
        pass

    qs = qs.order_by("id")

    items = []
    for prof in qs:
        bp = getattr(prof, "blogger", None)
        items.append({
            "id": prof.id,
            "avatar_url": prof.avatar.url if prof.avatar else "",
            "city": prof.city,

            "nickname": getattr(bp, "nickname", "") if bp else "",
            "platform": getattr(bp, "platform", "") if bp else "",
            "platform_url": getattr(bp, "platform_url", "") if bp else "",
            "followers": getattr(bp, "followers", 0) if bp else 0,
            "topic": getattr(bp, "topic", "") if bp else "",
            "formats": getattr(bp, "formats", "") if bp else "",
        })

    return Response({"ok": True, "results": items})


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def brands_list(request):
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    qs = Profile.objects.filter(role="brand").select_related("user", "brand").order_by("id")

    items = []
    for prof in qs:
        bp = getattr(prof, "brand", None)
        items.append({
            "id": prof.id,
            "email": prof.user.email,
            "avatar_url": prof.avatar.url if prof.avatar else "",

            "brand_name": getattr(bp, "brand_name", "") if bp else "",
            "sphere": getattr(bp, "sphere", "") if bp else "",
            "budget": getattr(bp, "budget", "") if bp else "",

            "city": prof.city,
            "about": prof.about,
        })

    return Response({"ok": True, "results": items})


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def blogger_public(request, profile_id: int):
    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    qs = Profile.objects.select_related("user", "blogger").filter(role="blogger")
    prof = qs.filter(id=profile_id).first()
    if prof is None:
        prof = get_object_or_404(qs, user__id=profile_id)

    bp = getattr(prof, "blogger", None)

    return Response({
        "ok": True,
        "id": prof.id,
        "avatar_url": prof.avatar.url if prof.avatar else "",
        "city": prof.city,

        "nickname": getattr(bp, "nickname", "") if bp else "",
        "platform": getattr(bp, "platform", "") if bp else "",
        "platform_url": getattr(bp, "platform_url", "") if bp else "",
        "followers": getattr(bp, "followers", 0) if bp else 0,
        "topic": getattr(bp, "topic", "") if bp else "",
        "formats": getattr(bp, "formats", "") if bp else "",
    })


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def brand_public(request, profile_id: int):
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    prof = get_object_or_404(
        Profile.objects.select_related("user", "brand"),
        id=profile_id,
        role="brand",
    )

    bp = getattr(prof, "brand", None)

    return Response({
        "ok": True,
        "id": prof.id,
        "avatar_url": prof.avatar.url if prof.avatar else "",
        "city": prof.city,
        "about": prof.about,

        "brand_name": getattr(bp, "brand_name", "") if bp else "",
        "sphere": getattr(bp, "sphere", "") if bp else "",
        "budget": getattr(bp, "budget", "") if bp else "",
        "contact_person": getattr(bp, "contact_person", "") if bp else "",
    })


# ---------------- CHAT ----------------

def other_party(me: Profile, conv: Conversation) -> Profile:
    return conv.blogger if me.role == "brand" else conv.brand


def display_name(p: Profile) -> str:
    if p.role == "brand":
        bp = getattr(p, "brand", None)
        return (bp.brand_name if bp and bp.brand_name else "") or p.user.email
    bp = getattr(p, "blogger", None)
    return (bp.nickname if bp and bp.nickname else "") or p.user.email


def _supports_read_flags() -> bool:
    return hasattr(Message, "read_by_brand") and hasattr(Message, "read_by_blogger")


def unread_count_for(me: Profile, conv: Conversation) -> int:
    qs = Message.objects.filter(conversation=conv).exclude(sender=me)

    if _supports_read_flags():
        if me.role == "brand":
            return qs.filter(read_by_brand=False).count()
        return qs.filter(read_by_blogger=False).count()

    if hasattr(Message, "is_read"):
        return qs.filter(is_read=False).count()

    return 0


def mark_read_for(me: Profile, conv: Conversation):
    qs = Message.objects.filter(conversation=conv).exclude(sender=me)

    if _supports_read_flags():
        if me.role == "brand":
            qs.update(read_by_brand=True)
        else:
            qs.update(read_by_blogger=True)
        return

    if hasattr(Message, "is_read"):
        qs.update(is_read=True)


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversations_list(request):
    me_prof = ensure_profile_and_role_models(request.user, role_default="brand")

    qs = (
        Conversation.objects
        .filter(Q(brand=me_prof) | Q(blogger=me_prof))
        .select_related("brand__user", "blogger__user", "brand__brand", "blogger__blogger")
        .order_by("-updated_at")
    )

    results = []
    for c in qs:
        other = other_party(me_prof, c)
        last_msg = c.messages.order_by("-created_at").first()
        last_text = last_msg.text if last_msg else ""
        last_at = last_msg.created_at if last_msg else None

        results.append({
            "id": c.id,
            "avatar_url": get_avatar_url(request, other),
            "title": display_name(other),
            "last_message": last_text,
            "last_message_at": last_at,
            "unread_count": unread_count_for(me_prof, c),
        })

    return Response({"ok": True, "results": results})


@api_view(["GET", "POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conv_id: int):
    me_prof = ensure_profile_and_role_models(request.user, role_default="brand")
    conv = get_object_or_404(Conversation, id=conv_id)

    if me_prof.id not in (conv.brand_id, conv.blogger_id):
        return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "POST":
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"error": "text is required"}, status=status.HTTP_400_BAD_REQUEST)

        create_kwargs = {
            "conversation": conv,
            "sender": me_prof,
            "text": text,
        }

        if _supports_read_flags():
            create_kwargs["read_by_brand"] = (me_prof.role == "brand")
            create_kwargs["read_by_blogger"] = (me_prof.role == "blogger")
        elif hasattr(Message, "is_read"):
            create_kwargs["is_read"] = True

        msg = Message.objects.create(**create_kwargs)
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

    qs = conv.messages.select_related("sender__user").order_by("created_at")
    results = []
    for m in qs:
        results.append({
            "id": m.id,
            "text": m.text,
            "created_at": m.created_at,
            "sender_id": m.sender_id,
            "is_mine": (m.sender_id == me_prof.id),
        })

    return Response({"ok": True, "results": results})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversation_mark_read(request, conv_id: int):
    me_prof = ensure_profile_and_role_models(request.user, role_default="brand")
    conv = get_object_or_404(Conversation, id=conv_id)

    if me_prof.id not in (conv.brand_id, conv.blogger_id):
        return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    mark_read_for(me_prof, conv)
    return Response({"ok": True})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversation_with_profile(request, profile_id: int):
    me_prof = ensure_profile_and_role_models(request.user, role_default="brand")
    other = get_object_or_404(Profile, id=profile_id)

    if me_prof.role == other.role:
        return Response({"error": "Same role chat not allowed"}, status=status.HTTP_400_BAD_REQUEST)

    if me_prof.role == "brand":
        brand, blogger = me_prof, other
    else:
        brand, blogger = other, me_prof

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