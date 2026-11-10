// Data model (PRD §12-A). Entities: User (AppState + Settings), System, SubArea,
// Exercise, ExerciseAreaMapping (AreaWeight), WorkoutLog, PriorityPin and the
// CoinLedger (derived from logs + Purchase records).
//
// Only *facts* are stored: what the user logged, pinned and bought. Every level,
// streak and coin balance is recomputed from those facts by the engine, so
// deleting a log or retuning decay rewrites history consistently.

export type SystemId = 'upper' | 'lower' | 'core' | 'back' | 'cardio' | 'mobility';

export interface SystemDef {
  id: SystemId;
  name: string;
  blurb: string;
}

export interface SubArea {
  id: string;
  systemId: SystemId;
  name: string;
  /** Optional per-area override of the default daily decay (PRD §6.3). */
  decayPerDay?: number;
}

export type ExerciseKind = 'reps' | 'timed';

export type ExerciseCategory = 'Strength' | 'Core & back' | 'Cardio' | 'Mobility';

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
  custom?: boolean;
  /** Coins needed to unlock (PRD §6.5). Undefined = available from the start. */
  unlockCost?: number;
  hint?: string;
}

export interface WorkoutLog {
  id: string;
  exerciseId: string;
  /** Local calendar day, YYYY-MM-DD. */
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
  decayPerDay: number;
  priorityDecayPerDay: number;
  skin: string;
}

export interface AppState {
  version: 1;
  onboardedAt?: string;
  /** Body model starts here; decay is replayed from this day. */
  startDate: string;
  logs: WorkoutLog[];
  customExercises: Exercise[];
  pins: PriorityPin[];
  purchases: Purchase[];
  settings: Settings;
}
