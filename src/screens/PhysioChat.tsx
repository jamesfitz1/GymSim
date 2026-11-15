import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, toast } from '../components/ui';
import { INJURY_REGION_BY_ID } from '../domain/config';
import type { BodyState } from '../domain/engine';
import { physioContext, proposalsIn, type Proposal } from '../domain/physio';
import type { AppState, Injury, StoredChatMessage } from '../domain/types';
import { explainError, getApiKey, runPhysioTurn, setApiKey, testApiKey } from '../lib/anthropic';
import { actions, activeWorkout, allExercises, exerciseMap } from '../store';
import { injuryTitle } from './Injuries';

// Chat with the physio assistant about one injury. Loaded on demand (it pulls in the API SDK).

/** Very small markdown: paragraphs, "- " bullets, **bold**. */
function RichText({ text }: { text: string }) {
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  const inline = (s: string, key: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong> : <span key={`${key}-${i}`}>{part}</span>,
    );
  const flush = (k: number) => {
    if (list.length) {
      blocks.push(<ul key={`ul${k}`}>{list.map((l, i) => <li key={i}>{inline(l, `li${k}-${i}`)}</li>)}</ul>);
      list = [];
    }
  };
  text.split('\n').forEach((raw, k) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) list.push(bullet[1]);
    else {
      flush(k);
      if (line.trim()) blocks.push(<p key={`p${k}`}>{inline(line.replace(/^#+\s*/, ''), `p${k}`)}</p>);
    }
  });
  flush(-1);
  return <>{blocks}</>;
}

function textOf(content: StoredChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return (content as { type?: string; text?: string }[]).filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('\n\n');
}

function ProposalCard({ proposal, state, injury, onStarted }: { proposal: Proposal; state: AppState; injury: Injury; onStarted: () => void }) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const exercises = exerciseMap(state);
  const save = () => {
    const id = savedId ?? actions.saveRehabPlan(injury.id, proposal);
    setSavedId(id);
    return id;
  };
  return (
    <div className="proposal">
      <div className="small muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Proposed rehab plan</div>
      <h3 style={{ margin: '2px 0 4px' }}>{proposal.name}</h3>
      <p className="small" style={{ margin: '0 0 8px' }}>{proposal.summary}</p>
      <ol className="proposal-list">
        {proposal.exercises.map((e, i) => (
          <li key={i}>
            <strong>{e.exerciseId ? exercises[e.exerciseId]?.name ?? e.exerciseId : e.customName}</strong>
            {!e.exerciseId && <span className="tag" style={{ marginLeft: 6 }}>new</span>}
            <div className="small">
              {e.kind === 'timed' ? `${e.sets > 1 ? `${e.sets} × ` : ''}${e.minutes} min` : `${e.sets} × ${e.reps}`} · {e.frequency}
            </div>
            {e.note && <div className="small muted">{e.note}</div>}
          </li>
        ))}
      </ol>
      {proposal.safetyNotes.length > 0 && (
        <div className="small" style={{ margin: '6px 0 10px' }}>
          {proposal.safetyNotes.map((n, i) => <div key={i}>⚠ {n}</div>)}
        </div>
      )}
      <div className="row wrap">
        <button
          className="btn ghost small"
          disabled={!!savedId}
          onClick={() => {
            save();
            toast('Saved to your rehab plans');
          }}
        >
          {savedId ? 'Saved ✓' : 'Save as rehab plan'}
        </button>
        <button
          className="btn small"
          onClick={() => {
            const id = save();
            if (activeWorkout(state)) {
              toast('Plan saved. Finish your current workout first, then start it from Workout → Rehab');
              return;
            }
            actions.startWorkout({ planId: id });
            onStarted();
          }}
        >
          Save and start now
        </button>
      </div>
    </div>
  );
}

function KeySetup({ onReady }: { onReady: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card">
      <h3>Connect the assistant</h3>
      <p className="small">
        The physio assistant uses Claude, with your own Anthropic API key. It's stored only on this device, and usage is billed to your
        Anthropic account (usually a few pence per conversation). Get a key at console.anthropic.com.
      </p>
      <input type="password" autoComplete="off" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Anthropic API key" />
      {error && <p className="small" style={{ color: 'var(--danger)', margin: '6px 0 0' }}>{error}</p>}
      <button
        className="btn block"
        style={{ marginTop: 10 }}
        disabled={!key.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await testApiKey(key.trim());
          setBusy(false);
          if (r.ok) {
            setApiKey(key.trim());
            toast('Assistant connected');
            onReady();
          } else setError(r.message);
        }}
      >
        {busy ? 'Checking…' : 'Save and connect'}
      </button>
    </section>
  );
}

