from django.conf import settings
from django.utils import translation


class UserLanguageMiddleware:
    """Включает язык из профиля, пока человек сам не переключил язык в шапке админки."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        chosen = request.COOKIES.get(settings.LANGUAGE_COOKIE_NAME)
        if not chosen and user is not None and user.is_authenticated and user.language:
            translation.activate(user.language)
            request.LANGUAGE_CODE = user.language
        return self.get_response(request)
