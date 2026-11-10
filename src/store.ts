import { useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, TUNING } from './domain/config';
import { todayKey } from './domain/dates';
import { computeBody } from './domain/engine';
import { SEED_EXERCISES } from './domain/exercises';
import type { AppState, Exercise, Settings, WorkoutLog } from './domain/types';

// Local-only persistence (PRD §12-E): everything lives in this browser's
// localStorage. No account, no server, no health data leaves the phone.

const KEY = 'gymsim:v1';

export function freshState(): AppState {
  return {
    version: 1,
    startDate: todayKey(),
    logs: [],
    customExercises: [],
    pins: [],
    purchases: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function isState(x: unknown): x is AppState {
  const s = x as AppState;
  return !!s && s.version === 1 && typeof s.startDate === 'string' && Array.isArray(s.logs);
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isState(parsed)) return { ...freshState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return freshState();
}

let state: AppState = load();
const listeners = new Set<() => void>();

function set(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota: keep working in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState() {
  return useSyncExternalStore(subscribe, () => state);
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function allExercises(s: AppState): Exercise[] {
  return [...SEED_EXERCISES, ...s.customExercises];
}

export function exerciseMap(s: AppState): Record<string, Exercise> {
  return Object.fromEntries(allExercises(s).map((e) => [e.id, e]));
}

export function isUnlocked(s: AppState, ex: Exercise) {
  return !ex.unlockCost || s.purchases.some((p) => p.itemId === `exercise:${ex.id}`);
}

export function ownsSkin(s: AppState, skinId: string) {
  return skinId === 'classic' || s.purchases.some((p) => p.itemId === `skin:${skinId}`);
}

/** Derived body state, recomputed whenever stored facts change. */
export function useBody() {
  const s = useAppState();
  const today = todayKey();
  return useMemo(() => computeBody(s, exerciseMap(s), today), [s, today]);
}

export const actions = {
  completeOnboarding(pinnedAreaIds: string[]) {
    const today = todayKey();
    set({
      ...state,
      onboardedAt: today,
      startDate: state.logs.length ? state.startDate : today,
      pins: pinnedAreaIds.map((areaId) => ({ areaId, since: today, weeklyTarget: TUNING.defaultWeeklyTarget })),
    });
  },

  addLog(log: Omit<WorkoutLog, 'id' | 'loggedAt'>) {
    set({ ...state, logs: [...state.logs, { ...log, id: uid(), loggedAt: Date.now() }] });
  },

  deleteLog(id: string) {
    set({ ...state, logs: state.logs.filter((l) => l.id !== id) });
  },

  addCustomExercise(ex: Omit<Exercise, 'id' | 'custom'>) {
    const created: Exercise = { ...ex, id: `custom-${uid()}`, custom: true };
    set({ ...state, customExercises: [...state.customExercises, created] });
    return created;
  },

  deleteCustomExercise(id: string) {
    set({
      ...state,
      customExercises: state.customExercises.filter((e) => e.id !== id),
      logs: state.logs.filter((l) => l.exerciseId !== id),
    });
  },

  togglePin(areaId: string) {
    const pinned = state.pins.some((p) => p.areaId === areaId);
    set({
      ...state,
      pins: pinned
        ? state.pins.filter((p) => p.areaId !== areaId)
        : [...state.pins, { areaId, since: todayKey(), weeklyTarget: TUNING.defaultWeeklyTarget }],
    });
  },

  setWeeklyTarget(areaId: string, weeklyTarget: number) {
    set({ ...state, pins: state.pins.map((p) => (p.areaId === areaId ? { ...p, weeklyTarget } : p)) });
  },

  /** Returns false if the balance can't cover it. */
  buy(itemId: string, cost: number, balance: number) {
    if (cost > balance || state.purchases.some((p) => p.itemId === itemId)) return false;
    set({ ...state, purchases: [...state.purchases, { itemId, cost, date: todayKey() }] });
    return true;
  },

  updateSettings(patch: Partial<Settings>) {
    set({ ...state, settings: { ...state.settings, ...patch } });
  },

  exportJson() {
    return JSON.stringify(state, null, 2);
  },

  importJson(raw: string) {
    const parsed = JSON.parse(raw);
    if (!isState(parsed)) throw new Error('That file is not a GymSim backup.');
    set({ ...freshState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } });
  },

  reset() {
    set(freshState());
  },
};
