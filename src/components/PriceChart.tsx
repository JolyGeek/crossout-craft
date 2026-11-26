import { useState } from 'react';
import type { PricePoint } from '../api/types';
import { coins } from '../lib/format';

const W = 720;
const H = 240;
const PAD = { l: 64, r: 12, t: 12, b: 28 };

/** Лёгкий SVG-график цен продажи и покупки, без внешних библиотек. */
export default function PriceChart({ points }: { points: PricePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="muted">Недостаточно данных для графика.</p>;

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const vals = points.flatMap((p) => [p.sell, p.buy]).filter((v) => v > 0);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    hi += 1;
    lo = Math.max(0, lo - 1);
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;

  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = (key: 'sell' | 'buy') =>
    points.filter((p) => p[key] > 0).map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');

  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
  const days = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  const fmtDay = (t: number) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    setHover(best);
  };
  const hp = hover === null ? null : points[hover];

  return (
    <div className="chart">
      <div className="legend">
        <span className="sw sell" /> Цена предложений (купить)
        <span className="sw buy" /> Цена запросов (продать сразу)
        {hp && (
          <span className="hover-val">
            {new Date(hp.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}:
            {' '}{coins(hp.sell)} / {coins(hp.buy)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="График цены">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="axis">{coins(v)}</text>
          </g>
        ))}
        {days.map((t, i) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} className="axis">
            {fmtDay(t)}
          </text>
        ))}
        <path d={line('sell')} className="ln sell" />
        <path d={line('buy')} className="ln buy" />
        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.t} y2={H - PAD.b} className="cursor" />}
      </svg>
    </div>
  );
}
