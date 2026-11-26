import { describe, expect, it } from 'vitest';
import { normalizeHistory, normalizeItems, normalizeRecipe } from '../api/normalize';
import { rawHistory, rawItems, rawRecipes } from '../mocks/data';
import { computeCraft, defaultSettings, rankCrafts, sellNet, unitBuyPrice, type Settings } from './craft';

const s: Settings = { ...defaultSettings };
const items = normalizeItems(rawItems);
const byId = (id: number) => items.find((i) => i.id === id)!;

describe('normalize', () => {
  it('переводит цены из сотых в монеты и читает размер лота', () => {
    const copper = byId(2);
    expect(copper.sellPrice).toBe(24);
    expect(copper.lotSize).toBe(100);
    expect(byId(201).craftable).toBe(true);
  });

  it('пропускает служебные строки с итогами в рецепте', () => {
    const r = normalizeRecipe(rawRecipes[201]);
    expect(r.ingredients.map((i) => i.item.id)).toEqual([101, 1, 2]);
  });

  it('разбирает историю цен из строк market-all', () => {
    const h = normalizeHistory(rawHistory(201));
    expect(h.length).toBeGreaterThan(100);
    expect(h[0].t).toBeLessThan(h[h.length - 1].t);
    expect(h[0].sell).toBeGreaterThan(0);
  });

  it('не падает на пустом или странном ответе', () => {
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeRecipe({}).ingredients).toEqual([]);
    expect(normalizeHistory('oops')).toEqual([]);
  });
});

describe('цены', () => {
  it('цена ресурса считается за единицу, а не за лот', () => {
    expect(unitBuyPrice(byId(1), s)).toBeCloseTo(0.045);
    expect(unitBuyPrice(byId(1), { ...s, buyMode: 'order' })).toBeCloseTo(0.04);
  });

  it('выручка учитывает комиссию', () => {
    expect(sellNet(byId(201), s)).toBeCloseTo(42 * 0.9);
    expect(sellNet(byId(201), { ...s, sellMode: 'instant' })).toBeCloseTo(35 * 0.9);
  });
});

describe('computeCraft', () => {
  it('считает себестоимость простого рецепта', () => {
    // 2 × 2.10 + 150 × 0.045 + 50 × 0.24 = 4.2 + 6.75 + 12 = 22.95
    const r = computeCraft(normalizeRecipe(rawRecipes[201]), s);
    expect(r.craftCostPerUnit).toBeCloseTo(22.95);
    expect(r.profit).toBeCloseTo(42 * 0.9 - 22.95);
    expect(r.saveVsBuy).toBeCloseTo(42 - 22.95);
  });

  it('выбирает крафт компонента, если он дешевле покупки', () => {
    const r = computeCraft(normalizeRecipe(rawRecipes[301]), s);
    const cannon = r.ingredients[0];
    expect(cannon.buyCost).toBeCloseTo(84);
    expect(cannon.craftCost).toBeCloseTo(45.9);
    expect(cannon.choice).toBe('craft');
    // 45.9 + 200 × 0.045 + 100 × 0.61 = 45.9 + 9 + 61 = 115.9
    expect(r.craftCostPerUnit).toBeCloseTo(115.9);
  });

  it('учитывает ручной выбор и плату за верстак', () => {
    const r = computeCraft(normalizeRecipe(rawRecipes[301]), { ...s, benchCost: 10 }, { '0': 'buy' });
    expect(r.ingredients[0].choice).toBe('buy');
    expect(r.ingredients[0].isCheapest).toBe(false);
    expect(r.craftCostPerUnit).toBeCloseTo(84 + 9 + 61 + 10);
  });

  it('не даёт выбрать крафт для ресурса', () => {
    const r = computeCraft(normalizeRecipe(rawRecipes[201]), s, { '1': 'craft' });
    expect(r.ingredients[1].choice).toBe('buy');
  });

  it('делит себестоимость, если за крафт выходит несколько штук', () => {
    const recipe = normalizeRecipe(rawRecipes[201]);
    recipe.item = { ...recipe.item, resultAmount: 2 };
    expect(computeCraft(recipe, s).craftCostPerUnit).toBeCloseTo(22.95 / 2);
  });
});

describe('rankCrafts', () => {
  it('сортирует по прибыли и пропускает некрафтовые предметы', () => {
    const rows = rankCrafts(items, s);
    expect(rows.every((r) => r.item.craftable)).toBe(true);
    expect(rows[0].item.id).toBe(401);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].profit).toBeGreaterThanOrEqual(rows[i].profit);
  });

  it('фильтрует по ликвидности', () => {
    expect(rankCrafts(items, s, { minOffers: 1e6 })).toEqual([]);
  });
});
