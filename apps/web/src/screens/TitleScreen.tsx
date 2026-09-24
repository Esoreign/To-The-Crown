import { useEffect, useMemo, useState } from 'react';
import { getScenario } from '@ttc/content';
import { GAME_VERSION_LABEL, formatDateFr, type GameSummary } from '@ttc/shared';
import { MapView } from '../map/MapView';
import { scenarioView } from '../map/scenarioView';
import { api } from '../net/api';
import { resetSocket } from '../net/socket';
import { useAuth } from '../state/auth';
import { useRouter } from '../lib/router';
import { playSound, startMusic, unlockAudio } from '../audio/audio';
import { Modal } from '../ui/common';
import { AuthModal } from './AuthModal';
import { SettingsModal } from './SettingsModal';
import { MusicButton, NowPlaying } from '../ui/music';

export function TitleScreen() {
  const { user, logout } = useAuth();
  const go = useRouter((s) => s.go);
  const view = useMemo(() => scenarioView(getScenario('couronne_brisee')), []);
  const [auth, setAuth] = useState<null | 'login' | 'register'>(null);
  const [after, setAfter] = useState<null | (() => void)>(null);
  const [settings, setSettings] = useState(false);
  const [saves, setSaves] = useState<GameSummary[] | null>(null);
  const [continueOpen, setContinueOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setSaves(null);
      return;
    }
    api<{ games: GameSummary[] }>('GET', '/api/games')
      .then((r) => setSaves(r.games.filter((g) => g.isMember && g.status === 'running')))
      .catch(() => setSaves([]));
  }, [user]);

  const requireAuth = (fn: () => void) => {
    unlockAudio();
    startMusic();
    playSound('click');
    if (user) fn();
    else {
      setAfter(() => fn);
      setAuth('login');
    }
  };

  const latest = saves?.[0];

  return (
    <div className="title-screen">
      <MapView styleMode="ambient" view={view} mapMode="political" className="map-host title-map" />
      <div className="title-vignette" />
      <div className="title-content">
        <div className="title-crest" aria-hidden="true">
          <svg viewBox="0 0 120 80" width="120" height="80">
            <path d="M14 62 L20 22 L40 42 L60 10 L80 42 L100 22 L106 62 Z" fill="none" stroke="#c9a24b" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M14 68 H106" stroke="#c9a24b" strokeWidth="2.4" />
            <circle cx="60" cy="10" r="4" fill="#c9a24b" />
            <circle cx="20" cy="22" r="3" fill="#c9a24b" />
            <circle cx="100" cy="22" r="3" fill="#c9a24b" />
          </svg>
        </div>
        <h1 className="title-logo">TO THE CROWN</h1>
        <p className="title-tagline">Chaque serment a un prix.</p>
        <nav className="title-menu" aria-label="Menu principal">
          <button
            className="menu-item"
            disabled={!!user && !latest}
            onClick={() => requireAuth(() => (saves && saves.length > 1 ? setContinueOpen(true) : latest && go({ name: 'game', id: latest.id })))}
            title={user && !latest ? 'Aucune sauvegarde' : undefined}
          >
            Continuer
            {latest && (
              <span className="menu-sub">
                {latest.rulerName ?? latest.name} · {latest.gameDate ? formatDateFr(latest.gameDate) : ''}
              </span>
            )}
          </button>
          <button className="menu-item" onClick={() => requireAuth(() => go({ name: 'new' }))}>
            Nouvelle partie
          </button>
          <button className="menu-item" onClick={() => requireAuth(() => go({ name: 'multiplayer' }))}>
            Multijoueur
          </button>
          <button className="menu-item" onClick={() => (unlockAudio(), setSettings(true))}>
            Paramètres
          </button>
          <button className="menu-item" onClick={() => go({ name: 'credits' })}>
            Crédits
          </button>
          {user ? (
            <button
              className="menu-item small"
              onClick={async () => {
                await logout();
                resetSocket();
              }}
            >
              Déconnexion <span className="menu-sub">{user.username}</span>
            </button>
          ) : (
            <button className="menu-item small" onClick={() => setAuth('login')}>
              Se connecter
            </button>
          )}
        </nav>
      </div>
      <div className="title-music">
        <MusicButton />
        <NowPlaying />
      </div>
      <div className="title-version">v{GAME_VERSION_LABEL}</div>
      {auth && (
        <AuthModal
          mode={auth}
          onMode={setAuth}
          onClose={() => setAuth(null)}
          onDone={() => {
            setAuth(null);
            after?.();
            setAfter(null);
          }}
        />
      )}
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {continueOpen && saves && (
        <Modal title="Continuer une saga" onClose={() => setContinueOpen(false)}>
          <div className="save-list">
            {saves.map((g) => (
              <button key={g.id} className="save-item" onClick={() => go({ name: 'game', id: g.id })}>
                <div className="save-name display">{g.name}</div>
                <div className="soft">{g.rulerName ?? '—'}</div>
                <div className="muted">
                  {g.gameDate ? formatDateFr(g.gameDate) : ''} · {g.mode === 'solo' ? 'Solo' : `${g.playerCount} joueurs`} · {Math.round(g.playedSeconds / 60)} min
                  {g.lastSavedAt ? ` · sauvegardé le ${new Date(g.lastSavedAt).toLocaleString('fr-FR')}` : ''}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
