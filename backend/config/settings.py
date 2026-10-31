"""Настройки ASTTA. Всё, что отличается между ноутбуком и сервером, берётся из переменных окружения."""

import os
from pathlib import Path

from django.utils.translation import gettext_lazy as _

BASE_DIR = Path(__file__).resolve().parent.parent


def env(name, default=None):
    return os.environ.get(name, default)


def env_bool(name, default=False):
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = env("DJANGO_SECRET_KEY") or ("dev-only-not-secret" if DEBUG or env("PYTEST_VERSION") else None)
if not SECRET_KEY:
    raise RuntimeError("Задайте DJANGO_SECRET_KEY")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "unfold",
    "unfold.contrib.filters",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_otp",
    "django_otp.plugins.otp_totp",
    "accounts",
    "catalog",
    "pricing",
    "orders",
    "links",
    "assistant",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "accounts.security.AdminGuardMiddleware",
    "accounts.middleware.UserLanguageMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

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

# Без POSTGRES_DB работаем на SQLite: удобно для первого запуска и тестов на ноутбуке.
if env("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB"),
            "USER": env("POSTGRES_USER", "astta"),
            "PASSWORD": env("POSTGRES_PASSWORD", ""),
            "HOST": env("POSTGRES_HOST", "localhost"),
            "PORT": env("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Работает только команда, интерфейс на русском.
LANGUAGE_CODE = "ru"
LANGUAGES = [("ru", _("Русский"))]
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", BASE_DIR / "media"))
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
if env("PYTEST_VERSION"):
    STORAGES["staticfiles"] = {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}

# ASTTA AI на YandexGPT и Yandex Vision OCR. Без ключей ИИ выключен, остальной сайт работает.
YANDEX_API_KEY = env("YANDEX_API_KEY", "")
YANDEX_FOLDER_ID = env("YANDEX_FOLDER_ID", "")
YANDEX_GPT_MODEL = env("YANDEX_GPT_MODEL", "yandexgpt/latest")

# Общий кэш нужен, чтобы лимит попыток входа работал во всех процессах сервера.
if env("REDIS_URL"):
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": env("REDIS_URL")}}

CELERY_BROKER_URL = env("REDIS_URL", "redis://localhost:6379/0")
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    # ЦБ публикует курс на следующий день во второй половине дня по Москве.
    "update-cny-rate": {"task": "pricing.tasks.update_cny_rate", "schedule": 60 * 60 * 3},
    # Неоплаченные за сутки заказы снимаем: цена и наличие у поставщика уже могли измениться.
    "cancel-unpaid-orders": {"task": "orders.tasks.cancel_unpaid_orders", "schedule": 60 * 60},
}

# Защита админки (подробно в accounts/security.py).
ADMIN_URL = env("DJANGO_ADMIN_URL", "admin").strip("/") + "/"
# После входа по прямой ссылке на страницу входа открываем админку, а не /accounts/profile/.
LOGIN_URL = "/" + ADMIN_URL + "login/"
LOGIN_REDIRECT_URL = "/" + ADMIN_URL
ADMIN_ALLOWED_IPS = env_list("ADMIN_ALLOWED_IPS")
TESTING = bool(env("PYTEST_VERSION"))
# Под тестами второй шаг и редирект на https выключены, их проверяют отдельные тесты.
ADMIN_REQUIRE_2FA = env_bool("ADMIN_REQUIRE_2FA", not DEBUG and not TESTING)
LOGIN_FAIL_LIMIT = int(env("LOGIN_FAIL_LIMIT", "5"))
LOGIN_LOCK_MINUTES = int(env("LOGIN_LOCK_MINUTES", "15"))
OTP_TOTP_ISSUER = "ASTTA"
# Сколько прокси стоит перед сервером (Caddy — один). От этого зависит, чей адрес считают лимиты:
# без прокси адрес берём из соединения, иначе — тот, что дописал наш прокси.
NUM_PROXIES = int(env("NUM_PROXIES", "0"))
NINJA_NUM_PROXIES = NUM_PROXIES

# Сессия сотрудника живёт 12 часов, cookie недоступны скриптам.
SESSION_COOKIE_AGE = 60 * 60 * 12
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", not TESTING)
    SECURE_HSTS_SECONDS = int(env("DJANGO_HSTS_SECONDS", str(60 * 60 * 24 * 365)))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # Проверка «жив ли сервер» ходит внутри Docker по http, её не перенаправляем.
    SECURE_REDIRECT_EXEMPT = [r"^healthz$"]
# В список HSTS preload браузеров домен попадает почти навсегда: включим, когда домен и поддомены устоятся.
SILENCED_SYSTEM_CHECKS = ["security.W021"]

UNFOLD = {
    "SITE_TITLE": "ASTTA",
    "SITE_HEADER": "ASTTA",
    "SITE_SYMBOL": "storefront",
    "SHOW_LANGUAGES": False,
    "SIDEBAR": {"show_search": True, "show_all_applications": False, "navigation": "config.admin_nav.navigation"},
    "COLORS": {
        "primary": {
            "50": "250 253 231",
            "100": "243 250 200",
            "200": "235 247 160",
            "300": "227 243 110",
            "400": "220 239 58",
            "500": "196 214 38",
            "600": "158 173 26",
            "700": "118 130 20",
            "800": "80 88 14",
            "900": "50 55 9",
            "950": "28 31 5",
        },
    },
}
