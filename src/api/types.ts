/** Предмет рынка в нормализованном виде. Все цены в монетах (уже поделены на 100). */
export interface Item {
  id: number;
  name: string;
  /** Самое дешёвое предложение о продаже: столько платишь при мгновенной покупке. */
  sellPrice: number;
  /** Самый дорогой запрос на покупку: столько получаешь при мгновенной продаже (до комиссии). */
  buyPrice: number;
  sellOffers: number;
  buyOrders: number;
  rarity: string;
  category: string;
  type: string;
  faction: string;
  craftable: boolean;
  /** Стоимость ингредиентов первого уровня по ценам предложений (считает CrossoutDB). */
  craftingSellSum: number;
  /** Стоимость ингредиентов первого уровня по ценам запросов (считает CrossoutDB). */
  craftingBuySum: number;
  /** Сколько единиц в одном лоте рынка (у ресурсов обычно 100). */
  lotSize: number;
  /** Сколько штук получается за один крафт. */
  resultAmount: number;
  removed: boolean;
  meta: boolean;
}

/** Узел дерева крафта. */
export interface RecipeNode {
  item: Item;
  /** Сколько единиц нужно для одного крафта родителя. */
  count: number;
  children: RecipeNode[];
}

export interface Recipe {
  item: Item;
  ingredients: RecipeNode[];
}

export interface PricePoint {
  /** Время в миллисекундах. */
  t: number;
  sell: number;
  buy: number;
}

export interface ItemFilter {
  query?: string;
  rarity?: string;
  category?: string;
  faction?: string;
}
