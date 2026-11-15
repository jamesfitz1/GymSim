import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SUB_AREAS } from './config';
import { computeBody } from './engine';
import { SEED_EXERCISES } from './exercises';
import { customExerciseFor, parseProposal, physioContext, PHYSIO_SYSTEM, planEntriesFor, proposalsIn, PROPOSE_TOOL } from './physio';
import type { AppState, Injury } from './types';

const EX = Object.fromEntries(SEED_EXERCISES.map((e) => [e.id, e]));
const TODAY = '2026-11-15';
const injury: Injury = {
  id: 'i1', region: 'lower-back', side: 'none', areaIds: ['lowerBack', 'spinalStabilisers', 'backMobility'],
  severity: 'moderate', startDate: '2026-11-10', underCare: false, notes: 'Twinged it deadlifting', pain: [{ date: '2026-11-14', score: 6 }],
};
const state: AppState = {
  version: 2, profile: { id: 'p', name: 'T', createdAt: 0 }, startDate: '2026-11-01', workouts: [], plans: [],
  customExercises: [], pins: [], injuries: [injury], purchases: [], settings: { ...DEFAULT_SETTINGS },
};

const good = {
  name: 'Lower back rehab A',
  summary: 'Gentle core and mobility work.',
  exercises: [
    { exerciseId: 'bird-dog', customName: null, customAreas: null, kind: 'reps', sets: 2, reps: 8, minutes: null, frequency: 'daily', note: 'Slow, keep hips level.' },
    { exerciseId: 'cat-cow', customName: null, customAreas: null, kind: 'timed', sets: 1, reps: null, minutes: 2, frequency: 'twice a day', note: 'Pain-free range only.' },
    { exerciseId: null, customName: 'Supine knee rocks', customAreas: [{ areaId: 'backMobility', weight: 3 }, { areaId: 'hipMobility', weight: 1 }], kind: 'reps', sets: 2, reps: 10, minutes: null, frequency: 'daily', note: 'Small range.' },
  ],
  safetyNotes: ['Stop if pain goes above 5/10.'],
};

describe('physio prompt and context', () => {
  it('the frozen prompt screens for red flags and avoids diagnosis', () => {
    for (const phrase of ['red flag', 'saddle', 'bladder', 'never as a diagnosis', 'stop rules', 'propose_rehab_plan']) {
      expect(PHYSIO_SYSTEM.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it('context includes the injury, pain trend, areas and library ids', () => {
    const body = computeBody(state, EX, TODAY);
    const ctx = physioContext(injury, body, SEED_EXERCISES, TODAY);
    expect(ctx).toContain('Lower back');
    expect(ctx).toContain('5 days ago');
    expect(ctx).toContain('2026-11-14: 6/10');
    expect(ctx).toContain('Twinged it deadlifting');
    expect(ctx).toContain('bird-dog | Bird-dog');
    for (const a of SUB_AREAS) expect(ctx).toContain(a.id);
  });

  it('the tool schema requires every field (needed for schema-valid inputs)', () => {
    const item = PROPOSE_TOOL.input_schema.properties.exercises.items;
    expect(item.required.sort()).toEqual(Object.keys(item.properties).sort());
  });
});

describe('proposal validation', () => {
  it('accepts a valid proposal', () => {
    const r = parseProposal(good, SEED_EXERCISES);
    expect(r.ok).toBe(true);
  });

  it('rejects unknown exercise ids, bad areas and missing doses with a fixable message', () => {
    const bad = (patch: object, i = 0) => ({ ...good, exercises: good.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
    const cases: [object, string][] = [
      [bad({ exerciseId: 'moonwalk' }), 'not in the library'],
      [bad({ customAreas: [{ areaId: 'eyebrows', weight: 1 }] }, 2), 'unknown area'],
      [bad({ reps: null }), 'reps must be'],
      [bad({ minutes: 0 }, 1), 'minutes must be'],
      [bad({ sets: 0 }), 'sets must be'],
      [{ ...good, exercises: [] }, 'non-empty'],
    ];
    for (const [input, msg] of cases) {
      const r = parseProposal(input, SEED_EXERCISES);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(msg);
    }
  });
});

describe('proposal → rehab plan', () => {
  it('custom exercises get normalised weights and a sensible standard', () => {
    const r = parseProposal(good, SEED_EXERCISES);
    if (!r.ok) throw new Error('expected ok');
    const custom = customExerciseFor(r.proposal.exercises[2]);
    expect(custom.name).toBe('Supine knee rocks');
    expect(custom.mappings.reduce((s, m) => s + m.weight, 0)).toBeCloseTo(1);
    expect(custom.mappings.find((m) => m.areaId === 'backMobility')!.weight).toBeCloseTo(0.75);
    expect(custom.standard).toBe(20);
  });

  it('plan entries carry sets, doses and the note with frequency', () => {
    const r = parseProposal(good, SEED_EXERCISES);
    if (!r.ok) throw new Error('expected ok');
    const entries = planEntriesFor(r.proposal, ['bird-dog', 'cat-cow', 'custom-x']);
    expect(entries[0].sets).toEqual([{ reps: 8 }, { reps: 8 }]);
    expect(entries[1].sets).toEqual([{ minutes: 2 }]);
    expect(entries[0].note).toBe('Do daily. Slow, keep hips level.');
    expect(entries[2].exerciseId).toBe('custom-x');
  });

  it('finds valid proposals in stored assistant content and skips invalid ones', () => {
    const content = [
      { type: 'text', text: 'Here is a plan.' },
      { type: 'tool_use', id: 'tu1', name: 'propose_rehab_plan', input: good },
      { type: 'tool_use', id: 'tu2', name: 'propose_rehab_plan', input: { name: 'x' } },
    ];
    const found = proposalsIn(content, SEED_EXERCISES);
    expect(found.map((f) => f.id)).toEqual(['tu1']);
  });
});
