from pathlib import Path
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

import json
import re
import ipaddress
import logging
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ============================================================
# КОНСТАНТЫ
# ============================================================

MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_AVATAR_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MIN_PASSWORD_LENGTH = 8

ALLOWED_MARKETPLACE_DOMAINS = [
    "wildberries.ru",
    "wb.ru",
    "ozon.ru",
    "market.yandex.ru",
    "yandex.ru",
]

# ============================================================
# ВАЛИДАТОРЫ
# ============================================================

def validate_avatar(f) -> str | None:
    """Возвращает текст ошибки или None если файл валиден."""
    if f.size > MAX_AVATAR_SIZE:
        return "Файл слишком большой (максимум 5 МБ)"
    content_type = getattr(f, "content_type", "") or ""
    if content_type not in ALLOWED_AVATAR_MIME:
        return f"Недопустимый тип файла. Разрешены: JPEG, PNG, WebP, GIF"
    return None


def validate_marketplace_url(url: str) -> bool:
    """
    Разрешает только HTTPS ссылки на известные маркетплейсы.
    Блокирует SSRF: локальные IP, file://, внутренние хосты.
    """
    try:
        parsed = urlparse(url)

        # Только HTTPS
        if parsed.scheme != "https":
            return False

        host = parsed.netloc.lower().split(":")[0]
        if not host:
            return False

        # Блокируем IP-адреса (в т.ч. 169.254.x.x — AWS metadata)
        try:
            ip = ipaddress.ip_address(host)
            return False  # любой IP запрещён
        except ValueError:
            pass  # не IP — проверяем домен дальше

        # Только разрешённые домены
        return any(
            host == d or host.endswith("." + d)
            for d in ALLOWED_MARKETPLACE_DOMAINS
        )

    except Exception:
        return False


