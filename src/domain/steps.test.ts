import { describe, expect, it } from 'vitest';
import { COINS, DEFAULT_SETTINGS, SUB_AREAS, TUNING } from './config';
import { addDays } from './dates';
import { computeBody } from './engine';
import { SEED_EXERCISES } from './exercises';
import { normaliseState } from './migrate';
import { parseStepsRollup, stepPoints } from './steps';
import type { AppState } from './types';

const exercises = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const today = '2026-11-15';
const state = (extra: Partial<AppState> = {}): AppState => ({
  version: 2,
  profile: { id: 'p', name: 'T', createdAt: 1 },
  startDate: addDays(today, -10),
  workouts: [],
  plans: [],
  customExercises: [],
  pins: [],
  injuries: [],
  purchases: [],
  settings: { ...DEFAULT_SETTINGS },
  ...extra,
});

describe('steps', () => {
  it('scores steps on a capped linear scale above the floor', () => {
    expect(stepPoints(undefined)).toBe(0);
    expect(stepPoints(2500)).toBe(0);
    expect(stepPoints(3000)).toBe(0);
    expect(stepPoints(8000)).toBeCloseTo(5);
    expect(stepPoints(11000)).toBe(TUNING.stepsDailyMax);
    expect(stepPoints(30000)).toBe(TUNING.stepsDailyMax);
  });

  it('raises only aerobic base and does not count as a training day', () => {
    const plain = computeBody(state(), exercises, today);
    const steps: Record<string, number> = {};
    for (let i = 0; i <= 10; i++) steps[addDays(today, -i)] = 10000;
    const walked = computeBody(state({ steps }), exercises, today);
    expect(walked.levels.aerobic).toBeGreaterThan(plain.levels.aerobic + 5);
    for (const a of SUB_AREAS) if (a.id !== 'aerobic') expect(walked.levels[a.id]).toBeCloseTo(plain.levels[a.id]);
    expect(walked.streak).toBe(0);
    expect(walked.trainingDays).toBe(0);
  });

  it('awards coins on days the step goal is reached', () => {
    const body = computeBody(
      state({ steps: { [today]: 9000, [addDays(today, -1)]: 7000, [addDays(today, -2)]: 8000 }, settings: { ...DEFAULT_SETTINGS, stepGoal: 8000 } }),
      exercises,
      today,
    );
    const goalDays = body.ledger.filter((e) => e.reason === 'Step goal');
    expect(goalDays.map((e) => e.date).sort()).toEqual([addDays(today, -2), today]);
    expect(body.coinsEarned).toBe(2 * COINS.stepGoal);
  });

  it('loads old profiles without steps', () => {
    const s = normaliseState({ ...state(), steps: undefined }, state().profile, exercises)!;
    expect(() => computeBody(s, exercises, today)).not.toThrow();
  });

  it('parses a dailyRollUp response into per-day totals', () => {
    const body = {
      rollupDataPoints: [
        { civilStartTime: { date: { year: 2026, month: 11, day: 14 } }, civilEndTime: { date: { year: 2026, month: 11, day: 15 } }, steps: { countSum: '10432' } },
        { civilStartTime: { date: { year: 2026, month: 11, day: 15 } }, steps: { countSum: '0' } },
        { civilStartTime: { date: { year: 2026, month: 11, day: 13 } } },
        { civilStartTime: { date: { year: 2026, month: 11, day: 12 } }, steps: { countSum: 'nope' } },
      ],
    };
    expect(parseStepsRollup(body)).toEqual({ '2026-11-14': 10432, '2026-11-15': 0 });
    expect(parseStepsRollup({})).toEqual({});
    expect(parseStepsRollup(null)).toEqual({});
  });
});
