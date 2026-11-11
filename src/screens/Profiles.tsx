import { useState } from 'react';
import { Icon, LevelBar } from '../components/ui';
import { APP_NAME, AREA_BY_ID, SUB_AREAS, SYSTEMS } from '../domain/config';
import { QUESTIONS, scoreAssessment, suggestedFocus, type Answers } from '../domain/assessment';
import { profiles, useProfiles } from '../store';
import { Disclaimer } from './FocusAreas';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

/** "Who's training?": pick a profile or make a new one. */
export function ProfilePicker() {
  const index = useProfiles();
  const [creating, setCreating] = useState(index.profiles.length === 0);

  if (creating) return <NewProfile onCancel={index.profiles.length ? () => setCreating(false) : undefined} />;

  const ordered = [...index.profiles].sort((a, b) => (a.id === index.lastId ? -1 : b.id === index.lastId ? 1 : a.createdAt - b.createdAt));

  return (
    <div className="onboard">
      <h1>Who's training?</h1>
      <p className="lead">{APP_NAME} keeps a separate body, workouts and coins for each person on this device.</p>
      <div className="profile-list">
        {ordered.map((p) => (
          <button key={p.id} className="profile-card" onClick={() => profiles.open(p.id)}>
            <span className="avatar-dot" aria-hidden="true">{initials(p.name)}</span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 17 }}>{p.name}</span>
              {p.id === index.lastId && <span className="small muted">Last used</span>}
            </span>
            <span className="muted" aria-hidden="true">›</span>
          </button>
        ))}
        <button className="profile-card new" onClick={() => setCreating(true)}>
          <span className="avatar-dot" aria-hidden="true">+</span>
          <span className="grow" style={{ textAlign: 'left', fontWeight: 700 }}>New profile</span>
        </button>
      </div>
    </div>
  );
}

type Step = { k: 'name' } | { k: 'disclaimer' } | { k: 'q'; i: number } | { k: 'review' };

function NewProfile({ onCancel }: { onCancel?: () => void }) {
  const [step, setStep] = useState<Step>({ k: 'name' });
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [focus, setFocus] = useState<Set<string>>(new Set());

  const total = QUESTIONS.length + 3;
  const position = step.k === 'name' ? 0 : step.k === 'disclaimer' ? 1 : step.k === 'q' ? 2 + step.i : total - 1;

  const back = () => {
    if (step.k === 'name') onCancel?.();
    else if (step.k === 'disclaimer') setStep({ k: 'name' });
    else if (step.k === 'q') setStep(step.i === 0 ? { k: 'disclaimer' } : { k: 'q', i: step.i - 1 });
    else setStep({ k: 'q', i: QUESTIONS.length - 1 });
  };

  const answer = (qid: string, value: string, i: number) => {
    const next = { ...answers, [qid]: value };
    setAnswers(next);
    if (i + 1 < QUESTIONS.length) setStep({ k: 'q', i: i + 1 });
    else {
      setFocus(new Set(suggestedFocus(next)));
      setStep({ k: 'review' });
    }
  };

  const toggleFocus = (id: string) =>
    setFocus((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="onboard">
      <div className="row" style={{ marginBottom: 4 }}>
        {(step.k !== 'name' || onCancel) && (
          <button className="icon-btn" onClick={back} aria-label="Back">{Icon.back}</button>
        )}
        <div className="steps grow" aria-hidden="true" style={{ margin: 0 }}>
          <span className="on" style={{ flex: position + 1 }} />
          <span style={{ flex: Math.max(0.001, total - position - 1) }} />
        </div>
      </div>

      {step.k === 'name' && (
        <>
          <h1>{onCancel ? 'New profile' : `Welcome to ${APP_NAME}`}</h1>
          <p className="lead">Your body as a living picture: 18 areas that grow when you train them and fade when you don't.</p>
          <section className="card">
            <label className="field" style={{ marginBottom: 0 }}>
              <span>What should we call you?</span>
              <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep({ k: 'disclaimer' })} />
            </label>
          </section>
          <button className="btn block" disabled={!name.trim()} onClick={() => setStep({ k: 'disclaimer' })}>Continue</button>
        </>
      )}

      {step.k === 'disclaimer' && (
        <>
          <h1>Before you start</h1>
          <Disclaimer />
          <section className="card">
            <label className="checkbox">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I understand {APP_NAME} is a tracking tool, not medical advice. If I have a condition, I'll follow my clinician's plan.</span>
            </label>
          </section>
          <button className="btn block" disabled={!agreed} onClick={() => setStep({ k: 'q', i: 0 })}>Next: quick health check</button>
          <p className="small muted" style={{ textAlign: 'center' }}>About 3 minutes, {QUESTIONS.length} one-tap questions. It sets your starting levels.</p>
        </>
      )}

      {step.k === 'q' && (() => {
        const q = QUESTIONS[step.i];
        return (
          <>
            <p className="section-title" style={{ margin: '12px 0 4px' }}>
              {q.section} · {step.i + 1} of {QUESTIONS.length}
            </p>
            <h1 style={{ fontSize: 24 }}>{q.prompt}</h1>
            {q.help && <p className="lead" style={{ fontSize: 15 }}>{q.help}</p>}
            <div className="pin-pick" style={{ marginTop: 12 }}>
              {q.options.map((o) => (
                <button key={o.value} aria-pressed={answers[q.id] === o.value} onClick={() => answer(q.id, o.value, step.i)} style={{ padding: '14px 14px' }}>
                  <span>{o.label}</span>
                  {answers[q.id] === o.value && <span className="muted">✓</span>}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {step.k === 'review' && (() => {
        const levels = scoreAssessment(answers);
        return (
          <>
            <h1>Your starting body</h1>
            <p className="lead">This is where each system starts. Training pushes it up; neglect lets it fade.</p>
            <section className="card">
              {SYSTEMS.map((s) => {
                const subs = SUB_AREAS.filter((a) => a.systemId === s.id);
                const lvl = subs.reduce((t, a) => t + levels[a.id], 0) / subs.length;
                return (
                  <div className="level-row" key={s.id}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <span className="name">{s.name}</span>
                      <span className="val">{Math.round(lvl)}</span>
                    </div>
                    <LevelBar level={lvl} />
                  </div>
                );
              })}
            </section>

            <h2 className="section-title">Focus areas</h2>
            <p className="small muted" style={{ margin: '0 4px 8px' }}>
              {answers.condition === 'back'
                ? "We've suggested your back. Keep the ones your clinician wants you to work on."
                : "Optional. Pick any areas you've been told to work on. You can change these later."}
            </p>
            <div className="pin-pick">
              {['lowerBack', 'spinalStabilisers', 'backMobility', 'abs', 'glutes', 'hipMobility', 'shoulderMobility', 'hamstringFlex'].map((id) => (
                <button key={id} aria-pressed={focus.has(id)} onClick={() => toggleFocus(id)}>
                  <span>{AREA_BY_ID[id].name}</span>
                  <span className="muted">{focus.has(id) ? '✓ Focus' : 'Add'}</span>
                </button>
              ))}
            </div>

            <button
              className="btn block"
              style={{ marginTop: 16 }}
              onClick={() => profiles.create({ name, startLevels: levels, assessment: answers, focusAreas: [...focus] })}
            >
              Create {name.trim() || 'profile'}
            </button>
          </>
        );
      })()}
    </div>
  );
}
