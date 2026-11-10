import { useEffect, useState } from 'react';
import { levelBand } from '../domain/config';

export function LevelBar({ level, color }: { level: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, level));
  return (
    <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div style={{ width: `${pct}%`, background: color ?? levelBand(level).color }} />
    </div>
  );
}

export function TrendTag({ trend }: { trend: number }) {
  if (trend <= -0.5) return <span className="tag down">↓ {Math.abs(Math.round(trend))}</span>;
  if (trend >= 0.5) return <span className="tag up">↑ {Math.round(trend)}</span>;
  return null;
}

let showToastImpl: (msg: string) => void = () => {};
export const toast = (msg: string) => showToastImpl(msg);

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    showToastImpl = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2400);
    };
    return () => clearTimeout(t);
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999 }: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <span className="stepper">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span>{value}</span>
      <button type="button" aria-label="Increase" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </span>
  );
}

export const Icon = {
  body: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4.5" r="2.5" />
      <path d="M5 9h14M12 9v6M12 15l-3.5 6M12 15l3.5 6" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
};
