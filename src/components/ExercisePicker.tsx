import { useMemo, useState } from 'react';
import { AREA_BY_ID, SUB_AREAS, SYSTEMS } from '../domain/config';
import type { AppState, Equipment, Exercise, ExerciseCategory } from '../domain/types';
import { allExercises, isUnlocked } from '../store';
import { Icon } from './ui';

const CATEGORIES: ExerciseCategory[] = ['Core & back', 'Strength', 'Cardio', 'Mobility'];

/** Ids of the sub-areas a focus refers to: one area, or every area in a system. */
export function focusAreaIds(focus?: string): string[] {
  if (!focus) return [];
  return AREA_BY_ID[focus] ? [focus] : SUB_AREAS.filter((a) => a.systemId === focus).map((a) => a.id);
}

export function focusLabel(focus?: string) {
  if (!focus) return undefined;
  return AREA_BY_ID[focus]?.name ?? SYSTEMS.find((s) => s.id === focus)?.name;
}

export function ExerciseOption({ ex, onPick, right }: { ex: Exercise; onPick: () => void; right?: React.ReactNode }) {
  const main = [...ex.mappings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  return (
    <button className="ex-option" onClick={onPick}>
      <span className="grow">
        <span style={{ display: 'block', fontWeight: 600 }}>
          {ex.name} {ex.custom && <span className="tag">custom</span>}
        </span>
        <span className="small muted">
          {main.map((m) => AREA_BY_ID[m.areaId]?.name).join(' · ')}
          {ex.equipment && ex.equipment !== 'Bodyweight' ? ` · ${ex.equipment}` : ''}
        </span>
      </span>
      {right ?? <span className="muted" aria-hidden="true">›</span>}
    </button>
  );
}

export function ExercisePicker({ state, title = 'Add exercise', focus, onPick, onClose, already = [] }: {
  state: AppState;
  title?: string;
  focus?: string;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  /** Exercises already in the workout, marked with a tick. */
  already?: string[];
}) {
  const [query, setQuery] = useState('');
  const [focusOn, setFocusOn] = useState(focus);
  const [equipment, setEquipment] = useState<Equipment | 'All'>('All');
  const exercises = useMemo(() => allExercises(state).filter((e) => isUnlocked(state, e)), [state]);
  const equipmentList = useMemo(
    () => [...new Set(exercises.map((e) => e.equipment).filter(Boolean))] as Equipment[],
    [exercises],
  );

  const ids = focusAreaIds(focusOn);
  const weight = (e: Exercise) => e.mappings.filter((m) => ids.includes(m.areaId)).reduce((s, m) => s + m.weight, 0);
  const q = query.trim().toLowerCase();
  const filtered = exercises
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .filter((e) => equipment === 'All' || (e.equipment ?? 'Bodyweight') === equipment)
    .filter((e) => !focusOn || weight(e) > 0)
    .sort((a, b) => (focusOn ? weight(b) - weight(a) : 0));

  const option = (e: Exercise) => (
    <ExerciseOption
      key={e.id}
      ex={e}
      onPick={() => onPick(e.id)}
      right={already.includes(e.id) ? <span className="tag up">added</span> : undefined}
    />
  );

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onClose} aria-label="Back">{Icon.back}</button>
          <div>
            <h1>{title}</h1>
            <p className="sub">Tap an exercise to add it</p>
          </div>
        </div>
      </header>

      <input
        type="search"
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search exercises"
        style={{ marginBottom: 8 }}
      />
      {equipmentList.length > 1 && (
        <div className="chip-scroll" role="group" aria-label="Filter by equipment">
          {(['All', ...equipmentList] as const).map((eq) => (
            <button key={eq} className="chip-btn" aria-pressed={equipment === eq} onClick={() => setEquipment(eq)}>
              {eq}
            </button>
          ))}
        </div>
      )}

      {focusOn && (
        <div className="notice row between">
          <span>For <strong>{focusLabel(focusOn)}</strong>, best matches first</span>
          <button className="btn ghost small" onClick={() => setFocusOn(undefined)}>Show all</button>
        </div>
      )}

      {focusOn ? (
        <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>{filtered.map(option)}</section>
      ) : (
        CATEGORIES.map((cat) => {
          const list = filtered.filter((e) => e.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat}>
              <h2 className="section-title">{cat}</h2>
              <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>{list.map(option)}</section>
            </div>
          );
        })
      )}
      {filtered.length === 0 && <p className="empty">No exercises match.</p>}
    </>
  );
}
