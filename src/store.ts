import { useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, TUNING } from './domain/config';
import { todayKey } from './domain/dates';
import { computeBody } from './domain/engine';
import { SEED_EXERCISES } from './domain/exercises';
import { normaliseState } from './domain/migrate';
import type { AppState, Exercise, Plan, PriorityPin, ProfileInfo, SetEntry, Settings, Workout, WorkoutEntry } from './domain/types';

// Local-only persistence (PRD §12-E). Several profiles can live on one device;
// there are no logins. Storage layout:
//   gymsim:profiles       → { profiles: ProfileInfo[], lastId }
//   gymsim:profile:<id>   → AppState for that profile
// v0.1 data under `gymsim:v1` is migrated into a first profile on load.

const INDEX_KEY = 'gymsim:profiles';
const profileKey = (id: string) => `gymsim:profile:${id}`;
const LEGACY_KEY = 'gymsim:v1';
const SESSION_KEY = 'gymsim:session-profile';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const SEED_MAP: Record<string, Exercise> = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));

interface ProfileIndex {
  profiles: ProfileInfo[];
  lastId?: string;
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: keep working in memory */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function blankState(profile: ProfileInfo): AppState {
  return {
    version: 2,
    profile,
    startDate: todayKey(),
    workouts: [],
    plans: [],
    customExercises: [],
    pins: [],
    purchases: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function loadIndex(): ProfileIndex {
  const idx = read(INDEX_KEY) as ProfileIndex | null;
  if (idx && Array.isArray(idx.profiles)) return idx;

  // First run of v0.2: adopt any v0.1 data as the first profile.
  const legacy = read(LEGACY_KEY);
  if (legacy) {
    const profile: ProfileInfo = { id: uid(), name: 'Me', createdAt: Date.now() };
    const migrated = normaliseState(legacy, profile, SEED_MAP);
    if (migrated) {
      write(profileKey(profile.id), migrated);
      const next = { profiles: [profile], lastId: profile.id };
      write(INDEX_KEY, next);
      return next;
    }
  }
  return { profiles: [] };
}

function loadProfile(info: ProfileInfo): AppState {
  return normaliseState(read(profileKey(info.id)), info, SEED_MAP) ?? blankState(info);
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

let index: ProfileIndex = loadIndex();
let state: AppState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Re-open the profile used in this browser session (survives reloads, not relaunches).
try {
  const sid = sessionStorage.getItem(SESSION_KEY);
  const info = index.profiles.find((p) => p.id === sid);
  if (info) state = loadProfile(info);
} catch {
  /* sessionStorage unavailable */
}

function set(next: AppState) {
  state = next;
  write(profileKey(next.profile.id), next);
  emit();
}

function saveIndex(next: ProfileIndex) {
  index = next;
  write(INDEX_KEY, next);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The open profile's state, or null when the profile picker should show. */
export function useCurrentState() {
  return useSyncExternalStore(subscribe, () => state);
}

/** For screens rendered only while a profile is open. */
export function useAppState(): AppState {
  const s = useCurrentState();
  if (!s) throw new Error('No profile open');
  return s;
}

export function useProfiles() {
  return useSyncExternalStore(subscribe, () => index);
}

function cur(): AppState {
  if (!state) throw new Error('No profile open');
  return state;
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

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

export function activeWorkout(s: AppState): Workout | undefined {
  return s.workouts.find((w) => w.id === s.activeWorkoutId && !w.finishedAt);
}

/** The most recent earlier entry of this exercise that had done sets. */
export function lastEntryFor(s: AppState, exerciseId: string, excludeWorkoutId?: string): { workout: Workout; entry: WorkoutEntry } | undefined {
  const sorted = [...s.workouts].filter((w) => w.id !== excludeWorkoutId).sort((a, b) => b.startedAt - a.startedAt);
  for (const w of sorted) {
    const entry = w.entries.find((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.done));
    if (entry) return { workout: w, entry };
  }
  return undefined;
}

export function useBody() {
  const s = useAppState();
  const today = todayKey();
  return useMemo(() => computeBody(s, exerciseMap(s), today), [s, today]);
}

function defaultSets(ex: Exercise | undefined): SetEntry[] {
  if (ex?.kind === 'timed') return [{ minutes: ex.standard, done: false }];
  return Array.from({ length: 3 }, () => ({ reps: 10, done: false }));
}

function setsFromLast(s: AppState, exerciseId: string, excludeWorkoutId?: string): SetEntry[] {
  const last = lastEntryFor(s, exerciseId, excludeWorkoutId);
  if (!last) return defaultSets(exerciseMap(s)[exerciseId]);
  return last.entry.sets.filter((x) => x.done).map(({ reps, weightKg, minutes }) => ({ reps, weightKg, minutes, done: false }));
}

function updateWorkout(id: string, fn: (w: Workout) => Workout) {
  const s = cur();
  set({ ...s, workouts: s.workouts.map((w) => (w.id === id ? fn(w) : w)) });
}

function updateEntry(workoutId: string, entryId: string, fn: (e: WorkoutEntry) => WorkoutEntry) {
  updateWorkout(workoutId, (w) => ({ ...w, entries: w.entries.map((e) => (e.id === entryId ? fn(e) : e)) }));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const profiles = {
  open(id: string) {
    const info = index.profiles.find((p) => p.id === id);
    if (!info) return;
    state = loadProfile(info);
    saveIndex({ ...index, lastId: id });
    try {
      sessionStorage.setItem(SESSION_KEY, id);
    } catch {
      /* ignore */
    }
  },

  /** Back to the "Who's training?" screen. */
  close() {
    state = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    emit();
  },

  create(opts: { name: string; startLevels?: Record<string, number>; assessment?: Record<string, string>; focusAreas?: string[] }) {
    const info: ProfileInfo = { id: uid(), name: opts.name.trim() || 'Me', createdAt: Date.now() };
    const today = todayKey();
    const s: AppState = {
      ...blankState(info),
      onboardedAt: today,
      startLevels: opts.startLevels,
      assessment: opts.assessment,
      pins: (opts.focusAreas ?? []).map((areaId) => ({ areaId, since: today, weeklyTarget: TUNING.defaultWeeklyTarget })),
    };
    write(profileKey(info.id), s);
    saveIndex({ profiles: [...index.profiles, info], lastId: info.id });
    profiles.open(info.id);
  },

  rename(name: string) {
    const s = cur();
    const info = { ...s.profile, name: name.trim() || s.profile.name };
    saveIndex({ ...index, profiles: index.profiles.map((p) => (p.id === info.id ? info : p)) });
    set({ ...s, profile: info });
  },

  /** Deletes the open profile and all its data. */
  deleteCurrent() {
    const s = cur();
    remove(profileKey(s.profile.id));
    const rest = index.profiles.filter((p) => p.id !== s.profile.id);
    saveIndex({ profiles: rest, lastId: rest[0]?.id });
    profiles.close();
  },
};

export const actions = {
  // --- Workouts -------------------------------------------------------------
  startWorkout(from?: { planId?: string; repeatWorkoutId?: string }): string {
    const s = cur();
    const plan = from?.planId ? s.plans.find((p) => p.id === from.planId) : undefined;
    const repeat = from?.repeatWorkoutId ? s.workouts.find((w) => w.id === from.repeatWorkoutId) : undefined;
    const entries: WorkoutEntry[] = plan
      ? plan.entries.map((e) => ({ id: uid(), exerciseId: e.exerciseId, sets: e.sets.map((x) => ({ ...x, done: false })) }))
      : repeat
        ? repeat.entries.map((e) => ({ id: uid(), exerciseId: e.exerciseId, sets: setsFromLast(s, e.exerciseId) }))
        : [];
    const w: Workout = {
      id: `w-${uid()}`,
      date: todayKey(),
      startedAt: Date.now(),
      name: plan?.name ?? repeat?.name,
      planId: plan?.id,
      entries,
    };
    set({ ...s, workouts: [...s.workouts, w], activeWorkoutId: w.id });
    return w.id;
  },

  addEntry(workoutId: string, exerciseId: string) {
    const s = cur();
    const entry: WorkoutEntry = { id: uid(), exerciseId, sets: setsFromLast(s, exerciseId, workoutId) };
    updateWorkout(workoutId, (w) => ({ ...w, entries: [...w.entries, entry] }));
  },

  removeEntry(workoutId: string, entryId: string) {
    updateWorkout(workoutId, (w) => ({ ...w, entries: w.entries.filter((e) => e.id !== entryId) }));
  },

  updateSet(workoutId: string, entryId: string, index: number, patch: Partial<SetEntry>) {
    updateEntry(workoutId, entryId, (e) => ({ ...e, sets: e.sets.map((x, i) => (i === index ? { ...x, ...patch } : x)) }));
  },

  addSet(workoutId: string, entryId: string) {
    updateEntry(workoutId, entryId, (e) => {
      const last = e.sets[e.sets.length - 1];
      const next: SetEntry = last ? { reps: last.reps, weightKg: last.weightKg, minutes: last.minutes, done: false } : { reps: 10, done: false };
      return { ...e, sets: [...e.sets, next] };
    });
  },

  removeSet(workoutId: string, entryId: string, index: number) {
    updateEntry(workoutId, entryId, (e) => ({ ...e, sets: e.sets.filter((_, i) => i !== index) }));
  },

  renameWorkout(workoutId: string, name: string) {
    updateWorkout(workoutId, (w) => ({ ...w, name: name.trim() || undefined }));
  },

  /** Closes the workout. Exercises with nothing ticked are dropped; an empty workout is discarded. */
  finishWorkout(workoutId: string) {
    const s = cur();
    const w = s.workouts.find((x) => x.id === workoutId);
    if (!w) return;
    const entries = w.entries
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
      .filter((e) => e.sets.length > 0);
    const workouts = entries.length
      ? s.workouts.map((x) => (x.id === workoutId ? { ...x, entries, finishedAt: Date.now() } : x))
      : s.workouts.filter((x) => x.id !== workoutId);
    set({ ...s, workouts, activeWorkoutId: undefined });
  },

  discardWorkout(workoutId: string) {
    const s = cur();
    set({
      ...s,
      workouts: s.workouts.filter((w) => w.id !== workoutId),
      activeWorkoutId: s.activeWorkoutId === workoutId ? undefined : s.activeWorkoutId,
    });
  },

  /** Re-open a finished workout to fix it (becomes the active one). */
  reopenWorkout(workoutId: string) {
    const s = cur();
    set({
      ...s,
      workouts: s.workouts.map((w) => (w.id === workoutId ? { ...w, finishedAt: undefined } : w)),
      activeWorkoutId: workoutId,
    });
  },

  // --- Plans ----------------------------------------------------------------
  savePlanFromWorkout(workoutId: string, name: string) {
    const s = cur();
    const w = s.workouts.find((x) => x.id === workoutId);
    if (!w) return;
    const plan: Plan = {
      id: `p-${uid()}`,
      name: name.trim() || 'My plan',
      createdAt: Date.now(),
      entries: w.entries.map((e) => ({
        exerciseId: e.exerciseId,
        sets: (e.sets.some((x) => x.done) ? e.sets.filter((x) => x.done) : e.sets).map(({ reps, weightKg, minutes }) => ({ reps, weightKg, minutes })),
      })),
    };
    set({ ...s, plans: [...s.plans, plan] });
    return plan.id;
  },

  createPlan(name: string, exerciseIds: string[]) {
    const s = cur();
    const map = exerciseMap(s);
    const plan: Plan = {
      id: `p-${uid()}`,
      name: name.trim() || 'My plan',
      createdAt: Date.now(),
      entries: exerciseIds.map((id) => ({
        exerciseId: id,
        sets: setsFromLast(s, id).map(({ reps, weightKg, minutes }) => ({ reps, weightKg, minutes })).slice(0, map[id]?.kind === 'timed' ? 1 : 5),
      })),
    };
    set({ ...s, plans: [...s.plans, plan] });
    return plan.id;
  },

  updatePlan(plan: Plan) {
    const s = cur();
    set({ ...s, plans: s.plans.map((p) => (p.id === plan.id ? plan : p)) });
  },

  deletePlan(planId: string) {
    const s = cur();
    set({ ...s, plans: s.plans.filter((p) => p.id !== planId) });
  },

  // --- Library --------------------------------------------------------------
  addCustomExercise(ex: Omit<Exercise, 'id' | 'custom'>) {
    const s = cur();
    const created: Exercise = { ...ex, id: `custom-${uid()}`, custom: true };
    set({ ...s, customExercises: [...s.customExercises, created] });
    return created;
  },

  deleteCustomExercise(id: string) {
    const s = cur();
    set({
      ...s,
      customExercises: s.customExercises.filter((e) => e.id !== id),
      workouts: s.workouts
        .map((w) => ({ ...w, entries: w.entries.filter((e) => e.exerciseId !== id) }))
        .filter((w) => w.entries.length > 0 || !w.finishedAt),
      plans: s.plans.map((p) => ({ ...p, entries: p.entries.filter((e) => e.exerciseId !== id) })),
    });
  },

  // --- Focus areas ------------------------------------------------------------
  togglePin(areaId: string) {
    const s = cur();
    const pinned = s.pins.some((p) => p.areaId === areaId);
    const pins: PriorityPin[] = pinned
      ? s.pins.filter((p) => p.areaId !== areaId)
      : [...s.pins, { areaId, since: todayKey(), weeklyTarget: TUNING.defaultWeeklyTarget }];
    set({ ...s, pins });
  },

  setWeeklyTarget(areaId: string, weeklyTarget: number) {
    const s = cur();
    set({ ...s, pins: s.pins.map((p) => (p.areaId === areaId ? { ...p, weeklyTarget } : p)) });
  },

  // --- Rewards & settings -----------------------------------------------------
  /** Returns false if the balance can't cover it. */
  buy(itemId: string, cost: number, balance: number) {
    const s = cur();
    if (cost > balance || s.purchases.some((p) => p.itemId === itemId)) return false;
    set({ ...s, purchases: [...s.purchases, { itemId, cost, date: todayKey() }] });
    return true;
  },

  updateSettings(patch: Partial<Settings>) {
    const s = cur();
    set({ ...s, settings: { ...s.settings, ...patch } });
  },

  // --- Data -------------------------------------------------------------------
  exportJson() {
    return JSON.stringify(cur(), null, 2);
  },

  /** Replaces the open profile's data with a backup (v0.1 or v0.2). */
  importJson(raw: string) {
    const s = cur();
    const next = normaliseState(JSON.parse(raw), s.profile, SEED_MAP);
    if (!next) throw new Error('That file is not a GymSim backup.');
    set(next);
  },

  /** Clears this profile's training data but keeps the profile. */
  reset() {
    const s = cur();
    set({ ...blankState(s.profile), onboardedAt: todayKey() });
  },
};
