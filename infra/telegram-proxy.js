// Посредник к Telegram Bot API для серверов, где хостинг блокирует api.telegram.org.
// Бесплатно на Cloudflare Workers:
//   1. dash.cloudflare.com → Workers & Pages → Create → Worker (Hello World) → Deploy.
//   2. Edit code → заменить весь текст этим файлом → Deploy.
//   3. Settings → Variables and Secrets → Add: имя BOT_ID, значение — цифры токена до двоеточия
//      (у токена 123456789:AA... это 123456789). Так посредник обслуживает только наш бот.
//   4. Адрес воркера (https://….workers.dev) вписать в infra/.env: TELEGRAM_API_URL=https://….workers.dev
// Токен через посредника проходит, но нигде не сохраняется; сам токен сюда вписывать не нужно.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.BOT_ID || !url.pathname.startsWith(`/bot${env.BOT_ID}:`)) {
      return new Response("Not found", { status: 404 });
    }
    return fetch(`https://api.telegram.org${url.pathname}${url.search}`, {
      method: request.method,
      headers: { "content-type": request.headers.get("content-type") || "application/json" },
      body: request.method === "GET" ? undefined : request.body,
    });
  },
};
