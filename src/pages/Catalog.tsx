import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchItems, filterItems } from '../api/client';
import type { Item, ItemFilter } from '../api/types';
import ItemFilters from '../components/ItemFilters';
import { coins, int, RARITY_CLASS } from '../lib/format';
import { useSettings } from '../lib/settings';
import { useAsync } from '../lib/useAsync';

type SortKey = 'name' | 'sellPrice' | 'buyPrice' | 'spread' | 'sellOffers';
const PAGE = 100;


export default function Catalog() {
  const { data, error, loading } = useAsync(fetchItems, []);
  const [filter, setFilter] = useState<ItemFilter>({});
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'sellOffers', desc: true });
  const [limit, setLimit] = useState(PAGE);
  const [{ fee }] = useSettings();
  // Перепродажа: купить через запрос и выставить предложение, с учётом комиссии.
  const spread = (i: Item) => i.sellPrice * (1 - fee) - i.buyPrice;

  const rows = useMemo(() => {
    const list = filterItems(data ?? [], filter);
    const val = (i: Item) => (sort.key === 'spread' ? spread(i) : i[sort.key]);
    return list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.desc ? -c : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, sort, fee]);

  if (loading) return <p className="muted">Загружаю цены…</p>;
  if (error) return <p className="error">Не удалось загрузить предметы: {error}</p>;

  const th = (key: SortKey, label: string, title?: string) => (
    <th
      onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : key !== 'name' })}
      className={sort.key === key ? 'sorted' : ''}
      title={title}
    >
      {label} {sort.key === key ? (sort.desc ? '▼' : '▲') : ''}
    </th>
  );

  return (
    <section>
      <h1>Каталог предметов</h1>
      <ItemFilters items={data ?? []} value={filter} onChange={(f) => { setFilter(f); setLimit(PAGE); }} />
      <p className="muted">Найдено: {int(rows.length)}</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {th('name', 'Предмет')}
              <th>Редкость</th>
              <th>Категория</th>
              {th('sellPrice', 'Купить сразу', 'Самое дешёвое предложение')}
              {th('buyPrice', 'Продать сразу', 'Самый дорогой запрос, до комиссии')}
              {th('spread', 'Перепродажа', 'Купить по запросу и продать по предложению, с учётом комиссии')}
              {th('sellOffers', 'Предложений')}
              <th>Запросов</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((i) => (
              <tr key={i.id}>
                <td><Link to={`/item/${i.id}`}>{i.name}</Link>{i.craftable && <span className="tag">крафт</span>}</td>
                <td className={RARITY_CLASS[i.rarity]}>{i.rarity}</td>
                <td>{i.category}</td>
                <td className="num">{coins(i.sellPrice)}</td>
                <td className="num">{coins(i.buyPrice)}</td>
                <td className={`num ${spread(i) >= 0 ? 'pos' : 'neg'}`}>{coins(spread(i))}</td>
                <td className="num">{int(i.sellOffers)}</td>
                <td className="num">{int(i.buyOrders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button className="more" onClick={() => setLimit(limit + PAGE)}>Показать ещё</button>
      )}
    </section>
  );
}
