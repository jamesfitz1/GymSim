import { describe, expect, it } from 'vitest';
import { AREA_BY_ID, dailyFade, DEFAULT_SETTINGS, HALF_LIFE_DAYS, SUB_AREAS, TUNING } from './config';
import { addDays, weekStart } from './dates';
import { areaGains, computeBody, entryGains, headroom, isDeclining, sessionPoints } from './engine';
import { SEED_EXERCISES } from './exercises';
import { logsToWorkouts, normaliseState } from './migrate';
import type { AppState, LegacyStateV1, WorkoutLog } from './types';

const EX = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const TODAY = '2026-11-11'; // a Wednesday

const PROFILE = { id: 'p1', name: 'Test', createdAt: 0 };

/** Builds a state; `logs` (one exercise per log) are turned into workouts. */
function state(partial: Partial<AppState> & { logs?: WorkoutLog[] } = {}): AppState {
  const { logs = [], ...rest } = partial;
  return {
    version: 2,
    profile: PROFILE,
    startDate: TODAY,
    workouts: logsToWorkouts(logs, EX),
    plans: [],
    customExercises: [],
    pins: [],
    purchases: [],
    settings: { ...DEFAULT_SETTINGS },
    ...rest,
    injuries: rest.injuries ?? [],
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

  it('has a library of 120+ exercises, each tagged with equipment', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(120);
    for (const ex of SEED_EXERCISES) expect(ex.equipment, ex.name).toBeTruthy();
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

  it('loses a percentage each day, set by the half-life', () => {
    const b = computeBody(state({ startDate: addDays(TODAY, -HALF_LIFE_DAYS.strength) }), EX, TODAY);
    expect(b.levels.quads).toBeCloseTo(TUNING.startLevel / 2, 5);
  });

  it('cardio fades faster than mobility, which fades faster than strength', () => {
    const b = computeBody(state({ startDate: addDays(TODAY, -10) }), EX, TODAY);
    expect(b.levels.aerobic).toBeLessThan(b.levels.hipMobility);
    expect(b.levels.hipMobility).toBeLessThan(b.levels.quads);
  });

  it('the fade-speed setting scales every rate', () => {
    const start = addDays(TODAY, -14);
    const gentle = computeBody(state({ startDate: start, settings: { ...DEFAULT_SETTINGS, decaySpeed: 'gentle' } }), EX, TODAY);
    const std = computeBody(state({ startDate: start }), EX, TODAY);
    const tough = computeBody(state({ startDate: start, settings: { ...DEFAULT_SETTINGS, decaySpeed: 'tough' } }), EX, TODAY);
    expect(gentle.levels.quads).toBeGreaterThan(std.levels.quads);
    expect(std.levels.quads).toBeGreaterThan(tough.levels.quads);
  });

  it('never drops below 0 or rises above 100', () => {
    const low = computeBody(state({ startDate: addDays(TODAY, -365) }), EX, TODAY);
    expect(low.levels.aerobic).toBeGreaterThanOrEqual(0);
    expect(low.levels.aerobic).toBeLessThan(1);
    const logs = Array.from({ length: 60 }, (_, i) => log('back-squat', addDays(TODAY, -i), { sets: 10, reps: 10, weightKg: 100 }));
    const high = computeBody(state({ startDate: addDays(TODAY, -60), logs }), EX, TODAY);
    expect(high.levels.quads).toBeLessThanOrEqual(100);
    expect(high.levels.quads).toBeGreaterThan(85);
  });

  it('caps the daily gain, and stronger areas gain less', () => {
    const logs = Array.from({ length: 6 }, () => log('running', TODAY, { minutes: 50 }));
    const b = computeBody(state({ logs }), EX, TODAY);
    expect(b.levels.aerobic).toBeCloseTo(TUNING.startLevel + TUNING.dailyGainCap * headroom(TUNING.startLevel));
    const one = [log('running', TODAY, { minutes: 20 })];
    const weak = computeBody(state({ logs: one, startLevels: { aerobic: 20 } }), EX, TODAY);
    const strong = computeBody(state({ logs: one, startLevels: { aerobic: 80 } }), EX, TODAY);
    expect(weak.levels.aerobic - 20).toBeGreaterThan(strong.levels.aerobic - 80);
  });

  it('weekly targets count the points earned, before headroom', () => {
    const b = computeBody(state({ logs: [log('bird-dog', TODAY, { sets: 3, reps: 10 })] }), EX, TODAY);
    expect(b.weekGains.spinalStabilisers).toBeCloseTo(TUNING.sessionPoints);
  });

  it('focus areas fade faster, only from the day they were added', () => {
    const start = addDays(TODAY, -6);
    const pins = [{ areaId: 'lowerBack', since: addDays(TODAY, -3), weeklyTarget: 60 }];
    const b = computeBody(state({ startDate: start, pins }), EX, TODAY);
    const normal = dailyFade('strength');
    const focus = dailyFade('strength', 'standard', true);
    expect(focus).toBeCloseTo(normal * TUNING.focusFadeMultiplier);
    expect(b.levels.lowerBack).toBeCloseTo(TUNING.startLevel * (1 - normal) ** 3 * (1 - focus) ** 3);
    expect(b.levels.quads).toBeCloseTo(TUNING.startLevel * (1 - normal) ** 6);
  });

  it('flags untrained areas as declining and trained ones as not', () => {
    const logs = [log('cat-cow', TODAY, { minutes: 3 })];
    const b = computeBody(state({ startDate: addDays(TODAY, -5), logs }), EX, TODAY);
    expect(isDeclining(b, 'aerobic')).toBe(true);
    expect(isDeclining(b, 'backMobility')).toBe(false);
    expect(b.trend.backMobility).toBeGreaterThan(0);
  });

  /** Train one exercise `perWeek` times a week for 6 months; return the final week's average level. */
  function settle(exerciseId: string, area: string, perWeek: number, fields: Partial<WorkoutLog>) {
    const pattern: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4] };
    const days = 26 * 7;
    const logs: WorkoutLog[] = [];
    for (let d = 0; d < days; d++) if (pattern[perWeek].includes(d % 7)) logs.push(log(exerciseId, addDays(TODAY, d - days + 1), fields));
    const levels = [0, 1, 2, 3, 4, 5, 6].map((back) => computeBody(state({ startDate: addDays(TODAY, -days + 1), logs }), EX, addDays(TODAY, -back)).levels[area]);
    return levels.reduce((a, b) => a + b, 0) / levels.length;
  }

  it('levels settle where training frequency puts them, instead of hitting 100 or 0', () => {
    const squat = { sets: 5, reps: 5 };
    const once = settle('back-squat', 'quads', 1, squat);
    const twice = settle('back-squat', 'quads', 2, squat);
    const thrice = settle('back-squat', 'quads', 3, squat);
    expect(once).toBeGreaterThan(40);
    expect(once).toBeLessThan(65);
    expect(twice).toBeGreaterThan(once + 10);
    expect(thrice).toBeGreaterThan(twice + 5);
    expect(thrice).toBeLessThan(95);
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

describe('workouts (v0.2)', () => {
  const W = (sets: { reps?: number; weightKg?: number; minutes?: number; done: boolean }[], exerciseId = 'push-up', date = TODAY) => ({
    id: 'w', date, startedAt: 0, entries: [{ id: 'e', exerciseId, sets }],
  });

  it('only ticked sets score', () => {
    const g = entryGains(EX['push-up'], [
      { reps: 10, done: true },
      { reps: 10, done: true },
      { reps: 10, done: false },
    ]);
    expect(g.chest).toBeCloseTo(sessionPoints(EX['push-up'], { sets: 2, reps: 10 }) * 1);
    const none = computeBody(state({ workouts: [W([{ reps: 10, done: false }])] }), EX, TODAY);
    expect(none.levels.chest).toBe(TUNING.startLevel);
    expect(none.trainingDays).toBe(0);
  });

  it('per-set weights are respected', () => {
    const mixed = entryGains(EX['back-squat'], [
      { reps: 5, weightKg: 100, done: true },
      { reps: 5, weightKg: 0, done: true },
    ]);
    const light = entryGains(EX['back-squat'], [
      { reps: 5, weightKg: 0, done: true },
      { reps: 5, weightKg: 0, done: true },
    ]);
    expect(mixed.quads).toBeGreaterThan(light.quads);
  });

  it('splitting the same exercise across workouts in a day earns no extra', () => {
    const one = computeBody(state({ workouts: [W([{ reps: 15, done: true }, { reps: 15, done: true }])] }), EX, TODAY);
    const split = computeBody(
      state({ workouts: [{ ...W([{ reps: 15, done: true }]), id: 'a' }, { ...W([{ reps: 15, done: true }]), id: 'b' }] }),
      EX,
      TODAY,
    );
    expect(split.levels.chest).toBeCloseTo(one.levels.chest);
  });

  it('an unfinished workout still counts its ticked sets', () => {
    const b = computeBody(state({ workouts: [W([{ minutes: 20, done: true }], 'running')] }), EX, TODAY);
    expect(b.levels.aerobic).toBeCloseTo(TUNING.startLevel + TUNING.sessionPoints * headroom(TUNING.startLevel));
  });

  it('uses starting levels from the health check', () => {
    const b = computeBody(state({ startLevels: { quads: 55 } }), EX, TODAY);
    expect(b.levels.quads).toBe(55);
    expect(b.levels.chest).toBe(TUNING.startLevel);
  });
});

describe('migration from v0.1', () => {
  const v1: LegacyStateV1 = {
    version: 1,
    startDate: addDays(TODAY, -3),
    onboardedAt: addDays(TODAY, -3),
    logs: [
      log('back-squat', addDays(TODAY, -2), { sets: 5, reps: 5, weightKg: 60 }),
      log('running', addDays(TODAY, -2), { minutes: 20 }),
      log('bird-dog', TODAY, { sets: 3, reps: 10 }),
    ],
    customExercises: [],
    pins: [{ areaId: 'spinalStabilisers', since: addDays(TODAY, -3), weeklyTarget: 60 }],
    purchases: [],
    settings: { ...DEFAULT_SETTINGS },
  };

  it('groups logs into one workout per day with done sets', () => {
    const s = normaliseState(v1, PROFILE, EX)!;
    expect(s.version).toBe(2);
    expect(s.workouts).toHaveLength(2);
    const squat = s.workouts[0].entries.find((e) => e.exerciseId === 'back-squat')!;
    expect(squat.sets).toHaveLength(5);
    expect(squat.sets.every((x) => x.done && x.reps === 5 && x.weightKg === 60)).toBe(true);
    const run = s.workouts[0].entries.find((e) => e.exerciseId === 'running')!;
    expect(run.sets).toEqual([{ minutes: 20, done: true }]);
    expect(s.pins).toHaveLength(1);
  });

  it('gives the same body state before and after migration', () => {
    const migrated = normaliseState(v1, PROFILE, EX)!;
    const direct = computeBody(state({ startDate: v1.startDate, logs: v1.logs, pins: v1.pins }), EX, TODAY);
    const after = computeBody(migrated, EX, TODAY);
    for (const a of SUB_AREAS) expect(after.levels[a.id]).toBeCloseTo(direct.levels[a.id]);
    expect(after.coinsEarned).toBe(direct.coinsEarned);
  });

  it('rejects data that is not GymSim', () => {
    expect(normaliseState({ hello: 'world' }, PROFILE, EX)).toBeNull();
    expect(normaliseState(null, PROFILE, EX)).toBeNull();
  });
});

describe('health check scoring', () => {
  it('scores every area within bounds', async () => {
    const { scoreAssessment, START_MIN, START_MAX } = await import('./assessment');
    const s = scoreAssessment({});
    for (const a of SUB_AREAS) {
      expect(s[a.id]).toBeGreaterThanOrEqual(START_MIN);
      expect(s[a.id]).toBeLessThanOrEqual(START_MAX);
    }
  });

  it('fitter answers give higher starting levels in the tested areas', async () => {
    const { scoreAssessment } = await import('./assessment');
    const low = scoreAssessment({ activity: '0', pushups: '0', walk: '0', toeTouch: '0' });
    const high = scoreAssessment({ activity: '3', pushups: '4', walk: '3', toeTouch: '4' });
    for (const a of ['chest', 'aerobic', 'hamstringFlex', 'backMobility']) expect(high[a]).toBeGreaterThan(low[a]);
  });

  it('"not sure" falls back to the activity estimate', async () => {
    const { scoreAssessment } = await import('./assessment');
    const unsure = scoreAssessment({ activity: '2', pushups: 'unsure' });
    const skipped = scoreAssessment({ activity: '2' });
    expect(unsure.chest).toBe(skipped.chest);
  });

  it('suggests back focus areas only when the back is flagged', async () => {
    const { suggestedFocus } = await import('./assessment');
    expect(suggestedFocus({ condition: 'back' })).toContain('spinalStabilisers');
    expect(suggestedFocus({ condition: 'none' })).toEqual([]);
  });
});

describe('health check v0.3', () => {
  it('every area is covered by at least one self-test (incl. lats and calves)', async () => {
    const { TEST_AREAS } = await import('./assessment');
    const covered = new Set(Object.values(TEST_AREAS).flat());
    for (const a of SUB_AREAS) expect(covered.has(a.id), a.name).toBe(true);
  });

  it('a very fit person can start well above the old 70 ceiling, but never above START_MAX', async () => {
    const { QUESTIONS, scoreAssessment, START_MAX } = await import('./assessment');
    const best = Object.fromEntries(
      QUESTIONS.map((q) => [q.id, [...q.options].filter((o) => o.score !== undefined).sort((a, b) => b.score! - a.score!)[0]?.value ?? 'none']),
    );
    const s = scoreAssessment(best);
    expect(Math.max(...Object.values(s))).toBeGreaterThan(75);
    for (const v of Object.values(s)) expect(v).toBeLessThanOrEqual(START_MAX);
  });

  it('starting levels follow training frequency for that type of area', async () => {
    const { scoreAssessment } = await import('./assessment');
    const lifter = scoreAssessment({ activity: '2', strengthFreq: 'often3', cardioFreq: 'never', stretchFreq: 'never' });
    expect(lifter.quads).toBeGreaterThan(lifter.aerobic + 20);
    expect(lifter.quads).toBeGreaterThan(lifter.hipMobility + 20);
  });
});

describe('injuries', () => {
  const inj = (over: Partial<import('./types').Injury> = {}): import('./types').Injury => ({
    id: 'i1', region: 'lower-back', side: 'none', areaIds: ['lowerBack', 'spinalStabilisers', 'backMobility'],
    severity: 'moderate', startDate: TODAY, underCare: true, pain: [], ...over,
  });

  it('takes 10 off each affected area once, on the start day', () => {
    const b = computeBody(state({ injuries: [inj()] }), EX, TODAY);
    expect(b.levels.lowerBack).toBe(TUNING.startLevel - TUNING.injuryHit);
    expect(b.levels.backMobility).toBe(TUNING.startLevel - TUNING.injuryHit);
    expect(b.levels.quads).toBe(TUNING.startLevel);
    expect(b.injured.lowerBack).toEqual(['i1']);
  });

  it('affected areas stop fading while active; others keep fading', () => {
    const start = addDays(TODAY, -10);
    const b = computeBody(state({ startDate: start, injuries: [inj({ startDate: start })] }), EX, TODAY);
    expect(b.levels.lowerBack).toBe(TUNING.startLevel - TUNING.injuryHit);
    expect(b.levels.quads).toBeLessThan(TUNING.startLevel - 5);
  });

  it('rehab during an injury still raises the area', () => {
    const b = computeBody(state({ injuries: [inj()], logs: [log('bird-dog', TODAY, { sets: 3, reps: 10 })] }), EX, TODAY);
    expect(b.levels.spinalStabilisers).toBeGreaterThan(TUNING.startLevel - TUNING.injuryHit);
  });

  it('normal fading resumes once recovered, and recovered injuries are not "injured" today', () => {
    const start = addDays(TODAY, -10);
    const resolved = addDays(TODAY, -5);
    const b = computeBody(state({ startDate: start, injuries: [inj({ startDate: start, resolvedDate: resolved })] }), EX, TODAY);
    const expected = (TUNING.startLevel - TUNING.injuryHit) * (1 - dailyFade('strength')) ** 5;
    expect(b.levels.lowerBack).toBeCloseTo(expected);
    expect(b.injured.lowerBack).toBeUndefined();
  });

  it('deleting an injury restores the levels it changed', () => {
    const start = addDays(TODAY, -4);
    const without = computeBody(state({ startDate: start }), EX, TODAY);
    const withIt = computeBody(state({ startDate: start, injuries: [inj({ startDate: addDays(TODAY, -2) })] }), EX, TODAY);
    expect(withIt.levels.lowerBack).not.toBeCloseTo(without.levels.lowerBack);
    const after = computeBody(state({ startDate: start, injuries: [] }), EX, TODAY);
    expect(after.levels.lowerBack).toBeCloseTo(without.levels.lowerBack);
  });

  it('an injury that began before the profile still hits once and pauses fading', () => {
    const b = computeBody(state({ startDate: addDays(TODAY, -3), injuries: [inj({ startDate: addDays(TODAY, -30) })] }), EX, TODAY);
    expect(b.levels.lowerBack).toBe(TUNING.startLevel - TUNING.injuryHit);
  });

  it('every injury region maps to real areas', async () => {
    const { INJURY_REGIONS } = await import('./config');
    for (const r of INJURY_REGIONS) {
      expect(r.areas.length, r.name).toBeGreaterThan(0);
      for (const a of r.areas) expect(AREA_BY_ID[a], `${r.name} → ${a}`).toBeDefined();
    }
  });

  it('old saved profiles load with no injuries', () => {
    const s = normaliseState({ ...state(), injuries: undefined }, PROFILE, EX)!;
    expect(s.injuries).toEqual([]);
  });
});
