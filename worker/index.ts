/**
 * Прокси данных рынка для продакшена (Cloudflare Workers).
 *
 * GET /api/market -> снимок рынка с crossoutcore.ru в нашем формате.
 * Ответ кэшируется на краю Cloudflare на 5 минут, чтобы не нагружать сайт-источник.
 */
import { fetchSnapshot } from '../src/api/crossoutcore';

interface Env {
  ALLOWED_ORIGIN?: string;
}

const TTL_SECONDS = 5 * 60;

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/api/market') {
      return new Response('Not found', { status: 404, headers: corsHeaders(env) });
    }

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/api/market`, { method: 'GET' });
    let response = await cache.match(cacheKey);
    if (!response) {
      try {
        const snapshot = await fetchSnapshot();
        response = new Response(JSON.stringify(snapshot), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': `public, max-age=${TTL_SECONDS}`,
          },
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } catch (e) {
        return new Response(e instanceof Error ? e.message : String(e), { status: 502, headers: corsHeaders(env) });
      }
    }
    const out = new Response(response.body, response);
    for (const [k, v] of Object.entries(corsHeaders(env))) out.headers.set(k, v);
    return out;
  },
};
