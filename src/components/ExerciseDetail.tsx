import { AREA_BY_ID } from '../domain/config';
import { formatDay, todayKey } from '../domain/dates';
import { entryUnits } from '../domain/engine';
import { bestSet, formatSets } from '../domain/format';
import type { AppState, Exercise } from '../domain/types';
import { Icon } from './ui';

/** One exercise: what it trains, your best, and your history with it. */
export function ExerciseDetail({ state, ex, onBack }: { state: AppState; ex: Exercise; onBack: () => void }) {
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
          <button className="icon-btn" onClick={onBack} aria-label="Back">{Icon.back}</button>
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
