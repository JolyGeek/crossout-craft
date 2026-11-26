import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchItems, filterItems } from '../api/client';
import type { ItemFilter } from '../api/types';
import ItemFilters from '../components/ItemFilters';
import { rankCrafts } from '../lib/craft';
import { coins, percent, RARITY_CLASS, signed } from '../lib/format';
import { useSettings } from '../lib/settings';
import { useAsync } from '../lib/useAsync';

export default function TopCrafts() {
  const { data, error, loading } = useAsync(fetchItems, []);
  const [settings] = useSettings();
  const [filter, setFilter] = useState<ItemFilter>({});
  const [minOffers, setMinOffers] = useState(20);
  const [sortBy, setSortBy] = useState<'profit' | 'margin'>('profit');

  const rows = useMemo(() => {
    const ranked = rankCrafts(filterItems(data ?? [], filter), settings, { minOffers });
    return sortBy === 'margin' ? [...ranked].sort((a, b) => b.margin - a.margin) : ranked;
  }, [data, filter, settings, minOffers, sortBy]);

  if (loading) return <p className="muted">Загружаю цены…</p>;
  if (error) return <p className="error">Не удалось загрузить предметы: {error}</p>;

  return (
    <section>
      <h1>Выгодные крафты</h1>
      <p className="muted">
        Себестоимость здесь считается по ингредиентам первого уровня, купленным на рынке, без платы за верстак.
        Точный расчёт с выбором «купить или скрафтить» для каждого компонента открывается на странице предмета.
      </p>
      <ItemFilters items={data ?? []} value={filter} onChange={setFilter} />
      <div className="filters">
        <label>
          Мин. ликвидность (предложений + запросов)
          <input type="number" min={0} value={minOffers} onChange={(e) => setMinOffers(Number(e.target.value))} />
        </label>
        <label>
          Сортировать по
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'profit' | 'margin')}>
            <option value="profit">прибыли в монетах</option>
            <option value="margin">прибыли в процентах</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Предмет</th>
              <th>Редкость</th>
              <th>Себестоимость</th>
              <th>Выручка после комиссии</th>
              <th>Прибыль</th>
              <th>Маржа</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r) => (
              <tr key={r.item.id}>
                <td><Link to={`/item/${r.item.id}`}>{r.item.name}</Link></td>
                <td className={RARITY_CLASS[r.item.rarity]}>{r.item.rarity}</td>
                <td className="num">{coins(r.cost)}</td>
                <td className="num">{coins(r.sellNet)}</td>
                <td className={`num ${r.profit >= 0 ? 'pos' : 'neg'}`}>{signed(r.profit)}</td>
                <td className={`num ${r.margin >= 0 ? 'pos' : 'neg'}`}>{percent(r.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted">Ничего не нашлось с такими фильтрами.</p>}
    </section>
  );
}
