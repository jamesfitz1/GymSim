import { lazy, Suspense, useState } from 'react';
import { BodyFigure } from '../components/BodyFigure';
import { LevelBar, TrendTag } from '../components/ui';
import { APP_NAME, AREA_BY_ID, levelBand, SUB_AREAS, SYSTEMS } from '../domain/config';
import { daysBetween, formatDay } from '../domain/dates';
import { injuryActiveOn, isDeclining, type BodyState } from '../domain/engine';
import type { AppState } from '../domain/types';
import { actions } from '../store';
import { injuryTitle, PainSparkline } from './Injuries';

const Body3D = lazy(() => import('../components/Body3D'));
let webgl: boolean | undefined;
const hasWebGL = () => {
  if (webgl === undefined) {
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      webgl = false;
    }
  }
  return webgl;
};

export function Dashboard({ state, body, onLogForArea, onOpenInjuries }: {
  state: AppState;
  body: BodyState;
  onLogForArea: (areaId?: string) => void;
  onOpenInjuries: () => void;
}) {
  const injuredAreas = new Set(Object.keys(body.injured));
  const activeInjuries = state.injuries.filter((i) => injuryActiveOn(i, body.today));
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const pinned = new Set(state.pins.map((p) => p.areaId));
  const declining = SUB_AREAS.filter((a) => isDeclining(body, a.id)).length;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // `id` is a sub-area, or 'cardio' when the heart is tapped.
  const selectArea = (id: string) => {
    setSelected(id === selected ? null : id);
    setOpen((prev) => new Set(prev).add(AREA_BY_ID[id]?.systemId ?? id));
  };

  const sel = selected ? AREA_BY_ID[selected] : null;
  const lastSel = selected ? body.lastTrained[selected] : undefined;
  const cardioSubs = SUB_AREAS.filter((a) => a.systemId === 'cardio');

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{APP_NAME}</h1>
          <p className="sub">
            {body.trainingDays === 0
              ? 'Your body, starting today'
              : declining > 0
                ? `${declining} area${declining === 1 ? '' : 's'} declining`
                : 'Everything is holding up'}
          </p>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="value">{body.streak}</div>
          <div className="label">day streak</div>
        </div>
        <div className="stat">
          <div className="value">{body.coinBalance}</div>
          <div className="label">coins</div>
        </div>
        <div className="stat">
          <div className="value">
            {body.distinctAreasThisWeek}
            <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>/{SUB_AREAS.length}</span>
          </div>
          <div className="label">areas this week</div>
        </div>
      </div>

      <section className="card">
        {(() => {
          const figureProps = { levels: body.levels, cardioLevel: body.systemLevels.cardio, pinned, injured: injuredAreas, selected, onSelect: selectArea };
          const can3d = hasWebGL();
          const use3d = can3d && state.settings.bodyView !== '2d';
          return (
            <>
              {use3d ? (
                <Suspense fallback={<BodyFigure {...figureProps} />}>
                  <Body3D {...figureProps} />
                </Suspense>
              ) : (
                <BodyFigure {...figureProps} />
              )}
              {can3d && (
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <button className="btn ghost small" onClick={() => actions.updateSettings({ bodyView: use3d ? '2d' : '3d' })}>
                    {use3d ? 'Switch to 2D view' : 'Switch to 3D view'}
                  </button>
                </div>
              )}
            </>
          );
        })()}
        {selected === 'cardio' ? (
          <div className="preview" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="row between">
              <strong>♥ Cardio</strong>
              <strong className="num">{Math.round(body.systemLevels.cardio)}</strong>
            </div>
            <div className="sub-rows" style={{ margin: '8px 0 10px' }}>
              {cardioSubs.map((a) => (
                <div className="sub-row" key={a.id}>
                  <span>{a.name}</span>
                  <LevelBar level={body.levels[a.id]} />
                  <span className="val num" style={{ textAlign: 'right' }}>{Math.round(body.levels[a.id])}</span>
                </div>
              ))}
            </div>
            <button className="btn small" onClick={() => onLogForArea('cardio')}>Log cardio</button>
          </div>
        ) : sel ? (
          <div className="preview" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="row between">
              <strong>{sel.name}</strong>
              <span className="row">
                <TrendTag trend={body.trend[sel.id]} />
                <strong className="num">{Math.round(body.levels[sel.id])}</strong>
              </span>
            </div>
            <p className="small muted" style={{ margin: '4px 0 10px' }}>
              {lastSel ? `Last trained ${formatDay(lastSel, body.today).toLowerCase()}` : 'Not trained yet'} ·{' '}
              {levelBand(body.levels[sel.id]).label}
            </p>
            {body.injured[sel.id] && (
              <p className="small" style={{ margin: '-4px 0 10px', color: 'var(--danger)', fontWeight: 600 }}>
                Injured:{' '}
                {state.injuries
                  .filter((i) => body.injured[sel.id].includes(i.id))
                  .map((i) => `${injuryTitle(i)} since ${formatDay(i.startDate, body.today).toLowerCase()}`)
                  .join('; ')}
                . Not fading while you recover.{' '}
                <button className="link-title" style={{ textDecoration: 'underline' }} onClick={onOpenInjuries}>View</button>
              </p>
            )}
            <button className="btn small" onClick={() => onLogForArea(sel.id)}>
              Log something for {sel.name.toLowerCase()}
            </button>
          </div>
        ) : (
          <p className="small muted" style={{ textAlign: 'center', margin: '10px 0 0' }}>Tap a muscle or the heart to see its level</p>
        )}
      </section>

      {activeInjuries.length > 0 && (
        <>
          <h2 className="section-title">Injuries</h2>
          <section className="card injury-card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {activeInjuries.map((inj) => {
              const latest = inj.pain[inj.pain.length - 1];
              const days = daysBetween(inj.startDate, body.today);
              return (
                <button key={inj.id} className="ex-option" onClick={onOpenInjuries}>
                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 600 }}>{injuryTitle(inj)}</span>
                    <span className="small muted">
                      {days === 0 ? 'Since today' : `${days} day${days === 1 ? '' : 's'}`} · {inj.severity}
                      {latest ? ` · pain ${latest.score}/10` : ' · no pain logged yet'}
                    </span>
                  </span>
                  <PainSparkline pain={inj.pain} width={70} height={24} />
                  <span className="muted" aria-hidden="true">›</span>
                </button>
              );
            })}
          </section>
        </>
      )}

      {state.pins.length > 0 && (
        <>
          <h2 className="section-title">Focus areas · this week</h2>
          <section className="card">
            {state.pins.map((pin) => {
              const area = AREA_BY_ID[pin.areaId];
              const done = body.weekGains[pin.areaId] ?? 0;
              const pct = Math.min(100, (done / pin.weeklyTarget) * 100);
              return (
                <div className="level-row" key={pin.areaId}>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <span className="name">{area.name}</span>
                    <span className="small muted num">
                      {Math.round(done)} / {pin.weeklyTarget} pts {pct >= 100 && '✓'}
                    </span>
                  </div>
                  <LevelBar level={pct} color="var(--accent)" />
                  <div className="row between small muted" style={{ marginTop: 6 }}>
                    <span>Level {Math.round(body.levels[pin.areaId])}</span>
                    <TrendTag trend={body.trend[pin.areaId]} />
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      <h2 className="section-title">Body systems</h2>
      <section className="card">
        {SYSTEMS.map((sys) => {
          const lvl = body.systemLevels[sys.id];
          const subs = SUB_AREAS.filter((a) => a.systemId === sys.id);
          const anyDown = subs.some((a) => isDeclining(body, a.id));
          const isOpen = open.has(sys.id);
          return (
            <div className="level-row" key={sys.id}>
              <button
                onClick={() => toggle(sys.id)}
                aria-expanded={isOpen}
                style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}
              >
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span className="row">
                    <span className="name">{sys.name}</span>
                    {anyDown && <span className="tag down">declining</span>}
                  </span>
                  <span className="row">
                    <span className="val">{Math.round(lvl)}</span>
                    <span className="muted" aria-hidden="true" style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}>›</span>
                  </span>
                </div>
                <LevelBar level={lvl} />
              </button>
              {isOpen && (
                <div className="sub-rows">
                  {subs.map((a) => {
                    const last = body.lastTrained[a.id];
                    return (
                      <div key={a.id}>
                        <div className="sub-row">
                          <span className="row" style={{ minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                            {pinned.has(a.id) && <span className="tag pin">focus</span>}
                          </span>
                          <LevelBar level={body.levels[a.id]} />
                          <span className="val num" style={{ textAlign: 'right' }}>{Math.round(body.levels[a.id])}</span>
                        </div>
                        <div className="row small muted" style={{ gap: 6 }}>
                          <span>{last ? `trained ${daysBetween(last, body.today) === 0 ? 'today' : `${daysBetween(last, body.today)}d ago`}` : 'not trained yet'}</span>
                          <TrendTag trend={body.trend[a.id]} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {body.trainingDays === 0 && (
        <div className="card empty">
          <p><strong>Every area decays a little each day.</strong></p>
          <p>Log your first workout to start pushing levels up.</p>
          <button className="btn" onClick={() => onLogForArea()}>Log a workout</button>
        </div>
      )}
    </>
  );
}
