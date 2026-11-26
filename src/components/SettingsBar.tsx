import { useSettings } from '../lib/settings';

export default function SettingsBar() {
  const [s, set] = useSettings();
  return (
    <div className="settings">
      <label>
        Покупаю
        <select value={s.buyMode} onChange={(e) => set({ ...s, buyMode: e.target.value as typeof s.buyMode })}>
          <option value="instant">сразу, по цене предложений</option>
          <option value="order">через запрос, по цене запросов</option>
        </select>
      </label>
      <label>
        Продаю
        <select value={s.sellMode} onChange={(e) => set({ ...s, sellMode: e.target.value as typeof s.sellMode })}>
          <option value="offer">выставляю предложение</option>
          <option value="instant">сразу, в лучший запрос</option>
        </select>
      </label>
      <label>
        Комиссия, %
        <input
          type="number"
          min={0}
          max={50}
          step={1}
          value={Math.round(s.fee * 100)}
          onChange={(e) => set({ ...s, fee: Math.max(0, Number(e.target.value)) / 100 })}
        />
      </label>
    </div>
  );
}
