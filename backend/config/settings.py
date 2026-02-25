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
    "whitenoise.middleware.WhiteNoiseMiddleware",  
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
        "DIRS": [
            BASE_DIR / "frontend_build" / "build",
        ],
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
DATABASE_URL = os.getenv("DATABASE_URL")  # может быть пусто локально

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=DATABASE_URL.startswith("postgres"),
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ===== CORS/CSRF =====
def _split_env_urls(name: str):
    raw = os.getenv(name, "")
    items = []
    for x in raw.split(","):
        x = x.strip()
        if not x:
            continue
        # убираем хвостовой слэш
        if x.endswith("/"):
            x = x[:-1]
        items.append(x)
    return items

CORS_ALLOWED_ORIGINS = ["https://blogopen2-1.onrender.com",]

# на всякий случай (если домен фронта меняется / есть preview-домены)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.onrender\.com$",
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = ["https://blogopen2-1.onrender.com",]



# ===== SECURITY for Render (reverse proxy HTTPS) =====
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ===== I18N =====
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ===== STATIC/MEDIA =====
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [
    BASE_DIR / "frontend_build" / "build" / "static",
]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Cookies for cross-site (frontend != backend domain, Render HTTPS) ---
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # если вдруг будешь читать CSRF из JS

SESSION_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SAMESITE = "None"

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Render / reverse proxy
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# ===== DRF =====
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}