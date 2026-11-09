#!/usr/bin/env bash
# Проверка защиты сервера ASTTA. Ничего не меняет, только показывает, что включено, а что нет.
#   cd /opt/astta && bash infra/security-check.sh
# Строки «!!» — что стоит исправить; рядом написано как.

cd "$(dirname "$0")/.." || exit 1
ENV=infra/.env
ok() { printf '  OK  %s\n' "$1"; }
bad() { printf '  !!  %s\n      → %s\n' "$1" "$2"; }
val() { grep -E "^$1=" "$ENV" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"; }

echo "Сервер"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ok "файрвол ufw включён"
else bad "файрвол ufw выключен" "запустите infra/server-setup.sh или: ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443; ufw --force enable"; fi
if systemctl is-active --quiet fail2ban; then ok "fail2ban работает: блокирует перебор паролей SSH"
else bad "fail2ban не работает" "apt-get install -y fail2ban && systemctl enable --now fail2ban"; fi
if systemctl is-enabled --quiet unattended-upgrades 2>/dev/null; then ok "обновления безопасности ставятся сами"
else bad "автообновления выключены" "apt-get install -y unattended-upgrades && dpkg-reconfigure -f noninteractive unattended-upgrades"; fi
if command -v sshd >/dev/null; then
  if sshd -T 2>/dev/null | grep -qi "^passwordauthentication yes"; then
    bad "в SSH можно войти по паролю" "надёжнее вход по ключу: настройте ключ в Termius, проверьте, что входите по нему, и только потом выключите пароль (PasswordAuthentication no)"
  else ok "SSH пускает только по ключу"; fi
fi

echo "Настройки сайта ($ENV)"
if [ ! -f "$ENV" ]; then bad "нет файла $ENV" "создайте его из infra/.env.example"; exit 1; fi
perm=$(stat -c %a "$ENV")
if [ "$perm" = "600" ]; then ok "файл с ключами доступен только root"
else bad "файл с ключами читают все пользователи сервера (права $perm)" "chmod 600 $ENV"; fi
case "$(val DJANGO_DEBUG | tr 'A-Z' 'a-z')" in
  1|true|yes|on) bad "включён режим отладки: при ошибке видно код и настройки" "DJANGO_DEBUG=0 в $ENV и перезапуск";;
  *) ok "режим отладки выключен";;
esac
admin=$(val DJANGO_ADMIN_URL)
if [ -z "$admin" ] || [ "$admin" = "admin" ] || [ "$admin" = "admin/" ]; then
  bad "админка на стандартном адресе /admin/ — его первым пробуют боты" "DJANGO_ADMIN_URL=$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')-panel в $ENV, перезапуск, новый адрес сохраните"
else ok "админка на своём адресе"; fi
secret=$(val DJANGO_SECRET_KEY)
if [ ${#secret} -ge 40 ]; then ok "секретный ключ Django длинный"; else bad "секретный ключ Django короткий" "сгенерируйте новый: python3 -c 'import secrets;print(secrets.token_urlsafe(50))'"; fi
if [ -n "$(val TELEGRAM_BOT_TOKEN)" ] && [ -z "$(val TELEGRAM_WEBHOOK_SECRET)" ]; then
  bad "нет секрета вебхука Telegram: боту можно прислать поддельные сообщения" "TELEGRAM_WEBHOOK_SECRET=<случайная строка> и снова manage.py telegram_setup"
else ok "вебхук Telegram защищён секретом"; fi

echo "Наружу"
open=$(docker compose -f infra/docker-compose.yml --env-file "$ENV" ps --format '{{.Publishers}}' 2>/dev/null | grep -oE '0\.0\.0\.0:[0-9]+' | sort -u | cut -d: -f2 | tr '\n' ' ')
extra=$(echo "$open" | tr ' ' '\n' | grep -vE '^(80|443|)$' | tr '\n' ' ')
if [ -z "$extra" ]; then ok "наружу открыты только 80 и 443"; else bad "наружу открыты порты: $extra" "уберите их из ports: в infra/docker-compose.yml"; fi

echo "Резервные копии"
last=$(ls -t infra/backups/db-*.dump 2>/dev/null | head -1)
if [ -n "$last" ] && [ -n "$(find "$last" -mtime -2)" ]; then ok "свежая копия базы: $last"
else bad "нет копии базы за последние 2 дня" "проверьте контейнер backup: docker compose -f infra/docker-compose.yml --env-file $ENV logs backup"; fi
echo "Копии лежат на этом же сервере: раз в неделю скачивайте их себе (см. README)."
