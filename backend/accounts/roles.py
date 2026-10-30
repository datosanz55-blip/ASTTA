"""Группы прав для ролей. Поставщик работает только со своими товарами (это ограничение в админке каталога).

Основатели работают как суперпользователи (createsuperuser): им доступно всё, включая создание аккаунтов.
"""

from django.contrib.auth.models import Group, Permission


def _all(app_label, *models):
    return [f"{app_label}.{action}_{model}" for model in models for action in ("view", "add", "change", "delete")]


ROLE_PERMISSIONS = {
    # Модератор правит любые товары, поставщиков, заказы и цены. Пользователей только смотрит:
    # право менять пользователей позволило бы выдать себе права суперпользователя.
    "Модераторы": [
        *_all("catalog", "category", "supplier", "product", "pricetier", "productimage", "factorysettings",
              "supplierpost", "postimage"),
        *_all("orders", "order", "orderitem", "orderevent", "supplierorder", "payout"),
        *_all("pricing", "exchangerate", "shippingmethod", "pricingconfig", "commissionrule"),
        *_all("links", "marketplace", "linkrequest"),
        *_all("assistant", "knowledgearticle"),
        "assistant.view_ailog",
        "accounts.view_user",
    ],
    "Поставщики": [
        "catalog.view_product", "catalog.add_product", "catalog.change_product",
        "catalog.view_pricetier", "catalog.add_pricetier", "catalog.change_pricetier", "catalog.delete_pricetier",
        "catalog.view_productimage", "catalog.add_productimage", "catalog.change_productimage",
        "catalog.delete_productimage", "catalog.view_category",
    ],
    "Агенты": [
        "orders.view_order", "orders.change_order",
        "orders.view_orderitem",
        "orders.view_orderevent", "orders.add_orderevent", "orders.change_orderevent",
        "orders.view_supplierorder", "orders.change_supplierorder",
        "catalog.view_product", "catalog.change_product", "catalog.view_pricetier", "catalog.view_supplier",
        "pricing.view_exchangerate", "pricing.view_shippingmethod",
        "links.view_linkrequest", "links.change_linkrequest", "links.view_marketplace",
    ],
}


def setup_roles():
    for group_name, codenames in ROLE_PERMISSIONS.items():
        group, _ = Group.objects.get_or_create(name=group_name)
        perms = []
        for full in codenames:
            app_label, codename = full.split(".")
            perms.append(Permission.objects.get(content_type__app_label=app_label, codename=codename))
        group.permissions.set(perms)
