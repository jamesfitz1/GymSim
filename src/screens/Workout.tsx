import { useEffect, useMemo, useState } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { Icon, toast } from '../components/ui';
import { AREA_BY_ID } from '../domain/config';
import { formatDay, todayKey } from '../domain/dates';
import { entryGains, type BodyState } from '../domain/engine';
import { formatDuration, formatSets, personalBests } from '../domain/format';
import type { AppState, Exercise, Plan, SetEntry, Workout } from '../domain/types';
import { actions, activeWorkout, exerciseMap, lastEntryFor } from '../store';

type View =
  | { k: 'main' }
  | { k: 'pick'; focus?: string }
  | { k: 'summary'; workoutId: string }
  | { k: 'plan'; planId: string }
  | { k: 'planPick'; planId: string }
  | { k: 'detail'; workoutId: string };

export interface WorkoutIntent {
  /** Open the exercise picker filtered to this area or system. */
  focus?: string;
  nonce: number;
}

export function WorkoutTab({ state, body, intent }: { state: AppState; body: BodyState; intent?: WorkoutIntent }) {
  const [view, setView] = useState<View>({ k: 'main' });
  const exercises = useMemo(() => exerciseMap(state), [state]);
  const active = activeWorkout(state);

  // Deep link from the Body screen ("Log something for quads").
  useEffect(() => {
    if (!intent) return;
    if (!activeWorkout(state)) actions.startWorkout();
    setView({ k: 'pick', focus: intent.focus });
  }, [intent?.nonce]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view.k]);

  if (view.k === 'pick' && active) {
    return (
      <ExercisePicker
        state={state}
        focus={view.focus}
        already={active.entries.map((e) => e.exerciseId)}
        onClose={() => setView({ k: 'main' })}
        onPick={(id) => {
          actions.addEntry(active.id, id);
          toast(`Added ${exercises[id]?.name}`);
          setView({ k: 'main' });
        }}
      />
    );
  }

  if (view.k === 'planPick') {
    const plan = state.plans.find((p) => p.id === view.planId);
    if (plan)
      return (
        <ExercisePicker
          state={state}
          title="Add to plan"
          already={plan.entries.map((e) => e.exerciseId)}
          onClose={() => setView({ k: 'plan', planId: plan.id })}
          onPick={(id) => {
            const ex = exercises[id];
            const sets = ex?.kind === 'timed' ? [{ minutes: ex.standard }] : [{ reps: 10 }, { reps: 10 }, { reps: 10 }];
            actions.updatePlan({ ...plan, entries: [...plan.entries, { exerciseId: id, sets }] });
            setView({ k: 'plan', planId: plan.id });
          }}
        />
      );
  }

  if (view.k === 'summary') {
    const w = state.workouts.find((x) => x.id === view.workoutId);
    if (w) return <Summary state={state} body={body} workout={w} exercises={exercises} onDone={() => setView({ k: 'main' })} />;
  }

  if (view.k === 'plan') {
    const plan = state.plans.find((p) => p.id === view.planId);
    if (plan)
      return (
        <PlanEditor
          plan={plan}
          exercises={exercises}
          canStart={!active}
          onBack={() => setView({ k: 'main' })}
          onAdd={() => setView({ k: 'planPick', planId: plan.id })}
          onStart={() => {
            actions.startWorkout({ planId: plan.id });
            setView({ k: 'main' });
          }}
        />
      );
  }

  if (view.k === 'detail') {
    const w = state.workouts.find((x) => x.id === view.workoutId);
    if (w)
      return (
        <WorkoutDetail
          workout={w}
          exercises={exercises}
          canReopen={!active}
          onBack={() => setView({ k: 'main' })}
          onReopen={() => {
            actions.reopenWorkout(w.id);
            setView({ k: 'main' });
          }}
        />
      );
  }

  if (active) {
    return (
      <Session
        state={state}
        workout={active}
        exercises={exercises}
        onAdd={() => setView({ k: 'pick' })}
        onFinished={(kept) => setView(kept ? { k: 'summary', workoutId: active.id } : { k: 'main' })}
      />
    );
  }

  return (
    <WorkoutHome
      state={state}
      exercises={exercises}
      onOpenPlan={(planId) => setView({ k: 'plan', planId })}
      onOpenWorkout={(workoutId) => setView({ k: 'detail', workoutId })}
    />
  );
}

// ---------------------------------------------------------------------------
// Set rows (shared by the session and the plan editor)
// ---------------------------------------------------------------------------

