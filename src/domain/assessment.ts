import { SUB_AREAS, TUNING } from './config';
import type { FadeKind } from './types';

// New-profile health check: 14 one-tap questions (about 3 minutes) that set
// each sub-area's starting level instead of a flat TUNING.startLevel.
//
// How scoring works:
//   1. An estimate per area: 40% overall activity + 60% how often you've
//      trained that *type* of area recently (strength / cardio / stretching).
//      The frequency scores match where an area settles under the decay model
//      (see HALF_LIFE_DAYS in config.ts), so starting levels and day-to-day
//      levels mean the same thing.
//   2. Where a quick self-test covers an area, it's blended in: 60% test,
//      40% estimate. Several tests on one area are averaged. "Not sure" skips.
//   3. Clamped to START_MIN..START_MAX, so nobody starts at zero or maxed out.
// All the numbers live here so they're easy to tune.

export const START_MIN = 10;
export const START_MAX = 85;
const TEST_WEIGHT = 0.6;
const ACTIVITY_WEIGHT = 0.4;

export interface Option {
  label: string;
  value: string;
  /** Level (0–100) this answer suggests for the areas it covers. */
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

/** Scores roughly match where areas settle at that training frequency. */
const FREQ: Option[] = [
  { label: 'Never', value: 'never', score: 12 },
  { label: 'Now and then', value: 'sometimes', score: 28 },
  { label: 'About once a week', value: 'weekly', score: 48 },
  { label: 'Twice a week', value: 'often', score: 66 },
  { label: 'Three times a week or more', value: 'often3', score: 80 },
];

export const QUESTIONS: Question[] = [
  {
    id: 'activity',
    section: 'Activity',
    prompt: 'Over the last 3 months, how active have you been overall?',
    options: [
      { label: 'Hardly at all', value: '0', score: 18 },
      { label: 'A little (about once a week)', value: '1', score: 30 },
      { label: 'Fairly (2–3 times a week)', value: '2', score: 44 },
      { label: 'Very (4–5 times a week)', value: '3', score: 58 },
      { label: 'Training most days', value: '4', score: 70 },
    ],
  },
  { id: 'strengthFreq', section: 'Activity', prompt: 'How often have you done strength training?', help: 'Weights, machines or bodyweight exercises.', options: FREQ },
  { id: 'cardioFreq', section: 'Activity', prompt: 'How often have you done cardio?', help: 'Running, cycling, swimming, brisk walks, sport.', options: FREQ },
  { id: 'stretchFreq', section: 'Activity', prompt: 'How often have you stretched or done yoga?', options: FREQ },
  {
    id: 'pushups',
    section: 'Quick self-tests',
    prompt: 'How many push-ups can you do in a row?',
    help: 'Full push-ups with good form. Knee push-ups count as "1–5".',
    options: [
      { label: 'None', value: '0', score: 10 },
      { label: '1–5', value: '1', score: 24 },
      { label: '6–15', value: '2', score: 40 },
      { label: '16–30', value: '3', score: 56 },
      { label: '31–45', value: '4', score: 70 },
      { label: 'More than 45', value: '5', score: 84 },
      NOT_SURE,
    ],
  },
  {
    id: 'pullups',
    section: 'Quick self-tests',
    prompt: 'Hanging from a bar, how many pull-ups can you do?',
    help: 'Palms facing away, chin over the bar.',
    options: [
      { label: "I can't hang from a bar", value: '0', score: 10 },
      { label: 'I can hang, but no pull-ups', value: '1', score: 24 },
      { label: '1–3', value: '2', score: 40 },
      { label: '4–8', value: '3', score: 56 },
      { label: '9–15', value: '4', score: 70 },
      { label: 'More than 15', value: '5', score: 84 },
      NOT_SURE,
    ],
  },
  {
    id: 'sitStand',
    section: 'Quick self-tests',
    prompt: 'How many times can you stand up from a chair in 30 seconds, without using your hands?',
    options: [
      { label: 'Fewer than 8', value: '0', score: 12 },
      { label: '8–12', value: '1', score: 28 },
      { label: '13–17', value: '2', score: 44 },
      { label: '18–22', value: '3', score: 60 },
      { label: '23 or more', value: '4', score: 76 },
      NOT_SURE,
    ],
  },
  {
    id: 'calfRaise',
    section: 'Quick self-tests',
    prompt: 'Standing on one leg, how many slow heel raises can you do?',
    help: 'Rise all the way up onto your toes each time. A fingertip on a wall for balance is fine.',
    options: [
      { label: 'Fewer than 5', value: '0', score: 14 },
      { label: '5–14', value: '1', score: 30 },
      { label: '15–24', value: '2', score: 48 },
      { label: '25–35', value: '3', score: 64 },
      { label: 'More than 35', value: '4', score: 78 },
      NOT_SURE,
    ],
  },
  {
    id: 'plank',
    section: 'Quick self-tests',
    prompt: 'How long can you hold a plank?',
    options: [
      { label: 'Under 15 seconds', value: '0', score: 12 },
      { label: '15–30 seconds', value: '1', score: 24 },
      { label: '30–60 seconds', value: '2', score: 40 },
      { label: '1–2 minutes', value: '3', score: 56 },
      { label: '2–3 minutes', value: '4', score: 70 },
      { label: 'Over 3 minutes', value: '5', score: 82 },
      NOT_SURE,
    ],
  },
  {
    id: 'toeTouch',
    section: 'Quick self-tests',
    prompt: 'Stand and bend forward with straight legs. Where do your fingertips reach?',
    help: 'Go gently and stop if it hurts.',
    options: [
      { label: 'Knees', value: '0', score: 14 },
      { label: 'Shins', value: '1', score: 28 },
      { label: 'Ankles', value: '2', score: 42 },
      { label: 'Toes', value: '3', score: 56 },
      { label: 'Fingertips on the floor', value: '4', score: 68 },
      { label: 'Palms flat on the floor', value: '5', score: 82 },
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
      { label: 'Overlapping', value: '3', score: 66 },
      { label: 'Overlapping by a hand or more', value: '4', score: 80 },
      NOT_SURE,
    ],
  },
  {
    id: 'hips',
    section: 'Quick self-tests',
    prompt: 'How comfortable are you sitting low on the floor?',
    options: [
      { label: "I can't sit cross-legged", value: '0', score: 16 },
      { label: 'Cross-legged, with some effort', value: '1', score: 34 },
      { label: 'Cross-legged, easily', value: '2', score: 54 },
      { label: 'I can also rest in a deep squat', value: '3', score: 74 },
      NOT_SURE,
    ],
  },
  {
    id: 'walk',
    section: 'Quick self-tests',
    prompt: 'How long can you walk briskly or jog without stopping?',
    options: [
      { label: 'Under 10 minutes', value: '0', score: 12 },
      { label: '10–20 minutes', value: '1', score: 26 },
      { label: '20–40 minutes', value: '2', score: 42 },
      { label: '40–60 minutes', value: '3', score: 58 },
      { label: 'Over an hour, or I could run 5 km', value: '4', score: 74 },
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

/** Which self-test informs which areas. Every area has at least one test. */
export const TEST_AREAS: Record<string, string[]> = {
  pushups: ['chest', 'shoulders', 'arms'],
  pullups: ['lats', 'arms'],
  sitStand: ['quads', 'glutes', 'hamstrings'],
  calfRaise: ['calves'],
  plank: ['abs', 'obliques', 'spinalStabilisers', 'lowerBack'],
  toeTouch: ['hamstringFlex', 'backMobility'],
  shoulderReach: ['shoulderMobility'],
  hips: ['hipMobility'],
  walk: ['aerobic', 'hiit'],
};

/** Which frequency question applies to which type of area. */
const FREQ_FOR: Record<FadeKind, string> = {
  strength: 'strengthFreq',
  cardio: 'cardioFreq',
  mobility: 'stretchFreq',
};

function optionScore(qid: string, value: string | undefined): number | undefined {
  if (!value) return undefined;
  return QUESTIONS.find((q) => q.id === qid)?.options.find((o) => o.value === value)?.score;
}

export type Answers = Record<string, string>;

export function scoreAssessment(answers: Answers): Record<string, number> {
  const activity = optionScore('activity', answers.activity);
  const out: Record<string, number> = {};

  for (const area of SUB_AREAS) {
    const freq = optionScore(FREQ_FOR[area.fade], answers[FREQ_FOR[area.fade]]);
    const estimate =
      activity !== undefined && freq !== undefined
        ? ACTIVITY_WEIGHT * activity + (1 - ACTIVITY_WEIGHT) * freq
        : (freq ?? activity ?? TUNING.startLevel);

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
