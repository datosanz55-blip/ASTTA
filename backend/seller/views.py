"""Страница кабинета команды. Отдаём тот же seller.html, что и в прототипе, но в боевом режиме:
пути к файлам ведут в static, а data-api включает работу с настоящим API вместо демо-данных."""

import re
from functools import lru_cache

from django.conf import settings
from django.http import HttpResponse
from django.templatetags.static import static
from django.views.decorators.csrf import ensure_csrf_cookie

ASSET_RE = re.compile(r'(href|src)="assets/([^"]+)"')


@lru_cache(maxsize=1)
def _page() -> str:
    html = (settings.FRONTEND_DIR / "seller.html").read_text(encoding="utf-8")
    html = ASSET_RE.sub(lambda m: f'{m.group(1)}="{static(m.group(2))}"', html)
    html = html.replace('<a class="brand" href="index.html"', '<a class="brand" href="/seller/"')
    return html.replace("<body>", '<body data-api="/api/seller">', 1)


@ensure_csrf_cookie
def seller_page(request):
    if settings.DEBUG:
        _page.cache_clear()
    response = HttpResponse(_page())
    # Кабинет не нужен поисковикам.
    response["X-Robots-Tag"] = "noindex"
    return response
