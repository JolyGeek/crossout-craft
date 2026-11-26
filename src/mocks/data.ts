/*
 * Тестовые данные в «сыром» формате CrossoutDB (цены в сотых долях монеты).
 * Используются в режиме `npm run dev:mock` и в тестах, чтобы сайт можно было
 * разрабатывать без доступа к API. Предметы выдуманы.
 */

type RawItem = Record<string, unknown>;

const res = (id: number, name: string, sell: number, buy: number): RawItem => ({
  id, name, sellPrice: sell, buyPrice: buy, sellOffers: 5000, buyOrders: 8000,
  rarityName: 'Common', categoryName: 'Resources', typeName: 'Resource', faction: '',
  craftable: 0, amount: 100, craftingResultAmount: 0, craftingSellSum: 0, craftingBuySum: 0,
});

export const rawResources: RawItem[] = [
  res(1, 'Scrap Metal x100', 450, 400),
  res(2, 'Copper x100', 2400, 2200),
  res(3, 'Wires x100', 2900, 2600),
  res(4, 'Plastic x100', 6100, 5600),
  res(5, 'Electronics x100', 17000, 15500),
];

const part = (
  id: number, name: string, rarity: string, category: string, faction: string,
  sell: number, buy: number, cSell: number, cBuy: number,
): RawItem => ({
  id, name, sellPrice: sell, buyPrice: buy, sellOffers: 40 + id, buyOrders: 90 + id,
  rarityName: rarity, categoryName: category, typeName: category, faction,
  craftable: 1, amount: 1, craftingResultAmount: 1, craftingSellSum: cSell, craftingBuySum: cBuy,
});

export const rawParts: RawItem[] = [
  part(101, 'Rusty Bolt Gun', 'Common', 'Weapons', 'Engineers', 210, 150, 0, 0),
  part(102, 'Plain Wheel', 'Common', 'Movement', 'Engineers', 120, 90, 0, 0),
  part(201, 'Hornet Cannon', 'Rare', 'Weapons', 'Lunatics', 4200, 3500, 3500, 3000),
  part(202, 'Pebble Wheel', 'Rare', 'Movement', 'Nomads', 1900, 1500, 2100, 1800),
  part(301, 'Thunder Mortar', 'Special', 'Weapons', 'Scavengers', 19500, 17000, 15700, 14000),
  part(401, 'Cobalt Lance', 'Epic', 'Weapons', 'Firestarters', 82000, 76000, 66000, 60000),
];

export const rawItems: RawItem[] = [...rawResources, ...rawParts];

const byId = (id: number) => rawItems.find((i) => i.id === id)!;
const ing = (id: number, number: number, ingredients: unknown[] = []) => ({
  item: byId(id), number, ingredients,
});

/** Деревья рецептов в формате recipe-deep. */
export const rawRecipes: Record<number, unknown> = {
  201: { recipe: { item: byId(201), ingredients: [
    ing(101, 2), ing(1, 150), ing(2, 50),
    { isSumRow: true, item: byId(201), number: 0 },
  ] } },
  202: { recipe: { item: byId(202), ingredients: [ing(102, 3), ing(1, 100), ing(3, 30)] } },
  301: { recipe: { item: byId(301), ingredients: [
    ing(201, 2, [ing(101, 2), ing(1, 150), ing(2, 50)]),
    ing(1, 200), ing(4, 100),
  ] } },
  401: { recipe: { item: byId(401), ingredients: [
    ing(301, 2, [
      ing(201, 2, [ing(101, 2), ing(1, 150), ing(2, 50)]),
      ing(1, 200), ing(4, 100),
    ]),
    ing(202, 3, [ing(102, 3), ing(1, 100), ing(3, 30)]),
    ing(5, 150),
  ] } },
};

/** Синтетическая история цен за 14 дней, точка раз в 2 часа. */
export function rawHistory(id: number): unknown[][] {
  const item = byId(id);
  if (!item) return [];
  const sell = Number(item.sellPrice);
  const buy = Number(item.buyPrice);
  const now = Math.floor(Date.UTC(2026, 10, 26) / 1000);
  const rows: unknown[][] = [];
  for (let i = 14 * 12; i >= 0; i--) {
    const k = 1 + 0.08 * Math.sin(i / 9 + id) + 0.03 * Math.cos(i / 2.3);
    const unix = now - i * 7200;
    rows.push([id, Math.round(sell * k), Math.round(buy * k), 50, 90, new Date(unix * 1000).toISOString(), unix]);
  }
  return rows;
}
