import { useMemo, useState } from 'react';
import { Icon, toast } from '../components/ui';
import { AREA_BY_ID, SUB_AREAS, SYSTEMS } from '../domain/config';
import { formatDay, todayKey } from '../domain/dates';
import { entryUnits, type BodyState } from '../domain/engine';
import { bestSet, formatSets } from '../domain/format';
import type { AppState, AreaWeight, Equipment, Exercise, ExerciseCategory, ExerciseKind } from '../domain/types';
import { actions, allExercises, isUnlocked } from '../store';

const EQUIPMENT: Equipment[] = ['Bodyweight', 'Dumbbell', 'Barbell', 'Kettlebell', 'Machine / cable', 'Band', 'Cardio machine', 'Other'];

const CATEGORIES: ExerciseCategory[] = ['Core & back', 'Strength', 'Cardio', 'Mobility'];

export function Library({ state, body }: { state: AppState; body: BodyState }) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | 'All'>('All');
  const all = allExercises(state);
  const equipmentList = useMemo(() => EQUIPMENT.filter((eq) => all.some((e) => (e.equipment ?? 'Bodyweight') === eq)), [all]);
  const q = query.trim().toLowerCase();
  const exercises = all
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.mappings.some((m) => AREA_BY_ID[m.areaId]?.name.toLowerCase().includes(q)))
    .filter((e) => equipment === 'All' || (e.equipment ?? 'Bodyweight') === equipment);

  if (adding) return <AddCustom onDone={() => setAdding(false)} />;
  const open = openId ? all.find((e) => e.id === openId) : undefined;
  if (open) return <ExerciseDetail state={state} ex={open} onBack={() => setOpenId(null)} />;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Exercise library</h1>
          <p className="sub">What each exercise feeds, by weighting</p>
        </div>
        <button className="btn small" onClick={() => setAdding(true)}>+ Custom</button>
      </header>

      <input
        type="search"
        placeholder={`Search ${all.length} exercises or a muscle`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search exercises"
        style={{ marginBottom: 8 }}
      />
      <div className="chip-scroll" role="group" aria-label="Filter by equipment">
        {(['All', ...equipmentList] as const).map((eq) => (
          <button key={eq} className="chip-btn" aria-pressed={equipment === eq} onClick={() => setEquipment(eq)}>{eq}</button>
        ))}
      </div>
      {exercises.length === 0 && <p className="empty">No exercises match.</p>}

      {CATEGORIES.map((cat) => {
        const list = exercises.filter((e) => e.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat}>
            <h2 className="section-title">{cat}</h2>
            <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {list.map((ex) => (
                <LibraryItem key={ex.id} ex={ex} unlocked={isUnlocked(state, ex)} balance={body.coinBalance} onOpen={() => setOpenId(ex.id)} />
              ))}
            </section>
          </div>
        );
      })}
    </>
  );
}

