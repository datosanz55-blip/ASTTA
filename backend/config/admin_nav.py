"""Боковое меню админки: разделы по работе команды и счётчики дел, которые ждут человека."""

from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _


def _count(qs):
    n = qs.count()
    return str(n) if n else ""


def awaiting_payment(request):
    from orders.models import Order
    return _count(Order.objects.filter(status=Order.Status.AWAITING_PAYMENT))


def to_order(request):
    from orders.models import SupplierOrder
    return _count(SupplierOrder.objects.filter(status=SupplierOrder.Status.TO_ORDER))


def new_link_requests(request):
    from links.models import LinkRequest
    return _count(LinkRequest.objects.filter(status=LinkRequest.Status.NEW))


def _perm(codename):
    return lambda request: request.user.has_perm(codename)


def _item(title, icon, url, perm, badge=None):
    item = {"title": title, "icon": icon, "link": reverse_lazy(url), "permission": _perm(perm)}
    if badge:
        item["badge"] = f"config.admin_nav.{badge}"
    return item


NAVIGATION = [
    {"title": _("Заказы"), "separator": True, "items": [
        _item(_("Заказы покупателей"), "receipt_long", "admin:orders_order_changelist", "orders.view_order",
              "awaiting_payment"),
        _item(_("Заказать у поставщиков"), "shopping_cart_checkout", "admin:orders_supplierorder_purchase",
              "orders.change_supplierorder", "to_order"),
        _item(_("Части заказов у поставщиков"), "local_shipping", "admin:orders_supplierorder_changelist",
              "orders.view_supplierorder"),
        _item(_("Заявки по ссылке и фото"), "link", "admin:links_linkrequest_changelist", "links.view_linkrequest",
              "new_link_requests"),
        _item(_("Выплаты поставщикам"), "payments", "admin:orders_payout_changelist", "orders.view_payout"),
    ]},
    {"title": _("Каталог"), "separator": True, "items": [
        _item(_("Товары"), "inventory_2", "admin:catalog_product_changelist", "catalog.view_product"),
        _item(_("Загрузить каталог из Excel"), "upload_file", "admin:catalog_product_import", "catalog.add_product"),
        _item(_("Поставщики"), "factory", "admin:catalog_supplier_changelist", "catalog.view_supplier"),
        _item(_("Категории"), "category", "admin:catalog_category_changelist", "catalog.view_category"),
    ]},
    {"title": _("Лента"), "separator": True, "items": [
        _item(_("Посты"), "photo_library", "admin:catalog_supplierpost_changelist", "catalog.view_supplierpost"),
    ]},
    {"title": _("Цены"), "separator": True, "items": [
        _item(_("Настройки цены"), "tune", "admin:pricing_pricingconfig_changelist", "pricing.view_pricingconfig"),
        _item(_("Комиссия по категориям и поставщикам"), "percent", "admin:pricing_commissionrule_changelist",
              "pricing.view_commissionrule"),
        _item(_("Доставка"), "flight", "admin:pricing_shippingmethod_changelist", "pricing.view_shippingmethod"),
        _item(_("Курс юаня"), "currency_yuan", "admin:pricing_exchangerate_changelist", "pricing.view_exchangerate"),
        _item(_("Площадки (Poizon, Taobao…)"), "storefront", "admin:links_marketplace_changelist",
              "links.view_marketplace"),
    ]},
    {"title": _("ИИ-помощник"), "separator": True, "items": [
        _item(_("База знаний"), "menu_book", "admin:assistant_knowledgearticle_changelist",
              "assistant.view_knowledgearticle"),
        _item(_("Журнал ИИ"), "history", "admin:assistant_ailog_changelist", "assistant.view_ailog"),
    ]},
    {"title": _("Доступ"), "separator": True, "items": [
        _item(_("Пользователи"), "group", "admin:accounts_user_changelist", "accounts.view_user"),
        _item(_("Группы прав"), "admin_panel_settings", "admin:auth_group_changelist", "auth.view_group"),
    ]},
]


def navigation(request):
    return NAVIGATION