def validate_password(password: str) -> str | None:
    """Возвращает текст ошибки или None."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Пароль должен содержать минимум {MIN_PASSWORD_LENGTH} символов"
    return None


# ============================================================
# HELPERS
# ============================================================

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
    """Возвращает абсолютный URL аватарки."""
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


# ============================================================
# ПАРСИНГ МАРКЕТПЛЕЙСОВ (только requests, без Selenium в запросе)
# ============================================================

def parse_wildberries(url: str) -> dict | None:
    """Парсит карточку WB через официальный API."""
    match = re.search(r"/catalog/(\d+)/", url)
    if not match:
        return None

    nm_id = match.group(1)
    api_url = f"https://card.wb.ru/cards/detail?nm={nm_id}"

    try:
        resp = requests.get(
            api_url,
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.Timeout:
        logger.warning("WB API timeout for nm=%s", nm_id)
        return None
    except Exception as e:
        logger.warning("WB API error: %s", e)
        return None

    try:
        products = data.get("data", {}).get("products", [])
        if not products:
            return None

        product = products[0]
        price_raw = product.get("salePriceU") or product.get("priceU") or 0

        return {
            "title": product.get("name") or "",
            "brand": product.get("brand") or "",
            "price": price_raw / 100 if price_raw else None,
            "description": "",
        }
    except Exception as e:
        logger.warning("WB parse error: %s", e)
        return None


def parse_ozon(url: str) -> dict | None:
    """Простой парсинг страницы Ozon через requests+BeautifulSoup."""
    try:
        resp = requests.get(
            url,
            timeout=10,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
            },
        )
        resp.raise_for_status()
    except requests.Timeout:
        logger.warning("Ozon timeout: %s", url)
        return None
    except Exception as e:
        logger.warning("Ozon fetch error: %s", e)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    title = ""
    tag = soup.find("h1")
    if tag:
        title = tag.get_text(strip=True)

    return {
        "title": title,
        "brand": "",
        "price": None,
        "description": "",
    }


def detect_marketplace(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "wildberries" in host or "wb.ru" in host:
        return "wildberries"
    if "ozon" in host:
        return "ozon"
    if "market.yandex" in host or "yandex" in host:
        return "yandex_market"
    return "unknown"


def detect_category_from_text(text: str) -> str:
    t = (text or "").lower()
    mapping = {
        "beauty": ["крем", "сыворот", "шампун", "маска", "космет", "уход", "лицо", "волос", "гель"],
        "food": ["чай", "кофе", "шоколад", "батончик", "еда", "напиток", "снек", "печенье"],
        "clothes": ["платье", "футболка", "куртка", "джинсы", "юбка", "одежда", "костюм"],
        "tech": ["наушники", "смартфон", "ноутбук", "колонка", "техника", "кабель", "зарядка"],
        "education": ["курс", "обучение", "школа", "урок", "образование"],
        "services": ["услуга", "сервис", "доставка", "консультация"],
    }
    for category, words in mapping.items():
        if any(word in t for word in words):
            return category
    return "services"


# ============================================================
# AUTH
# ============================================================

@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def register(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    role = (request.data.get("role") or "brand").strip()

    # --- валидация ---
    if not email or not password:
        return Response(
            {"error": "email и password обязательны"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # простая проверка формата email
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return Response(
            {"error": "Некорректный email"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pwd_err = validate_password(password)
    if pwd_err:
        return Response({"error": pwd_err}, status=status.HTTP_400_BAD_REQUEST)

    if role not in ("brand", "blogger"):
        role = "brand"

    if User.objects.filter(username=email).exists():
        return Response(
            {"error": "Пользователь уже существует"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(username=email, email=email, password=password)

    profile = user.profile
    profile.role = role
    profile.save()

    if role == "brand":
        BrandProfile.objects.get_or_create(profile=profile)
    else:
        BloggerProfile.objects.get_or_create(profile=profile)

    login(request, user)

    return Response(
        {
            "ok": True,
            "user_id": user.id,
            "email": user.email,
            "role": role,
            "verification_status": profile.verification_status,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def login_view(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""

    if not email or not password:
        return Response(
            {"error": "email и password обязательны"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=email, password=password)
    if user is None:
        # Одинаковое сообщение — не раскрываем, что именно неверно
        return Response(
            {"error": "Неверный email или пароль"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    login(request, user)
    profile = ensure_profile_and_role_models(user, role_default="brand")

    return Response({
        "ok": True,
        "email": user.email,
        "role": profile.role,
        "verification_status": profile.verification_status,
    })


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"ok": True})


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    profile = ensure_profile_and_role_models(request.user, role_default="brand")
    return Response({
        "ok": True,
        "email": request.user.email,
        "role": profile.role,
        "verification_status": profile.verification_status,
    })


# ============================================================
# BRAND PROFILE
# ============================================================

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
        "topics": bp.topics or [],
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

    # --- topics ---
    topics = data.get("topics")
    if isinstance(topics, str):
        try:
            topics = json.loads(topics)
        except Exception:
            topics = None
    if isinstance(topics, list):
        bp.topics = topics

    # --- avatar с валидацией ---
    avatar = request.FILES.get("avatar")
    if avatar:
        err = validate_avatar(avatar)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
        save_avatar_to_profile(p, avatar)

    # --- поля Profile ---
    p.city = (data.get("city") or p.city or "")
    p.about = (data.get("about") or p.about or "")
    p.save()

    # --- поля BrandProfile ---
    bp.brand_name = data.get("brand_name", bp.brand_name)
    bp.budget = data.get("budget", bp.budget)
    bp.inn = data.get("inn", bp.inn)
    bp.contact_person = data.get("contact_person", bp.contact_person)
    bp.save()

    return Response({
        "ok": True,
        "avatar_url": get_avatar_url(request, p),
        "topics": bp.topics or [],
    })


# ============================================================
# BLOGGER PROFILE
# ============================================================

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
        "city": p.city,
        "gender": p.gender,
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
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    bp, _ = BloggerProfile.objects.get_or_create(profile=p)
    data = request.data

    # --- topics ---
    topics = data.get("topics")
    if isinstance(topics, str):
        try:
            topics = json.loads(topics)
        except Exception:
            topics = None
    if isinstance(topics, list):
        bp.topics = topics

    # --- avatar с валидацией ---
    avatar = request.FILES.get("avatar")
    if avatar:
        err = validate_avatar(avatar)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
        save_avatar_to_profile(p, avatar)

    # --- поля Profile ---
    p.gender = data.get("gender", p.gender) or ""
    p.city = data.get("city", p.city) or ""
    p.save()

    # --- поля BloggerProfile ---
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


# ============================================================
# LISTS / PUBLIC PROFILES
# ============================================================

@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def bloggers_list(request):
    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    mode = (request.GET.get("mode") or "").strip()
    city = (request.GET.get("city") or "").strip()
    platform = (request.GET.get("platform") or "").strip()
    topic = (request.GET.get("topic") or "").strip()
    followers_min = (request.GET.get("followers_min") or "").strip()
    followers_max = (request.GET.get("followers_max") or "").strip()

    qs = Profile.objects.filter(role="blogger").select_related("user", "blogger")

    brand_bp, _ = BrandProfile.objects.get_or_create(profile=p)
    brand_topics = brand_bp.topics or []

    if mode != "all" and brand_topics:
        topic_q = Q()
        for t in brand_topics:
            if t:
                topic_q |= Q(blogger__topics__contains=[t])
        if topic_q:
            qs = qs.filter(topic_q)

    if city:
        qs = qs.filter(city__iexact=city)
    if platform:
        qs = qs.filter(blogger__platform__iexact=platform)
    if topic:
        qs = qs.filter(blogger__topic__icontains=topic)

    try:
        if followers_min:
            qs = qs.filter(blogger__followers__gte=int(followers_min))
    except ValueError:
        pass

    try:
        if followers_max:
            qs = qs.filter(blogger__followers__lte=int(followers_max))
    except ValueError:
        pass

    qs = qs.order_by("id")

    items = []
    for prof in qs:
        bp = getattr(prof, "blogger", None)
        items.append({
            "id": prof.id,
            # ИСПРАВЛЕНО: используем get_avatar_url везде, не prof.avatar.url напрямую
            "avatar_url": get_avatar_url(request, prof),
            "city": prof.city,
            "verification_status": prof.verification_status,
            "nickname": getattr(bp, "nickname", "") if bp else "",
            "platform": getattr(bp, "platform", "") if bp else "",
            "platform_url": getattr(bp, "platform_url", "") if bp else "",
            "followers": getattr(bp, "followers", 0) if bp else 0,
            "topic": getattr(bp, "topic", "") if bp else "",
            "formats": getattr(bp, "formats", "") if bp else "",
            "topics": getattr(bp, "topics", []) if bp else [],
        })

    return Response({"ok": True, "results": items})


@api_view(["GET"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def brands_list(request):
    p = ensure_profile_and_role_models(request.user, role_default="blogger")
    if p.role != "blogger":
        return Response({"error": "Not a blogger"}, status=status.HTTP_403_FORBIDDEN)

    mode = (request.GET.get("mode") or "").strip()

    qs = Profile.objects.filter(role="brand").select_related("user", "brand")

    blogger_bp, _ = BloggerProfile.objects.get_or_create(profile=p)
    blogger_topics = blogger_bp.topics or []

    if mode != "all" and blogger_topics:
        topic_q = Q()
        for t in blogger_topics:
            if t:
                topic_q |= Q(brand__topics__contains=[t])
        qs = qs.filter(topic_q)

    qs = qs.order_by("id")

    items = []
    for prof in qs:
        bp = getattr(prof, "brand", None)
        items.append({
            "id": prof.id,
            "email": prof.user.email,
            "avatar_url": get_avatar_url(request, prof),
            "verification_status": prof.verification_status,
            "brand_name": getattr(bp, "brand_name", "") if bp else "",
            "sphere": getattr(bp, "sphere", "") if bp else "",
            "budget": getattr(bp, "budget", "") if bp else "",
            "city": prof.city,
            "about": prof.about,
            "topics": (getattr(bp, "topics", None) or []) if bp else [],
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
        "verification_status": prof.verification_status,
        "avatar_url": get_avatar_url(request, prof),
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
        "avatar_url": get_avatar_url(request, prof),
        "city": prof.city,
        "about": prof.about,
        "verification_status": prof.verification_status,
        "brand_name": getattr(bp, "brand_name", "") if bp else "",
        "sphere": getattr(bp, "sphere", "") if bp else "",
        "budget": getattr(bp, "budget", "") if bp else "",
        "contact_person": getattr(bp, "contact_person", "") if bp else "",
        "topics": (getattr(bp, "topics", None) or []) if bp else [],
    })


# ============================================================
# AVATAR ENDPOINT
# ============================================================

@api_view(["GET"])
@permission_classes([AllowAny])
def profile_avatar(request, profile_id):
    profile = get_object_or_404(Profile, id=profile_id)

    if not profile.avatar_blob:
        return HttpResponse(status=404)

    content_type = profile.avatar_mime or "image/jpeg"
    return HttpResponse(profile.avatar_blob, content_type=content_type)


# ============================================================
# CHAT
# ============================================================

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

        results.append({
            "id": c.id,
            "avatar_url": get_avatar_url(request, other),
            "title": display_name(other),
            "last_message": last_msg.text if last_msg else "",
            "last_message_at": last_msg.created_at if last_msg else None,
            "unread_count": unread_count_for(me_prof, c),
        })

    return Response({"ok": True, "results": results})


@api_view(["GET", "POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conv_id: int):
    me_prof = ensure_profile_and_role_models(request.user, role_default="brand")
    conv = get_object_or_404(Conversation, id=conv_id)

    # Проверяем что пользователь участник разговора
    if me_prof.id not in (conv.brand_id, conv.blogger_id):
        return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "POST":
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response(
                {"error": "text is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ограничение длины сообщения
        if len(text) > 5000:
            return Response(
                {"error": "Сообщение слишком длинное (максимум 5000 символов)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

    # GET — список сообщений
    qs = conv.messages.select_related("sender__user").order_by("created_at")
    results = [
        {
            "id": m.id,
            "text": m.text,
            "created_at": m.created_at,
            "sender_id": m.sender_id,
            "is_mine": (m.sender_id == me_prof.id),
        }
        for m in qs
    ]

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
        return Response(
            {"error": "Same role chat not allowed"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if me_prof.role == "brand":
        brand, blogger = me_prof, other
    else:
        brand, blogger = other, me_prof

    conv, _ = Conversation.objects.get_or_create(brand=brand, blogger=blogger)
    return Response({"ok": True, "conversation_id": conv.id})


# ============================================================
# PRODUCT ANALYZE (парсинг маркетплейсов)
# ============================================================
# Добавь этот импорт в начало views.py (рядом с другими импортами):
# from .parser.run_parser import run_ozon_parser

# И замени существующий product_analyze на этот:

@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def product_analyze(request):
    """
    Принимает ссылку на магазин Ozon, парсит и возвращает данные
    для автозаполнения профиля бренда.
    """
    from .parser.run_parser import run_ozon_parser

    p = ensure_profile_and_role_models(request.user, role_default="brand")
    if p.role != "brand":
        return Response({"error": "Not a brand"}, status=status.HTTP_403_FORBIDDEN)

    url = (request.data.get("url") or "").strip()
    if not url:
        return Response(
            {"error": "Ссылка обязательна"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # SSRF защита — только Ozon
    if not validate_marketplace_url(url):
        return Response(
            {"error": "Разрешены только ссылки на Ozon (ozon.ru)"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    marketplace = detect_marketplace(url)
    if marketplace != "ozon":
        return Response(
            {"error": "Пока поддерживается только Ozon. Wildberries — скоро."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Запускаем парсер в отдельном процессе (не блокирует Gunicorn)
    result = run_ozon_parser(url)

    if "error" in result:
        logger.warning("Ozon parser error for %s: %s", url, result["error"])
        return Response(
            {"error": result["error"]},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    return Response({
        "ok": True,
        "data": {
            "brand_name":     result.get("brand_name", ""),
            "sphere":         result.get("sphere", ""),
            "topics":         result.get("topics", []),
            "description":    result.get("description", ""),
            "rating":         result.get("rating"),
            "products_count": result.get("products_count"),
            "source_url":     result.get("source_url", url),
            "marketplace":    "ozon",
        }
    })