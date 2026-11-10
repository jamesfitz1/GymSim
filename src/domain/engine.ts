import { COINS, SUB_AREAS, SYSTEMS, TUNING } from './config';
import { addDays, dayRange, weekStart } from './dates';
import type { AppState, Exercise, PriorityPin, SystemId, WorkoutLog } from './types';

// ---------------------------------------------------------------------------
// Scoring (PRD §6.2)
//
//   units  = sets × reps × loadFactor   (reps exercises)
//          = minutes                    (timed exercises)
//   ratio  = min(units / exercise.standard, maxRatio)
//   points = sessionPoints × ratio^curve           ← normalised across modalities
//   gain(area) = points × weight(area) / maxWeight  ← main area gets full points
//
// So one "standard" session of anything — 5×5 squats, a 20-minute run,
// 3 minutes of cat-cow — gives its main area +20, and secondary areas a
// proportional share. Extra volume has diminishing returns.
// ---------------------------------------------------------------------------

export function loadFactor(weightKg: number | undefined): number {
  const kg = Math.max(0, weightKg ?? 0);
  return 1 + Math.min(kg, TUNING.loadCapKg) / TUNING.loadDivisor;
}

export function sessionUnits(ex: Exercise, log: Pick<WorkoutLog, 'sets' | 'reps' | 'weightKg' | 'minutes'>): number {
  if (ex.kind === 'timed') return Math.max(0, log.minutes ?? 0);
  const reps = Math.max(0, log.sets ?? 1) * Math.max(0, log.reps ?? 0);
  return ex.usesWeight ? reps * loadFactor(log.weightKg) : reps;
}

export function sessionPoints(ex: Exercise, log: Pick<WorkoutLog, 'sets' | 'reps' | 'weightKg' | 'minutes'>): number {
  const units = sessionUnits(ex, log);
  if (units <= 0 || ex.standard <= 0) return 0;
  const ratio = Math.min(units / ex.standard, TUNING.maxRatio);
  return TUNING.sessionPoints * ratio ** TUNING.curve;
}

export function areaGains(ex: Exercise, log: Pick<WorkoutLog, 'sets' | 'reps' | 'weightKg' | 'minutes'>): Record<string, number> {
  const pts = sessionPoints(ex, log);
  const maxW = Math.max(0, ...ex.mappings.map((m) => m.weight));
  const out: Record<string, number> = {};
  if (pts <= 0 || maxW <= 0) return out;
  for (const m of ex.mappings) out[m.areaId] = (out[m.areaId] ?? 0) + (pts * m.weight) / maxW;
  return out;
}

// ---------------------------------------------------------------------------
// Replay (PRD §6.3 decay, §6.4 priorities, §6.5 coins)
//
// Walk every day from the start date to today. On each day: apply that day's
// gains (capped per area), award coins, then — for every day before today —
// apply overnight decay. Priority areas decay at the faster rate from the day
// they were pinned.
// ---------------------------------------------------------------------------

export interface CoinEntry {
  date: string;
  amount: number;
  reason: string;
}

