import { SUB_AREAS, TUNING } from './config';
import type { SystemId } from './types';

// New-profile health check. About 11 one-tap questions (2–3 minutes) that set
// each sub-area's starting level instead of a flat TUNING.startLevel.
//
// How scoring works:
//   1. A baseline from overall activity (Q1).
//   2. Plus a modifier per system from how often you've done strength,
//      cardio or stretching recently.
//   3. Where a quick self-test covers an area, it's blended in (60% test,
//      40% the estimate from 1+2). "Not sure" skips the test.
//   4. Clamped to MIN..MAX so nobody starts maxed out or at zero.
// All the numbers live here so they're easy to tune.

export const START_MIN = 10;
export const START_MAX = 70;
const TEST_WEIGHT = 0.6;

export interface Option {
  label: string;
  value: string;
  /** Score this option contributes (meaning depends on the question). */
  score?: number;
}

export interface Question {
  id: string;
  section: 'Activity' | 'Quick self-tests' | 'Health';
  prompt: string;
  help?: string;
  options: Option[];
}

const NOT_SURE: Option = { label: "Not sure / can't test now", value: 'unsure' };
const FREQ: Option[] = [
  { label: 'Never', value: 'never', score: -6 },
  { label: 'Now and then', value: 'sometimes', score: 0 },
  { label: 'About once a week', value: 'weekly', score: 4 },
  { label: 'Twice a week or more', value: 'often', score: 8 },
];

export const QUESTIONS: Question[] = [
  {
    id: 'activity',
    section: 'Activity',
    prompt: 'Over the last 3 months, how active have you been overall?',
    options: [
      { label: 'Hardly at all', value: '0', score: 20 },
      { label: 'A little (about once a week)', value: '1', score: 28 },
      { label: 'Fairly (2–3 times a week)', value: '2', score: 38 },
      { label: 'Very (4+ times a week)', value: '3', score: 48 },
    ],
  },
  { id: 'strengthFreq', section: 'Activity', prompt: 'How often have you done strength training?', help: 'Weights, machines or bodyweight exercises.', options: FREQ },
  { id: 'cardioFreq', section: 'Activity', prompt: 'How often have you done cardio?', help: 'Running, cycling, swimming, brisk walks.', options: FREQ },
  { id: 'stretchFreq', section: 'Activity', prompt: 'How often have you stretched or done yoga?', options: FREQ },
  {
    id: 'pushups',
    section: 'Quick self-tests',
    prompt: 'How many push-ups can you do in a row?',
    help: 'Full push-ups with good form. Knee push-ups count as "1–5".',
    options: [
      { label: 'None', value: '0', score: 12 },
      { label: '1–5', value: '1', score: 24 },
      { label: '6–15', value: '2', score: 38 },
      { label: '16–30', value: '3', score: 52 },
      { label: 'More than 30', value: '4', score: 66 },
      NOT_SURE,
    ],
  },
  {
    id: 'sitStand',
    section: 'Quick self-tests',
    prompt: 'How many times can you stand up from a chair in 30 seconds, without using your hands?',
    options: [
      { label: 'Fewer than 8', value: '0', score: 14 },
      { label: '8–12', value: '1', score: 28 },
      { label: '13–17', value: '2', score: 42 },
      { label: '18 or more', value: '3', score: 58 },
      NOT_SURE,
    ],
  },
  {
    id: 'plank',
    section: 'Quick self-tests',
    prompt: 'How long can you hold a plank?',
    options: [
      { label: 'Under 15 seconds', value: '0', score: 14 },
      { label: '15–30 seconds', value: '1', score: 26 },
      { label: '30–60 seconds', value: '2', score: 40 },
      { label: '1–2 minutes', value: '3', score: 54 },
      { label: 'Over 2 minutes', value: '4', score: 66 },
      NOT_SURE,
    ],
  },
  {
    id: 'toeTouch',
    section: 'Quick self-tests',
    prompt: 'Stand and bend forward with straight legs. Where do your fingertips reach?',
    help: 'Go gently and stop if it hurts.',
    options: [
      { label: 'Knees', value: '0', score: 15 },
      { label: 'Shins', value: '1', score: 28 },
      { label: 'Ankles', value: '2', score: 42 },
      { label: 'Toes', value: '3', score: 56 },
      { label: 'Palms on the floor', value: '4', score: 70 },
      NOT_SURE,
    ],
  },
  {
    id: 'shoulderReach',
    section: 'Quick self-tests',
    prompt: 'Reach one hand over your shoulder and the other up your back. How close do your fingers get?',
    options: [
      { label: 'More than a hand apart', value: '0', score: 18 },
      { label: 'Nearly touching', value: '1', score: 34 },
      { label: 'Touching', value: '2', score: 50 },
      { label: 'Overlapping', value: '3', score: 64 },
      NOT_SURE,
    ],
  },
  {
    id: 'hips',
    section: 'Quick self-tests',
    prompt: 'Can you sit cross-legged on the floor comfortably?',
    options: [
      { label: 'No', value: '0', score: 18 },
      { label: 'With some effort', value: '1', score: 36 },
      { label: 'Yes, easily', value: '2', score: 56 },
      NOT_SURE,
    ],
  },
  {
    id: 'walk',
    section: 'Quick self-tests',
    prompt: 'How long can you walk briskly or jog without stopping?',
    options: [
      { label: 'Under 10 minutes', value: '0', score: 14 },
      { label: '10–20 minutes', value: '1', score: 28 },
      { label: '20–40 minutes', value: '2', score: 44 },
      { label: 'Over 40 minutes', value: '3', score: 60 },
      NOT_SURE,
    ],
  },
  {
    id: 'condition',
    section: 'Health',
    prompt: 'Do you have back pain, an injury, or a diagnosed condition that affects how you train?',
    options: [
      { label: 'No', value: 'none' },
      { label: 'Yes, my back', value: 'back' },
      { label: 'Yes, somewhere else', value: 'other' },
      { label: 'Prefer not to say', value: 'skip' },
    ],
  },
];

