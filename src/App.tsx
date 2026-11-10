import { useEffect, useState } from 'react';
import { Icon, Toaster } from './components/ui';
import { SKINS } from './domain/config';
import { Dashboard } from './screens/Dashboard';
import { Library } from './screens/Library';
import { LogWorkout } from './screens/LogWorkout';
import { More } from './screens/More';
import { Onboarding } from './screens/Onboarding';
import { Priorities } from './screens/Priorities';
import { useAppState, useBody } from './store';

type Tab = 'body' | 'library' | 'log' | 'priorities' | 'more';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'body', label: 'Body', icon: Icon.body },
  { id: 'library', label: 'Library', icon: Icon.list },
  { id: 'log', label: 'Log', icon: Icon.plus },
  { id: 'priorities', label: 'Priorities', icon: Icon.target },
  { id: 'more', label: 'You', icon: Icon.more },
];

export function App() {
  const state = useAppState();
  const body = useBody();
  const [tab, setTab] = useState<Tab>('body');
  const [focusArea, setFocusArea] = useState<string | undefined>();
  // Remount the Log screen (back to the exercise list) whenever its tab is tapped.
  const [logKey, setLogKey] = useState(0);

  const accent = SKINS.find((s) => s.id === state.settings.skin)?.accent ?? SKINS[0].accent;
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accent);
  }, [accent]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const go = (t: Tab) => {
    if (t === 'log') {
      setLogKey((k) => k + 1);
      setFocusArea(undefined);
    }
    setTab(t);
  };

  if (!state.onboardedAt) {
    return (
      <div className="app" style={{ paddingBottom: 32 }}>
        <Onboarding />
      </div>
    );
  }

  return (
    <>
      <main className="app">
        {tab === 'body' && (
          <Dashboard
            state={state}
            body={body}
            onLogForArea={(areaId) => {
              setFocusArea(areaId);
              setLogKey((k) => k + 1);
              setTab('log');
            }}
          />
        )}
        {tab === 'log' && (
          <LogWorkout key={logKey} state={state} focusArea={focusArea} onClearFocus={() => setFocusArea(undefined)} />
        )}
        {tab === 'library' && <Library state={state} body={body} />}
        {tab === 'priorities' && <Priorities state={state} body={body} />}
        {tab === 'more' && <More state={state} body={body} />}
      </main>

      <Toaster />

      <div className="tabbar">
        <nav aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === 'log' ? 'log-btn' : undefined}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              {t.id === 'log' ? <span className="circle">{t.icon}</span> : t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
