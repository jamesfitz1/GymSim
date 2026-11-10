import { useMemo, useState } from 'react';
import { Icon, toast } from '../components/ui';
import { AREA_BY_ID, SUB_AREAS, SYSTEMS, TUNING } from '../domain/config';
import { addDays, formatDay, todayKey } from '../domain/dates';
import { areaGains } from '../domain/engine';
import type { AppState, Exercise, ExerciseCategory } from '../domain/types';
import { actions, allExercises, exerciseMap, isUnlocked } from '../store';

const CATEGORIES: ExerciseCategory[] = ['Core & back', 'Strength', 'Cardio', 'Mobility'];

function describeLog(ex: Exercise | undefined, l: { sets?: number; reps?: number; weightKg?: number; minutes?: number }) {
  if (!ex) return '';
  if (ex.kind === 'timed') return `${l.minutes} min`;
  return `${l.sets} × ${l.reps}${ex.usesWeight && l.weightKg ? ` @ ${l.weightKg} kg` : ''}`;
}

export function LogWorkout({ state, focusArea, onClearFocus }: {
  state: AppState;
  focusArea?: string;
  onClearFocus: () => void;
}) {
  const [query, setQuery] = useState('');
  const [exId, setExId] = useState<string | null>(null);
  const exercises = useMemo(() => allExercises(state).filter((e) => isUnlocked(state, e)), [state]);
  const byId = useMemo(() => exerciseMap(state), [state]);
  const ex = exId ? byId[exId] : undefined;

  if (ex) return <LogForm ex={ex} onDone={() => setExId(null)} />;

  // focusArea is a sub-area id or a whole system id (e.g. 'cardio' from the heart).
  const focusIds = focusArea
    ? AREA_BY_ID[focusArea]
      ? [focusArea]
      : SUB_AREAS.filter((a) => a.systemId === focusArea).map((a) => a.id)
    : [];
  const focusName = focusArea ? AREA_BY_ID[focusArea]?.name ?? SYSTEMS.find((s) => s.id === focusArea)?.name : undefined;
  const focusWeight = (e: Exercise) =>
    e.mappings.filter((m) => focusIds.includes(m.areaId)).reduce((sum, m) => sum + m.weight, 0);

  const q = query.trim().toLowerCase();
  const filtered = exercises
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .filter((e) => !focusArea || focusWeight(e) > 0)
    .sort((a, b) => (focusArea ? focusWeight(b) - focusWeight(a) : 0));

  const recentLogs = [...state.logs].sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt - a.loggedAt).slice(0, 30);
  const today = todayKey();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Log a workout</h1>
          <p className="sub">Pick an exercise, then record what you did</p>
        </div>
      </header>

      <input
        type="search"
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search exercises"
        style={{ marginBottom: 12 }}
      />

      {focusArea && (
        <div className="notice row between">
          <span>Exercises for <strong>{focusName}</strong>, strongest first</span>
          <button className="btn ghost small" onClick={onClearFocus}>Show all</button>
        </div>
      )}

      {focusArea ? (
        <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {filtered.map((e) => <ExerciseOption key={e.id} ex={e} onPick={() => setExId(e.id)} />)}
          {filtered.length === 0 && <p className="empty">No exercises match.</p>}
        </section>
      ) : (
        CATEGORIES.map((cat) => {
          const list = filtered.filter((e) => e.category === cat);
          if (list.length === 0) return null;
          return (
            <div key={cat}>
              <h2 className="section-title">{cat}</h2>
              <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
                {list.map((e) => <ExerciseOption key={e.id} ex={e} onPick={() => setExId(e.id)} />)}
              </section>
            </div>
          );
        })
      )}
      {!focusArea && filtered.length === 0 && <p className="empty">No exercises match “{query}”.</p>}

      <h2 className="section-title">Recent</h2>
      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {recentLogs.length === 0 && <p className="empty">Nothing logged yet.</p>}
        {recentLogs.map((l) => {
          const e = byId[l.exerciseId];
          return (
            <div className="list-item" key={l.id}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{e?.name ?? 'Deleted exercise'}</div>
                <div className="small muted">{formatDay(l.date, today)} · {describeLog(e, l)}</div>
              </div>
              <button
                className="icon-btn"
                aria-label={`Delete ${e?.name ?? 'entry'}`}
                onClick={() => {
                  if (confirm('Delete this entry? Levels will be recalculated.')) actions.deleteLog(l.id);
                }}
              >
                {Icon.trash}
              </button>
            </div>
          );
        })}
      </section>
    </>
  );
}

