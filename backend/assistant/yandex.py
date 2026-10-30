"""Клиент Yandex AI Studio: YandexGPT (текст) и Vision OCR (текст на фото).

Ключи задаются переменными окружения YANDEX_API_KEY (API-ключ сервисного аккаунта)
и YANDEX_FOLDER_ID (каталог в Yandex Cloud). Без них ИИ выключен, остальной сайт работает.
Запросы не попадают в журналы Яндекса для обучения: заголовок x-data-logging-enabled: false.
"""

import base64
import json
from dataclasses import dataclass, field

import httpx
from django.conf import settings

# Адреса из справочника AI Studio (aistudio.yandex.ru/docs, проверено в октябре 2026).
GPT_URL = "https://ai.api.cloud.yandex.net/foundationModels/v1/completion"
OCR_URL = "https://ai.api.cloud.yandex.net/ocr/v1/recognizeText"
TIMEOUT = 60


class AIUnavailable(Exception):
    """ИИ не подключён: нет ключей."""


class AIError(Exception):
    """Яндекс вернул ошибку или непонятный ответ."""


def enabled() -> bool:
    return bool(settings.YANDEX_API_KEY and settings.YANDEX_FOLDER_ID)


def _headers():
    if not enabled():
        raise AIUnavailable("ИИ не подключён: задайте YANDEX_API_KEY и YANDEX_FOLDER_ID")
    return {
        "Authorization": f"Api-Key {settings.YANDEX_API_KEY}",
        "x-folder-id": settings.YANDEX_FOLDER_ID,
        "x-data-logging-enabled": "false",
    }


def _post(url: str, payload: dict) -> dict:
    try:
        response = httpx.post(url, json=payload, headers=_headers(), timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        raise AIError(f"Яндекс не ответил: {exc.__class__.__name__}") from exc
    if response.status_code != 200:
        raise AIError(f"Яндекс вернул {response.status_code}: {response.text[:200]}")
    data = response.json()
    # Ответ приходит то с обёрткой result, то без неё (в документации встречаются оба варианта).
    return data.get("result", data)


@dataclass
class Completion:
    text: str
    tokens: int


def complete(system: str, user: str, *, max_tokens: int = 800, temperature: float = 0.2,
             as_json: bool = False) -> Completion:
    payload = {
        "modelUri": f"gpt://{settings.YANDEX_FOLDER_ID}/{settings.YANDEX_GPT_MODEL}",
        "completionOptions": {"stream": False, "temperature": temperature, "maxTokens": str(max_tokens)},
        "messages": [{"role": "system", "text": system}, {"role": "user", "text": user}],
    }
    if as_json:
        payload["jsonObject"] = True
    data = _post(GPT_URL, payload)
    try:
        alternative = data["alternatives"][0]
        text = alternative["message"]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIError("Непонятный ответ YandexGPT") from exc
    if alternative.get("status") == "ALTERNATIVE_STATUS_CONTENT_FILTER":
        raise AIError("YandexGPT отказался отвечать на этот запрос")
    return Completion(text=text, tokens=int((data.get("usage") or {}).get("totalTokens") or 0))


def complete_json(system: str, user: str, **kwargs) -> tuple[dict, int]:
    result = complete(system, user, as_json=True, **kwargs)
    text = result.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIError("YandexGPT ответил не в формате JSON") from exc
    if not isinstance(data, dict):
        raise AIError("YandexGPT ответил не объектом JSON")
    return data, result.tokens


@dataclass
class OcrLine:
    text: str
    height: int


@dataclass
class OcrResult:
    full_text: str
    lines: list[OcrLine] = field(default_factory=list)


def _height(box) -> int:
    ys = [int(v.get("y", 0)) for v in (box or {}).get("vertices", [])]
    return max(ys) - min(ys) if ys else 0


def recognize_text(jpeg: bytes) -> OcrResult:
    """Текст со скриншота: китайский, русский и английский. Высота строки нужна, чтобы найти главную цену."""
    data = _post(OCR_URL, {
        "mimeType": "JPEG",
        "languageCodes": ["zh", "ru", "en"],
        "model": "page",
        "content": base64.b64encode(jpeg).decode(),
    })
    annotation = data.get("textAnnotation") or {}
    lines = [OcrLine(line.get("text", ""), _height(line.get("boundingBox")))
             for block in annotation.get("blocks", []) for line in block.get("lines", [])]
    return OcrResult(full_text=annotation.get("fullText", ""), lines=lines)
