import type { Plugin } from 'vite';
import { fetchSnapshot, type MarketSnapshot } from './crossoutcore';

/** Отдаёт /api/market в режиме разработки: загружает crossoutcore.ru и кэширует на 5 минут. */
export function marketApiPlugin(): Plugin {
  const TTL = 5 * 60 * 1000;
  let cache: { at: number; body: string } | null = null;
  let inflight: Promise<MarketSnapshot> | null = null;

  return {
    name: 'crossout-market-api',
    configureServer(server) {
      server.middlewares.use('/api/market', async (_req, res) => {
        try {
          if (!cache || Date.now() - cache.at > TTL) {
            inflight ??= fetchSnapshot().finally(() => (inflight = null));
            cache = { at: Date.now(), body: JSON.stringify(await inflight) };
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(cache.body);
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(e instanceof Error ? e.message : String(e));
        }
      });
    },
  };
}
