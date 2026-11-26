import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchHistory, fetchRecipe } from '../api/client';
import PriceChart from '../components/PriceChart';
import { computeCraft, type Choice, type NodeResult } from '../lib/craft';
import { coins, int, percent, RARITY_CLASS, signed } from '../lib/format';
import { useSettings } from '../lib/settings';
import { useAsync } from '../lib/useAsync';

// key сбрасывает выбор «купить/крафт» и плату за верстак при переходе на другой предмет.
export default function ItemRoute() {
  const id = Number(useParams().id);
  return <ItemPage key={id} id={id} />;
}

function ItemPage({ id }: { id: number }) {
  const recipe = useAsync(() => fetchRecipe(id), [id]);
  const history = useAsync(() => fetchHistory(id), [id]);
  const [settings] = useSettings();
  const [benchCost, setBenchCost] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Choice>>({});

  const result = useMemo(
    () => (recipe.data ? computeCraft(recipe.data, { ...settings, benchCost }, overrides) : null),
    [recipe.data, settings, benchCost, overrides],
  );

  if (recipe.loading) return <p className="muted">Загружаю рецепт…</p>;
  if (recipe.error || !result) return <p className="error">Не удалось загрузить предмет: {recipe.error}</p>;

  const item = result.item;
  const hasRecipe = result.ingredients.length > 0;
  const toggle = (path: string, choice: Choice) => setOverrides({ ...overrides, [path]: choice });

  return (
    <section>
      <p><Link to="/">← Каталог</Link></p>
      <h1>{item.name}</h1>
      <p className="meta">
        <span className={RARITY_CLASS[item.rarity]}>{item.rarity}</span>
        {item.category && <> · {item.category}</>}
        {item.faction && <> · {item.faction}</>}
        {' · '}предложений {int(item.sellOffers)}, запросов {int(item.buyOrders)}
      </p>

      <div className="cards">
        <div className="card">
          <div className="label">Купить сразу</div>
          <div className="value">{coins(item.sellPrice)}</div>
        </div>
        <div className="card">
          <div className="label">Продать сразу (до комиссии)</div>
          <div className="value">{coins(item.buyPrice)}</div>
        </div>
        {hasRecipe && (
          <>
            <div className="card">
              <div className="label">Себестоимость крафта</div>
              <div className="value">{coins(result.craftCostPerUnit)}</div>
            </div>
            <div className={`card ${result.profit >= 0 ? 'good' : 'bad'}`}>
              <div className="label">Прибыль с продажи</div>
              <div className="value">{signed(result.profit)}</div>
              <div className="sub">{percent(result.margin)} · выручка {coins(result.sellNet)}</div>
            </div>
            {result.saveVsBuy !== null && (
              <div className={`card ${result.saveVsBuy >= 0 ? 'good' : 'bad'}`}>
                <div className="label">{result.saveVsBuy >= 0 ? 'Крафт дешевле покупки на' : 'Покупка дешевле крафта на'}</div>
                <div className="value">{coins(Math.abs(result.saveVsBuy))}</div>
              </div>
            )}
          </>
        )}
      </div>

      {hasRecipe ? (
        <>
          <h2>Калькулятор крафта</h2>
          <div className="filters">
            <label>
              Плата за верстак
              <input type="number" min={0} step={1} value={benchCost} onChange={(e) => setBenchCost(Math.max(0, Number(e.target.value)))} />
            </label>
            {Object.keys(overrides).length > 0 && (
              <button onClick={() => setOverrides({})}>Сбросить на самый дешёвый вариант</button>
            )}
          </div>
          <p className="muted">
            Для каждого компонента выбран самый дешёвый вариант. Нажми «купить» или «крафт», чтобы посчитать по-своему.
            {item.resultAmount > 1 && ` За один крафт получается ${item.resultAmount} шт., цены указаны за одну.`}
          </p>
          <div className="table-wrap">
            <table className="tree">
              <thead>
                <tr>
                  <th>Компонент</th>
                  <th>Кол-во</th>
                  <th>Купить</th>
                  <th>Скрафтить</th>
                  <th>Выбрано</th>
                </tr>
              </thead>
              <tbody>
                {result.ingredients.map((n) => (
                  <Row key={n.path} node={n} depth={0} onToggle={toggle} />
                ))}
                <tr className="total">
                  <td colSpan={4}>Итого за крафт{benchCost > 0 ? ' с верстаком' : ''}</td>
                  <td className="num">{coins(result.craftCostPerUnit * item.resultAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="muted">Этот предмет не крафтится, его можно только купить.</p>
      )}

      <h2>Цена за 14 дней</h2>
      {history.loading ? (
        <p className="muted">Загружаю историю…</p>
      ) : history.error ? (
        <p className="error">История недоступна: {history.error}</p>
      ) : (
        <PriceChart points={history.data ?? []} />
      )}
    </section>
  );
}

function Row({
  node,
  depth,
  onToggle,
}: {
  node: NodeResult;
  depth: number;
  onToggle: (path: string, c: Choice) => void;
}) {
  const btn = (c: Choice, cost: number | null) =>
    cost === null ? (
      <span className="muted">—</span>
    ) : (
      <button className={`pick ${node.choice === c ? 'on' : ''}`} onClick={() => onToggle(node.path, c)}>
        {coins(cost)}
      </button>
    );
  return (
    <>
      <tr className={depth ? 'sub' : ''}>
        <td style={{ paddingLeft: 8 + depth * 20 }}>
          {depth > 0 && '↳ '}
          <Link to={`/item/${node.item.id}`}>{node.item.name}</Link>
          {!node.isCheapest && <span className="tag warn" title="Есть вариант дешевле">не самый дешёвый</span>}
        </td>
        <td className="num">{int(node.qty)}</td>
        <td className="num">{btn('buy', node.buyCost)}</td>
        <td className="num">{btn('craft', node.craftCost)}</td>
        <td className="num">{coins(node.cost)}</td>
      </tr>
      {node.choice === 'craft' &&
        node.children.map((c) => <Row key={c.path} node={c} depth={depth + 1} onToggle={onToggle} />)}
    </>
  );
}
