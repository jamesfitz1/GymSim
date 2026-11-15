import { AREA_BY_ID, INJURY_REGION_BY_ID, SUB_AREAS } from './config';
import { daysBetween } from './dates';
import type { BodyState } from './engine';
import type { Exercise, Injury, Plan, StoredChatMessage } from './types';

// The physio assistant: system prompt, per-injury context, the plan tool, and
// turning a proposed plan into a GymSim rehab plan. No network code here (see
// lib/anthropic.ts), so this is easy to test.

export const PHYSIO_MODEL = 'claude-opus-5-5';

/** Frozen instructions: kept first and unchanged so the prompt prefix can be cached. */
export const PHYSIO_SYSTEM = `You are GymSim's rehab assistant: a knowledgeable, careful guide who helps people with musculoskeletal aches and injuries understand what might be going on and stay active safely. You are not a doctor or physiotherapist and you cannot examine the person. Be warm, plain-spoken and concise.

How to run the conversation
- Ask a few short questions at a time, not a long questionnaire. Cover: how and when it started, where exactly it hurts and whether it spreads, what makes it better or worse, pain now (0-10), night pain, and what they have already tried. Use what the app tells you about the injury so you don't re-ask it.
- Screen for red flags early, before suggesting any exercise. Red flags: numbness in the groin, buttocks or inner thighs (saddle area); new problems controlling bladder or bowels; weakness or numbness in a leg or arm that is getting worse; fever or feeling generally unwell with the pain; pain after a major fall, crash or impact; unexplained weight loss; a history of cancer with new back pain; constant pain that does not ease with rest or position, especially at night; chest pain, breathlessness, or a hot, swollen, red calf. If any red flag is present, stop: explain calmly that this needs prompt medical assessment (emergency services or urgent care for the most serious signs), and do not suggest exercises.
- Explain what might be going on as possibilities to discuss with a physiotherapist or doctor, never as a diagnosis ("this sounds like it could be..., which a physio can confirm"). Say when something is uncertain.
- When suggesting exercises, start gentle and conservative, with a clear dose (sets x reps or minutes, how often), a short cue for good form, and how to progress. Always give stop rules: stop or ease off if pain goes above 5/10 during the exercise, or if it is worse the next morning than before.
- Encourage seeing a physiotherapist, especially if things are not improving within 2 to 3 weeks, the pain is severe, or the person is unsure. If they already have a physio's plan, help them follow it rather than replacing it.
- Do not recommend medication doses or interpret scans.

Proposing a rehab plan
- When you and the person have settled on a set of exercises, or they ask for a plan, call the propose_rehab_plan tool. The app shows it as a card they can save into their rehab plans and start straight away.
- Prefer exercises from the app's exercise library (use their exact ids). Only use a custom exercise when nothing in the library fits; then give it a clear name and the body areas it works, with weights that sum to 1, using only the area ids listed.
- Keep plans short: usually 3 to 6 exercises. Put the form cue, frequency and stop rule for each exercise in its note.
- After the tool result, briefly tell the person the plan is ready to save and offer to adjust it.

Formatting: short paragraphs and simple bullet lists. No tables, no headings larger than bold text.`;

export interface ProposedExercise {
  exerciseId: string | null;
  customName: string | null;
  customAreas: { areaId: string; weight: number }[] | null;
  kind: 'reps' | 'timed';
  sets: number;
  reps: number | null;
  minutes: number | null;
  frequency: string;
  note: string;
}

export interface Proposal {
  name: string;
  summary: string;
  exercises: ProposedExercise[];
  safetyNotes: string[];
}

