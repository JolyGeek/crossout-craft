import type { MarketSnapshot } from './crossoutcore';
import { normalizeHistory, normalizeItem, normalizeItems, normalizeRecipe } from './normalize';
import type { Item, ItemFilter, PricePoint, Recipe, RecipeNode } from './types';

/*
 * Источник данных: crossoutcore.ru. Страницу рынка загружает и разбирает
 * наш сервер (dev-сервер Vite или Cloudflare Worker) и отдаёт по адресу
 * /api/market компактный снимок: предметы, цены и рецепты.
 *
 * В тестовом режиме (VITE_API_MOCK=1) используются выдуманные данные из src/mocks.
 */

const API_BASE: string = import.meta.env.VITE_API_BASE || '/api';
const USE_MOCK = import.meta.env.VITE_API_MOCK === '1';

export const isMock = USE_MOCK;
/** История цен есть только в тестовых данных: crossoutcore не отдаёт её в странице рынка. */
export const hasHistory = USE_MOCK;

let snapshotPromise: Promise<MarketSnapshot> | null = null;

function loadSnapshot(): Promise<MarketSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = fetch(`${API_BASE}/market`, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Ошибка загрузки данных рынка: ${res.status} ${await res.text()}`);
        return (await res.json()) as MarketSnapshot;
      })
      .catch((e) => {
        snapshotPromise = null;
        throw e;
      });
  }
  return snapshotPromise;
}

async function mocks() {
  await new Promise((r) => setTimeout(r, 150));
  return import('../mocks/data');
}

export async function fetchItems(): Promise<Item[]> {
  if (USE_MOCK) return normalizeItems((await mocks()).rawItems);
  return normalizeItems((await loadSnapshot()).items);
}

export async function fetchUpdatedAt(): Promise<number | null> {
  if (USE_MOCK) return null;
  return (await loadSnapshot()).updatedAt;
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

/** Собирает полное дерево крафта из рецептов первого уровня. */
export function buildRecipe(snapshot: MarketSnapshot, id: number): Recipe {
  const items = new Map(snapshot.items.map((raw) => [Number(raw.id), normalizeItem(raw)]));
  const unknown = (itemId: number): Item => normalizeItem({ id: itemId, name: `Предмет #${itemId}` });

  const node = (itemId: number, count: number, path: number[]): RecipeNode => {
    const r = snapshot.recipes[itemId];
    // Защита от циклов и слишком глубоких деревьев.
    const canExpand = r && !path.includes(itemId) && path.length < 8;
    return {
      item: items.get(itemId) ?? unknown(itemId),
      count,
      children: canExpand ? r.ingredients.map((ing) => node(ing.id, ing.amount, [...path, itemId])) : [],
    };
  };

  const root = snapshot.recipes[id];
  return {
    item: items.get(id) ?? unknown(id),
    ingredients: root ? root.ingredients.map((ing) => node(ing.id, ing.amount, [id])) : [],
  };
}

export async function fetchRecipe(id: number): Promise<Recipe> {
  if (USE_MOCK) {
    const m = await mocks();
    const raw = m.rawRecipes[id] ?? { recipe: { item: m.rawItems.find((i) => i.id === id), ingredients: [] } };
    return normalizeRecipe(raw);
  }
  return buildRecipe(await loadSnapshot(), id);
}

export async function fetchHistory(id: number): Promise<PricePoint[]> {
  if (USE_MOCK) return normalizeHistory((await mocks()).rawHistory(id));
  return [];
}
