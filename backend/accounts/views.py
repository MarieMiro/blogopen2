from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Profile, BrandProfile, BloggerProfile, Conversation, Message
from .auth import CsrfExemptSessionAuthentication
from django.db.models import Q, Count

from django.shortcuts import get_object_or_404
# ---------------- HELPERS ----------------

def ensure_profile_and_role_models(user: User, role_default="brand"):
    """
    Гарантирует, что:
    - есть Profile у пользователя
    - есть role
    - создан BrandProfile или BloggerProfile в зависимости от role
    """
    profile, created = Profile.objects.get_or_create(
        user=user,
        defaults={"role": role_default},
    )

    # если вдруг role пустой — подстрахуемся
    if not profile.role:
        profile.role = role_default
        profile.save()

    if profile.role == "brand":
        BrandProfile.objects.get_or_create(profile=profile)
    else:
        BloggerProfile.objects.get_or_create(profile=profile)

    return profile


def calc_blogger_progress(profile: Profile, bp: BloggerProfile) -> int:
    """
    Примерная оценка заполненности профиля блогера.
    Можно менять веса как захочешь.
    """
    fields = [
        bool(profile.avatar),
        bool(bp.nickname.strip()),
        bool(bp.platform.strip()),
        bool(bp.platform_url.strip()),
        bool(bp.followers),
        bool(bp.topic.strip()),
        bool(bp.formats.strip()),
        bool(bp.inn.strip()),
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

    # создаём общий профиль + расширение по роли
    profile = Profile.objects.create(user=user, role=role)
    if role == "brand":
        BrandProfile.objects.create(profile=profile)
    else:
        BloggerProfile.objects.create(profile=profile)

    # ✅ АВТО-ЛОГИН после регистрации (создаёт session cookie)
    login(request, user)

    return Response(
        {"ok": True, "user_id": user.id, "email": user.email, "role": role},
        status=status.HTTP_201_CREATED
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
        "avatar_url": p.avatar.url if p.avatar else "",

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

    # общие
    p.city = data.get("city", p.city)
    p.about = data.get("about", p.about)

    avatar = request.FILES.get("avatar")
    if avatar:
        p.avatar = avatar
    p.save()

    # брендовые
    bp.brand_name = data.get("brand_name", bp.brand_name)
    bp.sphere = data.get("sphere", bp.sphere)
    bp.budget = data.get("budget", bp.budget)
    bp.inn = data.get("inn", bp.inn)
    bp.contact_person = data.get("contact_person", bp.contact_person)
    bp.save()

    return Response({"ok": True, "avatar_url": p.avatar.url if p.avatar else ""})


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

        "avatar_url": p.avatar.url if p.avatar else "",

        # публично
        "nickname": bp.nickname,
        "platform": bp.platform,
        "platform_url": bp.platform_url,
        "followers": bp.followers,
        "topic": bp.topic,
        "formats": bp.formats,

        # для платформы
        "inn": bp.inn,

        # прогресс
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

    # аватар общий
    avatar = request.FILES.get("avatar")
    if avatar:
        p.avatar = avatar
        p.save()

    # поля блогера
    bp.nickname = data.get("nickname", bp.nickname)
    bp.platform = data.get("platform", bp.platform)
    bp.platform_url = data.get("platform_url", bp.platform_url)

    followers = data.get("followers", bp.followers)
    try:
        bp.followers = int(followers) if followers not in (None, "") else 0
    except:
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


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def bloggers_list(request):
    # доступ только бренду
    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    # --- query params ---
    city = (request.GET.get("city") or "").strip()
    platform = (request.GET.get("platform") or "").strip()
    topic = (request.GET.get("topic") or "").strip()
    followers_min = (request.GET.get("followers_min") or "").strip()
    followers_max = (request.GET.get("followers_max") or "").strip()

    qs = Profile.objects.filter(role="blogger").select_related("user", "blogger")

    # city (в Profile)
    if city:
        qs = qs.filter(city__iexact=city)

    # platform/topic/followers (в BloggerProfile)
    if platform:
        qs = qs.filter(blogger__platform__iexact=platform)

    if topic:
        # поиск по вхождению (можно заменить на exact если надо)
        qs = qs.filter(blogger__topic__icontains=topic)

    # followers range
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

    qs = qs.order_by("id")  # без “релевантности”, стабильно

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
    # доступ только блогеру
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    qs = Profile.objects.filter(role="brand").select_related("user", "brand").order_by("id")

    items = []
    for prof in qs:
        bp = getattr(prof, "brand", None)  # BrandProfile
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
    # доступ только бренду
    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    qs = Profile.objects.select_related("user", "blogger").filter(role="blogger")

    # 1) пробуем как Profile.id
    prof = qs.filter(id=profile_id).first()

    # 2) если не нашли — пробуем как User.id
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
    # доступ только блогеру
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

            # чтобы совпало с фронтом:
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