export const PROPOSE_TOOL = {
  name: 'propose_rehab_plan',
  description:
    'Show the person a proposed rehab plan as a card they can save into their rehab plans and start. Call this once you have agreed on exercises, or when they ask for a plan. Use library exercise ids where possible.',
  eager_input_streaming: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['name', 'summary', 'exercises', 'safetyNotes'],
    properties: {
      name: { type: 'string', description: 'Short plan name, e.g. "Lower back rehab A".' },
      summary: { type: 'string', description: 'One or two sentences on what the plan is for.' },
      exercises: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['exerciseId', 'customName', 'customAreas', 'kind', 'sets', 'reps', 'minutes', 'frequency', 'note'],
          properties: {
            exerciseId: { type: ['string', 'null'], description: 'Id from the exercise library, or null for a custom exercise.' },
            customName: { type: ['string', 'null'], description: 'Name for a custom exercise (null when exerciseId is set).' },
            customAreas: {
              type: ['array', 'null'],
              description: 'Areas a custom exercise works, weights summing to 1 (null when exerciseId is set).',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['areaId', 'weight'],
                properties: { areaId: { type: 'string' }, weight: { type: 'number' } },
              },
            },
            kind: { type: 'string', enum: ['reps', 'timed'] },
            sets: { type: 'integer', description: 'Number of sets (1 for a single timed hold or session).' },
            reps: { type: ['integer', 'null'], description: 'Reps per set for reps exercises.' },
            minutes: { type: ['number', 'null'], description: 'Minutes per set for timed exercises.' },
            frequency: { type: 'string', description: 'How often, e.g. "daily" or "3 times a week".' },
            note: { type: 'string', description: 'Form cue, progression and stop rule.' },
          },
        },
      },
      safetyNotes: { type: 'array', items: { type: 'string' } },
    },
  },
};

