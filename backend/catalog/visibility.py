"""Storefront eligibility; hidden items remain available to staff and existing orders."""
from django.db.models import Exists, OuterRef, Q

from catalog.models import Product, ProductImage


def storefront_products():
    photos = ProductImage.objects.filter(product_id=OuterRef('pk')).exclude(image='')
    return (Product.objects.filter(status=Product.Status.PUBLISHED, supplier__is_active=True)
            .alias(_has_photo=Exists(photos))
            .filter(Q(market__source__isnull=True) | ~Q(market__source='taobao') | Q(_has_photo=True)))
