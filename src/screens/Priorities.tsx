import { Stepper } from '../components/ui';
import { SUB_AREAS, SYSTEMS } from '../domain/config';
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

export function Priorities({ state, body }: { state: AppState; body: BodyState }) {
  const pins = new Map(state.pins.map((p) => [p.areaId, p]));
  const { decayPerDay, priorityDecayPerDay } = state.settings;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Priority areas</h1>
          <p className="sub">Pin the areas you must not neglect</p>
        </div>
      </header>

      <Disclaimer />

      <p className="small muted" style={{ margin: '0 4px 12px' }}>
        A pinned area gets a weekly points target and a spot on your dashboard. It also decays faster:
        −{priorityDecayPerDay}/day instead of −{decayPerDay}/day, so missing it shows quickly. Hitting a weekly target earns 20 coins.
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
                    {pin ? 'Pinned' : 'Pin'}
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
