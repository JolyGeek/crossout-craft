import { describe, expect, it } from 'vitest';
import { computeCraft, defaultSettings } from '../lib/craft';
import { buildRecipe } from './client';
import { extractFlight, parseMarketHtml, toSnapshot, type CoreInitialData } from './crossoutcore';
import { normalizeItems } from './normalize';

// Уменьшенная копия структуры, которую отдаёт crossoutcore.ru (формат на 26.11.2026).
const initialData: CoreInitialData = {
  items: [
    { id: 1434, name: 'Металлолом x100', rarityId: 2, factionId: 0, categoryId: 8, typeId: 1, recipe: '$undefined', removed: 0, amount: 100, craftable: 0, craftingResultAmount: 0 },
    { id: 1432, name: 'Медь x100', rarityId: 2, factionId: 0, categoryId: 8, typeId: 1, recipe: '$undefined', removed: 0, amount: 100, craftable: 0, craftingResultAmount: 0 },
    { id: 10, name: 'Простая пушка', rarityId: 2, factionId: 1, categoryId: 2, typeId: 5, recipe: '$undefined', removed: 0, amount: 1, craftable: 0, craftingResultAmount: 0 },
    {
      id: 20, name: 'Редкая пушка', rarityId: 3, factionId: 1, categoryId: 2, typeId: 5,
      recipe: { resultAmount: 1, ingredients: [{ id: 10, amount: 2 }, { id: 1434, amount: 150 }, { id: 1432, amount: 50 }] },
      removed: 0, amount: 1, craftable: 1, craftingResultAmount: 1,
    },
    {
      id: 30, name: 'Особый миномёт', rarityId: 4, factionId: 2, categoryId: 2, typeId: 6,
      recipe: { resultAmount: 1, ingredients: [{ id: 20, amount: 2 }, { id: 1434, amount: 200 }] },
      removed: 0, amount: 1, craftable: 1, craftingResultAmount: 1,
    },
  ],
  marketData: {
    '1434': { s: 4.5, b: 4, so: 400, bo: 500 },
    '1432': { s: 24, b: 22, so: 300, bo: 200 },
    '10': { s: 2.1, b: 1.5, so: 50, bo: 90 },
    '20': { s: 84, b: 70, so: 20, bo: 30 },
    '30': { s: 195, b: 170, so: 10, bo: 12 },
  },
  rarities: [{ id: 2, name: 'Обычная' }, { id: 3, name: 'Редкая' }, { id: 4, name: 'Особая' }],
  factions: [{ id: 1, name: 'Механики' }, { id: 2, name: 'Бешеные' }],
  categories: [{ id: 2, name: 'Оружие' }, { id: 8, name: 'Ресурсы' }],
  types: [{ id: 1, name: 'Ресурс' }, { id: 5, name: 'Пушка' }, { id: 6, name: 'Миномёт' }],
  lastUpdateTimestamp: 1795733113000,
};

/** Собирает HTML так же, как его отдаёт Next.js: поток разрезан на несколько push-вызовов. */
function fakeHtml(): string {
  const row = `2e:${JSON.stringify(['$', '$L46', null, { initialData, children: '$L47' }])}\n`;
  const flight = `1:"$Sreact.fragment"\n${row}47:["$","div",null,{}]\n`;
  const cut = Math.floor(flight.length / 2);
  const push = (s: string) => `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`;
  return `<html><body>${push(flight.slice(0, cut))}${push(flight.slice(cut))}</body></html>`;
}

describe('crossoutcore', () => {
  it('склеивает поток Next.js из нескольких кусков', () => {
    expect(extractFlight(fakeHtml())).toContain('"initialData"');
  });

  it('находит initialData на странице', () => {
    const data = parseMarketHtml(fakeHtml());
    expect(data.items).toHaveLength(5);
    expect(data.marketData['20'].s).toBe(84);
  });

  it('понятно падает, если формат страницы изменился', () => {
    expect(() => parseMarketHtml('<html></html>')).toThrow(/crossoutcore/);
  });

  it('переводит предметы в наш формат с русскими названиями', () => {
    const snap = toSnapshot(initialData);
    const items = normalizeItems(snap.items);
    const cannon = items.find((i) => i.id === 20)!;
    expect(cannon.sellPrice).toBe(84);
    expect(cannon.rarity).toBe('Редкая');
    expect(cannon.faction).toBe('Механики');
    expect(cannon.craftable).toBe(true);
    // 2 × 2.10 + 150/100 × 4.5 + 50/100 × 24 = 4.2 + 6.75 + 12 = 22.95
    expect(cannon.craftingSellSum).toBeCloseTo(22.95);
    expect(items.find((i) => i.id === 1434)!.lotSize).toBe(100);
  });

  it('строит полное дерево рецепта и считает крафт', () => {
    const recipe = buildRecipe(toSnapshot(initialData), 30);
    expect(recipe.ingredients[0].item.id).toBe(20);
    expect(recipe.ingredients[0].children.map((c) => c.item.id)).toEqual([10, 1434, 1432]);
    const r = computeCraft(recipe, defaultSettings);
    // Пушку дешевле скрафтить: 2 × 22.95 = 45.9 против 2 × 84 = 168. Плюс 200 металлолома = 9.
    expect(r.ingredients[0].choice).toBe('craft');
    expect(r.craftCostPerUnit).toBeCloseTo(45.9 + 9);
  });

  it('не зацикливается на рецепте, ссылающемся сам на себя', () => {
    const snap = toSnapshot(initialData);
    snap.recipes[10] = { resultAmount: 1, ingredients: [{ id: 30, amount: 1 }] };
    expect(() => buildRecipe(snap, 30)).not.toThrow();
  });
});
