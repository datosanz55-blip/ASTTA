# Собирается из корня репозитория: кроме сервера в образ нужен кабинет поставщика (seller.html и его ресурсы).
#   docker build -f backend/Dockerfile .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 FRONTEND_DIR=/frontend
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY seller.html /frontend/
COPY assets/css/seller.css /frontend/assets/css/
COPY assets/js/seller.js /frontend/assets/js/
COPY assets/fonts /frontend/assets/fonts
COPY assets/img/brand /frontend/assets/img/brand
COPY backend/ .
RUN DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput \
    && useradd --system --uid 1000 app && mkdir -p /app/media && chown -R app /app/media
USER app

EXPOSE 8000
CMD ["gunicorn", "config.wsgi", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-", "--no-control-socket"]
