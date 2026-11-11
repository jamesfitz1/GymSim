import { useMemo, useState } from 'react';
import { AREA_BY_ID, SUB_AREAS, SYSTEMS, TUNING } from '../domain/config';
import type { AppState, Equipment, Exercise, ExerciseCategory } from '../domain/types';
import { actions, allExercises, isUnlocked } from '../store';
import { CustomExerciseForm, EQUIPMENT } from './CustomExerciseForm';
import { Icon, toast } from './ui';

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

/** Injured areas this exercise works noticeably (weight ≥ TUNING.injuryWarnWeight). */
export function injuredAreasWorked(ex: Exercise | undefined, injured: Record<string, string[]> = {}): string[] {
  if (!ex) return [];
  return ex.mappings.filter((m) => m.weight >= TUNING.injuryWarnWeight && injured[m.areaId]?.length).map((m) => m.areaId);
}

/** "⚠ Works your injured lower back strength and spinal stabilisers". No advice, just a flag. */
export function InjuryWarning({ areas }: { areas: string[] }) {
  if (!areas.length) return null;
  const names = areas.map((a) => AREA_BY_ID[a]?.name.toLowerCase() ?? a);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return <span className="injury-warning">⚠ Works your injured {list}</span>;
}

export function ExerciseOption({ ex, onPick, right, injured }: {
  ex: Exercise;
  onPick: () => void;
  right?: React.ReactNode;
  injured?: Record<string, string[]>;
}) {
  const main = [...ex.mappings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  return (
    <button className="ex-option" onClick={onPick}>
      <span className="grow">
        <span style={{ display: 'block', fontWeight: 600 }}>
          {ex.name} {ex.custom && <span className="tag">custom</span>}
        </span>
        <span className="small muted" style={{ display: 'block' }}>
          {main.map((m) => AREA_BY_ID[m.areaId]?.name).join(' · ')}
          {ex.equipment && ex.equipment !== 'Bodyweight' ? ` · ${ex.equipment}` : ''}
        </span>
        <InjuryWarning areas={injuredAreasWorked(ex, injured)} />
      </span>
      {right ?? <span className="muted" aria-hidden="true">›</span>}
    </button>
  );
}

function LockedOption({ ex, balance }: { ex: Exercise; balance: number }) {
  const cost = ex.unlockCost ?? 0;
  return (
    <div className="ex-option locked">
      <span className="grow">
        <span style={{ display: 'block', fontWeight: 600 }}>🔒 {ex.name}</span>
        <span className="small muted">{cost} coins to unlock</span>
      </span>
      <button
        className="btn small"
        disabled={balance < cost}
        onClick={() => {
          if (actions.buy(`exercise:${ex.id}`, cost, balance)) toast(`Unlocked ${ex.name}`);
        }}
      >
        Unlock
      </button>
    </div>
  );
}

export function ExercisePicker({ state, title = 'Add exercise', focus, onPick, onClose, already = [], balance = 0, injured = {} }: {
  state: AppState;
  title?: string;
  focus?: string;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  /** Exercises already in the workout, marked with a tick. */
  already?: string[];
  /** Coin balance, for unlocking exercises. */
  balance?: number;
  /** Today's injured areas, to flag exercises that work them. */
  injured?: Record<string, string[]>;
}) {
  const [query, setQuery] = useState('');
  const [focusOn, setFocusOn] = useState(focus);
  const [equipment, setEquipment] = useState<Equipment | 'All'>('All');
  const [creating, setCreating] = useState(false);
  const exercises = useMemo(() => allExercises(state), [state]);
  const equipmentList = useMemo(() => EQUIPMENT.filter((eq) => exercises.some((e) => (e.equipment ?? 'Bodyweight') === eq)), [exercises]);

  if (creating) {
    return (
      <CustomExerciseForm
        onDone={(created) => {
          setCreating(false);
          if (created) onPick(created.id);
        }}
      />
    );
  }

  const ids = focusAreaIds(focusOn);
  const weight = (e: Exercise) => e.mappings.filter((m) => ids.includes(m.areaId)).reduce((s, m) => s + m.weight, 0);
  const q = query.trim().toLowerCase();
  const filtered = exercises
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.mappings.some((m) => AREA_BY_ID[m.areaId]?.name.toLowerCase().includes(q)))
    .filter((e) => equipment === 'All' || (e.equipment ?? 'Bodyweight') === equipment)
    .filter((e) => !focusOn || weight(e) > 0)
    .sort((a, b) => (focusOn ? weight(b) - weight(a) : 0));

  const option = (e: Exercise) =>
    isUnlocked(state, e) ? (
      <ExerciseOption
        key={e.id}
        ex={e}
        injured={injured}
        onPick={() => onPick(e.id)}
        right={already.includes(e.id) ? <span className="tag up">added</span> : undefined}
      />
    ) : (
      <LockedOption key={e.id} ex={e} balance={balance} />
    );

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onClose} aria-label="Back">{Icon.back}</button>
          <div>
            <h1>{title}</h1>
            <p className="sub">{exercises.length} exercises · tap one to add it</p>
          </div>
        </div>
      </header>

      <input
        type="search"
        placeholder="Search exercises or a muscle"
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

      <button className="btn ghost block" style={{ marginBottom: 12 }} onClick={() => setCreating(true)}>
        + Create custom exercise
      </button>

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
