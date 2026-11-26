import { normalizeHistory, normalizeItems, normalizeRecipe } from './normalize';
import type { Item, ItemFilter, PricePoint, Recipe } from './types';

const API_BASE: string = import.meta.env.VITE_API_BASE || '/api';
const USE_MOCK = import.meta.env.VITE_API_MOCK === '1';

async function getJson(path: string): Promise<unknown> {
  if (USE_MOCK) return mockGet(path);
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Ошибка API ${res.status}`);
  return res.json();
}

async function mockGet(path: string): Promise<unknown> {
  const m = await import('../mocks/data');
  const url = new URL(path, 'http://mock');
  await new Promise((r) => setTimeout(r, 150));
  if (url.pathname === '/items') return m.rawItems;
  const recipe = url.pathname.match(/^\/recipe(?:-deep)?\/(\d+)$/);
  if (recipe) {
    const id = Number(recipe[1]);
    return m.rawRecipes[id] ?? { recipe: { item: m.rawItems.find((i) => i.id === id), ingredients: [] } };
  }
  const hist = url.pathname.match(/^\/market-all\/(\d+)$/);
  if (hist) return m.rawHistory(Number(hist[1]));
  throw new Error(`Нет тестовых данных для ${path}`);
}

// Простой кэш в памяти, чтобы не перезапрашивать список при переходах между страницами.
const cache = new Map<string, Promise<unknown>>();
function cached(path: string): Promise<unknown> {
  let p = cache.get(path);
  if (!p) {
    p = getJson(path).catch((e) => {
      cache.delete(path);
      throw e;
    });
    cache.set(path, p);
  }
  return p;
}

export async function fetchItems(): Promise<Item[]> {
  return normalizeItems(await cached('/items'));
}

export function filterItems(items: Item[], f: ItemFilter): Item[] {
  const q = f.query?.trim().toLowerCase();
  return items.filter(
    (i) =>
      !i.removed &&
      (!q || i.name.toLowerCase().includes(q)) &&
      (!f.rarity || i.rarity === f.rarity) &&
      (!f.category || i.category === f.category) &&
      (!f.faction || i.faction === f.faction),
  );
}

export async function fetchRecipe(id: number): Promise<Recipe> {
  return normalizeRecipe(await cached(`/recipe-deep/${id}`));
}

export async function fetchHistory(id: number, days = 14): Promise<PricePoint[]> {
  // Округляем до 10 минут, чтобы ключ кэша не менялся каждую секунду.
  const start = Math.floor(Date.now() / 600_000) * 600 - days * 86400;
  return normalizeHistory(await cached(`/market-all/${id}?startTimestamp=${start}`));
}

export const isMock = USE_MOCK;
