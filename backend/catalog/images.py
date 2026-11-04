"""Фото товаров и постов: проверяем, поворачиваем по EXIF, уменьшаем и сохраняем в WebP.

Покупатель открывает каталог с телефона, поэтому храним не оригинал на 5–10 МБ, а WebP до 1600 px
по длинной стороне: этого хватает на экран с плотными пикселями, а весит в 10–20 раз меньше.
"""

from io import BytesIO
from pathlib import PurePath

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_SIDE = 1600
QUALITY = 85
MAX_SOURCE_BYTES = 15 * 1024 * 1024
# Защита от «бомбы» из картинки 30 000 × 30 000: Pillow откажется её разжимать.
Image.MAX_IMAGE_PIXELS = 60_000_000


class ImageError(Exception):
    pass


def prepare_image(data: bytes, name: str) -> ContentFile:
    if len(data) > MAX_SOURCE_BYTES:
        raise ImageError(f"{name}: фото больше 15 МБ")
    try:
        with Image.open(BytesIO(data)) as probe:
            probe.verify()
        image = Image.open(BytesIO(data))
        # JPEG сразу разжимаем в уменьшенном виде (не меньше итоговых 1600 px): в разы быстрее для больших фото.
        scale = MAX_SIDE / max(image.size)
        if scale < 1:
            image.draft("RGB", (round(image.width * scale), round(image.height * scale)))
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") and _has_alpha(image) else "RGB")
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        out = BytesIO()
        image.save(out, "WEBP", quality=QUALITY, method=4)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError) as exc:
        raise ImageError(f"{name}: это не фото или файл повреждён") from exc
    return ContentFile(out.getvalue(), name=f"{PurePath(name).stem[:80] or 'photo'}.webp")


def _has_alpha(image) -> bool:
    if image.mode == "P":
        return "transparency" in image.info
    return True
