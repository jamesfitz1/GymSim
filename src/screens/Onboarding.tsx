import { useState } from 'react';
import { APP_NAME, SUB_AREAS, SYSTEMS, TUNING } from '../domain/config';
import { actions } from '../store';
import { Disclaimer } from './Priorities';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="onboard">
      <div className="steps" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      {step === 0 && (
        <>
          <h1>Welcome to {APP_NAME}</h1>
          <p className="lead">Your body as a living picture, not a single XP bar.</p>
          <section className="card">
            <p><strong>{SUB_AREAS.length} areas across {SYSTEMS.length} systems.</strong> Every workout you log feeds the specific areas it trains.</p>
            <p><strong>Everything decays.</strong> Each area loses a few points a day, so anything you neglect shows up.</p>
            <p><strong>Balance wins.</strong> Coins come from turning up consistently, not from one huge session.</p>
            <p style={{ marginBottom: 0 }} className="muted small">Every area starts at {TUNING.startLevel}/100.</p>
          </section>
          <button className="btn block" onClick={() => setStep(1)}>Continue</button>
        </>
      )}

      {step === 1 && (
        <>
          <h1>Before you start</h1>
          <Disclaimer />
          <section className="card">
            <label className="checkbox">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I understand {APP_NAME} is a tracking tool, not medical advice. If I have a condition, I'll follow my clinician's plan.</span>
            </label>
          </section>
          <button className="btn block" disabled={!agreed} onClick={() => setStep(2)}>I understand</button>
        </>
      )}

      {step === 2 && (
        <>
          <h1>Any priority areas?</h1>
          <p className="lead">Pin areas you've been told to focus on. You can change these any time.</p>
          {SYSTEMS.filter((s) => s.id === 'back' || s.id === 'core' || s.id === 'mobility').map((s) => (
            <div key={s.id}>
              <h2 className="section-title">{s.name}</h2>
              <div className="pin-pick">
                {SUB_AREAS.filter((a) => a.systemId === s.id).map((a) => (
                  <button key={a.id} aria-pressed={picked.has(a.id)} onClick={() => toggle(a.id)}>
                    <span>{a.name}</span>
                    <span className="muted">{picked.has(a.id) ? '✓ Pinned' : 'Pin'}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="small muted" style={{ margin: '12px 4px' }}>Every other area can be pinned later from the Priorities tab.</p>
          <button className="btn block" onClick={() => actions.completeOnboarding([...picked])}>
            {picked.size ? `Start with ${picked.size} priorit${picked.size === 1 ? 'y' : 'ies'}` : 'Start without priorities'}
          </button>
        </>
      )}
    </div>
  );
}
