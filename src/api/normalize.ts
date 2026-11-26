import type { Item, PricePoint, Recipe, RecipeNode } from './types';

/*
 * Все знания о формате ответов CrossoutDB собраны здесь.
 * Автор API предупреждает, что формат может меняться, поэтому разбор
 * сделан терпимым: недостающие поля получают безопасные значения.
 */

type Raw = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === 'string' && v) return v;
  return '';
};
/** Цены в API хранятся в сотых долях монеты. */
const price = (v: unknown): number => num(v) / 100;

export function normalizeItem(raw: Raw): Item {
  return {
    id: num(raw.id),
    name: str(raw.availableName, raw.localizedName, raw.name) || `#${num(raw.id)}`,
    sellPrice: price(raw.sellPrice),
    buyPrice: price(raw.buyPrice),
    sellOffers: num(raw.sellOffers),
    buyOrders: num(raw.buyOrders),
    rarity: str(raw.rarityName, raw.rarity),
    category: str(raw.categoryName, raw.category),
    type: str(raw.typeName, raw.type),
    faction: str(raw.faction, raw.factionName),
    craftable: raw.craftable === true || raw.craftable === 1,
    craftingSellSum: price(raw.craftingSellSum),
    craftingBuySum: price(raw.craftingBuySum),
    lotSize: num(raw.amount) || 1,
    resultAmount: num(raw.craftingResultAmount) || 1,
    removed: raw.removed === true || raw.removed === 1,
    meta: raw.meta === true || raw.meta === 1,
  };
}

export function normalizeItems(raw: unknown): Item[] {
  return Array.isArray(raw) ? raw.map((r) => normalizeItem(r as Raw)) : [];
}

function normalizeIngredients(list: unknown): RecipeNode[] {
  if (!Array.isArray(list)) return [];
  return (list as Raw[])
    // В ответе CrossoutDB встречаются служебные строки с итогами — пропускаем их.
    .filter((ing) => ing && ing.item && !ing.isSumRow)
    .map((ing) => ({
      item: normalizeItem(ing.item as Raw),
      count: num(ing.number),
      children: normalizeIngredients(ing.ingredients),
    }));
}

export function normalizeRecipe(raw: unknown): Recipe {
  const top = (raw ?? {}) as Raw;
  const r = ((top.recipe as Raw) ?? top) as Raw;
  const item = normalizeItem(((r.item as Raw) ?? (top.item as Raw) ?? {}) as Raw);
  return { item, ingredients: normalizeIngredients(r.ingredients) };
}

/**
 * market-all отдаёт строки вида [id, sellprice, buyprice, selloffers, buyorders, datetime, unix].
 * На всякий случай поддерживаем и объекты.
 */
export function normalizeHistory(raw: unknown): PricePoint[] {
  if (!Array.isArray(raw)) return [];
  const points = raw.map((row): PricePoint => {
    if (Array.isArray(row)) {
      const unix = num(row[6]);
      const t = unix ? unix * 1000 : Date.parse(String(row[5]));
      return { t, sell: price(row[1]), buy: price(row[2]) };
    }
    const o = row as Raw;
    const unix = num(o.unixTimestamp ?? o.timestamp);
    return {
      t: unix ? (unix < 1e12 ? unix * 1000 : unix) : Date.parse(String(o.datetime)),
      sell: price(o.sellprice ?? o.sellPrice),
      buy: price(o.buyprice ?? o.buyPrice),
    };
  });
  return points.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
}
