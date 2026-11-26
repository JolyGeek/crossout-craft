/**
 * Прокси к API CrossoutDB с кэшем.
 *
 * GET /api/items?...        -> https://crossoutdb.com/api/v1/items?...
 * GET /api/recipe-deep/123  -> https://crossoutdb.com/api/v1/recipe-deep/123
 *
 * Зачем: CrossoutDB не обязан отдавать CORS-заголовки, а частые запросы
 * от каждого посетителя лишний раз нагружают чужой сервис. Ответы
 * кэшируются на краю Cloudflare на несколько минут.
 */

interface Env {
  ALLOWED_ORIGIN?: string;
}

const UPSTREAM = 'https://crossoutdb.com/api/v1';

// Разрешаем только чтение известных эндпоинтов.
const ALLOWED_PATHS = [
  /^\/items$/,
  /^\/item\/\d+$/,
  /^\/recipe\/\d+$/,
  /^\/recipe-deep\/\d+$/,
  /^\/market\/(sellprice|buyprice|selloffers|buyorders)\/\d+$/,
  /^\/market-all\/\d+$/,
  /^\/(rarities|factions|types|categories)$/,
];

// Сколько секунд хранить ответ в кэше.
function ttlFor(path: string): number {
  if (/^\/(rarities|factions|types|categories)$/.test(path)) return 6 * 3600;
  if (path.startsWith('/market')) return 15 * 60;
  return 5 * 60;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '');
    if (!ALLOWED_PATHS.some((re) => re.test(path))) {
      return new Response('Not found', { status: 404, headers: corsHeaders(env) });
    }

    const upstreamUrl = `${UPSTREAM}${path}${url.search}`;
    const cache = caches.default;
    const cacheKey = new Request(upstreamUrl, { method: 'GET' });

    let response = await cache.match(cacheKey);
    if (!response) {
      const upstream = await fetch(upstreamUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'crossout-craft-proxy' },
      });
      if (!upstream.ok) {
        return new Response(`Upstream error ${upstream.status}`, {
          status: 502,
          headers: corsHeaders(env),
        });
      }
      response = new Response(upstream.body, upstream);
      response.headers.set('Cache-Control', `public, max-age=${ttlFor(path)}`);
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    const out = new Response(response.body, response);
    for (const [k, v] of Object.entries(corsHeaders(env))) out.headers.set(k, v);
    return out;
  },
};
