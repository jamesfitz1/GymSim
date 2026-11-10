// Calendar-day helpers. Days are local-time 'YYYY-MM-DD' strings; arithmetic
// goes through UTC so daylight-saving changes never skip or repeat a day.

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function addDays(key: string, n: number): string {
  return utcToKey(keyToUtc(key) + n * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / DAY_MS);
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const dow = new Date(keyToUtc(key)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

export function dayRange(from: string, to: string): string[] {
  const n = daysBetween(from, to);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

export function formatDay(key: string, today: string): string {
  const diff = daysBetween(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(keyToUtc(key));
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
