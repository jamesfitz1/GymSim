import { describe, expect, it } from 'vitest';
import { AREA_BY_ID, DEFAULT_SETTINGS, SUB_AREAS, TUNING } from './config';
import { addDays, weekStart } from './dates';
import { areaGains, computeBody, sessionPoints } from './engine';
import { SEED_EXERCISES } from './exercises';
import type { AppState, WorkoutLog } from './types';

const EX = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const TODAY = '2026-11-11'; // a Wednesday

function state(partial: Partial<AppState> = {}): AppState {
  return {
    version: 1,
    startDate: TODAY,
    logs: [],
    customExercises: [],
    pins: [],
    purchases: [],
    settings: { ...DEFAULT_SETTINGS },
    ...partial,
  };
}

let n = 0;
function log(exerciseId: string, date: string, fields: Partial<WorkoutLog>): WorkoutLog {
  return { id: String(n++), exerciseId, date, loggedAt: 0, ...fields };
}

describe('seed exercise table', () => {
  it('every exercise has weights summing to 1 and only known areas', () => {
    for (const ex of SEED_EXERCISES) {
      const sum = ex.mappings.reduce((s, m) => s + m.weight, 0);
      expect(sum, ex.name).toBeCloseTo(1, 6);
      for (const m of ex.mappings) expect(AREA_BY_ID[m.areaId], `${ex.name} → ${m.areaId}`).toBeDefined();
    }
  });

  it('has unique ids and at least 20 starter exercises', () => {
    const ids = SEED_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SEED_EXERCISES.filter((e) => !e.unlockCost).length).toBeGreaterThanOrEqual(20);
  });

  it('every sub-area can be trained by at least one starter exercise', () => {
    const covered = new Set(SEED_EXERCISES.filter((e) => !e.unlockCost).flatMap((e) => e.mappings.map((m) => m.areaId)));
    for (const a of SUB_AREAS) expect(covered.has(a.id), a.name).toBe(true);
  });
});

describe('scoring', () => {
  it('a standard session of anything earns the same main-area points', () => {
    const squat = areaGains(EX['back-squat'], { sets: 5, reps: 5, weightKg: 0 });
    const run = areaGains(EX['running'], { minutes: 20 });
    const catCow = areaGains(EX['cat-cow'], { minutes: 3 });
    expect(squat.quads).toBeCloseTo(TUNING.sessionPoints);
    expect(run.aerobic).toBeCloseTo(TUNING.sessionPoints);
    expect(catCow.backMobility).toBeCloseTo(TUNING.sessionPoints);
  });

  it('distributes points to secondary areas by weight', () => {
    const g = areaGains(EX['back-squat'], { sets: 5, reps: 5 });
    expect(g.glutes / g.quads).toBeCloseTo(0.3 / 0.35);
    expect(g.spinalStabilisers).toBeGreaterThan(0);
  });

  it('load adds a modest multiplier, capped at 1.5×', () => {
    const light = sessionPoints(EX['back-squat'], { sets: 5, reps: 5, weightKg: 0 });
    const heavy = sessionPoints(EX['back-squat'], { sets: 5, reps: 5, weightKg: 120 });
    const absurd = sessionPoints(EX['back-squat'], { sets: 5, reps: 5, weightKg: 500 });
    expect(heavy).toBeGreaterThan(light);
    expect(absurd).toBeCloseTo(heavy);
  });

  it('has diminishing returns and a ceiling on volume', () => {
    const one = sessionPoints(EX['running'], { minutes: 20 });
    const two = sessionPoints(EX['running'], { minutes: 40 });
    const huge = sessionPoints(EX['running'], { minutes: 400 });
    expect(two).toBeLessThan(2 * one);
    expect(huge).toBeCloseTo(sessionPoints(EX['running'], { minutes: 20 * TUNING.maxRatio }));
  });

  it('zero or empty input earns nothing', () => {
    expect(sessionPoints(EX['push-up'], { sets: 3, reps: 0 })).toBe(0);
    expect(sessionPoints(EX['plank'], {})).toBe(0);
  });
});