export default function PhysioChat({ state, body, injury, onBack, onStarted }: {
  state: AppState;
  body: BodyState;
  injury: Injury;
  onBack: () => void;
  onStarted: () => void;
}) {
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chat = injury.chat ?? [];
  const exercises = useMemo(() => allExercises(state), [state]);
  const region = INJURY_REGION_BY_ID[injury.region]?.name.toLowerCase() ?? 'injury';

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, streaming, pendingUser]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const key = getApiKey();
    if (!text.trim() || busy || !key) return;
    setInput('');
    setNotice(null);
    setBusy(true);
    setStreaming('');
    setPendingUser(text.trim());
    const controller = new AbortController();
    abortRef.current = controller;
    const messages: StoredChatMessage[] = [...chat, { role: 'user', content: text.trim() }];
    try {
      const result = await runPhysioTurn({
        apiKey: key,
        context: physioContext(injury, body, exercises, body.today),
        messages,
        exercises,
        onText: setStreaming,
        signal: controller.signal,
      });
      actions.saveInjuryChat(injury.id, result.messages);
      if (result.notice) setNotice(result.notice);
    } catch (err) {
      if (!controller.signal.aborted) {
        setNotice(explainError(err));
        if ((err as { status?: number })?.status === 401) setHasKey(false);
        setInput(text);
      }
    } finally {
      setBusy(false);
      setStreaming('');
      setPendingUser(null);
      abortRef.current = null;
    }
  };

  const starters = ['It started suddenly', "It's been building up over time", 'My physio already gave me exercises'];

  return (
    <>
      <header className="topbar">
        <div className="row grow">
          <button className="icon-btn" onClick={onBack} aria-label="Back to injuries">{Icon.back}</button>
          <div className="grow">
            <h1 style={{ fontSize: 20 }}>Physio assistant</h1>
            <p className="sub">{injuryTitle(injury)}</p>
          </div>
          {chat.length > 0 && !busy && (
            <button
              className="btn ghost small"
              onClick={() => {
                if (confirm('Start this conversation over? Saved rehab plans are kept.')) actions.saveInjuryChat(injury.id, []);
              }}
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <div className="notice small" style={{ marginBottom: 12 }}>
        <strong>AI guidance, not a diagnosis.</strong> It can't examine you. If you have numbness in the groin or saddle area, bladder or bowel
        changes, worsening weakness, fever, or severe pain after an accident, get medical help now.
      </div>

      {!hasKey ? (
        <KeySetup onReady={() => setHasKey(true)} />
      ) : (
        <div className="chat">
          <div className="bubble assistant">
            <p>
              Hi, I'm your rehab assistant. I can't examine you, but I can help you understand what might be going on with your {region} and
              suggest gentle exercises to save as a rehab plan.
            </p>
            <p>To start, tell me how it happened and what it feels like right now.</p>
          </div>

          {chat.map((m, i) => {
            if (m.role === 'user') {
              return typeof m.content === 'string' ? <div key={i} className="bubble user">{m.content}</div> : null; // tool results are hidden
            }
            const text = textOf(m.content);
            const proposals = proposalsIn(m.content, exercises);
            return (
              <div key={i}>
                {text && <div className="bubble assistant"><RichText text={text} /></div>}
                {proposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p.proposal} state={state} injury={injury} onStarted={onStarted} />
                ))}
              </div>
            );
          })}

          {pendingUser && <div className="bubble user">{pendingUser}</div>}
          {busy && (
            <div className="bubble assistant">
              {streaming ? <RichText text={streaming} /> : <p className="muted typing">Thinking<span>.</span><span>.</span><span>.</span></p>}
            </div>
          )}
          {notice && <div className="notice small" style={{ borderLeftColor: 'var(--danger)' }}>{notice}</div>}
          <div ref={endRef} />

          {chat.length === 0 && !busy && (
            <div className="chips" style={{ margin: '4px 0 10px' }}>
              {starters.map((s) => (
                <button key={s} className="chip-btn" onClick={() => setInput((v) => (v ? `${v} ${s}.` : `${s}. `))}>{s}</button>
              ))}
            </div>
          )}

          <div className="composer">
            <textarea
              rows={2}
              value={input}
              placeholder={busy ? 'The assistant is replying…' : 'Describe your symptoms or ask a question'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              disabled={busy}
              aria-label="Message the physio assistant"
            />
            {busy ? (
              <button className="btn ghost" onClick={() => abortRef.current?.abort()}>Stop</button>
            ) : (
              <button className="btn" disabled={!input.trim()} onClick={() => send(input)}>Send</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
