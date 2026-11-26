import type { Item, Recipe, RecipeNode } from '../api/types';

/** Комиссия рынка Crossout при продаже. */
export const MARKET_FEE = 0.1;

export interface Settings {
  /** instant: покупаем по самому дешёвому предложению; order: ставим запрос по цене лучшего запроса. */
  buyMode: 'instant' | 'order';
  /** offer: выставляем предложение по текущей цене продажи; instant: продаём в лучший запрос сразу. */
  sellMode: 'offer' | 'instant';
  /** Комиссия рынка (доля). */
  fee: number;
  /** Плата за верстак за один крафт итогового предмета. В API её нет, вводится вручную. */
  benchCost: number;
}

export const defaultSettings: Settings = {
  buyMode: 'instant',
  sellMode: 'offer',
  fee: MARKET_FEE,
  benchCost: 0,
};

export type Choice = 'buy' | 'craft';

export interface NodeResult {
  path: string;
  item: Item;
  qty: number;
  /** Цена покупки нужного количества на рынке, null если купить нельзя. */
  buyCost: number | null;
  /** Цена крафта нужного количества, null если предмет не крафтится. */
  craftCost: number | null;
  choice: Choice;
  /** Выбранный вариант совпадает с самым дешёвым. */
  isCheapest: boolean;
  cost: number;
  children: NodeResult[];
}

export interface CraftResult {
  item: Item;
  ingredients: NodeResult[];
  /** Себестоимость одной штуки при выбранных вариантах. */
  craftCostPerUnit: number;
  /** Сколько стоит купить готовый предмет. */
  marketBuyPrice: number | null;
  /** Сколько получишь с продажи одной штуки после комиссии. */
  sellNet: number;
  profit: number;
  /** Прибыль относительно себестоимости. */
  margin: number;
  /** Экономия, если скрафтить для себя вместо покупки. */
  saveVsBuy: number | null;
}

/** Цена одной единицы при покупке. У ресурсов цена указана за лот, например за 100 шт. */
export function unitBuyPrice(item: Item, s: Settings): number | null {
  const p = s.buyMode === 'instant' ? item.sellPrice : item.buyPrice;
  return p > 0 ? p / item.lotSize : null;
}

/** Выручка с продажи одной штуки после комиссии. */
export function sellNet(item: Item, s: Settings): number {
  const p = s.sellMode === 'offer' ? item.sellPrice : item.buyPrice;
  return (p / item.lotSize) * (1 - s.fee);
}

export function evalNode(
  node: RecipeNode,
  s: Settings,
  overrides: Record<string, Choice> = {},
  path = '0',
): NodeResult {
  const unit = unitBuyPrice(node.item, s);
  const buyCost = unit === null ? null : unit * node.count;

  const children = node.children.map((c, i) => evalNode(c, s, overrides, `${path}.${i}`));
  let craftCost: number | null = null;
  if (children.length > 0) {
    const perBatch = children.reduce((sum, c) => sum + c.cost, 0);
    craftCost = (perBatch * node.count) / node.item.resultAmount;
  }

  const cheapest: Choice =
    craftCost !== null && (buyCost === null || craftCost < buyCost) ? 'craft' : 'buy';
  let choice = overrides[path] ?? cheapest;
  if (choice === 'craft' && craftCost === null) choice = 'buy';
  if (choice === 'buy' && buyCost === null && craftCost !== null) choice = 'craft';

  const cost = (choice === 'craft' ? craftCost : buyCost) ?? 0;
  return {
    path,
    item: node.item,
    qty: node.count,
    buyCost,
    craftCost,
    choice,
    isCheapest: choice === cheapest,
    cost,
    children,
  };
}

export function computeCraft(
  recipe: Recipe,
  s: Settings,
  overrides: Record<string, Choice> = {},
): CraftResult {
  const ingredients = recipe.ingredients.map((n, i) => evalNode(n, s, overrides, String(i)));
  const batch = ingredients.reduce((sum, n) => sum + n.cost, 0) + s.benchCost;
  const craftCostPerUnit = batch / recipe.item.resultAmount;
  const marketBuyPrice = unitBuyPrice(recipe.item, s);
  const net = sellNet(recipe.item, s);
  const profit = net - craftCostPerUnit;
  return {
    item: recipe.item,
    ingredients,
    craftCostPerUnit,
    marketBuyPrice,
    sellNet: net,
    profit,
    margin: craftCostPerUnit > 0 ? profit / craftCostPerUnit : 0,
    saveVsBuy: marketBuyPrice === null ? null : marketBuyPrice - craftCostPerUnit,
  };
}

export interface CraftRow {
  item: Item;
  cost: number;
  sellNet: number;
  profit: number;
  margin: number;
}

/**
 * Быстрая оценка выгоды крафта по всем предметам сразу.
 * Берёт стоимость ингредиентов первого уровня, которую CrossoutDB уже посчитал,
 * поэтому не нужно запрашивать рецепт каждого предмета. Точный расчёт
 * с выбором «купить или скрафтить» на каждом уровне есть на странице предмета.
 */
export function rankCrafts(
  items: Item[],
  s: Settings,
  opts: { minOffers?: number } = {},
): CraftRow[] {
  const minOffers = opts.minOffers ?? 0;
  return items
    .filter((i) => i.craftable && !i.removed && i.sellPrice > 0)
    .map((item) => {
      const sum = s.buyMode === 'instant' ? item.craftingSellSum : item.craftingBuySum;
      return { item, sum };
    })
    .filter(({ item, sum }) => sum > 0 && item.sellOffers + item.buyOrders >= minOffers)
    .map(({ item, sum }) => {
      const cost = sum / item.resultAmount;
      const net = sellNet(item, s);
      const profit = net - cost;
      return { item, cost, sellNet: net, profit, margin: profit / cost };
    })
    .sort((a, b) => b.profit - a.profit);
}
