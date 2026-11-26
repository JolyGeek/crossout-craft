const nf = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intf = new Intl.NumberFormat('ru-RU');

export const coins = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : nf.format(v);

export const int = (v: number): string => intf.format(v);

export const percent = (v: number): string =>
  Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%` : '—';

export const signed = (v: number): string => `${v >= 0 ? '+' : ''}${coins(v)}`;

export const RARITY_CLASS: Record<string, string> = {
  Common: 'r-common',
  Rare: 'r-rare',
  Special: 'r-special',
  Epic: 'r-epic',
  Legendary: 'r-legendary',
  Relic: 'r-relic',
};
