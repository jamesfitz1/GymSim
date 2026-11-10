import type { Exercise, SetEntry, Workout } from './types';

type SetLike = Pick<SetEntry, 'reps' | 'weightKg' | 'minutes'>;

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "3 × 10 @ 40 kg", "10, 8, 6 @ 40 kg", "12 min", "2 × 1.5 min". */
export function formatSets(ex: Exercise | undefined, sets: SetLike[]): string {
  if (!ex || sets.length === 0) return '';
  if (ex.kind === 'timed') {
    const mins = sets.map((s) => s.minutes ?? 0);
    if (mins.length === 1) return `${num(mins[0])} min`;
    return mins.every((m) => m === mins[0]) ? `${mins.length} × ${num(mins[0])} min` : `${mins.map(num).join(', ')} min`;
  }
  const reps = sets.map((s) => s.reps ?? 0);
  const kgs = sets.map((s) => s.weightKg ?? 0);
  const sameReps = reps.every((r) => r === reps[0]);
  const sameKg = kgs.every((k) => k === kgs[0]);
  const repsText = sameReps ? `${sets.length} × ${reps[0]}` : reps.join(', ');
  if (!ex.usesWeight || kgs.every((k) => !k)) return repsText;
  if (sameKg) return `${repsText} @ ${num(kgs[0])} kg`;
  return sets.map((s) => `${s.reps ?? 0} @ ${num(s.weightKg ?? 0)} kg`).join(', ');
}

/** The best single set, for personal-best tracking. */
export function bestSet(ex: Exercise, sets: SetEntry[]): { value: number; label: string } | undefined {
  const done = sets.filter((s) => s.done);
  if (!done.length) return undefined;
  if (ex.kind === 'timed') {
    const m = Math.max(...done.map((s) => s.minutes ?? 0));
    return m > 0 ? { value: m, label: `${num(m)} min` } : undefined;
  }
  if (ex.usesWeight && done.some((s) => (s.weightKg ?? 0) > 0)) {
    const kg = Math.max(...done.map((s) => s.weightKg ?? 0));
    const reps = Math.max(...done.filter((s) => (s.weightKg ?? 0) === kg).map((s) => s.reps ?? 0));
    return { value: kg * 1000 + reps, label: `${num(kg)} kg × ${reps}` };
  }
  const r = Math.max(...done.map((s) => s.reps ?? 0));
  return r > 0 ? { value: r, label: `${r} reps` } : undefined;
}

/** Personal bests set in `workout` compared with every earlier workout. */
export function personalBests(workout: Workout, all: Workout[], exercises: Record<string, Exercise>) {
  const earlier = all.filter((w) => w.id !== workout.id && w.startedAt < workout.startedAt);
  const out: { exerciseId: string; label: string }[] = [];
  for (const e of workout.entries) {
    const ex = exercises[e.exerciseId];
    if (!ex) continue;
    const now = bestSet(ex, e.sets);
    if (!now) continue;
    const prev = earlier
      .flatMap((w) => w.entries.filter((x) => x.exerciseId === e.exerciseId))
      .map((x) => bestSet(ex, x.sets)?.value ?? 0);
    if (prev.length && now.value > Math.max(...prev)) out.push({ exerciseId: e.exerciseId, label: now.label });
  }
  return out;
}

export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}