/** What the app tells the assistant about this injury and the person (appended after the frozen prompt). */
export function physioContext(injury: Injury, body: BodyState, exercises: Exercise[], today: string): string {
  const region = INJURY_REGION_BY_ID[injury.region]?.name ?? injury.region;
  const pain = injury.pain.slice(-7).map((p) => `${p.date}: ${p.score}/10`).join(', ');
  const areas = injury.areaIds.map((a) => `${AREA_BY_ID[a]?.name ?? a} (level ${Math.round(body.levels[a] ?? 0)}/100)`).join(', ');
  const library = exercises
    .map((e) => `${e.id} | ${e.name} | ${e.kind === 'timed' ? 'minutes' : 'reps'} | ${[...e.mappings].sort((a, b) => b.weight - a.weight).map((m) => m.areaId).join(', ')}`)
    .join('\n');
  return [
    'About this person and injury (from the app):',
    `- Injury: ${region}${injury.side !== 'none' ? ` (${injury.side} side)` : ''}, reported as ${injury.severity}.`,
    `- Started: ${injury.startDate} (${daysBetween(injury.startDate, today)} days ago)${injury.resolvedDate ? `; marked recovered ${injury.resolvedDate}` : ''}.`,
    `- Seeing a clinician about it: ${injury.underCare ? 'yes' : 'no'}.`,
    injury.notes ? `- Their notes: ${injury.notes}` : '- No notes.',
    pain ? `- Recent pain scores: ${pain}.` : '- No pain scores logged yet.',
    `- Affected areas in the app: ${areas}.`,
    `- Today: ${today}.`,
    '',
    `Body area ids you may use for custom exercises: ${SUB_AREAS.map((a) => `${a.id} (${a.name})`).join(', ')}.`,
    '',
    'Exercise library (id | name | measured in | areas, main first):',
    library,
  ].join('\n');
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Check a tool input against the schema (the API doesn't when tool input streams). */
export function parseProposal(input: unknown, exercises: Exercise[]): { ok: true; proposal: Proposal } | { ok: false; error: string } {
  const i = input as Partial<Proposal> | null;
  if (!i || typeof i !== 'object') return { ok: false, error: 'Input must be an object.' };
  if (typeof i.name !== 'string' || !i.name.trim()) return { ok: false, error: 'name is required.' };
  if (typeof i.summary !== 'string') return { ok: false, error: 'summary is required.' };
  if (!Array.isArray(i.exercises) || i.exercises.length === 0) return { ok: false, error: 'exercises must be a non-empty array.' };
  if (i.exercises.length > 12) return { ok: false, error: 'Too many exercises; keep it to 12 or fewer.' };
  const ids = new Set(exercises.map((e) => e.id));
  for (const [n, e] of i.exercises.entries()) {
    const where = `exercises[${n}]`;
    if (!e || typeof e !== 'object') return { ok: false, error: `${where} must be an object.` };
    if (e.kind !== 'reps' && e.kind !== 'timed') return { ok: false, error: `${where}.kind must be "reps" or "timed".` };
    if (!isNum(e.sets) || e.sets < 1 || e.sets > 10) return { ok: false, error: `${where}.sets must be 1-10.` };
    if (e.kind === 'reps' && (!isNum(e.reps) || e.reps < 1 || e.reps > 100)) return { ok: false, error: `${where}.reps must be 1-100 for a reps exercise.` };
    if (e.kind === 'timed' && (!isNum(e.minutes) || e.minutes <= 0 || e.minutes > 120)) return { ok: false, error: `${where}.minutes must be over 0 for a timed exercise.` };
    if (typeof e.frequency !== 'string' || typeof e.note !== 'string') return { ok: false, error: `${where} needs frequency and note.` };
    if (e.exerciseId) {
      if (!ids.has(e.exerciseId)) return { ok: false, error: `${where}.exerciseId "${e.exerciseId}" is not in the library; use a library id or a custom exercise.` };
    } else {
      if (typeof e.customName !== 'string' || !e.customName.trim()) return { ok: false, error: `${where} needs exerciseId or customName.` };
      if (!Array.isArray(e.customAreas) || e.customAreas.length === 0) return { ok: false, error: `${where}.customAreas is required for a custom exercise.` };
      for (const a of e.customAreas) {
        if (!AREA_BY_ID[a?.areaId]) return { ok: false, error: `${where}.customAreas has unknown area "${a?.areaId}".` };
        if (!isNum(a.weight) || a.weight <= 0) return { ok: false, error: `${where}.customAreas weights must be positive.` };
      }
    }
  }
  const safetyNotes = Array.isArray(i.safetyNotes) ? i.safetyNotes.filter((s): s is string => typeof s === 'string') : [];
  return { ok: true, proposal: { name: i.name.trim(), summary: i.summary, exercises: i.exercises as ProposedExercise[], safetyNotes } };
}

/** A custom exercise a proposal needs created (weights normalised to sum to 1). */
export function customExerciseFor(e: ProposedExercise): Omit<Exercise, 'id' | 'custom'> {
  const areas = e.customAreas ?? [];
  const total = areas.reduce((s, a) => s + a.weight, 0) || 1;
  // Merge duplicate areas, then normalise.
  const merged = new Map<string, number>();
  for (const a of areas) merged.set(a.areaId, (merged.get(a.areaId) ?? 0) + a.weight / total);
  return {
    name: (e.customName ?? 'Rehab exercise').trim(),
    category: 'Core & back',
    equipment: 'Bodyweight',
    kind: e.kind,
    usesWeight: false,
    standard: e.kind === 'timed' ? Math.max(1, (e.minutes ?? 1) * e.sets) : Math.max(1, (e.reps ?? 10) * e.sets),
    mappings: [...merged.entries()].map(([areaId, weight]) => ({ areaId, weight })),
    hint: e.note || undefined,
  };
}

/** The plan entries for a proposal, given the ids of exercises (custom ones already created, in order). */
export function planEntriesFor(p: Proposal, exerciseIds: string[]): Plan['entries'] {
  return p.exercises.map((e, i) => ({
    exerciseId: exerciseIds[i],
    note: [e.frequency && `Do ${e.frequency}.`, e.note].filter(Boolean).join(' '),
    sets: Array.from({ length: e.sets }, () => (e.kind === 'timed' ? { minutes: e.minutes ?? 1 } : { reps: e.reps ?? 10 })),
  }));
}

/** Valid proposals in a stored assistant message, with their tool_use ids. */
export function proposalsIn(content: StoredChatMessage['content'], exercises: Exercise[]): { id: string; proposal: Proposal }[] {
  if (!Array.isArray(content)) return [];
  const out: { id: string; proposal: Proposal }[] = [];
  for (const b of content as { type?: string; name?: string; id?: string; input?: unknown }[]) {
    if (b?.type === 'tool_use' && b.name === PROPOSE_TOOL.name && b.id) {
      const parsed = parseProposal(b.input, exercises);
      if (parsed.ok) out.push({ id: b.id, proposal: parsed.proposal });
    }
  }
  return out;
}