function ExerciseOption({ ex, onPick }: { ex: Exercise; onPick: () => void }) {
  const main = [...ex.mappings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  return (
    <button className="ex-option" onClick={onPick}>
      <span className="grow">
        <span style={{ display: 'block', fontWeight: 600 }}>
          {ex.name} {ex.custom && <span className="tag">custom</span>}
        </span>
        <span className="small muted">{main.map((m) => AREA_BY_ID[m.areaId]?.name).join(' · ')}</span>
      </span>
      <span className="muted" aria-hidden="true">›</span>
    </button>
  );
}

function NumberField({ label, value, onChange, step = 1, suffix }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="field">
      <span>{label}{suffix ? ` (${suffix})` : ''}</span>
      <input type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function LogForm({ ex, onDone }: { ex: Exercise; onDone: () => void }) {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('');
  const [minutes, setMinutes] = useState(String(ex.standard));

  const fields =
    ex.kind === 'timed'
      ? { minutes: Number(minutes) || 0 }
      : { sets: Number(sets) || 0, reps: Number(reps) || 0, weightKg: ex.usesWeight ? Number(weight) || 0 : undefined };

  const gains = Object.entries(areaGains(ex, fields)).sort((a, b) => b[1] - a[1]);
  const valid = gains.length > 0;

  const save = () => {
    actions.addLog({ exerciseId: ex.id, date, ...fields });
    const capped = gains[0] ? Math.round(Math.min(gains[0][1], TUNING.dailyGainCap)) : 0;
    toast(`Logged ${ex.name} · +${capped} ${AREA_BY_ID[gains[0][0]]?.name ?? ''}`);
    onDone();
  };

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onDone} aria-label="Back to exercise list">{Icon.back}</button>
          <div>
            <h1>{ex.name}</h1>
            <p className="sub">{ex.category}</p>
          </div>
        </div>
      </header>

      <section className="card">
        {ex.kind === 'timed' ? (
          <NumberField label="Duration" suffix="minutes" value={minutes} onChange={setMinutes} step={0.5} />
        ) : (
          <div className={ex.usesWeight ? 'grid-3' : 'grid-2'}>
            <NumberField label="Sets" value={sets} onChange={setSets} />
            <NumberField label="Reps per set" value={reps} onChange={setReps} />
            {ex.usesWeight && <NumberField label="Weight" suffix="kg" value={weight} onChange={setWeight} step={0.5} />}
          </div>
        )}
        {ex.hint && <p className="small muted" style={{ marginTop: -4 }}>{ex.hint}</p>}

        <label className="field">
          <span>Day</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {Array.from({ length: 7 }, (_, i) => addDays(today, -i)).map((d) => (
              <option key={d} value={d}>{formatDay(d, today)}</option>
            ))}
          </select>
        </label>

        <div className="preview" aria-live="polite">
          <div className="small muted" style={{ fontWeight: 600, marginBottom: 4 }}>This will add</div>
          {valid ? (
            gains.map(([areaId, g]) => (
              <div className="gain" key={areaId}>
                <span>{AREA_BY_ID[areaId]?.name ?? areaId}</span>
                <b>+{Math.round(g)}</b>
              </div>
            ))
          ) : (
            <div className="small muted">Enter what you did to see the points.</div>
          )}
          <div className="small muted" style={{ marginTop: 6 }}>
            A standard session ({ex.kind === 'timed' ? `${ex.standard} min` : `${ex.standard} reps`}) gives the main area +{TUNING.sessionPoints}. Max +{TUNING.dailyGainCap} per area per day.
          </div>
        </div>

        <button className="btn block" disabled={!valid} onClick={save}>Save</button>
      </section>
    </>
  );
}