export interface BodyState {
  today: string;
  levels: Record<string, number>;
  systemLevels: Record<SystemId, number>;
  /** Level change over the last TUNING.trendDays days. */
  trend: Record<string, number>;
  /** Last day each area received points, if ever. */
  lastTrained: Record<string, string | undefined>;
  /** Points earned this week (Mon–today) per area. */
  weekGains: Record<string, number>;
  /** Sub-areas that got any points this week (PRD §8 balance metric). */
  distinctAreasThisWeek: number;
  streak: number;
  longestStreak: number;
  trainingDays: number;
  coinsEarned: number;
  coinsSpent: number;
  coinBalance: number;
  ledger: CoinEntry[];
  /** Level per area at the end of each of the last 14 days (oldest first). */
  recent: { date: string; levels: Record<string, number> }[];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function pinOn(pins: PriorityPin[], areaId: string, day: string) {
  return pins.find((p) => p.areaId === areaId && p.since <= day);
}

export function computeBody(state: AppState, exercises: Record<string, Exercise>, today: string): BodyState {
  const { settings, pins } = state;
  const logsByDay = new Map<string, WorkoutLog[]>();
  let start = state.startDate;
  for (const log of state.logs) {
    if (log.date > today) continue;
    if (log.date < start) start = log.date;
    const list = logsByDay.get(log.date) ?? [];
    list.push(log);
    logsByDay.set(log.date, list);
  }
  if (start > today) start = today;

  const levels: Record<string, number> = {};
  const lastTrained: Record<string, string | undefined> = {};
  for (const a of SUB_AREAS) levels[a.id] = TUNING.startLevel;

  const ledger: CoinEntry[] = [];
  const recent: BodyState['recent'] = [];
  const thisWeek = weekStart(today);
  let weekKey = '';
  let weekGains: Record<string, number> = {};
  const targetHit = new Set<string>();

  let streak = 0;
  let streakBeforeToday = 0;
  let longestStreak = 0;
  let trainingDays = 0;
  const days = dayRange(start, today);
  const keepFrom = addDays(today, -13);

  for (const day of days) {
    const wk = weekStart(day);
    if (wk !== weekKey) {
      weekKey = wk;
      weekGains = {};
    }

    // 1. Gains from today's logs, capped per area per day.
    const dayLogs = logsByDay.get(day) ?? [];
    const dayGain: Record<string, number> = {};
    for (const log of dayLogs) {
      const ex = exercises[log.exerciseId];
      if (!ex) continue;
      for (const [areaId, g] of Object.entries(areaGains(ex, log))) {
        if (!(areaId in levels)) continue;
        dayGain[areaId] = (dayGain[areaId] ?? 0) + g;
      }
    }
    for (const [areaId, raw] of Object.entries(dayGain)) {
      const g = Math.min(raw, TUNING.dailyGainCap);
      if (g <= 0) continue;
      levels[areaId] = clamp(levels[areaId] + g, 0, TUNING.maxLevel);
      weekGains[areaId] = (weekGains[areaId] ?? 0) + g;
      lastTrained[areaId] = day;
    }

    // 2. Consistency coins: training day + streak milestones.
    if (day === today) streakBeforeToday = streak;
    if (dayLogs.length > 0) {
      trainingDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
      ledger.push({ date: day, amount: COINS.trainingDay, reason: 'Training day' });
      const milestone = COINS.streakMilestones.find((m) => m.days === streak);
      if (milestone) ledger.push({ date: day, amount: milestone.coins, reason: `${milestone.days}-day streak` });
    } else {
      streak = 0;
    }

    // 3. Priority weekly targets (awarded once per area per week).
    for (const pin of pins) {
      if (pin.since > day) continue;
      const key = `${wk}:${pin.areaId}`;
      if (!targetHit.has(key) && (weekGains[pin.areaId] ?? 0) >= pin.weeklyTarget) {
        targetHit.add(key);
        const name = SUB_AREAS.find((a) => a.id === pin.areaId)?.name ?? pin.areaId;
        ledger.push({ date: day, amount: COINS.weeklyTargetHit, reason: `Weekly target: ${name}` });
      }
    }

    if (day >= keepFrom) recent.push({ date: day, levels: { ...levels } });

    // 4. Overnight decay (not yet applied for today).
    if (day !== today) {
      for (const a of SUB_AREAS) {
        const base = a.decayPerDay ?? settings.decayPerDay;
        const rate = pinOn(pins, a.id, day) ? Math.max(base, settings.priorityDecayPerDay) : base;
        levels[a.id] = clamp(levels[a.id] - rate, 0, TUNING.maxLevel);
      }
    }
  }

  // A streak isn't broken until today ends without a workout.
  const currentStreak = logsByDay.has(today) ? streak : streakBeforeToday;

  const systemLevels = {} as Record<SystemId, number>;
  for (const s of SYSTEMS) {
    const subs = SUB_AREAS.filter((a) => a.systemId === s.id);
    systemLevels[s.id] = subs.reduce((sum, a) => sum + levels[a.id], 0) / subs.length;
  }

  const trend: Record<string, number> = {};
  const past = recent.length > TUNING.trendDays ? recent[recent.length - 1 - TUNING.trendDays] : recent[0];
  for (const a of SUB_AREAS) trend[a.id] = levels[a.id] - (past?.levels[a.id] ?? levels[a.id]);

  const currentWeekGains = weekKey === thisWeek ? weekGains : {};
  const coinsEarned = ledger.reduce((s, e) => s + e.amount, 0);
  const coinsSpent = state.purchases.reduce((s, p) => s + p.cost, 0);

  return {
    today,
    levels,
    systemLevels,
    trend,
    lastTrained,
    weekGains: currentWeekGains,
    distinctAreasThisWeek: Object.values(currentWeekGains).filter((g) => g > 0).length,
    streak: currentStreak,
    longestStreak,
    trainingDays,
    coinsEarned,
    coinsSpent,
    coinBalance: coinsEarned - coinsSpent,
    ledger: ledger.reverse(),
    recent,
  };
}

/** Is the area visibly in decline? (Lower now than TUNING.trendDays days ago.) */
export function isDeclining(body: BodyState, areaId: string): boolean {
  return body.trend[areaId] < 0;
}
