import type { DecaySpeed, FadeKind, Settings, SubArea, SystemDef } from './types';

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
  { id: 'lowerBack', systemId: 'back', name: 'Lower back strength', fade: 'strength' },
  { id: 'spinalStabilisers', systemId: 'back', name: 'Spinal stabilisers', fade: 'strength' },
  { id: 'backMobility', systemId: 'back', name: 'Back mobility', fade: 'mobility' },

  { id: 'chest', systemId: 'upper', name: 'Chest', fade: 'strength' },
  { id: 'lats', systemId: 'upper', name: 'Upper back (lats)', fade: 'strength' },
  { id: 'shoulders', systemId: 'upper', name: 'Shoulders', fade: 'strength' },
  { id: 'arms', systemId: 'upper', name: 'Arms', fade: 'strength' },

  { id: 'glutes', systemId: 'lower', name: 'Glutes', fade: 'strength' },
  { id: 'quads', systemId: 'lower', name: 'Quads', fade: 'strength' },
  { id: 'hamstrings', systemId: 'lower', name: 'Hamstrings', fade: 'strength' },
  { id: 'calves', systemId: 'lower', name: 'Calves', fade: 'strength' },

  { id: 'abs', systemId: 'core', name: 'Abs', fade: 'strength' },
  { id: 'obliques', systemId: 'core', name: 'Obliques', fade: 'strength' },

  { id: 'aerobic', systemId: 'cardio', name: 'Aerobic base', fade: 'cardio' },
  { id: 'hiit', systemId: 'cardio', name: 'High-intensity capacity', fade: 'cardio' },

  { id: 'hipMobility', systemId: 'mobility', name: 'Hip mobility', fade: 'mobility' },
  { id: 'shoulderMobility', systemId: 'mobility', name: 'Shoulder mobility', fade: 'mobility' },
  { id: 'hamstringFlex', systemId: 'mobility', name: 'Hamstring flexibility', fade: 'mobility' },
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
  /** An area counts as "declining" if it dropped by at least `decliningBy` over this many days. */
  trendDays: 3,
  decliningBy: 1.5,
  /**
   * Gains shrink as an area gets stronger: gain × (1 − level / gainCeiling).
   * Together with percentage decay this makes each area settle at a level that
   * matches how often it's trained, instead of pinning at 100 or 0.
   */
  gainCeiling: 120,
  /** Focus areas fade this many times faster, to keep the pressure on. */
  focusFadeMultiplier: 1.5,
  /** Default weekly target for a newly pinned priority area (≈ 3 sessions). */
  defaultWeeklyTarget: 60,
} as const;

/**
 * Decay (PRD §6.3). Each night an area loses a percentage of its level, set by
 * a half-life: how many days without training it takes to lose half. Based
 * loosely on detraining research: aerobic fitness fades within weeks,
 * flexibility a little slower, and strength slowest.
 *
 * Where levels settle with the default settings (one standard session each time):
 *   strength area trained 1×/week ≈ 50–60, 2× ≈ 70–78, 3× ≈ 83–88
 *   mobility area         1×/week ≈ 40–50, 2× ≈ 62–71, 3× ≈ 75–82
 *   cardio area           1×/week ≈ 32–45, 2× ≈ 53–63, 3× ≈ 67–75
 * A week off takes a strength area from 70 to ~56, a cardio area to ~47.
 */
export const HALF_LIFE_DAYS: Record<FadeKind, number> = {
  strength: 21,
  mobility: 16,
  cardio: 12,
};

export const DECAY_SPEEDS: Record<DecaySpeed, { label: string; multiplier: number; blurb: string }> = {
  gentle: { label: 'Gentle', multiplier: 0.7, blurb: 'Levels fade slowly. Good for getting back into it.' },
  standard: { label: 'Standard', multiplier: 1, blurb: 'Roughly matches how fitness fades in real life.' },
  tough: { label: 'Tough', multiplier: 1.4, blurb: 'Gaps show quickly. For when you want pressure.' },
};

/** Fraction of its level an area loses overnight. */
export function dailyFade(fade: FadeKind, speed: DecaySpeed = 'standard', focus = false): number {
  const base = 1 - Math.pow(0.5, 1 / HALF_LIFE_DAYS[fade]);
  return base * DECAY_SPEEDS[speed].multiplier * (focus ? TUNING.focusFadeMultiplier : 1);
}

export const DEFAULT_SETTINGS: Settings = {
  decaySpeed: 'standard',
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
