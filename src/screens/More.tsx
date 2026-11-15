import { useEffect, useRef, useState } from 'react';
import { timeAgo, useStepsSync } from '../components/StepsCard';
import { stepGoalOf } from '../domain/steps';
import { connect, disconnect, getClientId, isConnected, setClientId } from '../lib/googleHealth';
import { Icon, toast } from '../components/ui';
import { APP_NAME, AREA_BY_ID, COINS, DECAY_SPEEDS, HALF_LIFE_DAYS, SKINS, TUNING } from '../domain/config';
import { formatDay } from '../domain/dates';
import { SEED_EXERCISES } from '../domain/exercises';
import type { BodyState } from '../domain/engine';
import type { AppState, DecaySpeed } from '../domain/types';
import { getApiKey, removeApiKey, setApiKey } from '../lib/apiKey';
import { actions, isUnlocked, ownsSkin, profiles } from '../store';
import { Disclaimer, FocusAreas } from './FocusAreas';

export function More({ state, body, anchor }: { state: AppState; body: BodyState; anchor?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sub, setSub] = useState<'focus' | null>(null);
  useEffect(() => {
    // After App's scroll-to-top for the tab change.
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  }, [anchor]);

  if (sub === 'focus') return <FocusAreas state={state} body={body} onBack={() => setSub(null)} />;

  const exportData = () => {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_NAME.toLowerCase()}-${state.profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${body.today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      actions.importJson(await file.text());
      toast('Backup restored');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{state.profile.name}</h1>
          <p className="sub">Profile, focus areas, rewards and settings</p>
        </div>
        <button className="btn ghost small" onClick={() => profiles.close()}>Switch profile</button>
      </header>

      <div className="stats">
        <div className="stat"><div className="value">{body.coinBalance}</div><div className="label">coins</div></div>
        <div className="stat"><div className="value">{body.longestStreak}</div><div className="label">best streak</div></div>
        <div className="stat"><div className="value">{body.trainingDays}</div><div className="label">training days</div></div>
      </div>

      <h2 className="section-title">Focus areas</h2>
      <section className="card">
        {state.pins.length === 0 ? (
          <p className="small muted">No focus areas yet. Add the areas you've been told to work on, such as your lower back.</p>
        ) : (
          <div className="chips" style={{ marginBottom: 10 }}>
            {state.pins.map((p) => (
              <span key={p.areaId} className="tag pin">{AREA_BY_ID[p.areaId]?.name} · {p.weeklyTarget} pts/wk</span>
            ))}
          </div>
        )}
        <button className="btn ghost small" onClick={() => setSub('focus')}>Edit focus areas</button>
      </section>

      <h2 className="section-title">Rewards</h2>
      <section className="card">
        <h3>Colour themes</h3>
        <div className="skin-grid">
          {SKINS.map((s) => {
            const owned = ownsSkin(state, s.id);
            const active = state.settings.skin === s.id;
            return (
              <button
                key={s.id}
                className="skin"
                aria-pressed={active}
                onClick={() => {
                  if (owned) return actions.updateSettings({ skin: s.id });
                  if (actions.buy(`skin:${s.id}`, s.cost, body.coinBalance)) {
                    actions.updateSettings({ skin: s.id });
                    toast(`${s.name} unlocked`);
                  } else toast(`You need ${s.cost - body.coinBalance} more coins`);
                }}
              >
                <div className="dot" style={{ background: s.accent }} />
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="small muted">{active ? 'In use' : owned ? 'Owned' : `${s.cost} coins`}</div>
              </button>
            );
          })}
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Coins come from consistency: {COINS.trainingDay} per training day, streak bonuses, and {COINS.weeklyTargetHit} per weekly
          focus target. They can't buy health levels.
        </p>
      </section>

      <section className="card" style={{ paddingBottom: 4 }}>
        <h3>Bonus exercises</h3>
        {SEED_EXERCISES.filter((e) => e.unlockCost).map((ex) => {
          const owned = isUnlocked(state, ex);
          return (
            <div className="list-item" key={ex.id}>
              <span className="grow">
                <span style={{ display: 'block', fontWeight: 600 }}>{owned ? '' : '🔒 '}{ex.name}</span>
                <span className="small muted">{owned ? 'Unlocked' : `${ex.unlockCost} coins`}</span>
              </span>
              {!owned && (
                <button
                  className="btn small"
                  disabled={body.coinBalance < (ex.unlockCost ?? 0)}
                  onClick={() => {
                    if (actions.buy(`exercise:${ex.id}`, ex.unlockCost ?? 0, body.coinBalance)) toast(`Unlocked ${ex.name}`);
                  }}
                >
                  Unlock
                </button>
              )}
            </div>
          );
        })}
      </section>

      <h2 className="section-title">My exercises</h2>
      <section className="card" style={{ paddingTop: state.customExercises.length ? 4 : undefined, paddingBottom: 4 }}>
        {state.customExercises.length === 0 && (
          <p className="small muted">
            Exercises you create appear here. Make one from <strong>Workout → Add exercise → Create custom exercise</strong>, e.g. one your
            physio gave you.
          </p>
        )}
        {state.customExercises.map((ex) => (
          <div className="list-item" key={ex.id}>
            <span className="grow">
              <span style={{ display: 'block', fontWeight: 600 }}>{ex.name}</span>
              <span className="small muted">
                {[...ex.mappings].sort((a, b) => b.weight - a.weight).map((m) => `${AREA_BY_ID[m.areaId]?.name} ${Math.round(m.weight * 100)}%`).join(' · ')}
              </span>
            </span>
            <button
              className="icon-btn"
              aria-label={`Delete ${ex.name}`}
              onClick={() => {
                if (confirm(`Delete “${ex.name}”? It will be removed from your workouts and plans too.`)) actions.deleteCustomExercise(ex.id);
              }}
            >
              {Icon.trash}
            </button>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Coin history</h3>
        {body.ledger.length === 0 && <p className="small muted">Train on any day to earn your first coins.</p>}
        {body.ledger.slice(0, 12).map((e, i) => (
          <div className="row between small" key={i} style={{ padding: '4px 0' }}>
            <span>{e.reason} <span className="muted">· {formatDay(e.date, body.today)}</span></span>
            <strong className="num">+{e.amount}</strong>
          </div>
        ))}
      </section>

      <h2 className="section-title" id="fitbit">Fitbit steps</h2>
      <FitbitSettings state={state} />

      <h2 className="section-title">Physio assistant</h2>
      <PhysioSettings />

      <h2 className="section-title">How fast levels fade</h2>
      <section className="card">
        <div className="segmented" role="group" aria-label="Fade speed">
          {(Object.keys(DECAY_SPEEDS) as DecaySpeed[]).map((k) => (
            <button key={k} type="button" aria-pressed={state.settings.decaySpeed === k} onClick={() => actions.updateSettings({ decaySpeed: k })}>
              {DECAY_SPEEDS[k].label}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: '10px 0 6px' }}>{DECAY_SPEEDS[state.settings.decaySpeed]?.blurb}</p>
        <p className="small muted" style={{ margin: 0 }}>
          Each area loses a share of its level every day you don't train it. Cardio fades fastest (half in about{' '}
          {Math.round(HALF_LIFE_DAYS.cardio / DECAY_SPEEDS[state.settings.decaySpeed].multiplier)} days), then mobility (
          {Math.round(HALF_LIFE_DAYS.mobility / DECAY_SPEEDS[state.settings.decaySpeed].multiplier)} days), then strength (
          {Math.round(HALF_LIFE_DAYS.strength / DECAY_SPEEDS[state.settings.decaySpeed].multiplier)} days). Changes apply to your whole
          history, so levels recalculate straight away.
        </p>
      </section>

      <h2 className="section-title">Your data</h2>
      <section className="card">
        <p className="small muted">
          Everything is stored only on this device, in this browser. Nothing is uploaded. On iPhone, the home-screen app and Safari
          keep separate data, so stick to one. Export a backup before you clear your browser or switch phones.
        </p>
        <div className="grid-2">
          <button className="btn ghost" onClick={exportData}>Export backup</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>Restore backup</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importData(f);
            e.target.value = '';
          }}
        />
        <button
          className="btn danger block"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (confirm("Erase all of this profile's workouts, plans, focus areas and coins? The profile itself stays. This cannot be undone.")) actions.reset();
          }}
        >
          Erase this profile's data
        </button>
      </section>

      <h2 className="section-title">Profile</h2>
      <section className="card">
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            defaultValue={state.profile.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value.trim() !== state.profile.name) {
                profiles.rename(e.target.value);
                toast('Name updated');
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
        <button
          className="btn danger block"
          onClick={() => {
            if (confirm(`Delete the profile “${state.profile.name}” and all its workouts on this device? This cannot be undone.`)) profiles.deleteCurrent();
          }}
        >
          Delete this profile
        </button>
      </section>

      <h2 className="section-title">About</h2>
      <Disclaimer />
      <p className="small muted" style={{ textAlign: 'center' }}>{APP_NAME} v0.1</p>
    </>
  );
}

/** API key for the physio assistant: stored on this device only, never in backups. */
function PhysioSettings() {
  const [saved, setSaved] = useState(() => !!getApiKey());
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const check = async (k: string) => {
    setBusy(true);
    setMessage(null);
    const { testApiKey } = await import('../lib/anthropic'); // loads the SDK only when needed
    const r = await testApiKey(k);
    setBusy(false);
    return r;
  };

  return (
    <section className="card">
      <p className="small muted" style={{ marginTop: 0 }}>
        The physio assistant on the Injuries tab uses Claude with your own Anthropic API key. The key is stored only on this device and isn't
        included in backups. Usage is billed to your Anthropic account. When you chat, your injury details and messages are sent to
        Anthropic to generate replies.
      </p>
      {saved ? (
        <>
          <p className="small" style={{ fontWeight: 600 }}>✓ A key is saved on this device.</p>
          <div className="grid-2">
            <button
              className="btn ghost"
              disabled={busy}
              onClick={async () => {
                const k = getApiKey();
                if (!k) return;
                const r = await check(k);
                setMessage(r.ok ? { ok: true, text: 'The key works.' } : { ok: false, text: r.message });
              }}
            >
              {busy ? 'Checking…' : 'Test key'}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm('Remove the API key from this device?')) {
                  removeApiKey();
                  setSaved(false);
                  setMessage(null);
                  toast('Key removed');
                }
              }}
            >
              Remove key
            </button>
          </div>
        </>
      ) : (
        <>
          <input type="password" autoComplete="off" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Anthropic API key" />
          <button
            className="btn block"
            style={{ marginTop: 8 }}
            disabled={!key.trim() || busy}
            onClick={async () => {
              const r = await check(key.trim());
              if (r.ok) {
                setApiKey(key.trim());
                setKey('');
                setSaved(true);
                setMessage({ ok: true, text: 'Key saved and working.' });
              } else setMessage({ ok: false, text: r.message });
            }}
          >
            {busy ? 'Checking…' : 'Save key'}
          </button>
        </>
      )}
      {message && <p className="small" style={{ margin: '8px 0 0', color: message.ok ? '#2f9e6e' : 'var(--danger)' }}>{message.text}</p>}
    </section>
  );
}