function LibraryItem({ ex, unlocked, balance, onOpen }: { ex: Exercise; unlocked: boolean; balance: number; onOpen: () => void }) {
  const maps = [...ex.mappings].sort((a, b) => b.weight - a.weight);
  return (
    <div className="list-item" style={{ alignItems: 'flex-start' }}>
      <button className="grow" onClick={onOpen} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }} aria-label={`${ex.name}: details and progress`}>
        <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>
          <strong>{ex.name}</strong>
          {ex.equipment && ex.equipment !== 'Bodyweight' && <span className="tag">{ex.equipment}</span>}
          {ex.custom && <span className="tag">custom</span>}
          {!unlocked && <span className="tag">🔒 {ex.unlockCost} coins</span>}
        </div>
        <div className="chips">
          {maps.map((m) => (
            <span className="chip" key={m.areaId}>
              {AREA_BY_ID[m.areaId]?.name ?? m.areaId} {Math.round(m.weight * 100)}%
            </span>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Standard session: {ex.kind === 'timed' ? `${ex.standard} min` : `${ex.standard} reps`}
          {ex.usesWeight ? ' · weighted' : ''}
        </div>
      </button>
      {!unlocked && (
        <button
          className="btn small"
          disabled={balance < (ex.unlockCost ?? 0)}
          onClick={() => {
            if (actions.buy(`exercise:${ex.id}`, ex.unlockCost ?? 0, balance)) toast(`Unlocked ${ex.name}`);
          }}
        >
          Unlock
        </button>
      )}
      {ex.custom && (
        <button
          className="icon-btn"
          aria-label={`Delete ${ex.name}`}
          onClick={() => {
            if (confirm(`Delete “${ex.name}” and all its logged entries?`)) actions.deleteCustomExercise(ex.id);
          }}
        >
          {Icon.trash}
        </button>
      )}
    </div>
  );
}

/** One exercise: what it trains, your best, and your history with it. */
function ExerciseDetail({ state, ex, onBack }: { state: AppState; ex: Exercise; onBack: () => void }) {
  const today = todayKey();
  const sessions = state.workouts
    .flatMap((w) => w.entries.filter((e) => e.exerciseId === ex.id && e.sets.some((s) => s.done)).map((e) => ({ w, e })))
    .sort((a, b) => a.w.startedAt - b.w.startedAt);
  const best = sessions
    .map(({ e }) => bestSet(ex, e.sets))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .sort((a, b) => b.value - a.value)[0];
  const recent = sessions.slice(-12);
  const volumes = recent.map(({ e }) => entryUnits(ex, e.sets));
  const maxV = Math.max(1, ...volumes);
  const maps = [...ex.mappings].sort((a, b) => b.weight - a.weight);

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onBack} aria-label="Back to library">{Icon.back}</button>
          <div>
            <h1>{ex.name}</h1>
            <p className="sub">{ex.category}{ex.equipment ? ` · ${ex.equipment}` : ''}</p>
          </div>
        </div>
      </header>

      <div className="stats">
        <div className="stat"><div className="value">{sessions.length}</div><div className="label">sessions</div></div>
        <div className="stat" style={{ gridColumn: 'span 2' }}>
          <div className="value" style={{ fontSize: 18, lineHeight: 1.3 }}>{best?.label ?? '–'}</div>
          <div className="label">best set</div>
        </div>
      </div>

      <section className="card">
        <h3>Trains</h3>
        <div className="chips">
          {maps.map((m) => (
            <span className="chip" key={m.areaId}>{AREA_BY_ID[m.areaId]?.name} {Math.round(m.weight * 100)}%</span>
          ))}
        </div>
        {ex.hint && <p className="small muted" style={{ margin: '8px 0 0' }}>{ex.hint}</p>}
      </section>

      {recent.length > 1 && (
        <section className="card">
          <h3>Volume per session</h3>
          <div className="spark" role="img" aria-label={`Volume over your last ${recent.length} sessions`}>
            {volumes.map((v, i) => (
              <div key={i} title={`${formatDay(recent[i].w.date, today)}: ${Math.round(v)}`} style={{ height: `${Math.max(6, (v / maxV) * 100)}%` }} />
            ))}
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {ex.kind === 'timed' ? 'Total minutes' : ex.usesWeight ? 'Reps weighted by load' : 'Total reps'} in each of your last {recent.length} sessions.
          </p>
        </section>
      )}

      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {sessions.length === 0 && <p className="empty">You haven't done this one yet.</p>}
        {[...sessions].reverse().slice(0, 20).map(({ w, e }) => (
          <div className="list-item" key={e.id}>
            <span className="grow">{formatDay(w.date, today)}</span>
            <span className="small muted">{formatSets(ex, e.sets.filter((s) => s.done))}</span>
          </div>
        ))}
      </section>
    </>
  );
}

interface Row {
  areaId: string;
  pct: string;
}

function AddCustom({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('Strength');
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
    actions.addCustomExercise({
      name: name.trim(),
      category,
      kind,
      usesWeight: kind === 'reps' && usesWeight,
      standard: Number(standard),
      mappings,
    });
    toast(`Added ${name.trim()}`);
    onDone();
  };

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onDone} aria-label="Back to library">{Icon.back}</button>
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
