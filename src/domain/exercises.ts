import type { AreaWeight, Equipment, Exercise, ExerciseCategory, ExerciseKind } from './types';

// Seed exercise-to-area mapping table (PRD §12-B). Weights for each exercise
// sum to 1 (enforced by a test). `standard` is one solid session: total reps
// for 'reps' exercises, total minutes for 'timed' ones.
//
// These are general-purpose defaults for tracking, not a programme. Users with
// a diagnosed condition should take exercise selection from their clinician.

const CORE_SEED: Exercise[] = [
  // --- Strength -------------------------------------------------------------
  { id: 'back-squat', name: 'Back squat', category: 'Strength', kind: 'reps', usesWeight: true, standard: 25,
    mappings: [{ areaId: 'quads', weight: 0.35 }, { areaId: 'glutes', weight: 0.3 }, { areaId: 'hamstrings', weight: 0.1 }, { areaId: 'spinalStabilisers', weight: 0.15 }, { areaId: 'abs', weight: 0.1 }] },
  { id: 'deadlift', name: 'Deadlift', category: 'Strength', kind: 'reps', usesWeight: true, standard: 25,
    mappings: [{ areaId: 'hamstrings', weight: 0.25 }, { areaId: 'glutes', weight: 0.25 }, { areaId: 'lowerBack', weight: 0.25 }, { areaId: 'spinalStabilisers', weight: 0.1 }, { areaId: 'quads', weight: 0.1 }, { areaId: 'lats', weight: 0.05 }] },
  { id: 'rdl', name: 'Romanian deadlift', category: 'Strength', kind: 'reps', usesWeight: true, standard: 30,
    mappings: [{ areaId: 'hamstrings', weight: 0.4 }, { areaId: 'glutes', weight: 0.25 }, { areaId: 'lowerBack', weight: 0.25 }, { areaId: 'spinalStabilisers', weight: 0.1 }] },
  { id: 'bench-press', name: 'Bench press', category: 'Strength', kind: 'reps', usesWeight: true, standard: 25,
    mappings: [{ areaId: 'chest', weight: 0.55 }, { areaId: 'shoulders', weight: 0.2 }, { areaId: 'arms', weight: 0.25 }] },
  { id: 'push-up', name: 'Push-up', category: 'Strength', kind: 'reps', usesWeight: false, standard: 30,
    mappings: [{ areaId: 'chest', weight: 0.45 }, { areaId: 'shoulders', weight: 0.2 }, { areaId: 'arms', weight: 0.2 }, { areaId: 'abs', weight: 0.15 }] },
  { id: 'overhead-press', name: 'Overhead press', category: 'Strength', kind: 'reps', usesWeight: true, standard: 25,
    mappings: [{ areaId: 'shoulders', weight: 0.55 }, { areaId: 'arms', weight: 0.25 }, { areaId: 'spinalStabilisers', weight: 0.1 }, { areaId: 'abs', weight: 0.1 }] },
  { id: 'pull-up', name: 'Pull-up', category: 'Strength', kind: 'reps', usesWeight: false, standard: 20,
    mappings: [{ areaId: 'lats', weight: 0.6 }, { areaId: 'arms', weight: 0.3 }, { areaId: 'abs', weight: 0.1 }] },
  { id: 'bent-over-row', name: 'Bent-over row', category: 'Strength', kind: 'reps', usesWeight: true, standard: 30,
    mappings: [{ areaId: 'lats', weight: 0.5 }, { areaId: 'arms', weight: 0.2 }, { areaId: 'lowerBack', weight: 0.15 }, { areaId: 'spinalStabilisers', weight: 0.15 }] },
  { id: 'lat-pulldown', name: 'Lat pulldown', category: 'Strength', kind: 'reps', usesWeight: true, standard: 30,
    mappings: [{ areaId: 'lats', weight: 0.65 }, { areaId: 'arms', weight: 0.3 }, { areaId: 'shoulders', weight: 0.05 }] },
  { id: 'bicep-curl', name: 'Bicep curl', category: 'Strength', kind: 'reps', usesWeight: true, standard: 30,
    mappings: [{ areaId: 'arms', weight: 1 }] },
  { id: 'lunge', name: 'Lunge', category: 'Strength', kind: 'reps', usesWeight: true, standard: 30,
    mappings: [{ areaId: 'quads', weight: 0.4 }, { areaId: 'glutes', weight: 0.35 }, { areaId: 'hamstrings', weight: 0.1 }, { areaId: 'calves', weight: 0.05 }, { areaId: 'spinalStabilisers', weight: 0.1 }] },
  { id: 'glute-bridge', name: 'Glute bridge', category: 'Strength', kind: 'reps', usesWeight: false, standard: 36,
    mappings: [{ areaId: 'glutes', weight: 0.6 }, { areaId: 'hamstrings', weight: 0.2 }, { areaId: 'spinalStabilisers', weight: 0.1 }, { areaId: 'lowerBack', weight: 0.1 }] },
  { id: 'calf-raise', name: 'Calf raise', category: 'Strength', kind: 'reps', usesWeight: false, standard: 45,
    mappings: [{ areaId: 'calves', weight: 1 }] },

  // --- Core & back ------------------------------------------------------------
  { id: 'back-extension', name: 'Back extension', category: 'Core & back', kind: 'reps', usesWeight: false, standard: 30,
    mappings: [{ areaId: 'lowerBack', weight: 0.6 }, { areaId: 'glutes', weight: 0.2 }, { areaId: 'hamstrings', weight: 0.2 }] },
  { id: 'bird-dog', name: 'Bird-dog', category: 'Core & back', kind: 'reps', usesWeight: false, standard: 30, hint: 'Count each side as one rep',
    mappings: [{ areaId: 'spinalStabilisers', weight: 0.6 }, { areaId: 'lowerBack', weight: 0.2 }, { areaId: 'glutes', weight: 0.1 }, { areaId: 'abs', weight: 0.1 }] },
  { id: 'dead-bug', name: 'Dead bug', category: 'Core & back', kind: 'reps', usesWeight: false, standard: 30,
    mappings: [{ areaId: 'abs', weight: 0.5 }, { areaId: 'spinalStabilisers', weight: 0.4 }, { areaId: 'obliques', weight: 0.1 }] },
  { id: 'mcgill-curl-up', name: 'McGill curl-up', category: 'Core & back', kind: 'reps', usesWeight: false, standard: 24,
    mappings: [{ areaId: 'abs', weight: 0.6 }, { areaId: 'spinalStabilisers', weight: 0.4 }] },
  { id: 'plank', name: 'Plank', category: 'Core & back', kind: 'timed', usesWeight: false, standard: 3, hint: 'Total minutes held',
    mappings: [{ areaId: 'abs', weight: 0.5 }, { areaId: 'spinalStabilisers', weight: 0.35 }, { areaId: 'shoulders', weight: 0.15 }] },
  { id: 'side-plank', name: 'Side plank', category: 'Core & back', kind: 'timed', usesWeight: false, standard: 2, hint: 'Total minutes, both sides',
    mappings: [{ areaId: 'obliques', weight: 0.6 }, { areaId: 'spinalStabilisers', weight: 0.3 }, { areaId: 'shoulders', weight: 0.1 }] },
  { id: 'pallof-press', name: 'Pallof press', category: 'Core & back', kind: 'reps', usesWeight: true, standard: 30,
    mappings: [{ areaId: 'obliques', weight: 0.5 }, { areaId: 'spinalStabilisers', weight: 0.4 }, { areaId: 'abs', weight: 0.1 }] },

  // --- Cardio -----------------------------------------------------------------
  { id: 'running', name: 'Running', category: 'Cardio', kind: 'timed', usesWeight: false, standard: 20,
    mappings: [{ areaId: 'aerobic', weight: 0.7 }, { areaId: 'calves', weight: 0.15 }, { areaId: 'quads', weight: 0.15 }] },
  { id: 'cycling', name: 'Cycling', category: 'Cardio', kind: 'timed', usesWeight: false, standard: 30,
    mappings: [{ areaId: 'aerobic', weight: 0.7 }, { areaId: 'quads', weight: 0.2 }, { areaId: 'glutes', weight: 0.1 }] },
  { id: 'brisk-walk', name: 'Brisk walk', category: 'Cardio', kind: 'timed', usesWeight: false, standard: 30,
    mappings: [{ areaId: 'aerobic', weight: 0.8 }, { areaId: 'calves', weight: 0.1 }, { areaId: 'glutes', weight: 0.1 }] },
  { id: 'rowing', name: 'Rowing machine', category: 'Cardio', kind: 'timed', usesWeight: false, standard: 15,
    mappings: [{ areaId: 'aerobic', weight: 0.5 }, { areaId: 'lats', weight: 0.2 }, { areaId: 'quads', weight: 0.1 }, { areaId: 'hamstrings', weight: 0.1 }, { areaId: 'arms', weight: 0.1 }] },
  { id: 'intervals', name: 'Intervals (HIIT)', category: 'Cardio', kind: 'timed', usesWeight: false, standard: 12,
    mappings: [{ areaId: 'hiit', weight: 0.7 }, { areaId: 'aerobic', weight: 0.2 }, { areaId: 'quads', weight: 0.1 }] },

  // --- Mobility ---------------------------------------------------------------
  { id: 'cat-cow', name: 'Cat-cow', category: 'Mobility', kind: 'timed', usesWeight: false, standard: 3,
    mappings: [{ areaId: 'backMobility', weight: 0.85 }, { areaId: 'hipMobility', weight: 0.15 }] },
  { id: 'childs-pose', name: "Child's pose", category: 'Mobility', kind: 'timed', usesWeight: false, standard: 3,
    mappings: [{ areaId: 'backMobility', weight: 0.6 }, { areaId: 'hipMobility', weight: 0.25 }, { areaId: 'shoulderMobility', weight: 0.15 }] },
  { id: 'thoracic-rotation', name: 'Thoracic rotation', category: 'Mobility', kind: 'timed', usesWeight: false, standard: 3,
    mappings: [{ areaId: 'backMobility', weight: 0.6 }, { areaId: 'shoulderMobility', weight: 0.4 }] },
  { id: 'hip-flexor-stretch', name: 'Hip flexor stretch', category: 'Mobility', kind: 'timed', usesWeight: false, standard: 4,
    mappings: [{ areaId: 'hipMobility', weight: 0.8 }, { areaId: 'backMobility', weight: 0.2 }] },
  { id: 'hamstring-stretch', name: 'Hamstring stretch', category: 'Mobility', kind: 'timed', usesWeight: false, standard: 4,
    mappings: [{ areaId: 'hamstringFlex', weight: 0.8 }, { areaId: 'backMobility', weight: 0.2 }] },
  { id: 'shoulder-pass-through', name: 'Band shoulder pass-through', category: 'Mobility', kind: 'reps', usesWeight: false, standard: 30,
    mappings: [{ areaId: 'shoulderMobility', weight: 1 }] },

  // --- Unlockable with coins (PRD §6.5) ----------------------------------------
  { id: 'kettlebell-swing', name: 'Kettlebell swing', category: 'Strength', kind: 'reps', usesWeight: true, standard: 45, unlockCost: 40,
    mappings: [{ areaId: 'glutes', weight: 0.35 }, { areaId: 'hamstrings', weight: 0.25 }, { areaId: 'lowerBack', weight: 0.15 }, { areaId: 'hiit', weight: 0.15 }, { areaId: 'spinalStabilisers', weight: 0.1 }] },
  { id: 'farmers-carry', name: "Farmer's carry", category: 'Core & back', kind: 'timed', usesWeight: false, standard: 4, unlockCost: 40,
    mappings: [{ areaId: 'spinalStabilisers', weight: 0.35 }, { areaId: 'arms', weight: 0.25 }, { areaId: 'obliques', weight: 0.2 }, { areaId: 'shoulders', weight: 0.2 }] },
  { id: 'swimming', name: 'Swimming', category: 'Cardio', kind: 'timed', usesWeight: false, standard: 20, unlockCost: 60,
    mappings: [{ areaId: 'aerobic', weight: 0.6 }, { areaId: 'lats', weight: 0.15 }, { areaId: 'shoulders', weight: 0.15 }, { areaId: 'shoulderMobility', weight: 0.1 }] },
  { id: 'yoga-flow', name: 'Yoga flow', category: 'Mobility', kind: 'timed', usesWeight: false, standard: 20, unlockCost: 60,
    mappings: [{ areaId: 'backMobility', weight: 0.3 }, { areaId: 'hipMobility', weight: 0.25 }, { areaId: 'hamstringFlex', weight: 0.25 }, { areaId: 'shoulderMobility', weight: 0.2 }] },
];