/** Which self-test informs which areas. */
const TEST_AREAS: Record<string, string[]> = {
  pushups: ['chest', 'shoulders', 'arms'],
  sitStand: ['quads', 'glutes', 'hamstrings'],
  plank: ['abs', 'obliques', 'spinalStabilisers', 'lowerBack'],
  toeTouch: ['hamstringFlex', 'backMobility'],
  shoulderReach: ['shoulderMobility'],
  hips: ['hipMobility'],
  walk: ['aerobic', 'hiit'],
};

/** Which frequency question nudges which systems. */
const FREQ_SYSTEMS: Record<string, SystemId[]> = {
  strengthFreq: ['upper', 'lower', 'core', 'back'],
  cardioFreq: ['cardio'],
  stretchFreq: ['mobility'],
};

/** Back mobility is in the Back system but responds to stretching. */
const EXTRA_FREQ_AREAS: Record<string, string[]> = { stretchFreq: ['backMobility'] };

function optionScore(qid: string, value: string | undefined): number | undefined {
  if (!value) return undefined;
  return QUESTIONS.find((q) => q.id === qid)?.options.find((o) => o.value === value)?.score;
}

export type Answers = Record<string, string>;

export function scoreAssessment(answers: Answers): Record<string, number> {
  const baseline = optionScore('activity', answers.activity) ?? TUNING.startLevel;
  const out: Record<string, number> = {};

  for (const area of SUB_AREAS) {
    let estimate = baseline;
    for (const [qid, systems] of Object.entries(FREQ_SYSTEMS)) {
      const mod = optionScore(qid, answers[qid]) ?? 0;
      const applies = systems.includes(area.systemId) || EXTRA_FREQ_AREAS[qid]?.includes(area.id);
      if (applies) estimate += mod;
    }

    const tests = Object.entries(TEST_AREAS)
      .filter(([, areas]) => areas.includes(area.id))
      .map(([qid]) => optionScore(qid, answers[qid]))
      .filter((s): s is number => s !== undefined);

    let level = estimate;
    if (tests.length) {
      const test = tests.reduce((a, b) => a + b, 0) / tests.length;
      level = TEST_WEIGHT * test + (1 - TEST_WEIGHT) * estimate;
    }
    // High-intensity capacity lags aerobic base for most people.
    if (area.id === 'hiit') level -= 6;

    out[area.id] = Math.round(Math.min(START_MAX, Math.max(START_MIN, level)));
  }
  return out;
}

/** Focus areas to suggest from the health answer (the user can change them). */
export function suggestedFocus(answers: Answers): string[] {
  if (answers.condition === 'back') return ['lowerBack', 'spinalStabilisers', 'backMobility'];
  return [];
}
