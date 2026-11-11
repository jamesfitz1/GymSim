// Data model (PRD §12-A). Entities: Profile (AppState + Settings), System,
// SubArea, Exercise, ExerciseAreaMapping (AreaWeight), Workout (entries of
// sets), Plan, PriorityPin (focus area) and the CoinLedger (derived).
//
// Only *facts* are stored: what the user did, pinned and bought. Every level,
// streak and coin balance is recomputed from those facts by the engine, so
// deleting a workout or retuning decay rewrites history consistently.

export type SystemId = 'upper' | 'lower' | 'core' | 'back' | 'cardio' | 'mobility';

export interface SystemDef {
  id: SystemId;
  name: string;
  blurb: string;
}

/** How an area fades without training: strength slowest, cardio fastest. */
export type FadeKind = 'strength' | 'mobility' | 'cardio';

export interface SubArea {
  id: string;
  systemId: SystemId;
  name: string;
  fade: FadeKind;
}

export type DecaySpeed = 'gentle' | 'standard' | 'tough';

export type ExerciseKind = 'reps' | 'timed';

export type ExerciseCategory = 'Strength' | 'Core & back' | 'Cardio' | 'Mobility';

export type Equipment =
  | 'Bodyweight'
  | 'Dumbbell'
  | 'Barbell'
  | 'Kettlebell'
  | 'Machine / cable'
  | 'Band'
  | 'Cardio machine'
  | 'Other';

/** ExerciseAreaMapping: one exercise feeds several sub-areas. Weights sum to 1. */
export interface AreaWeight {
  areaId: string;
  weight: number;
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** 'reps' scores sets × reps (× load); 'timed' scores total minutes. */
  kind: ExerciseKind;
  usesWeight: boolean;
  /**
   * What one solid session looks like, in the exercise's own units:
   * total reps for 'reps', total minutes for 'timed'. Hitting it earns
   * TUNING.sessionPoints — this is the cross-modal normalisation (PRD §10-3).
   */
  standard: number;
  mappings: AreaWeight[];
  equipment?: Equipment;
  custom?: boolean;
  /** Coins needed to unlock (PRD §6.5). Undefined = available from the start. */
  unlockCost?: number;
  hint?: string;
}

/** One set of an exercise. Only sets ticked `done` earn points. */
export interface SetEntry {
  reps?: number;
  weightKg?: number;
  minutes?: number;
  done: boolean;
}

export interface WorkoutEntry {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
}

/** A training session: a list of exercises, each with its sets. */
export interface Workout {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  startedAt: number;
  finishedAt?: number;
  name?: string;
  planId?: string;
  entries: WorkoutEntry[];
}

/** A saved workout template ("Back rehab A"). Targets only, nothing ticked. */
export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  entries: { exerciseId: string; sets: Omit<SetEntry, 'done'>[] }[];
}

/** Legacy v0.1 single-exercise log, kept only for migration. */
export interface WorkoutLog {
  id: string;
  exerciseId: string;
  date: string;
  loggedAt: number;
  sets?: number;
  reps?: number;
  weightKg?: number;
  minutes?: number;
}

export interface PriorityPin {
  areaId: string;
  /** Day the pin started; accelerated decay applies from this day. */
  since: string;
  /** Points to earn in this area each week (Mon–Sun). */
  weeklyTarget: number;
}

export interface Purchase {
  itemId: string;
  date: string;
  cost: number;
}

export interface Settings {
  /** Scales every area's fade rate. */
  decaySpeed: DecaySpeed;
  skin: string;
  /** Body view on the dashboard. Defaults to 3D where supported. */
  bodyView?: '3d' | '2d';
}

export interface ProfileInfo {
  id: string;
  name: string;
  createdAt: number;
}

/** Everything stored for one profile. */
export interface AppState {
  version: 2;
  profile: ProfileInfo;
  onboardedAt?: string;
  /** Body model starts here; decay is replayed from this day. */
  startDate: string;
  /** Starting level per sub-area from the health check (else TUNING.startLevel). */
  startLevels?: Record<string, number>;
  /** Raw questionnaire answers, kept so the check can be reviewed later. */
  assessment?: Record<string, string>;
  workouts: Workout[];
  activeWorkoutId?: string;
  plans: Plan[];
  customExercises: Exercise[];
  /** Focus areas (formerly "priority areas"). */
  pins: PriorityPin[];
  injuries: Injury[];
  purchases: Purchase[];
  settings: Settings;
}

export type InjurySeverity = 'mild' | 'moderate' | 'severe';
export type InjurySide = 'left' | 'right' | 'both' | 'none';

/**
 * A logged injury. While active (startDate ≤ day < resolvedDate), its areas
 * take a one-off hit on the start day and then stop fading.
 */
export interface Injury {
  id: string;
  /** Key into INJURY_REGIONS. */
  region: string;
  side: InjurySide;
  /** Sub-areas affected (pre-filled from the region, editable). */
  areaIds: string[];
  severity: InjurySeverity;
  startDate: string;
  /** Day it was marked recovered; absent while active. */
  resolvedDate?: string;
  underCare: boolean;
  notes?: string;
  /** Pain check-ins, at most one per day. */
  pain: { date: string; score: number }[];
}

/** v0.1 shape, read only to migrate. */
export interface LegacyStateV1 {
  version: 1;
  onboardedAt?: string;
  startDate: string;
  logs: WorkoutLog[];
  customExercises: Exercise[];
  pins: PriorityPin[];
  purchases: Purchase[];
  settings: Settings;
}
