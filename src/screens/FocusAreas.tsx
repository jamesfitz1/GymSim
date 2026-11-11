import { Icon, Stepper } from '../components/ui';
import { SUB_AREAS, SYSTEMS, TUNING } from '../domain/config';
import type { BodyState } from '../domain/engine';
import type { AppState } from '../domain/types';
import { actions } from '../store';

export function Disclaimer() {
  return (
    <div className="notice">
      <strong>This app tracks, it doesn't prescribe.</strong> If you have a diagnosed condition, such as a back
      problem, choose your exercises with a clinician like a physiotherapist. Use this app to check you're doing
      them consistently. Stop any exercise that causes pain and get advice.
    </div>
  );
}

export function FocusAreas({ state, body, onBack }: { state: AppState; body: BodyState; onBack: () => void }) {
  const pins = new Map(state.pins.map((p) => [p.areaId, p]));

  return (
    <>
      <header className="topbar">
        <div className="row">
          <button className="icon-btn" onClick={onBack} aria-label="Back">{Icon.back}</button>
          <div>
            <h1>Focus areas</h1>
            <p className="sub">The areas you must not neglect</p>
          </div>
        </div>
      </header>

      <Disclaimer />

      <p className="small muted" style={{ margin: '0 4px 12px' }}>
        A focus area gets a weekly points target and a spot on your dashboard. It also fades
        {` ${TUNING.focusFadeMultiplier}×`} faster than other areas, so missing it shows quickly. The target counts the points you
        earn, so three standard sessions a week make 60. Hitting it earns 20 coins.
      </p>

      {SYSTEMS.map((sys) => (
        <div key={sys.id}>
          <h2 className="section-title">{sys.name}</h2>
          <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {SUB_AREAS.filter((a) => a.systemId === sys.id).map((a) => {
              const pin = pins.get(a.id);
              return (
                <div className="list-item" key={a.id} style={{ flexWrap: 'wrap' }}>
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div className="small muted">
                      Level {Math.round(body.levels[a.id])}
                      {pin && ` · ${Math.round(body.weekGains[a.id] ?? 0)}/${pin.weeklyTarget} this week`}
                    </div>
                  </div>
                  <button
                    className={`btn small ${pin ? '' : 'ghost'}`}
                    aria-pressed={!!pin}
                    onClick={() => actions.togglePin(a.id)}
                  >
                    {pin ? 'Focus ✓' : 'Add'}
                  </button>
                  {pin && (
                    <div className="row between" style={{ width: '100%', marginTop: 8 }}>
                      <span className="small muted">Weekly target (points)</span>
                      <Stepper value={pin.weeklyTarget} step={10} min={10} max={300} onChange={(n) => actions.setWeeklyTarget(a.id, n)} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      ))}
    </>
  );
}