/** Equipment for the original seed exercises (kept separate so their ids never change). */
const CORE_EQUIPMENT: Record<string, Equipment> = {
  'back-squat': 'Barbell', deadlift: 'Barbell', rdl: 'Barbell', 'bench-press': 'Barbell', 'push-up': 'Bodyweight',
  'overhead-press': 'Barbell', 'pull-up': 'Bodyweight', 'bent-over-row': 'Barbell', 'lat-pulldown': 'Machine / cable',
  'bicep-curl': 'Dumbbell', lunge: 'Dumbbell', 'glute-bridge': 'Bodyweight', 'calf-raise': 'Bodyweight',
  'back-extension': 'Bodyweight', 'bird-dog': 'Bodyweight', 'dead-bug': 'Bodyweight', 'mcgill-curl-up': 'Bodyweight',
  plank: 'Bodyweight', 'side-plank': 'Bodyweight', 'pallof-press': 'Machine / cable', running: 'Bodyweight',
  cycling: 'Other', 'brisk-walk': 'Bodyweight', rowing: 'Cardio machine', intervals: 'Bodyweight', 'cat-cow': 'Bodyweight',
  'childs-pose': 'Bodyweight', 'thoracic-rotation': 'Bodyweight', 'hip-flexor-stretch': 'Bodyweight',
  'hamstring-stretch': 'Bodyweight', 'shoulder-pass-through': 'Band', 'kettlebell-swing': 'Kettlebell',
  'farmers-carry': 'Dumbbell', swimming: 'Other', 'yoga-flow': 'Bodyweight',
};