function NumInput({ value, onChange, label, step = 1 }: { value?: number; onChange: (n: number | undefined) => void; label: string; step?: number }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      aria-label={label}
      placeholder="–"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

function SetRows({ ex, sets, tickable, onChange, onRemove }: {
  ex: Exercise | undefined;
  sets: (Partial<SetEntry>)[];
  tickable: boolean;
  onChange: (i: number, patch: Partial<SetEntry>) => void;
  onRemove: (i: number) => void;
}) {
  const timed = ex?.kind === 'timed';
  const weighted = !timed && !!ex?.usesWeight;
  const cols = `26px ${timed ? '1fr' : weighted ? '1fr 1fr' : '1fr'} ${tickable ? '44px' : ''} 30px`;
  return (
    <div className="sets">
      <div className="set-row head" style={{ gridTemplateColumns: cols }}>
        <span>Set</span>
        {timed ? <span>Minutes</span> : <span>Reps</span>}
        {weighted && <span>kg</span>}
        {tickable && <span style={{ textAlign: 'center' }}>Done</span>}
        <span />
      </div>
      {sets.map((s, i) => (
        <div key={i} className={`set-row ${s.done ? 'done' : ''}`} style={{ gridTemplateColumns: cols }}>
          <span className="set-n">{i + 1}</span>
          {timed ? (
            <NumInput label={`Set ${i + 1} minutes`} step={0.5} value={s.minutes} onChange={(n) => onChange(i, { minutes: n })} />
          ) : (
            <NumInput label={`Set ${i + 1} reps`} value={s.reps} onChange={(n) => onChange(i, { reps: n })} />
          )}
          {weighted && <NumInput label={`Set ${i + 1} weight in kg`} step={0.5} value={s.weightKg} onChange={(n) => onChange(i, { weightKg: n })} />}
          {tickable && (
            <button
              type="button"
              className="tick"
              aria-pressed={!!s.done}
              aria-label={`Mark set ${i + 1} ${s.done ? 'not done' : 'done'}`}
              onClick={() => onChange(i, { done: !s.done })}
            >
              ✓
            </button>
          )}
          <button type="button" className="icon-btn x" aria-label={`Remove set ${i + 1}`} onClick={() => onRemove(i)}>×</button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home: start, plans, history
// ---------------------------------------------------------------------------

function planSummary(plan: Plan, exercises: Record<string, Exercise>) {
  return plan.entries.map((e) => exercises[e.exerciseId]?.name).filter(Boolean).join(' · ');
}

function WorkoutHome({ state, exercises, onOpenPlan, onOpenWorkout }: {
  state: AppState;
  exercises: Record<string, Exercise>;
  onOpenPlan: (id: string) => void;
  onOpenWorkout: (id: string) => void;
}) {
  const history = [...state.workouts].filter((w) => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt);
  const last = history[0];
  const focus = new Set(state.pins.map((p) => p.areaId));

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Workout</h1>
          <p className="sub">Plan it, tick it off, track progress</p>
        </div>
      </header>

      <section className="card">
        <button className="btn block" onClick={() => actions.startWorkout()}>Start a blank workout</button>
        {last && (
          <button className="btn ghost block" style={{ marginTop: 8, textAlign: 'left' }} onClick={() => actions.startWorkout({ repeatWorkoutId: last.id })}>
            <div>Repeat last workout</div>
            <div className="small muted" style={{ fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {last.name ? `${last.name} · ` : ''}
              {last.entries.map((e) => exercises[e.exerciseId]?.name).filter(Boolean).join(' · ')}
            </div>
          </button>
        )}
      </section>

      <div className="row between" style={{ margin: '20px 4px 8px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Plans</h2>
        <button
          className="btn ghost small"
          onClick={() => {
            const id = actions.createPlan('New plan', []);
            onOpenPlan(id);
          }}
        >
          + New plan
        </button>
      </div>
      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {state.plans.length === 0 && (
          <p className="small muted" style={{ padding: '10px 0', margin: 0 }}>
            Save a routine you repeat, like your physio exercises, then start it in one tap. You can also save any finished workout as a plan.
          </p>
        )}
        {state.plans.map((p) => {
          const hits = [...new Set(p.entries.flatMap((e) => exercises[e.exerciseId]?.mappings.map((m) => m.areaId) ?? []))].filter((a) => focus.has(a));
          return (
            <div className="list-item" key={p.id}>
              <button className="grow" style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => onOpenPlan(p.id)}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.entries.length} exercise{p.entries.length === 1 ? '' : 's'} · {planSummary(p, exercises) || 'empty'}
                </div>
                {hits.length > 0 && (
                  <div className="small" style={{ color: 'var(--accent)', marginTop: 2 }}>
                    Trains focus: {hits.map((a) => AREA_BY_ID[a]?.name).join(', ')}
                  </div>
                )}
              </button>
              <button className="btn small" disabled={p.entries.length === 0} onClick={() => actions.startWorkout({ planId: p.id })}>Start</button>
            </div>
          );
        })}
      </section>

      <h2 className="section-title">History</h2>
      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {history.length === 0 && <p className="empty">No workouts yet.</p>}
        {history.slice(0, 30).map((w) => {
          const sets = w.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
          return (
            <button key={w.id} className="ex-option" onClick={() => onOpenWorkout(w.id)}>
              <span className="grow">
                <span style={{ display: 'block', fontWeight: 600 }}>
                  {formatDay(w.date, todayKey())}
                  {w.name ? ` · ${w.name}` : ''}
                </span>
                <span className="small muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {w.entries.length} exercise{w.entries.length === 1 ? '' : 's'} · {sets} set{sets === 1 ? '' : 's'} ·{' '}
                  {w.entries.map((e) => exercises[e.exerciseId]?.name).filter(Boolean).join(', ')}
                </span>
              </span>
              <span className="muted" aria-hidden="true">›</span>
            </button>
          );
        })}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function workoutGains(w: Workout, exercises: Record<string, Exercise>) {
  const total: Record<string, number> = {};
  for (const e of w.entries) {
    const ex = exercises[e.exerciseId];
    if (!ex) continue;
    for (const [a, g] of Object.entries(entryGains(ex, e.sets))) total[a] = (total[a] ?? 0) + g;
  }
  return Object.entries(total).sort((a, b) => b[1] - a[1]);
}

function Session({ state, workout, exercises, onAdd, onFinished }: {
  state: AppState;
  workout: Workout;
  exercises: Record<string, Exercise>;
  onAdd: () => void;
  onFinished: (kept: boolean) => void;
}) {
  const now = useNow(30_000);
  const [naming, setNaming] = useState(false);
  const doneSets = workout.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const gains = workoutGains(workout, exercises);

  const finish = () => {
    if (doneSets === 0) {
      if (confirm('Nothing is ticked yet. Discard this workout?')) {
        actions.discardWorkout(workout.id);
        onFinished(false);
      }
      return;
    }
    actions.finishWorkout(workout.id);
    onFinished(true);
  };

  return (
    <>
      <header className="topbar">
        <div className="grow">
          {naming ? (
            <input
              type="text"
              autoFocus
              defaultValue={workout.name ?? ''}
              placeholder="Name this workout"
              aria-label="Workout name"
              onBlur={(e) => {
                actions.renameWorkout(workout.id, e.target.value);
                setNaming(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button style={{ all: 'unset', cursor: 'pointer' }} onClick={() => setNaming(true)} aria-label="Rename workout">
              <h1>{workout.name ?? 'Workout'} <span className="muted small" style={{ fontWeight: 500 }}>✎</span></h1>
            </button>
          )}
          <p className="sub">
            In progress · {formatDuration(now - workout.startedAt)} · {doneSets} set{doneSets === 1 ? '' : 's'} done
          </p>
        </div>
      </header>

      {gains.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }} aria-label="Points so far">
          {gains.slice(0, 6).map(([a, g]) => (
            <span key={a} className="chip" style={{ color: '#2f9e6e', fontWeight: 600 }}>
              +{Math.round(g)} {AREA_BY_ID[a]?.name}
            </span>
          ))}
        </div>
      )}

      {workout.entries.length === 0 && (
        <div className="card empty">
          <p style={{ marginTop: 0 }}><strong>Empty workout</strong></p>
          <p>Add the exercises you plan to do, then tick off each set as you finish it.</p>
        </div>
      )}

      {workout.entries.map((e) => {
        const ex = exercises[e.exerciseId];
        const last = lastEntryFor(state, e.exerciseId, workout.id);
        return (
          <section className="card" key={e.id}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <h3 style={{ margin: 0 }}>{ex?.name ?? 'Deleted exercise'}</h3>
                <div className="small muted">
                  {last
                    ? `Last time (${formatDay(last.workout.date, workout.date).toLowerCase()}): ${formatSets(ex, last.entry.sets.filter((s) => s.done))}`
                    : 'First time: enter what you do'}
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label={`Remove ${ex?.name ?? 'exercise'}`}
                onClick={() => {
                  if (!e.sets.some((s) => s.done) || confirm(`Remove ${ex?.name} from this workout?`)) actions.removeEntry(workout.id, e.id);
                }}
              >
                {Icon.trash}
              </button>
            </div>
            {ex?.hint && <p className="small muted" style={{ margin: '4px 0 0' }}>{ex.hint}</p>}
            <SetRows
              ex={ex}
              sets={e.sets}
              tickable
              onChange={(i, patch) => actions.updateSet(workout.id, e.id, i, patch)}
              onRemove={(i) => actions.removeSet(workout.id, e.id, i)}
            />
            <button className="btn ghost small" onClick={() => actions.addSet(workout.id, e.id)}>+ Add set</button>
          </section>
        );
      })}

      <button className="btn ghost block" style={{ marginBottom: 8 }} onClick={onAdd}>+ Add exercise</button>
      <button className="btn block" onClick={finish}>Finish workout</button>
      <button
        className="btn danger block"
        style={{ marginTop: 8 }}
        onClick={() => {
          if (confirm('Discard this workout and everything ticked in it?')) {
            actions.discardWorkout(workout.id);
            onFinished(false);
          }
        }}
      >
        Discard workout
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Summary after finishing
// ---------------------------------------------------------------------------

function Summary({ state, body, workout, exercises, onDone }: {
  state: AppState;
  body: BodyState;
  workout: Workout;
  exercises: Record<string, Exercise>;
  onDone: () => void;
}) {
  const [planName, setPlanName] = useState(workout.name ?? '');
  const [saved, setSaved] = useState(false);
  const gains = workoutGains(workout, exercises);
  const pbs = personalBests(workout, state.workouts, exercises);
  const sets = workout.entries.reduce((n, e) => n + e.sets.length, 0);
  const coinsToday = body.ledger.filter((e) => e.date === workout.date).reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Workout complete</h1>
          <p className="sub">
            {formatDuration((workout.finishedAt ?? Date.now()) - workout.startedAt)} · {workout.entries.length} exercise
            {workout.entries.length === 1 ? '' : 's'} · {sets} sets
          </p>
        </div>
      </header>

      <div className="stats">
        <div className="stat"><div className="value">{body.streak}</div><div className="label">day streak</div></div>
        <div className="stat"><div className="value">+{coinsToday}</div><div className="label">coins today</div></div>
        <div className="stat"><div className="value">{pbs.length}</div><div className="label">personal bests</div></div>
      </div>

      {pbs.length > 0 && (
        <section className="card">
          <h3>New personal bests</h3>
          {pbs.map((p) => (
            <div key={p.exerciseId} className="row between small" style={{ padding: '3px 0' }}>
              <span>{exercises[p.exerciseId]?.name}</span>
              <strong>{p.label}</strong>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h3>Points earned</h3>
        {gains.map(([a, g]) => (
          <div className="row between small" key={a} style={{ padding: '3px 0' }}>
            <span>{AREA_BY_ID[a]?.name}</span>
            <strong style={{ color: '#2f9e6e' }}>+{Math.round(g)}</strong>
          </div>
        ))}
        <p className="small muted" style={{ margin: '8px 0 0' }}>These are the points you earned. On the body, areas that are already strong gain less, and no area gains more than +35 a day.</p>
      </section>

      <section className="card">
        <h3>Save as a plan</h3>
        {saved ? (
          <p className="small muted" style={{ margin: 0 }}>Saved. Find it under Plans on the Workout tab.</p>
        ) : (
          <div className="row">
            <input type="text" className="grow" placeholder="e.g. Back rehab A" value={planName} onChange={(e) => setPlanName(e.target.value)} aria-label="Plan name" />
            <button
              className="btn small"
              onClick={() => {
                actions.savePlanFromWorkout(workout.id, planName || 'My plan');
                setSaved(true);
                toast('Plan saved');
              }}
            >
              Save
            </button>
          </div>
        )}
      </section>

      <button className="btn block" onClick={onDone}>Done</button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Plan editor
// ---------------------------------------------------------------------------

function PlanEditor({ plan, exercises, canStart, onBack, onAdd, onStart }: {
  plan: Plan;
  exercises: Record<string, Exercise>;
  canStart: boolean;
  onBack: () => void;
  onAdd: () => void;
  onStart: () => void;
}) {
  const update = (p: Plan) => actions.updatePlan(p);
  const setEntrySets = (idx: number, sets: Plan['entries'][number]['sets']) =>
    update({ ...plan, entries: plan.entries.map((e, i) => (i === idx ? { ...e, sets } : e)) });
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= plan.entries.length) return;
    const entries = [...plan.entries];
    [entries[idx], entries[j]] = [entries[j], entries[idx]];
    update({ ...plan, entries });
  };

  return (
    <>
      <header className="topbar">
        <div className="row grow">
          <button className="icon-btn" onClick={onBack} aria-label="Back to workouts">{Icon.back}</button>
          <input
            type="text"
            className="grow"
            value={plan.name}
            aria-label="Plan name"
            onChange={(e) => update({ ...plan, name: e.target.value })}
            style={{ fontWeight: 700, fontSize: 18 }}
          />
        </div>
      </header>

      <p className="small muted" style={{ margin: '0 4px 12px' }}>Set your target sets, reps and weight. Changes save automatically.</p>

      {plan.entries.map((e, idx) => {
        const ex = exercises[e.exerciseId];
        return (
          <section className="card" key={`${e.exerciseId}-${idx}`}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{ex?.name ?? 'Deleted exercise'}</h3>
              <span className="row" style={{ gap: 0 }}>
                <button className="icon-btn" aria-label="Move up" disabled={idx === 0} onClick={() => move(idx, -1)}>↑</button>
                <button className="icon-btn" aria-label="Move down" disabled={idx === plan.entries.length - 1} onClick={() => move(idx, 1)}>↓</button>
                <button className="icon-btn" aria-label={`Remove ${ex?.name}`} onClick={() => update({ ...plan, entries: plan.entries.filter((_, i) => i !== idx) })}>
                  {Icon.trash}
                </button>
              </span>
            </div>
            <SetRows
              ex={ex}
              sets={e.sets}
              tickable={false}
              onChange={(i, patch) => setEntrySets(idx, e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))}
              onRemove={(i) => setEntrySets(idx, e.sets.filter((_, j) => j !== i))}
            />
            <button className="btn ghost small" onClick={() => setEntrySets(idx, [...e.sets, { ...(e.sets[e.sets.length - 1] ?? { reps: 10 }) }])}>
              + Add set
            </button>
          </section>
        );
      })}

      <button className="btn ghost block" style={{ marginBottom: 8 }} onClick={onAdd}>+ Add exercise</button>
      <button className="btn block" disabled={!canStart || plan.entries.length === 0} onClick={onStart}>
        {canStart ? 'Start this plan' : 'Finish your current workout first'}
      </button>
      <button
        className="btn danger block"
        style={{ marginTop: 8 }}
        onClick={() => {
          if (confirm(`Delete the plan “${plan.name}”?`)) {
            actions.deletePlan(plan.id);
            onBack();
          }
        }}
      >
        Delete plan
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Past workout detail
// ---------------------------------------------------------------------------

function WorkoutDetail({ workout, exercises, canReopen, onBack, onReopen }: {
  workout: Workout;
  exercises: Record<string, Exercise>;
  canReopen: boolean;
  onBack: () => void;
  onReopen: () => void;
}) {
  const [planName, setPlanName] = useState(workout.name ?? '');
  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onBack} aria-label="Back to workouts">{Icon.back}</button>
          <div>
            <h1>{workout.name ?? 'Workout'}</h1>
            <p className="sub">
              {formatDay(workout.date, todayKey())}
              {workout.finishedAt ? ` · ${formatDuration(workout.finishedAt - workout.startedAt)}` : ''}
            </p>
          </div>
        </div>
      </header>

      <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {workout.entries.map((e) => (
          <div className="list-item" key={e.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{exercises[e.exerciseId]?.name ?? 'Deleted exercise'}</div>
              <div className="small muted">{formatSets(exercises[e.exerciseId], e.sets.filter((s) => s.done))}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Save as a plan</h3>
        <div className="row">
          <input type="text" className="grow" placeholder="Plan name" value={planName} onChange={(e) => setPlanName(e.target.value)} aria-label="Plan name" />
          <button
            className="btn small"
            onClick={() => {
              actions.savePlanFromWorkout(workout.id, planName || 'My plan');
              toast('Plan saved');
            }}
          >
            Save
          </button>
        </div>
      </section>

      <button className="btn ghost block" disabled={!canReopen} onClick={onReopen}>
        {canReopen ? 'Edit this workout' : 'Finish your current workout to edit this one'}
      </button>
      <button
        className="btn danger block"
        style={{ marginTop: 8 }}
        onClick={() => {
          if (confirm('Delete this workout? Levels and coins will be recalculated.')) {
            actions.discardWorkout(workout.id);
            onBack();
          }
        }}
      >
        Delete workout
      </button>
    </>
  );
}
