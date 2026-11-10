import type { Exercise } from './types';

// Seed exercise-to-area mapping table (PRD §12-B). Weights for each exercise
// sum to 1 (enforced by a test). `standard` is one solid session: total reps
// for 'reps' exercises, total minutes for 'timed' ones.
//
// These are general-purpose defaults for tracking, not a programme. Users with
// a diagnosed condition should take exercise selection from their clinician.

export const SEED_EXERCISES: Exercise[] = [
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
