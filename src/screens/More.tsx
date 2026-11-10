import { useRef } from 'react';
import { Stepper, toast } from '../components/ui';
import { APP_NAME, COINS, SKINS } from '../domain/config';
import { formatDay } from '../domain/dates';
import type { BodyState } from '../domain/engine';
import type { AppState } from '../domain/types';
import { actions, ownsSkin } from '../store';
import { Disclaimer } from './Priorities';

export function More({ state, body }: { state: AppState; body: BodyState }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_NAME.toLowerCase()}-backup-${body.today}.json`;
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
          <h1>You</h1>
          <p className="sub">Coins, rewards and settings</p>
        </div>
      </header>

      <div className="stats">
        <div className="stat"><div className="value">{body.coinBalance}</div><div className="label">coins</div></div>
        <div className="stat"><div className="value">{body.longestStreak}</div><div className="label">best streak</div></div>
        <div className="stat"><div className="value">{body.trainingDays}</div><div className="label">training days</div></div>
      </div>

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
          Locked exercises can be unlocked in the Library. Coins come from consistency: {COINS.trainingDay} per training day,
          streak bonuses, and {COINS.weeklyTargetHit} per weekly priority target. They can't buy health levels.
        </p>
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

      <h2 className="section-title">Tuning</h2>
      <section className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <span>
            <div style={{ fontWeight: 600 }}>Daily decay</div>
            <div className="small muted">Points every area loses per day</div>
          </span>
          <Stepper value={state.settings.decayPerDay} min={0} max={15} onChange={(n) => actions.updateSettings({ decayPerDay: n })} />
        </div>
        <div className="row between">
          <span>
            <div style={{ fontWeight: 600 }}>Priority decay</div>
            <div className="small muted">Faster decay for pinned areas</div>
          </span>
          <Stepper value={state.settings.priorityDecayPerDay} min={0} max={20} onChange={(n) => actions.updateSettings({ priorityDecayPerDay: n })} />
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Changes apply to your whole history, so levels recalculate straight away.</p>
      </section>

      <h2 className="section-title">Your data</h2>
      <section className="card">
        <p className="small muted">Everything is stored only on this device. Nothing is uploaded. Export a backup before you clear your browser or switch phones.</p>
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
            if (confirm('Erase all workouts, pins and coins on this device? This cannot be undone.')) actions.reset();
          }}
        >
          Erase everything
        </button>
      </section>

      <h2 className="section-title">About</h2>
      <Disclaimer />
      <p className="small muted" style={{ textAlign: 'center' }}>{APP_NAME} v0.1</p>
    </>
  );
}
