import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './state/auth';
import { useRouter } from './lib/router';
import { useUi } from './state/ui';
import { TooltipLayer } from './ui/common';
import { TitleScreen } from './screens/TitleScreen';
import { CreditsScreen } from './screens/CreditsScreen';

const NewGameScreen = lazy(() => import('./screens/NewGameScreen').then((m) => ({ default: m.NewGameScreen })));
const MultiplayerScreen = lazy(() => import('./screens/MultiplayerScreen').then((m) => ({ default: m.MultiplayerScreen })));
const LobbyScreen = lazy(() => import('./screens/LobbyScreen').then((m) => ({ default: m.LobbyScreen })));
const GameScreen = lazy(() => import('./game/GameScreen').then((m) => ({ default: m.GameScreen })));

function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="loading-screen">
      <div className="boot-crown">♛</div>
      <div className="loading-label">{label}</div>
    </div>
  );
}

export function App() {
  const { checked, user, check } = useAuth();
  const route = useRouter((s) => s.route);
  const go = useRouter((s) => s.go);

  useEffect(() => {
    void check();
  }, [check]);

  // Les pages protégées renvoient à l'accueil si la session a expiré.
  useEffect(() => {
    if (checked && !user && route.name !== 'title' && route.name !== 'credits') go({ name: 'title' }, true);
  }, [checked, user, route.name, go]);

  if (!checked) return <Loading />;

  let screen;
  switch (route.name) {
    case 'new':
      screen = <NewGameScreen />;
      break;
    case 'multiplayer':
      screen = <MultiplayerScreen />;
      break;
    case 'lobby':
      screen = <LobbyScreen gameId={route.id} key={route.id} />;
      break;
    case 'game':
      screen = <GameScreen gameId={route.id} key={route.id} />;
      break;
    case 'credits':
      screen = <CreditsScreen />;
      break;
    default:
      screen = <TitleScreen />;
  }

  return (
    <>
      <Suspense fallback={<Loading />}>{user || route.name === 'title' || route.name === 'credits' ? screen : <Loading />}</Suspense>
      <Toasts />
      <TooltipLayer />
    </>
  );
}
