import { TUNING } from './config';

/** Aerobic-base points (before headroom) for a day's steps. */
export function stepPoints(steps: number | undefined): number {
  if (!steps || steps <= TUNING.stepsFloor) return 0;
  return Math.min(TUNING.stepsDailyMax, (steps - TUNING.stepsFloor) / TUNING.stepsPerPoint);
}

export function stepGoalOf(goal: number | undefined): number {
  return goal && goal > 0 ? goal : TUNING.defaultStepGoal;
}

interface CivilDate {
  date?: { year?: number; month?: number; day?: number };
}

/**
 * Turns a Google Health API `steps` dailyRollUp response into per-day totals.
 * `countSum` is an int64 sent as a string; days with no value are skipped.
 */
export function parseStepsRollup(body: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const points = (body as { rollupDataPoints?: unknown[] })?.rollupDataPoints;
  if (!Array.isArray(points)) return out;
  for (const p of points as { civilStartTime?: CivilDate; steps?: { countSum?: string | number } }[]) {
    const d = p?.civilStartTime?.date;
    const raw = p?.steps?.countSum;
    if (!d?.year || !d.month || !d.day || raw === undefined || raw === null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    const key = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
    out[key] = (out[key] ?? 0) + Math.round(n);
  }
  return out;
}
