# Тайм-аут 180 с: загрузка каталога с архивом на 300 фото обрабатывается около минуты.
# Собирается из корня репозитория. В образе только сервер: API для сайта и админка команды.
#   docker build -f backend/Dockerfile .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .
RUN DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput \
    && useradd --system --uid 1000 app && mkdir -p /app/media && chown -R app /app/media
USER app

EXPOSE 8000
CMD ["gunicorn", "config.wsgi", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-", "--no-control-socket", "--timeout", "180"]
