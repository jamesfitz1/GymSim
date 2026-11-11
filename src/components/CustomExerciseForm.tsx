import { useState } from 'react';
import { SUB_AREAS, SYSTEMS } from '../domain/config';
import type { AreaWeight, Equipment, Exercise, ExerciseCategory, ExerciseKind } from '../domain/types';
import { actions } from '../store';
import { Icon, toast } from './ui';

export const EQUIPMENT: Equipment[] = ['Bodyweight', 'Dumbbell', 'Barbell', 'Kettlebell', 'Machine / cable', 'Band', 'Cardio machine', 'Other'];
const CATEGORIES: ExerciseCategory[] = ['Core & back', 'Strength', 'Cardio', 'Mobility'];

interface Row {
  areaId: string;
  pct: string;
}

/** Create a custom exercise (e.g. one a physio gave you). `onDone` gets the new exercise, or nothing if cancelled. */
export function CustomExerciseForm({ onDone }: { onDone: (created?: Exercise) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('Strength');
  const [equipment, setEquipment] = useState<Equipment>('Bodyweight');
  const [kind, setKind] = useState<ExerciseKind>('reps');
  const [usesWeight, setUsesWeight] = useState(false);
  const [standard, setStandard] = useState('30');
  const [rows, setRows] = useState<Row[]>([{ areaId: 'spinalStabilisers', pct: '100' }]);

  const total = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const usable = rows.filter((r) => (Number(r.pct) || 0) > 0);
  const distinct = new Set(usable.map((r) => r.areaId)).size === usable.length;
  const valid = name.trim().length > 0 && usable.length > 0 && distinct && Number(standard) > 0;

  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => {
    // Normalise so weights always sum to 1, whatever the user typed.
    const mappings: AreaWeight[] = usable.map((r) => ({ areaId: r.areaId, weight: (Number(r.pct) || 0) / total }));
    const created = actions.addCustomExercise({
      name: name.trim(),
      category,
      equipment,
      kind,
      usesWeight: kind === 'reps' && usesWeight,
      standard: Number(standard),
      mappings,
    });
    toast(`Created ${name.trim()}`);
    onDone(created);
  };

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={() => onDone()} aria-label="Cancel">{Icon.back}</button>
          <div>
            <h1>Custom exercise</h1>
            <p className="sub">e.g. one your physio gave you</p>
          </div>
        </div>
      </header>

      <section className="card">
        <label className="field">
          <span>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prone press-up" />
        </label>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Equipment</span>
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {EQUIPMENT.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>

        <div className="field">
          <span className="small muted" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Measured in</span>
          <div className="segmented">
            <button type="button" aria-pressed={kind === 'reps'} onClick={() => { setKind('reps'); setStandard('30'); }}>Sets × reps</button>
            <button type="button" aria-pressed={kind === 'timed'} onClick={() => { setKind('timed'); setStandard('5'); }}>Minutes</button>
          </div>
        </div>

        {kind === 'reps' && (
          <label className="checkbox" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={usesWeight} onChange={(e) => setUsesWeight(e.target.checked)} />
            <span>Uses added weight</span>
          </label>
        )}

        <label className="field">
          <span>A solid session is ({kind === 'reps' ? 'total reps' : 'total minutes'})</span>
          <input type="number" inputMode="decimal" min={1} value={standard} onChange={(e) => setStandard(e.target.value)} />
        </label>
      </section>

      <section className="card">
        <h3>Areas it trains</h3>
        <p className="small muted">Split 100% across the areas. The biggest share gets the full points.</p>
        {rows.map((r, i) => (
          <div className="row" key={i} style={{ marginBottom: 8 }}>
            <select className="grow" value={r.areaId} onChange={(e) => update(i, { areaId: e.target.value })} aria-label="Area">
              {SYSTEMS.map((s) => (
                <optgroup key={s.id} label={s.name}>
                  {SUB_AREAS.filter((a) => a.systemId === s.id).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={r.pct}
              onChange={(e) => update(i, { pct: e.target.value })}
              aria-label="Percent"
              style={{ width: 76, flex: 'none' }}
            />
            <span className="muted">%</span>
            {rows.length > 1 && (
              <button className="icon-btn" aria-label="Remove area" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                {Icon.trash}
              </button>
            )}
          </div>
        ))}
        <div className="row between">
          <button
            className="btn ghost small"
            onClick={() => setRows([...rows, { areaId: SUB_AREAS.find((a) => !rows.some((r) => r.areaId === a.id))?.id ?? 'abs', pct: '0' }])}
          >
            + Add area
          </button>
          <span className={`small num ${total === 100 ? 'muted' : ''}`} style={{ color: total === 100 ? undefined : 'var(--danger)' }}>
            Total {total}%{total !== 100 && total > 0 ? ' (will be scaled to 100)' : ''}
          </span>
        </div>
        {!distinct && <p className="small" style={{ color: 'var(--danger)', marginTop: 8 }}>Each area can only appear once.</p>}
      </section>

      <button className="btn block" disabled={!valid} onClick={save}>Save exercise</button>
    </>
  );
}