describe('replay: levels and decay', () => {
  it('starts every area at the start level with no decay on day one', () => {
    const b = computeBody(state(), EX, TODAY);
    for (const a of SUB_AREAS) expect(b.levels[a.id]).toBe(TUNING.startLevel);
  });

  it('decays every area by the daily rate', () => {
    const b = computeBody(state({ startDate: addDays(TODAY, -4) }), EX, TODAY);
    expect(b.levels.quads).toBe(TUNING.startLevel - 4 * DEFAULT_SETTINGS.decayPerDay);
  });

  it('never drops below 0 or rises above 100', () => {
    const low = computeBody(state({ startDate: addDays(TODAY, -100) }), EX, TODAY);
    expect(low.levels.quads).toBe(0);
    const logs = Array.from({ length: 30 }, (_, i) => log('back-squat', addDays(TODAY, -i), { sets: 10, reps: 10, weightKg: 100 }));
    const high = computeBody(state({ startDate: addDays(TODAY, -30), logs }), EX, TODAY);
    expect(high.levels.quads).toBe(100);
  });

  it('caps how much an area can gain in one day', () => {
    const logs = Array.from({ length: 6 }, () => log('running', TODAY, { minutes: 50 }));
    const b = computeBody(state({ logs }), EX, TODAY);
    expect(b.levels.aerobic).toBe(TUNING.startLevel + TUNING.dailyGainCap);
  });

  it('pinned areas decay faster, only from the day they were pinned', () => {
    const start = addDays(TODAY, -6);
    const pins = [{ areaId: 'lowerBack', since: addDays(TODAY, -3), weeklyTarget: 60 }];
    const b = computeBody(state({ startDate: start, pins }), EX, TODAY);
    const d = DEFAULT_SETTINGS;
    expect(b.levels.lowerBack).toBe(TUNING.startLevel - 3 * d.decayPerDay - 3 * d.priorityDecayPerDay);
    expect(b.levels.quads).toBe(TUNING.startLevel - 6 * d.decayPerDay);
  });

  it('flags untrained areas as declining and trained ones as not', () => {
    const logs = [log('cat-cow', TODAY, { minutes: 3 })];
    const b = computeBody(state({ startDate: addDays(TODAY, -5), logs }), EX, TODAY);
    expect(b.trend.quads).toBeLessThan(0);
    expect(b.trend.backMobility).toBeGreaterThan(0);
  });

  it('system level is the average of its sub-areas', () => {
    const logs = [log('cat-cow', TODAY, { minutes: 3 })];
    const b = computeBody(state({ logs }), EX, TODAY);
    const back = (b.levels.lowerBack + b.levels.spinalStabilisers + b.levels.backMobility) / 3;
    expect(b.systemLevels.back).toBeCloseTo(back);
  });

  it('ignores logs for deleted exercises and future dates', () => {
    const logs = [log('nope', TODAY, { minutes: 10 }), log('running', addDays(TODAY, 2), { minutes: 20 })];
    const b = computeBody(state({ logs }), EX, TODAY);
    expect(b.levels.aerobic).toBe(TUNING.startLevel);
  });
});

describe('streaks and coins', () => {
  it('counts a streak and keeps it alive until today ends', () => {
    const logs = [1, 2, 3].map((i) => log('running', addDays(TODAY, -i), { minutes: 20 }));
    const b = computeBody(state({ startDate: addDays(TODAY, -5), logs }), EX, TODAY);
    expect(b.streak).toBe(3);
    const withToday = computeBody(state({ startDate: addDays(TODAY, -5), logs: [...logs, log('running', TODAY, { minutes: 5 })] }), EX, TODAY);
    expect(withToday.streak).toBe(4);
  });

  it('a missed day resets the streak', () => {
    const logs = [log('running', addDays(TODAY, -3), { minutes: 20 })];
    const b = computeBody(state({ startDate: addDays(TODAY, -5), logs }), EX, TODAY);
    expect(b.streak).toBe(0);
    expect(b.longestStreak).toBe(1);
  });

  it('coins come from consistency, not intensity', () => {
    const easy = computeBody(state({ logs: [log('brisk-walk', TODAY, { minutes: 10 })] }), EX, TODAY);
    const brutal = computeBody(state({ logs: [log('deadlift', TODAY, { sets: 10, reps: 10, weightKg: 200 })] }), EX, TODAY);
    expect(easy.coinsEarned).toBe(brutal.coinsEarned);
  });

  it('awards streak milestones and weekly priority targets once', () => {
    const monday = weekStart(TODAY);
    const pins = [{ areaId: 'spinalStabilisers', since: monday, weeklyTarget: 30 }];
    const logs = [0, 1, 2].map((i) => log('bird-dog', addDays(monday, i), { sets: 3, reps: 10 }));
    const b = computeBody(state({ startDate: monday, pins, logs }), EX, TODAY);
    expect(b.ledger.filter((e) => e.reason.startsWith('Weekly target')).length).toBe(1);
    expect(b.ledger.some((e) => e.reason === '3-day streak')).toBe(true);
    expect(b.coinsEarned).toBe(3 * 5 + 10 + 20);
  });

  it('spending reduces the balance', () => {
    const b = computeBody(
      state({ logs: [log('running', TODAY, { minutes: 20 })], purchases: [{ itemId: 'x', cost: 3, date: TODAY }] }),
      EX,
      TODAY,
    );
    expect(b.coinBalance).toBe(2);
  });
});
