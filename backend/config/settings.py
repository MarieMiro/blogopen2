from pathlib import Path
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# ===== ENV =====
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("DEBUG", "0") == "1"

def env_list(name: str, default: str = ""):
    return [x.strip() for x in os.getenv(name, default).split(",") if x.strip()]

# Render urls (очень удобно)
FRONTEND_URL = os.getenv("FRONTEND_URL", "").rstrip("/")
BACKEND_URL = os.getenv("BACKEND_URL", "").rstrip("/")

# ===== HOSTS =====
# лучше явно, но если хочешь оставить env — ок
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")
# если задеплоен бэк на render — добавь домен бэка
# (можно и через env, но на всякий)
if "onrender.com" not in ",".join(ALLOWED_HOSTS):
    # не обязательно, просто подсказка
    pass

# ===== APPS =====
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "corsheaders",
    "rest_framework",
    "django_extensions",

    "accounts.apps.AccountsConfig",
]

# ===== MIDDLEWARE =====
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ===== DB =====
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
        ssl_require=not DEBUG,  # для render/postgres обычно нужно
    )
}

# ===== CORS/CSRF =====
# 1) Сначала из env (если задала)
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "")

# 2) Добавим FRONTEND_URL, если задан
if FRONTEND_URL:
    if FRONTEND_URL not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(FRONTEND_URL)
    if FRONTEND_URL not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)

# 3) Локалхосты для разработки
if DEBUG:
    for u in ("http://localhost:3000", "http://127.0.0.1:3000"):
        if u not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(u)
        if u not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(u)

CORS_ALLOW_CREDENTIALS = True

# ===== SECURITY for Render (reverse proxy HTTPS) =====
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ===== I18N =====
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ===== STATIC/MEDIA =====
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ===== COOKIES =====
# Критично: если фронт и бэк на разных доменах, и ты используешь session cookies:
# нужно SameSite=None и Secure=True
if DEBUG:
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
else:
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

CSRF_COOKIE_HTTPONLY = False  # пусть фронт при необходимости может читать csrftoken

# ===== DRF =====
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}