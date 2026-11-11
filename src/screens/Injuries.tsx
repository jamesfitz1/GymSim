import { useState } from 'react';
import { Icon, toast } from '../components/ui';
import { AREA_BY_ID, INJURY_REGION_BY_ID, INJURY_REGIONS, SUB_AREAS, SYSTEMS, TUNING } from '../domain/config';
import { daysBetween, formatDay, todayKey } from '../domain/dates';
import { injuryActiveOn, type BodyState } from '../domain/engine';
import type { AppState, Injury, InjurySeverity, InjurySide } from '../domain/types';
import { actions } from '../store';

type View = { k: 'list' } | { k: 'edit'; id?: string } | { k: 'focus'; title: string; candidates: string[] };

const SEVERITIES: { id: InjurySeverity; label: string }[] = [
  { id: 'mild', label: 'Mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'severe', label: 'Severe' },
];

const SIDES: { id: InjurySide; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'both', label: 'Both' },
];

export function injuryTitle(inj: Pick<Injury, 'region' | 'side'>) {
  const region = INJURY_REGION_BY_ID[inj.region]?.name ?? 'Injury';
  return inj.side === 'left' || inj.side === 'right' ? `${region} (${inj.side})` : inj.side === 'both' ? `${region} (both sides)` : region;
}

function SafetyNote() {
  return (
    <div className="notice">
      <strong>This is a log, not a diagnosis.</strong> Follow your clinician's advice on what to do and avoid. Get medical help
      if pain is severe or getting worse, or comes with numbness, weakness, or changes in bladder or bowel control.
    </div>
  );
}

/** Pain over time: higher on the chart = more pain. */
export function PainSparkline({ pain, width = 120, height = 32 }: { pain: Injury['pain']; width?: number; height?: number }) {
  const pts = pain.slice(-14);
  if (pts.length < 2) return null;
  const step = width / (pts.length - 1);
  const y = (s: number) => height - 3 - (s / 10) * (height - 6);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  return (
    <svg className="pain-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Pain trend over ${pts.length} check-ins`}>
      <path d={d} fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={p.date} cx={i * step} cy={y(p.score)} r="2.4" fill="var(--danger)" />)}
    </svg>
  );
}

