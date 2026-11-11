import { DEFAULT_SETTINGS } from './config';
import type { AppState, Exercise, LegacyStateV1, ProfileInfo, Workout, WorkoutLog } from './types';

// Converts older saved data to the current shape. Pure functions, so they're
// easy to test and safe to run on every load and on imported backups.

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** v0.1 logs → one workout per day, each log becoming an entry of done sets. */
export function logsToWorkouts(logs: WorkoutLog[], exercises: Record<string, Exercise>): Workout[] {
  const byDay = new Map<string, WorkoutLog[]>();
  for (const l of logs) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => a.loggedAt - b.loggedAt);
      const startedAt = sorted[0]?.loggedAt ?? 0;
      return {
        id: `w-${uid()}`,
        date,
        startedAt,
        finishedAt: sorted[sorted.length - 1]?.loggedAt ?? startedAt,
        entries: sorted.map((l) => {
          const timed = exercises[l.exerciseId]?.kind === 'timed' || (l.minutes !== undefined && l.reps === undefined);
          const sets = timed
            ? [{ minutes: l.minutes ?? 0, done: true }]
            : Array.from({ length: Math.max(1, l.sets ?? 1) }, () => ({ reps: l.reps ?? 0, weightKg: l.weightKg, done: true }));
          return { id: `e-${uid()}`, exerciseId: l.exerciseId, sets };
        }),
      };
    });
}

export function fromV1(old: LegacyStateV1, profile: ProfileInfo, exercises: Record<string, Exercise>): AppState {
  const custom = old.customExercises ?? [];
  const all = { ...exercises, ...Object.fromEntries(custom.map((e) => [e.id, e])) };
  return {
    version: 2,
    profile,
    onboardedAt: old.onboardedAt,
    startDate: old.startDate,
    workouts: logsToWorkouts(old.logs ?? [], all),
    plans: [],
    customExercises: custom,
    pins: old.pins ?? [],
    injuries: [],
    purchases: old.purchases ?? [],
    settings: { ...DEFAULT_SETTINGS, ...old.settings },
  };
}

/**
 * Accepts any saved or imported state (v1 or v2) and returns a valid v2 state,
 * or null if it isn't GymSim data. `profile` names the profile it belongs to.
 */
export function normaliseState(raw: unknown, profile: ProfileInfo, exercises: Record<string, Exercise>): AppState | null {
  const s = raw as Partial<AppState> & Partial<LegacyStateV1>;
  if (!s || typeof s !== 'object' || typeof s.startDate !== 'string') return null;
  if (s.version === 1 && Array.isArray(s.logs)) return fromV1(s as LegacyStateV1, profile, exercises);
  if (s.version === 2 && Array.isArray(s.workouts)) {
    return {
      version: 2,
      profile,
      onboardedAt: s.onboardedAt,
      startDate: s.startDate,
      startLevels: s.startLevels,
      assessment: s.assessment,
      workouts: s.workouts,
      activeWorkoutId: s.activeWorkoutId,
      plans: s.plans ?? [],
      customExercises: s.customExercises ?? [],
      pins: s.pins ?? [],
      injuries: s.injuries ?? [],
      purchases: s.purchases ?? [],
      settings: { ...DEFAULT_SETTINGS, ...s.settings },
    };
  }
  return null;
}