/** Parses "quads .4, glutes .35" into area weights. */
function m(spec: string): AreaWeight[] {
  return spec.split(',').map((part) => {
    const [areaId, w] = part.trim().split(/\s+/);
    return { areaId, weight: Number(w) };
  });
}

function ex(
  id: string, name: string, category: ExerciseCategory, equipment: Equipment, kind: ExerciseKind,
  standard: number, mappings: string, opts: { weighted?: boolean; hint?: string } = {},
): Exercise {
  return { id, name, category, equipment, kind, standard, usesWeight: !!opts.weighted, mappings: m(mappings), hint: opts.hint };
}

const W = { weighted: true };
const S = 'Strength', C = 'Core & back', K = 'Cardio', M = 'Mobility';

// Library expansion (v0.2). `standard` = one solid session: total reps, or minutes.
const MORE: Exercise[] = [
  // Barbell
  ex('front-squat', 'Front squat', S, 'Barbell', 'reps', 25, 'quads .45, glutes .2, hamstrings .1, spinalStabilisers .15, abs .1', W),
  ex('sumo-deadlift', 'Sumo deadlift', S, 'Barbell', 'reps', 25, 'glutes .3, quads .2, hamstrings .2, lowerBack .15, spinalStabilisers .1, lats .05', W),
  ex('hip-thrust', 'Hip thrust', S, 'Barbell', 'reps', 30, 'glutes .65, hamstrings .2, quads .1, spinalStabilisers .05', W),
  ex('good-morning', 'Good morning', S, 'Barbell', 'reps', 30, 'hamstrings .4, lowerBack .35, glutes .15, spinalStabilisers .1', W),
  ex('incline-bench', 'Incline bench press', S, 'Barbell', 'reps', 25, 'chest .5, shoulders .3, arms .2', W),
  ex('close-grip-bench', 'Close-grip bench press', S, 'Barbell', 'reps', 25, 'arms .5, chest .35, shoulders .15', W),
  ex('barbell-curl', 'Barbell curl', S, 'Barbell', 'reps', 30, 'arms 1', W),

  // Dumbbell
  ex('db-bench-press', 'Dumbbell bench press', S, 'Dumbbell', 'reps', 30, 'chest .55, shoulders .2, arms .25', W),
  ex('db-shoulder-press', 'Dumbbell shoulder press', S, 'Dumbbell', 'reps', 30, 'shoulders .6, arms .3, abs .1', W),
  ex('db-row', 'One-arm dumbbell row', S, 'Dumbbell', 'reps', 30, 'lats .6, arms .25, spinalStabilisers .1, obliques .05', { ...W, hint: 'Count both arms' }),
  ex('goblet-squat', 'Goblet squat', S, 'Dumbbell', 'reps', 30, 'quads .4, glutes .3, hamstrings .1, abs .1, spinalStabilisers .1', W),
  ex('db-rdl', 'Dumbbell Romanian deadlift', S, 'Dumbbell', 'reps', 30, 'hamstrings .4, glutes .3, lowerBack .2, spinalStabilisers .1', W),
  ex('lateral-raise', 'Lateral raise', S, 'Dumbbell', 'reps', 36, 'shoulders .9, arms .1', W),
  ex('db-fly', 'Dumbbell fly', S, 'Dumbbell', 'reps', 30, 'chest .8, shoulders .2', W),
  ex('hammer-curl', 'Hammer curl', S, 'Dumbbell', 'reps', 30, 'arms 1', W),
  ex('overhead-tricep-extension', 'Overhead tricep extension', S, 'Dumbbell', 'reps', 30, 'arms .9, shoulders .1', W),
  ex('step-up', 'Step-up', S, 'Dumbbell', 'reps', 30, 'quads .4, glutes .4, hamstrings .1, calves .1', { ...W, hint: 'Count both legs' }),
  ex('bulgarian-split-squat', 'Bulgarian split squat', S, 'Dumbbell', 'reps', 30, 'quads .4, glutes .4, hamstrings .1, spinalStabilisers .1', { ...W, hint: 'Count both legs' }),
  ex('walking-lunge', 'Walking lunge', S, 'Dumbbell', 'reps', 30, 'quads .4, glutes .35, hamstrings .1, calves .05, spinalStabilisers .1', W),
  ex('reverse-fly', 'Reverse fly', S, 'Dumbbell', 'reps', 36, 'shoulders .6, lats .3, spinalStabilisers .1', W),
  ex('db-pullover', 'Dumbbell pullover', S, 'Dumbbell', 'reps', 30, 'lats .5, chest .4, arms .1', W),
  ex('renegade-row', 'Renegade row', S, 'Dumbbell', 'reps', 24, 'lats .35, abs .25, obliques .15, arms .15, shoulders .1', W),
  ex('suitcase-carry', 'Suitcase carry', C, 'Dumbbell', 'timed', 3, 'obliques .4, spinalStabilisers .35, arms .15, shoulders .1', { hint: 'One weight, one side; switch halfway' }),

  // Kettlebell
  ex('kb-deadlift', 'Kettlebell deadlift', S, 'Kettlebell', 'reps', 30, 'glutes .3, hamstrings .3, lowerBack .2, quads .1, spinalStabilisers .1', W),
  ex('turkish-get-up', 'Turkish get-up', S, 'Kettlebell', 'reps', 6, 'shoulders .3, abs .2, spinalStabilisers .2, obliques .15, glutes .15', { ...W, hint: 'Count each side as one rep' }),
  ex('kb-clean-press', 'Kettlebell clean and press', S, 'Kettlebell', 'reps', 20, 'shoulders .35, glutes .2, hamstrings .15, arms .15, spinalStabilisers .15', W),
  ex('kb-halo', 'Kettlebell halo', M, 'Kettlebell', 'reps', 20, 'shoulderMobility .5, shoulders .3, abs .2', W),

  // Machine / cable
  ex('leg-press', 'Leg press', S, 'Machine / cable', 'reps', 30, 'quads .5, glutes .3, hamstrings .15, calves .05', W),
  ex('leg-extension', 'Leg extension', S, 'Machine / cable', 'reps', 36, 'quads 1', W),
  ex('leg-curl', 'Leg curl', S, 'Machine / cable', 'reps', 36, 'hamstrings 1', W),
  ex('chest-press-machine', 'Chest press machine', S, 'Machine / cable', 'reps', 30, 'chest .55, shoulders .2, arms .25', W),
  ex('seated-cable-row', 'Seated cable row', S, 'Machine / cable', 'reps', 30, 'lats .6, arms .25, spinalStabilisers .15', W),
  ex('face-pull', 'Face pull', S, 'Machine / cable', 'reps', 36, 'shoulders .5, lats .3, shoulderMobility .2', W),
  ex('tricep-pushdown', 'Tricep pushdown', S, 'Machine / cable', 'reps', 36, 'arms 1', W),
  ex('cable-woodchop', 'Cable woodchop', C, 'Machine / cable', 'reps', 30, 'obliques .6, abs .2, shoulders .1, spinalStabilisers .1', { ...W, hint: 'Count both sides' }),
  ex('hip-abduction', 'Hip abduction machine', S, 'Machine / cable', 'reps', 36, 'glutes 1', W),
  ex('assisted-pull-up', 'Assisted pull-up', S, 'Machine / cable', 'reps', 24, 'lats .6, arms .3, abs .1'),
  ex('cable-crunch', 'Cable crunch', C, 'Machine / cable', 'reps', 36, 'abs .9, obliques .1', W),
  ex('seated-calf-raise', 'Seated calf raise', S, 'Machine / cable', 'reps', 45, 'calves 1', W),

  // Bodyweight strength
  ex('chin-up', 'Chin-up', S, 'Bodyweight', 'reps', 20, 'lats .5, arms .4, abs .1'),
  ex('dips', 'Dips', S, 'Bodyweight', 'reps', 24, 'arms .45, chest .35, shoulders .2'),
  ex('inverted-row', 'Inverted row', S, 'Bodyweight', 'reps', 30, 'lats .55, arms .25, spinalStabilisers .1, abs .1'),
  ex('pike-push-up', 'Pike push-up', S, 'Bodyweight', 'reps', 24, 'shoulders .6, arms .3, chest .1'),
  ex('air-squat', 'Bodyweight squat', S, 'Bodyweight', 'reps', 45, 'quads .45, glutes .35, hamstrings .1, abs .1'),
  ex('single-leg-glute-bridge', 'Single-leg glute bridge', S, 'Bodyweight', 'reps', 30, 'glutes .6, hamstrings .25, spinalStabilisers .15', { hint: 'Count both legs' }),
  ex('wall-sit', 'Wall sit', S, 'Bodyweight', 'timed', 3, 'quads .8, glutes .2'),
  ex('nordic-curl', 'Nordic hamstring curl', S, 'Bodyweight', 'reps', 15, 'hamstrings .9, glutes .1'),
  ex('sit-to-stand', 'Sit-to-stand', S, 'Bodyweight', 'reps', 30, 'quads .45, glutes .4, hamstrings .15', { hint: 'From a chair, no hands if you can' }),

  // Core & back (incl. common rehab work)
  ex('superman', 'Superman', C, 'Bodyweight', 'reps', 30, 'lowerBack .55, glutes .2, spinalStabilisers .15, shoulders .1'),
  ex('prone-press-up', 'Prone press-up', C, 'Bodyweight', 'reps', 20, 'backMobility .8, lowerBack .2', { hint: 'Gentle. Stop if pain spreads down a leg' }),
  ex('pelvic-tilt', 'Pelvic tilt', C, 'Bodyweight', 'reps', 30, 'spinalStabilisers .5, abs .3, backMobility .2'),
  ex('clamshell', 'Clamshell', C, 'Bodyweight', 'reps', 40, 'glutes .9, hipMobility .1', { hint: 'Count both sides' }),
  ex('side-lying-leg-raise', 'Side-lying leg raise', C, 'Bodyweight', 'reps', 40, 'glutes .8, obliques .2', { hint: 'Count both sides' }),
  ex('hip-hinge-drill', 'Hip hinge drill', C, 'Bodyweight', 'reps', 30, 'spinalStabilisers .4, hamstrings .2, hipMobility .2, lowerBack .2', { hint: 'With a dowel along your spine' }),
  ex('bear-hold', 'Bear hold', C, 'Bodyweight', 'timed', 2, 'abs .35, shoulders .25, spinalStabilisers .25, quads .15'),
  ex('hollow-hold', 'Hollow hold', C, 'Bodyweight', 'timed', 2, 'abs .7, spinalStabilisers .2, obliques .1'),
  ex('crunch', 'Crunch', C, 'Bodyweight', 'reps', 40, 'abs .9, obliques .1'),
  ex('bicycle-crunch', 'Bicycle crunch', C, 'Bodyweight', 'reps', 40, 'obliques .5, abs .5'),
  ex('hanging-knee-raise', 'Hanging knee raise', C, 'Bodyweight', 'reps', 30, 'abs .7, obliques .1, arms .1, lats .1'),
  ex('ab-wheel', 'Ab wheel rollout', C, 'Other', 'reps', 20, 'abs .6, spinalStabilisers .2, lats .1, shoulders .1'),
  ex('glute-bridge-march', 'Glute bridge march', C, 'Bodyweight', 'reps', 30, 'glutes .5, spinalStabilisers .3, hamstrings .2'),
  ex('donkey-kick', 'Quadruped hip extension', C, 'Bodyweight', 'reps', 40, 'glutes .8, spinalStabilisers .1, hamstrings .1', { hint: 'Count both legs' }),
  ex('band-pull-apart', 'Band pull-apart', S, 'Band', 'reps', 45, 'shoulders .5, lats .3, shoulderMobility .2'),
  ex('lateral-band-walk', 'Lateral band walk', S, 'Band', 'reps', 40, 'glutes .9, hipMobility .1', { hint: 'Count steps' }),
  ex('band-row', 'Band row', S, 'Band', 'reps', 36, 'lats .6, arms .25, spinalStabilisers .15'),
  ex('pilates', 'Pilates class', C, 'Other', 'timed', 45, 'abs .3, spinalStabilisers .3, backMobility .2, hipMobility .2'),

  // Cardio
  ex('stair-climber', 'Stair climber', K, 'Cardio machine', 'timed', 15, 'aerobic .6, glutes .2, quads .15, calves .05'),
  ex('elliptical', 'Elliptical', K, 'Cardio machine', 'timed', 25, 'aerobic .8, quads .1, glutes .1'),
  ex('spin-class', 'Spin class', K, 'Cardio machine', 'timed', 40, 'hiit .4, aerobic .4, quads .15, glutes .05'),
  ex('bike-sprints', 'Bike sprints', K, 'Cardio machine', 'timed', 10, 'hiit .7, aerobic .2, quads .1'),
  ex('jump-rope', 'Jump rope', K, 'Other', 'timed', 10, 'aerobic .4, hiit .3, calves .3'),
  ex('hiking', 'Hiking', K, 'Other', 'timed', 45, 'aerobic .65, glutes .15, quads .1, calves .1'),
  ex('burpees', 'Burpees', K, 'Bodyweight', 'reps', 30, 'hiit .5, chest .15, quads .15, shoulders .1, abs .1'),
  ex('jumping-jacks', 'Jumping jacks', K, 'Bodyweight', 'timed', 5, 'aerobic .6, hiit .2, calves .2'),
  ex('mountain-climbers', 'Mountain climbers', K, 'Bodyweight', 'timed', 3, 'hiit .45, abs .3, shoulders .15, quads .1'),
  ex('team-sport', 'Team sport (football, netball…)', K, 'Other', 'timed', 60, 'aerobic .4, hiit .3, quads .1, hamstrings .1, calves .1'),
  ex('racket-sport', 'Racket sport (tennis, padel…)', K, 'Other', 'timed', 60, 'aerobic .4, hiit .25, quads .15, shoulders .1, calves .1'),
  ex('dancing', 'Dancing', K, 'Bodyweight', 'timed', 30, 'aerobic .7, calves .15, hipMobility .15'),

  // Mobility
  ex('pigeon-stretch', 'Pigeon stretch', M, 'Bodyweight', 'timed', 4, 'hipMobility .8, backMobility .2'),
  ex('ninety-ninety', '90/90 hip switches', M, 'Bodyweight', 'timed', 3, 'hipMobility 1'),
  ex('worlds-greatest-stretch', "World's greatest stretch", M, 'Bodyweight', 'timed', 4, 'hipMobility .4, backMobility .3, hamstringFlex .15, shoulderMobility .15'),
  ex('doorway-chest-stretch', 'Doorway chest stretch', M, 'Bodyweight', 'timed', 3, 'shoulderMobility .9, backMobility .1'),
  ex('wall-angels', 'Wall angels', M, 'Bodyweight', 'reps', 20, 'shoulderMobility .6, backMobility .3, spinalStabilisers .1'),
  ex('knee-to-chest', 'Knee-to-chest stretch', M, 'Bodyweight', 'timed', 3, 'backMobility .6, hipMobility .3, hamstringFlex .1'),
  ex('supine-twist', 'Supine twist', M, 'Bodyweight', 'timed', 3, 'backMobility .7, hipMobility .3'),
  ex('seated-forward-fold', 'Seated forward fold', M, 'Bodyweight', 'timed', 3, 'hamstringFlex .7, backMobility .3'),
  ex('couch-stretch', 'Couch stretch', M, 'Bodyweight', 'timed', 4, 'hipMobility 1'),
  ex('sphinx-pose', 'Sphinx pose', M, 'Bodyweight', 'timed', 3, 'backMobility .9, spinalStabilisers .1'),
  ex('frog-stretch', 'Frog stretch', M, 'Bodyweight', 'timed', 3, 'hipMobility 1'),
  ex('downward-dog', 'Downward dog', M, 'Bodyweight', 'timed', 3, 'hamstringFlex .4, shoulderMobility .35, backMobility .25'),
  ex('foam-rolling', 'Foam rolling', M, 'Other', 'timed', 8, 'backMobility .6, shoulderMobility .2, hipMobility .2'),
  ex('tai-chi', 'Tai chi', M, 'Bodyweight', 'timed', 30, 'hipMobility .3, backMobility .3, aerobic .2, spinalStabilisers .2'),
];

export const SEED_EXERCISES: Exercise[] = [
  ...CORE_SEED.map((e) => ({ ...e, equipment: e.equipment ?? CORE_EQUIPMENT[e.id] ?? 'Bodyweight' })),
  ...MORE,
];
