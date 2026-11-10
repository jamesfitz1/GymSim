import { useEffect, useState } from 'react';
import { Icon, Toaster } from './components/ui';
import { SKINS } from './domain/config';
import { Dashboard } from './screens/Dashboard';
import { Library } from './screens/Library';
import { More } from './screens/More';
import { ProfilePicker } from './screens/Profiles';
import { WorkoutTab, type WorkoutIntent } from './screens/Workout';
import { activeWorkout, useAppState, useBody, useCurrentState } from './store';

type Tab = 'body' | 'workout' | 'library' | 'more';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'body', label: 'Body', icon: Icon.body },
  { id: 'workout', label: 'Workout', icon: Icon.plus },
  { id: 'library', label: 'Library', icon: Icon.list },
  { id: 'more', label: 'You', icon: Icon.more },
];

export function App() {
  const current = useCurrentState();
  const accent = SKINS.find((s) => s.id === current?.settings.skin)?.accent ?? SKINS[0].accent;
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accent);
  }, [accent]);

  if (!current) {
    return (
      <div className="app" style={{ paddingBottom: 32 }}>
        <ProfilePicker />
      </div>
    );
  }
  // Remount per profile so screen state never leaks between people.
  return <ProfileApp key={current.profile.id} />;
}

function ProfileApp() {
  const state = useAppState();
  const body = useBody();
  const [tab, setTab] = useState<Tab>('body');
  const [intent, setIntent] = useState<WorkoutIntent | undefined>();
  // Tapping the current tab again resets it to its first screen.
  const [resetKey, setResetKey] = useState(0);
  const inProgress = !!activeWorkout(state);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const go = (t: Tab) => {
    if (t === tab) setResetKey((k) => k + 1);
    if (t === 'workout') setIntent(undefined);
    setTab(t);
  };

  return (
    <>
      <main className="app">
        {tab === 'body' && (
          <Dashboard
            state={state}
            body={body}
            onLogForArea={(focus) => {
              setIntent({ focus, nonce: Date.now() });
              setTab('workout');
            }}
          />
        )}
        {tab === 'workout' && <WorkoutTab key={resetKey} state={state} body={body} intent={intent} />}
        {tab === 'library' && <Library key={resetKey} state={state} body={body} />}
        {tab === 'more' && <More key={resetKey} state={state} body={body} />}
      </main>

      <Toaster />

      <div className="tabbar">
        <nav aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === 'workout' ? 'log-btn' : undefined}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => go(t.id)}
            >
              {t.id === 'workout' ? (
                <span className={`circle ${inProgress ? 'live' : ''}`}>{t.icon}</span>
              ) : (
                t.icon
              )}
              {t.id === 'workout' && inProgress ? 'In progress' : t.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
