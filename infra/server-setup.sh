#!/usr/bin/env bash
# Первая настройка чистого сервера Ubuntu 24.04 под ASTTA. Запускать от root один раз:
#   bash server-setup.sh
# Что делает: обновления и их автоустановка, файрвол (открыты только 22, 80, 443), защита SSH от подбора
# пароля, файл подкачки, Docker, загрузка кода из GitHub по ключу «только чтение», файл infra/.env со
# случайными паролями, запуск сайта и создание первого администратора.
# Повторный запуск безопасен: уже сделанные шаги пропускаются, пароли в .env не перезаписываются.
set -euo pipefail

REPO="git@github.com:datosanz55-blip/ASTTA.git"
APP=/opt/astta
DOMAIN="${DOMAIN:-astta.ru}"
KEY=/root/.ssh/astta_deploy

say() { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Запустите от root"; exit 1; }

say "1/7 Обновления системы"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -yq upgrade
apt-get -yq install ca-certificates curl git ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
timedatectl set-timezone Europe/Moscow || true

say "2/7 Файрвол и защита SSH"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
systemctl enable --now fail2ban

say "3/7 Файл подкачки 2 ГБ"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "4/7 Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

say "5/7 Код сайта из GitHub"
if [ ! -d "$APP/.git" ]; then
  mkdir -p /root/.ssh && chmod 700 /root/.ssh
  [ -f "$KEY" ] || ssh-keygen -t ed25519 -N "" -C "astta-server" -f "$KEY" >/dev/null
  ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null
  echo
  echo "Добавьте этот ключ в GitHub: репозиторий ASTTA → Settings → Deploy keys → Add deploy key."
  echo "Название: server. Галочку «Allow write access» НЕ ставьте."
  echo
  cat "$KEY.pub"
  echo
  read -rp "Когда добавите, нажмите Enter... " _
  GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes" git clone "$REPO" "$APP"
  git -C "$APP" config core.sshCommand "ssh -i $KEY -o IdentitiesOnly=yes"
fi
cd "$APP"

say "6/7 Настройки (infra/.env)"
ENV=infra/.env
if [ ! -f "$ENV" ]; then
  rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  read -rp "Почта для сертификата HTTPS и писем о безопасности: " EMAIL
  read -rsp "Токен бота из @BotFather (ввод не виден; можно оставить пустым и добавить потом): " TG
  echo
  ADMIN_PATH="team-$(rnd 10)"
  sed -e "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$(rnd 60)|" \
      -e "s|^ACME_EMAIL=.*|ACME_EMAIL=$EMAIL|" \
      -e "s|^SITE_DOMAIN=.*|SITE_DOMAIN=$DOMAIN|" \
      -e "s|^DJANGO_ADMIN_URL=.*|DJANGO_ADMIN_URL=$ADMIN_PATH|" \
      -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rnd 32)|" \
      -e "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TG|" \
      -e "s|^TELEGRAM_WEBHOOK_SECRET=.*|TELEGRAM_WEBHOOK_SECRET=$(rnd 40)|" \
      infra/.env.example > "$ENV"
  chmod 600 "$ENV"
fi

say "7/7 Запуск сайта"
docker compose -f infra/docker-compose.yml --env-file "$ENV" up -d --build

if ! docker compose -f infra/docker-compose.yml --env-file "$ENV" exec -T backend \
     python manage.py shell -c "from accounts.models import User; exit(0 if User.objects.filter(is_superuser=True).exists() else 1)"; then
  echo
  echo "Создайте первого администратора (логин, почта, пароль):"
  docker compose -f infra/docker-compose.yml --env-file "$ENV" exec backend python manage.py createsuperuser
fi

ADMIN_PATH=$(grep '^DJANGO_ADMIN_URL=' "$ENV" | cut -d= -f2)
say "Готово"
echo "Сайт:    https://$DOMAIN  (сертификат выпустится сам, когда домен будет указывать на этот сервер)"
echo "Админка: https://$DOMAIN/$ADMIN_PATH/  — сохраните адрес, он секретный"