/** Connect Fitbit through the Google Health API: a client ID James creates once, then Google sign-in. */
function FitbitSettings({ state }: { state: AppState }) {
  const [clientId, setId] = useState(() => getClientId() ?? '');
  const [connected, setConnected] = useState(isConnected);
  const [guide, setGuide] = useState(!getClientId());
  const { busy, error, sync } = useStepsSync();
  const [connectError, setConnectError] = useState<string | null>(null);
  const goal = stepGoalOf(state.settings.stepGoal);
  const origin = typeof location !== 'undefined' ? location.origin : '';

  return (
    <section className="card">
      <p className="small muted" style={{ marginTop: 0 }}>
        Pulls your daily steps from Fitbit through Google (Fitbit accounts now live on Google). Steps add up to {TUNING.stepsDailyMax} points a day to Aerobic
        base, and hitting your goal earns coins. Your Google sign-in stays on this device; steps are saved with your profile.
      </p>

      {connected ? (
        <>
          <p className="small" style={{ fontWeight: 600, margin: '0 0 8px' }}>
            ✓ Connected{state.stepsSyncedAt ? ` · synced ${timeAgo(state.stepsSyncedAt)}` : ''}
          </p>
          <div className="grid-2">
            <button className="btn ghost" disabled={busy} onClick={() => sync()}>{busy ? 'Syncing…' : 'Sync now'}</button>
            <button
              className="btn danger"
              onClick={() => {
                if (!confirm('Disconnect Fitbit? Synced steps stay unless you also clear them.')) return;
                disconnect();
                setConnected(false);
                if (confirm('Also remove the synced steps (and the points and coins they earned)?')) actions.clearSteps();
                toast('Fitbit disconnected');
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Google OAuth client ID</span>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="1234…apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setId(e.target.value)}
              aria-label="Google OAuth client ID"
            />
          </label>
          <button
            className="btn block"
            disabled={!/\.apps\.googleusercontent\.com$/.test(clientId.trim()) || busy}
            onClick={async () => {
              setConnectError(null);
              setClientId(clientId);
              try {
                await connect();
                setConnected(true);
                await sync();
              } catch (e) {
                setConnectError(e instanceof Error ? e.message : 'Connecting failed. Try again.');
              }
            }}
          >
            {busy ? 'Syncing…' : 'Connect Fitbit'}
          </button>
          {clientId.trim() && !/\.apps\.googleusercontent\.com$/.test(clientId.trim()) && (
            <p className="small muted" style={{ margin: '6px 0 0' }}>A client ID ends in .apps.googleusercontent.com</p>
          )}
        </>
      )}
      {(connectError || error) && <p className="small" style={{ color: 'var(--danger)', margin: '8px 0 0' }}>{connectError || error}</p>}

      <label className="field" style={{ marginTop: 14 }}>
        <span>Daily step goal</span>
        <select value={goal} onChange={(e) => actions.updateSettings({ stepGoal: Number(e.target.value) })} aria-label="Daily step goal">
          {[5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000].map((n) => (
            <option key={n} value={n}>{n.toLocaleString()} steps</option>
          ))}
        </select>
      </label>

      <button className="text-link" style={{ marginTop: 6 }} onClick={() => setGuide((g) => !g)} aria-expanded={guide}>
        {guide ? 'Hide setup guide' : 'How to set up (one-off, about 10 minutes)'}
      </button>
      {guide && (
        <ol className="guide small">
          <li>
            On a computer, open <strong>console.cloud.google.com</strong> and sign in with the Google account your Fitbit uses. Create a new
            project (any name, e.g. "GymSim").
          </li>
          <li>
            Go to <strong>APIs &amp; Services → Library</strong>, search for <strong>Google Health API</strong> and click <strong>Enable</strong>.
          </li>
          <li>
            Go to <strong>Google Auth Platform</strong> (OAuth consent screen). Choose <strong>External</strong>, give it a name and your email.
            Under <strong>Audience</strong>, leave it in <strong>Testing</strong> and add your own Google email as a <strong>test user</strong>.
            Under <strong>Data access</strong>, add the scope <code>googlehealth.activity_and_fitness.readonly</code>.
          </li>
          <li>
            Go to <strong>Clients → Create client</strong>, type <strong>Web application</strong>. Under <strong>Authorised JavaScript origins</strong>{' '}
            add <code>{origin}</code>. No redirect URI is needed. Create it.
          </li>
          <li>Copy the <strong>Client ID</strong> (ends in .apps.googleusercontent.com), paste it above and tap <strong>Connect Fitbit</strong>.</li>
          <li>
            Google will warn that the app isn't verified, because it's your own private app. Tap <strong>Continue</strong>, tick the activity
            permission, and allow.
          </li>
        </ol>
      )}
    </section>
  );
}
