/*
 * Разбор данных со страницы https://crossoutcore.ru/market/.
 *
 * Открытого API у crossoutcore.ru нет. Страница сделана на Next.js и
 * отдаёт все данные рынка внутри HTML: в вызовах self.__next_f.push(...)
 * лежит RSC-поток, в одной из строк которого есть объект initialData
 * со списком предметов, рецептами и текущими ценами.
 *
 * Этот модуль не зависит от браузера и Node: он используется и в dev-сервере
 * Vite, и в Cloudflare Worker. Если сайт-источник поменяет вёрстку,
 * чинить нужно только здесь.
 */

export const SOURCE_URL = 'https://crossoutcore.ru/market/';

interface CoreItem {
  id: number;
  name: string;
  rarityId: number;
  factionId: number;
  categoryId: number;
  typeId: number;
  recipe: { resultAmount: number; ingredients: { id: number; amount: number }[] } | string | null;
  removed: number;
  amount: number;
  craftable: number;
  craftingResultAmount: number;
}

interface CorePrice {
  /** Самое дешёвое предложение о продаже. */
  s: number;
  /** Самый дорогой запрос на покупку. */
  b: number;
  so: number;
  bo: number;
  t?: number;
}

interface Named {
  id: number;
  name: string;
}

export interface CoreInitialData {
  items: CoreItem[];
  marketData: Record<string, CorePrice>;
  rarities: Named[];
  factions: Named[];
  categories: Named[];
  types: Named[];
  lastUpdateTimestamp?: number;
}

/** Ингредиент рецепта: id предмета и количество в штуках. */
export interface RecipeLine {
  id: number;
  amount: number;
}

/** Компактный формат, который отдаёт наш прокси и читает сайт. */
export interface MarketSnapshot {
  source: string;
  updatedAt: number | null;
  /** Предметы в «сыром» виде, совместимом с normalizeItem (цены в сотых долях). */
  items: Record<string, unknown>[];
  /** Рецепты первого уровня по id предмета. */
  recipes: Record<number, { resultAmount: number; ingredients: RecipeLine[] }>;
}

/** Склеивает строки RSC-потока из HTML-страницы Next.js. */
export function extractFlight(html: string): string {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let out = '';
  for (let m = re.exec(html); m; m = re.exec(html)) out += JSON.parse(m[1]) as string;
  return out;
}

function findWithKey(o: unknown, key: string, depth = 0): Record<string, unknown> | null {
  if (!o || typeof o !== 'object' || depth > 12) return null;
  if (key in (o as object)) return o as Record<string, unknown>;
  for (const v of Object.values(o as object)) {
    const r = findWithKey(v, key, depth + 1);
    if (r) return r;
  }
  return null;
}

/** Достаёт initialData со страницы рынка. Бросает ошибку с понятным текстом, если формат изменился. */
export function parseMarketHtml(html: string): CoreInitialData {
  const flight = extractFlight(html);
  if (!flight) throw new Error('crossoutcore: на странице не найден поток данных Next.js');
  const row = flight.split('\n').find((r) => r.includes('"initialData"'));
  if (!row) throw new Error('crossoutcore: на странице не найден initialData');
  const holder = findWithKey(JSON.parse(row.slice(row.indexOf(':') + 1)), 'initialData');
  const data = holder?.initialData as CoreInitialData | undefined;
  if (!data || !Array.isArray(data.items) || !data.marketData) {
    throw new Error('crossoutcore: формат initialData изменился');
  }
  return data;
}

const nameMap = (list: Named[] | undefined) => new Map((list ?? []).map((x) => [x.id, x.name]));

/** Переводит данные crossoutcore в наш формат. */
export function toSnapshot(data: CoreInitialData): MarketSnapshot {
  const rarity = nameMap(data.rarities);
  const faction = nameMap(data.factions);
  const category = nameMap(data.categories);
  const type = nameMap(data.types);
  const price = (id: number): CorePrice => data.marketData[String(id)] ?? { s: 0, b: 0, so: 0, bo: 0 };
  const lot = new Map(data.items.map((i) => [i.id, i.amount || 1]));

  const recipes: MarketSnapshot['recipes'] = {};
  for (const i of data.items) {
    if (i.recipe && typeof i.recipe === 'object' && Array.isArray(i.recipe.ingredients)) {
      recipes[i.id] = {
        resultAmount: i.recipe.resultAmount || i.craftingResultAmount || 1,
        ingredients: i.recipe.ingredients.map((x) => ({ id: x.id, amount: x.amount })),
      };
    }
  }

  // Стоимость ингредиентов первого уровня: по ценам предложений и по ценам запросов.
  const ingredientSum = (id: number, key: 's' | 'b'): number => {
    const r = recipes[id];
    if (!r) return 0;
    let sum = 0;
    for (const ing of r.ingredients) {
      const p = price(ing.id)[key];
      if (!(p > 0)) return 0; // какой-то ингредиент сейчас не купить
      sum += (p * ing.amount) / (lot.get(ing.id) ?? 1);
    }
    return sum;
  };

  const cents = (v: number) => Math.round((v || 0) * 100);
  const items = data.items.map((i) => {
    const p = price(i.id);
    const craftable = Boolean(i.craftable) && Boolean(recipes[i.id]);
    return {
      id: i.id,
      name: i.name,
      sellPrice: cents(p.s),
      buyPrice: cents(p.b),
      sellOffers: p.so || 0,
      buyOrders: p.bo || 0,
      rarityName: rarity.get(i.rarityId) ?? '',
      categoryName: category.get(i.categoryId) ?? '',
      typeName: type.get(i.typeId) ?? '',
      faction: faction.get(i.factionId) ?? '',
      craftable,
      craftingSellSum: craftable ? cents(ingredientSum(i.id, 's')) : 0,
      craftingBuySum: craftable ? cents(ingredientSum(i.id, 'b')) : 0,
      amount: i.amount || 1,
      craftingResultAmount: recipes[i.id]?.resultAmount ?? 1,
      removed: Boolean(i.removed),
    };
  });

  return { source: SOURCE_URL, updatedAt: data.lastUpdateTimestamp ?? null, items, recipes };
}

/** Загружает страницу рынка и возвращает снимок данных. */
export async function fetchSnapshot(fetchImpl: typeof fetch = fetch): Promise<MarketSnapshot> {
  const res = await fetchImpl(SOURCE_URL, {
    headers: { 'User-Agent': 'crossout-craft (fan calculator)', Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`crossoutcore: HTTP ${res.status}`);
  return toSnapshot(parseMarketHtml(await res.text()));
}
