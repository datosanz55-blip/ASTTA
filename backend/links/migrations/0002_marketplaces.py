from django.db import migrations

MARKETPLACES = [
    ("1688", "1688"),
    ("taobao", "Taobao"),
    ("tmall", "Tmall"),
    ("pinduoduo", "Pinduoduo"),
    ("poizon", "Poizon"),
]


def add_marketplaces(apps, schema_editor):
    """Площадки, ссылки с которых узнаём. Надбавки нулевые: впишите их в админке по тарифам TT."""
    Marketplace = apps.get_model("links", "Marketplace")
    for code, name in MARKETPLACES:
        Marketplace.objects.get_or_create(code=code, defaults={"name": name,
                                                              "note": "Заполните надбавку и доставку по тарифам TT"})


class Migration(migrations.Migration):
    dependencies = [("links", "0001_initial")]

    operations = [migrations.RunPython(add_marketplaces, migrations.RunPython.noop)]
