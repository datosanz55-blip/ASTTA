#!/usr/bin/env bash
# Обновить сайт на сервере одной командой:
#   cd /opt/astta && bash infra/update.sh
set -e
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
# Caddy подключает index.html и privacy.html отдельными файлами: после git pull он продолжает видеть старые
# копии, пока его не пересоздать. Без этого шага новый app.js встречает старый index.html.
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --force-recreate caddy
echo "Готово: сайт обновлён"
