from ninja import NinjaAPI

from catalog.api import router as catalog_router
from orders.api import router as orders_router
from pricing.api import router as pricing_router

api = NinjaAPI(title="ASTTA API", version="1", urls_namespace="api")
api.add_router("/", catalog_router)
api.add_router("/", pricing_router)
api.add_router("/orders", orders_router)