export function InjuriesTab({ state, body }: { state: AppState; body: BodyState }) {
  const [view, setView] = useState<View>({ k: 'list' });
  const [showRecovered, setShowRecovered] = useState(false);
  const today = body.today;

  if (view.k === 'edit') {
    const existing = view.id ? state.injuries.find((i) => i.id === view.id) : undefined;
    return (
      <InjuryForm
        existing={existing}
        onCancel={() => setView({ k: 'list' })}
        onSaved={(saved, isNew) => {
          // For a new injury, offer to make any affected areas that aren't already focus areas into focus areas.
          const pinned = new Set(state.pins.map((p) => p.areaId));
          const candidates = saved.areaIds.filter((a) => !pinned.has(a));
          setView(isNew && candidates.length ? { k: 'focus', title: injuryTitle(saved), candidates } : { k: 'list' });
        }}
      />
    );
  }

  if (view.k === 'focus') {
    return <FocusPrompt title={view.title} candidates={view.candidates} onDone={() => setView({ k: 'list' })} />;
  }

  const active = state.injuries.filter((i) => injuryActiveOn(i, today)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const upcoming = state.injuries.filter((i) => i.startDate > today);
  const recovered = state.injuries.filter((i) => i.resolvedDate && i.resolvedDate <= today).sort((a, b) => (b.resolvedDate ?? '').localeCompare(a.resolvedDate ?? ''));

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Injuries</h1>
          <p className="sub">{active.length ? `${active.length} active` : 'Nothing logged right now'}</p>
        </div>
        <button className="btn small" onClick={() => setView({ k: 'edit' })}>+ Log injury</button>
      </header>

      <SafetyNote />

      {active.length === 0 && upcoming.length === 0 && (
        <div className="card empty">
          <p style={{ marginTop: 0 }}><strong>No active injuries</strong></p>
          <p>
            If something's hurting, log it here. The affected areas drop {TUNING.injuryHit} points, pulse red on your body, and stop fading while
            you recover, so resting doesn't count as neglect.
          </p>
        </div>
      )}

      {[...active, ...upcoming].map((inj) => (
        <InjuryCard key={inj.id} injury={inj} today={today} onEdit={() => setView({ k: 'edit', id: inj.id })} />
      ))}

      {recovered.length > 0 && (
        <>
          <button className="section-title link-title" style={{ display: 'block', margin: '20px 4px 8px' }} onClick={() => setShowRecovered((v) => !v)} aria-expanded={showRecovered}>
            Recovered ({recovered.length}) {showRecovered ? '▾' : '▸'}
          </button>
          {showRecovered && (
            <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {recovered.map((inj) => (
                <div className="list-item" key={inj.id}>
                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 600 }}>{injuryTitle(inj)}</span>
                    <span className="small muted">
                      {formatDay(inj.startDate, today)} → recovered {formatDay(inj.resolvedDate!, today).toLowerCase()} ·{' '}
                      {daysBetween(inj.startDate, inj.resolvedDate!)} days
                    </span>
                  </span>
                  <button className="btn ghost small" onClick={() => setView({ k: 'edit', id: inj.id })}>View</button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}

function InjuryCard({ injury, today, onEdit }: { injury: Injury; today: string; onEdit: () => void }) {
  const todayScore = injury.pain.find((p) => p.date === today)?.score;
  const latest = injury.pain[injury.pain.length - 1];
  const days = daysBetween(injury.startDate, today);
  const upcoming = injury.startDate > today;

  return (
    <section className="card injury-card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h3 style={{ margin: 0 }}>{injuryTitle(injury)}</h3>
          <div className="small muted">
            {upcoming ? `Starts ${formatDay(injury.startDate, today).toLowerCase()}` : days === 0 ? 'Since today' : `${days} day${days === 1 ? '' : 's'} · since ${formatDay(injury.startDate, today).toLowerCase()}`}
          </div>
          <div className="chips" style={{ marginTop: 6 }}>
            <span className={`tag sev-${injury.severity}`}>{injury.severity}</span>
            {injury.underCare && <span className="tag">Under a clinician</span>}
            {injury.areaIds.map((a) => <span key={a} className="tag">{AREA_BY_ID[a]?.name}</span>)}
          </div>
        </div>
        <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${injuryTitle(injury)}`}>✎</button>
      </div>

      {injury.notes && <p className="small" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{injury.notes}</p>}

      {!upcoming && (
        <>
          <div className="row between" style={{ marginTop: 12 }}>
            <span className="small" style={{ fontWeight: 600 }}>Pain today</span>
            {latest && (
              <span className="row small muted" style={{ gap: 8 }}>
                <PainSparkline pain={injury.pain} width={90} height={26} />
                last {latest.score}/10
              </span>
            )}
          </div>
          <div className="pain-row" role="group" aria-label="Pain today, 0 to 10">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                aria-pressed={todayScore === n}
                aria-label={`Pain ${n} out of 10`}
                onClick={() => {
                  actions.logPain(injury.id, n);
                  toast(`Pain ${n}/10 logged`);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            className="btn ghost block"
            style={{ marginTop: 10 }}
            onClick={() => {
              if (confirm(`Mark ${injuryTitle(injury).toLowerCase()} as recovered? Its areas will start fading normally again.`)) {
                actions.resolveInjury(injury.id);
                toast('Marked as recovered');
              }
            }}
          >
            Mark as recovered
          </button>
        </>
      )}
    </section>
  );
}

function InjuryForm({ existing, onCancel, onSaved }: { existing?: Injury; onCancel: () => void; onSaved: (saved: Pick<Injury, 'region' | 'side' | 'areaIds'>, isNew: boolean) => void }) {
  const today = todayKey();
  const [region, setRegion] = useState(existing?.region ?? 'lower-back');
  const [side, setSide] = useState<InjurySide>(existing?.side ?? 'none');
  const [severity, setSeverity] = useState<InjurySeverity>(existing?.severity ?? 'moderate');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [areas, setAreas] = useState<Set<string>>(new Set(existing?.areaIds ?? INJURY_REGION_BY_ID['lower-back'].areas));
  const [underCare, setUnderCare] = useState(existing?.underCare ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const sided = INJURY_REGION_BY_ID[region]?.sided;

  const pickRegion = (id: string) => {
    setRegion(id);
    setAreas(new Set(INJURY_REGION_BY_ID[id].areas));
    setSide(INJURY_REGION_BY_ID[id].sided ? (side === 'none' ? 'left' : side) : 'none');
  };
  const toggleArea = (id: string) =>
    setAreas((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const save = () => {
    const saved = {
      id: existing?.id,
      region,
      side: (sided ? side : 'none') as InjurySide,
      severity,
      startDate,
      resolvedDate: existing?.resolvedDate,
      areaIds: [...areas],
      underCare,
      notes: notes.trim() || undefined,
    };
    actions.saveInjury(saved);
    toast(existing ? 'Injury updated' : 'Injury logged');
    onSaved(saved, !existing);
  };

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onCancel} aria-label="Cancel">{Icon.back}</button>
          <div>
            <h1>{existing ? 'Edit injury' : 'Log an injury'}</h1>
            <p className="sub">{existing?.resolvedDate ? `Recovered ${formatDay(existing.resolvedDate, today).toLowerCase()}` : 'It affects your body levels while active'}</p>
          </div>
        </div>
      </header>

      <section className="card">
        <label className="field">
          <span>Where</span>
          <select value={region} onChange={(e) => pickRegion(e.target.value)}>
            {INJURY_REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>

        {sided && (
          <div className="field">
            <span className="small muted" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Side</span>
            <div className="segmented">
              {SIDES.map((s) => (
                <button key={s.id} type="button" aria-pressed={side === s.id} onClick={() => setSide(s.id)}>{s.label}</button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <span className="small muted" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>How bad</span>
          <div className="segmented">
            {SEVERITIES.map((s) => (
              <button key={s.id} type="button" aria-pressed={severity === s.id} onClick={() => setSeverity(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Started</span>
          <input type="date" value={startDate} max={today} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
        </label>

        <label className="checkbox" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={underCare} onChange={(e) => setUnderCare(e.target.checked)} />
          <span>I'm seeing a clinician (e.g. a physio or GP) about this</span>
        </label>

        <label className="field" style={{ marginBottom: 0 }}>
          <span>Notes (optional)</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened, what your physio said, what to avoid…" />
        </label>
      </section>

      <section className="card">
        <h3>Affected areas</h3>
        <p className="small muted">
          These drop {TUNING.injuryHit} points when the injury starts, then stop fading until you mark it recovered. We've picked the usual ones
          for this area; change them if needed.
        </p>
        {SYSTEMS.map((s) => (
          <div key={s.id} style={{ marginBottom: 8 }}>
            <div className="small muted" style={{ fontWeight: 600, marginBottom: 4 }}>{s.name}</div>
            <div className="chips">
              {SUB_AREAS.filter((a) => a.systemId === s.id).map((a) => (
                <button key={a.id} type="button" className="chip-btn" aria-pressed={areas.has(a.id)} onClick={() => toggleArea(a.id)}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <button className="btn block" disabled={areas.size === 0} onClick={save}>{existing ? 'Save changes' : 'Log injury'}</button>

      {existing?.resolvedDate && (
        <button
          className="btn ghost block"
          style={{ marginTop: 8 }}
          onClick={() => {
            actions.reopenInjury(existing.id);
            toast('Injury reopened');
            onCancel();
          }}
        >
          It's back: reopen this injury
        </button>
      )}
      {existing && (
        <button
          className="btn danger block"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm('Delete this injury and its pain log? Your levels will be recalculated as if it never happened.')) {
              actions.deleteInjury(existing.id);
              onCancel();
            }
          }}
        >
          Delete injury
        </button>
      )}
    </>
  );
}

function FocusPrompt({ title, candidates, onDone }: { title: string; candidates: string[]; onDone: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(candidates));
  return (
    <div className="onboard" style={{ paddingTop: 8 }}>
      <h1 style={{ fontSize: 26 }}>Make these focus areas?</h1>
      <p className="lead" style={{ fontSize: 16 }}>
        If your clinician has given you rehab exercises for your {title.toLowerCase()}, focus areas give them a weekly target on your
        dashboard and earn coins when you hit it.
      </p>
      <div className="pin-pick" style={{ marginTop: 12 }}>
        {candidates.map((id) => (
          <button
            key={id}
            aria-pressed={picked.has(id)}
            onClick={() =>
              setPicked((prev) => {
                const n = new Set(prev);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              })
            }
          >
            <span>{AREA_BY_ID[id]?.name}</span>
            <span className="muted">{picked.has(id) ? '✓ Focus' : 'Add'}</span>
          </button>
        ))}
      </div>
      <button
        className="btn block"
        style={{ marginTop: 16 }}
        disabled={picked.size === 0}
        onClick={() => {
          actions.addFocusAreas([...picked]);
          toast('Focus areas added');
          onDone();
        }}
      >
        Add {picked.size} focus area{picked.size === 1 ? '' : 's'}
      </button>
      <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onDone}>Not now</button>
    </div>
  );
}
