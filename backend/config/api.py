from django.core.exceptions import ValidationError
from ninja import NinjaAPI

from catalog.api import router as catalog_router
from orders.api import router as orders_router
from pricing.api import router as pricing_router
from seller.api import router as seller_router

api = NinjaAPI(title="ASTTA API", version="1", urls_namespace="api")
api.add_router("/", catalog_router)
api.add_router("/", pricing_router)
api.add_router("/orders", orders_router)
api.add_router("/seller", seller_router)


@api.exception_handler(ValidationError)
def validation_error(request, exc):
    """Ошибки проверки модели (full_clean) отдаём как 422 с текстом, а не как 500."""
    detail = exc.message_dict if hasattr(exc, "error_dict") else exc.messages
    return api.create_response(request, {"detail": str(detail)}, status=422)
