import type { Settings, SubArea, SystemDef } from './types';

// ---------------------------------------------------------------------------
// App identity (PRD §11): GymSim.
// ---------------------------------------------------------------------------
export const APP_NAME = 'GymSim';

// ---------------------------------------------------------------------------
// Body model (PRD §5, resolved for §12-D): six systems. "Back health" gets its
// own headline bar because the v1 design anchor is a user with a back
// condition; lats (upper body) still pick up back-strength work via mappings.
// A system's level is the average of its sub-areas.
// ---------------------------------------------------------------------------
export const SYSTEMS: SystemDef[] = [
  { id: 'back', name: 'Back health', blurb: 'Strength, stability and mobility of the spine' },
  { id: 'upper', name: 'Upper body', blurb: 'Pushing and pulling strength' },
  { id: 'lower', name: 'Lower body', blurb: 'Legs and hips' },
  { id: 'core', name: 'Core', blurb: 'Trunk strength' },
  { id: 'cardio', name: 'Cardio', blurb: 'Heart and lungs' },
  { id: 'mobility', name: 'Mobility', blurb: 'Range of motion' },
];

export const SUB_AREAS: SubArea[] = [
  { id: 'lowerBack', systemId: 'back', name: 'Lower back strength' },
  { id: 'spinalStabilisers', systemId: 'back', name: 'Spinal stabilisers' },
  { id: 'backMobility', systemId: 'back', name: 'Back mobility' },

  { id: 'chest', systemId: 'upper', name: 'Chest' },
  { id: 'lats', systemId: 'upper', name: 'Upper back (lats)' },
  { id: 'shoulders', systemId: 'upper', name: 'Shoulders' },
  { id: 'arms', systemId: 'upper', name: 'Arms' },

  { id: 'glutes', systemId: 'lower', name: 'Glutes' },
  { id: 'quads', systemId: 'lower', name: 'Quads' },
  { id: 'hamstrings', systemId: 'lower', name: 'Hamstrings' },
  { id: 'calves', systemId: 'lower', name: 'Calves' },

  { id: 'abs', systemId: 'core', name: 'Abs' },
  { id: 'obliques', systemId: 'core', name: 'Obliques' },

  { id: 'aerobic', systemId: 'cardio', name: 'Aerobic base' },
  { id: 'hiit', systemId: 'cardio', name: 'High-intensity capacity' },

  { id: 'hipMobility', systemId: 'mobility', name: 'Hip mobility' },
  { id: 'shoulderMobility', systemId: 'mobility', name: 'Shoulder mobility' },
  { id: 'hamstringFlex', systemId: 'mobility', name: 'Hamstring flexibility' },
];

export const AREA_BY_ID: Record<string, SubArea> = Object.fromEntries(SUB_AREAS.map((a) => [a.id, a]));

// ---------------------------------------------------------------------------
// Scoring & decay (PRD §6.2, §6.3, §12-C). All tunable here.
// ---------------------------------------------------------------------------
export const TUNING = {
  /** Every area starts here on day one, so decay is visible straight away. */
  startLevel: 30,
  /** Levels cap at 100; no prestige in v1 (Open Question 2). */
  maxLevel: 100,
  /** Points a "standard" session earns for the exercise's main area. */
  sessionPoints: 20,
  /** Diminishing returns: points = sessionPoints × ratio^curve. */
  curve: 0.7,
  /** Doing more than this multiple of a standard session earns nothing extra. */
  maxRatio: 2.5,
  /** Most an area can gain in one day, however much is logged. */
  dailyGainCap: 35,
  /** Load multiplier for weighted lifts: 1 + min(kg, loadCapKg) / loadDivisor (max 1.5×). */
  loadCapKg: 120,
  loadDivisor: 240,
  /** An area counts as "declining" if it dropped over this many days. */
  trendDays: 3,
  /** Default weekly target for a newly pinned priority area (≈ 3 sessions). */
  defaultWeeklyTarget: 60,
} as const;

export const DEFAULT_SETTINGS: Settings = {
  decayPerDay: 3,
  priorityDecayPerDay: 5,
  skin: 'classic',
};

// ---------------------------------------------------------------------------
// Coins (PRD §6.5): earned from consistency only, never from intensity.
// ---------------------------------------------------------------------------
export const COINS = {
  trainingDay: 5,
  weeklyTargetHit: 20,
  streakMilestones: [
    { days: 3, coins: 10 },
    { days: 7, coins: 25 },
    { days: 14, coins: 50 },
    { days: 30, coins: 100 },
    { days: 60, coins: 150 },
    { days: 100, coins: 250 },
  ],
} as const;

export interface Skin {
  id: string;
  name: string;
  accent: string;
  cost: number;
}

/** Cosmetic upgrades bought with coins. They change the app accent only. */
export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', accent: '#1f7a6a', cost: 0 },
  { id: 'ocean', name: 'Ocean', accent: '#3a5bc7', cost: 50 },
  { id: 'grape', name: 'Grape', accent: '#7a4bc2', cost: 100 },
  { id: 'graphite', name: 'Graphite', accent: '#4a5566', cost: 200 },
];

/** Health colour bands used for the body figure and bars. */
export const LEVEL_BANDS = [
  { min: 75, label: 'Strong', color: '#2f9e6e' },
  { min: 50, label: 'Okay', color: '#9cc05a' },
  { min: 25, label: 'Low', color: '#ec9a3a' },
  { min: 0, label: 'Neglected', color: '#d1495b' },
] as const;

export function levelBand(level: number) {
  return LEVEL_BANDS.find((b) => level >= b.min) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1];
}
