import type { Item, ItemFilter } from '../api/types';

const uniq = (items: Item[], key: 'rarity' | 'category' | 'faction') =>
  [...new Set(items.map((i) => i[key]).filter(Boolean))].sort();

export default function ItemFilters({
  items,
  value,
  onChange,
}: {
  items: Item[];
  value: ItemFilter;
  onChange: (f: ItemFilter) => void;
}) {
  const select = (key: 'rarity' | 'category' | 'faction', label: string) => (
    <select value={value[key] ?? ''} onChange={(e) => onChange({ ...value, [key]: e.target.value || undefined })}>
      <option value="">{label}: все</option>
      {uniq(items, key).map((v) => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  );
  return (
    <div className="filters">
      <input
        type="search"
        placeholder="Поиск по названию"
        value={value.query ?? ''}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
      />
      {select('rarity', 'Редкость')}
      {select('category', 'Категория')}
      {select('faction', 'Фракция')}
    </div>
  );
}
