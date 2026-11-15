import { useEffect, useState } from 'react';
import { addDays, dayRange } from '../domain/dates';
import { stepGoalOf } from '../domain/steps';
import type { AppState } from '../domain/types';
import { fetchSteps, hasFreshToken, isConnected, StepsError } from '../lib/googleHealth';
import { actions } from '../store';
import { toast } from './ui';

const HOUR = 3_600_000;

export function timeAgo(ms: number, now = Date.now()): string {
  const m = Math.round((now - ms) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** Sync state shared by the Body card and the settings section. */
export function useStepsSync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sync = async (opts: { interactive?: boolean; quiet?: boolean } = {}) => {
    setBusy(true);
    setError(null);
    try {
      const days = await fetchSteps({ interactive: opts.interactive });
      actions.saveSteps(days);
      if (!opts.quiet) toast('Steps synced');
      return true;
    } catch (e) {
      if (!opts.quiet) setError(e instanceof StepsError ? e.message : 'Something went wrong syncing steps. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, sync };
}

export function StepsCard({ state, today, onSetup }: { state: AppState; today: string; onSetup: () => void }) {
  const { busy, error, sync } = useStepsSync();
  const connected = isConnected();
  const steps = state.steps ?? {};
  const goal = stepGoalOf(state.settings.stepGoal);

  // Refresh quietly when the app is opened, if we can do it without a Google popup.
  useEffect(() => {
    if (connected && hasFreshToken() && (!state.stepsSyncedAt || Date.now() - state.stepsSyncedAt > HOUR)) sync({ quiet: true });
  }, []);

  if (!connected && !state.stepsSyncedAt) {
    return (
      <section className="card steps-card">
        <div className="row between">
          <div>
            <h3 style={{ margin: 0 }}>Steps</h3>
            <p className="small muted" style={{ margin: '2px 0 0' }}>Connect your Fitbit to add daily steps to your cardio.</p>
          </div>
          <button className="btn small" onClick={onSetup}>Connect Fitbit</button>
        </div>
      </section>
    );
  }

  const todaySteps = steps[today] ?? 0;
  const week = dayRange(addDays(today, -6), today);
  const max = Math.max(goal, ...week.map((d) => steps[d] ?? 0));
  const pct = Math.min(100, (todaySteps / goal) * 100);
  return (
    <section className="card steps-card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0 }}>Steps today</h3>
          <div className="steps-big num">
            {todaySteps.toLocaleString()} <span className="small muted">/ {goal.toLocaleString()}</span>
            {todaySteps >= goal && <span className="steps-done"> ✓</span>}
          </div>
        </div>
        <div className="steps-week" aria-label="Steps, last 7 days">
          {week.map((d) => {
            const n = steps[d] ?? 0;
            return (
              <div key={d} className="steps-bar-wrap" title={`${d}: ${n.toLocaleString()} steps`}>
                <div className={`steps-bar ${n >= goal ? 'hit' : ''} ${d === today ? 'today' : ''}`} style={{ height: `${Math.max(4, (n / max) * 100)}%` }} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="bar" style={{ marginTop: 8 }}>
        <div style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="small muted">{state.stepsSyncedAt ? `Synced ${timeAgo(state.stepsSyncedAt)}` : 'Not synced yet'}</span>
        {connected ? (
          <button className="text-link" disabled={busy} onClick={() => sync()}>{busy ? 'Syncing…' : 'Sync now'}</button>
        ) : (
          <button className="text-link" onClick={onSetup}>Reconnect</button>
        )}
      </div>
      {error && <p className="small" style={{ color: 'var(--danger)', margin: '6px 0 0' }}>{error}</p>}
    </section>
  );
}
