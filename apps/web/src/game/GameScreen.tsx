import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROVINCE_GEO, TITLE_DEFS, capitalProvinceOf, realmProvinceIds } from '@ttc/game-core';
import { MapView } from '../map/MapView';
import type { MapRenderer } from '../map/MapRenderer';
import { connectGame, leaveGame, sendCommand } from '../net/socket';
import { useGame } from '../state/game';
import { useUi, type MapMode, type ScreenId } from '../state/ui';
import { useSettings } from '../state/settings';
import { useAuth } from '../state/auth';
import { useRouter } from '../lib/router';
import { playSound, startMusic, unlockAudio } from '../audio/audio';
import { useTip } from '../ui/common';
import { Loading } from '../App';
import { SettingsModal } from '../screens/SettingsModal';
import { TopBar } from './hud/TopBar';
import { Clock, useClockControls } from './hud/Clock';
import { MapModes, MAP_MODES } from './hud/MapModes';
import { Outliner } from './hud/Outliner';
import { NotificationHistory, NotificationStack } from './hud/Notifications';
import { NavBar, NAV } from './hud/NavBar';
import { EventModal } from './EventModal';
import { SelectionPanel } from './panels/SelectionPanel';
import { ScreenHost } from './screens/ScreenHost';
import { ProvinceTooltip } from './panels/ProvincePanel';
import { ContextMenu } from './ContextMenu';
import { ChatPanel } from './ChatPanel';
import { GameOverScreen, SuccessionModal } from './GameOver';
import { Tutorial } from './Tutorial';
import { DevPanel } from './DevPanel';
import { GameMenu } from './GameMenu';
import { DialogHost } from './Dialogs';

export function GameScreen({ gameId }: { gameId: string }) {
  const status = useGame((s) => s.status);
  const error = useGame((s) => s.error);
  const world = useGame((s) => s.world);
  const meId = useGame((s) => s.youCharacterId);
  const userId = useAuth((s) => s.user?.id);
  const go = useRouter((s) => s.go);

  useEffect(() => {
    connectGame(gameId);
    unlockAudio();
    startMusic();
    return () => leaveGame();
  }, [gameId]);

  if (status === 'error' && !world) {
    return (
      <div className="loading-screen">
        <div className="boot-crown">♛</div>
        <div className="loading-label">{error ?? 'Connexion impossible'}</div>
        <button className="btn" onClick={() => go({ name: 'title' })}>
          Retour à l’accueil
        </button>
      </div>
    );
  }
  if (!world || !userId) return <Loading label="Ouverture des archives du royaume…" />;
  const slot = world.players[userId];
  if (slot?.gameOver || !meId) return <GameOverScreen view={world} userId={userId} />;
  return <GameHud gameId={gameId} meId={meId} />;
}

function GameHud({ gameId, meId }: { gameId: string; meId: string }) {
  const view = useGame((s) => s.world)!;
  const devTools = useGame((s) => s.devTools);
  const notifications = useGame((s) => s.notifications);
  const chat = useGame((s) => s.chat);
  const me = view.characters[meId]!;
  const selection = useUi((s) => s.selection);
  const screen = useUi((s) => s.screen);
  const mapMode = useUi((s) => s.mapMode);
  const openEventId = useUi((s) => s.openEventId);
  const focusRequest = useUi((s) => s.focusRequest);
  const contextMenu = useUi((s) => s.contextMenu);
  const chatOpen = useUi((s) => s.chatOpen);
  const status = useGame((s) => s.status);
  const tutorial = useSettings((s) => s.tutorialEnabled);
  const renderer = useRef<MapRenderer | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [dev, setDev] = useState(false);
  const [chatSeen, setChatSeen] = useState(0);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1000);
  const clock = useClockControls();
  const multiplayer = Object.keys(view.players).length > 1;

  // --- Centrage initial sur la capitale.
  const initialFocus = useMemo(() => {
    const cap = capitalProvinceOf(me);
    return cap ? { provinceId: cap, at: 0, zoom: 1.4 } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);
  const focus = focusRequest ?? initialFocus;

  // --- Ouverture automatique des événements.
  const myEvents = useMemo(() => Object.values(view.activeEvents).filter((e) => e.characterId === meId), [view.activeEvents, meId]);
  const seenEvents = useRef(new Set<string>());
  useEffect(() => {
    for (const e of myEvents) {
      if (seenEvents.current.has(e.id)) continue;
      seenEvents.current.add(e.id);
      if (!useUi.getState().openEventId) useUi.setState({ openEventId: e.id });
    }
    if (openEventId && !view.activeEvents[openEventId]) useUi.setState({ openEventId: myEvents[0]?.id ?? null });
  }, [myEvents, openEventId, view.activeEvents]);

  // --- Discussion non lue.
  useEffect(() => {
    if (chatOpen) setChatSeen(chat.length);
  }, [chatOpen, chat.length]);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1000);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // --- Sélection → carte.
  const selectedArmy = selection?.kind === 'army' ? selection.id : null;
  const selectedProvince = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === 'province') return selection.id;
    if (selection.kind === 'character') {
      const c = view.characters[selection.id];
      return c ? capitalProvinceOf(c) : null;
    }
    if (selection.kind === 'title') {
      const holder = view.titles[selection.id]?.holderId;
      const c = holder ? view.characters[holder] : undefined;
      return c ? capitalProvinceOf(c) : null;
    }
    if (selection.kind === 'battle') return view.battles[selection.id]?.provinceId ?? null;
    return null;
  }, [selection, view]);
  const highlight = useMemo(() => {
    if (selection?.kind === 'character' && view.characters[selection.id]?.titleIds.length) return realmProvinceIds(view, selection.id);
    if (selection?.kind === 'war') {
      const w = view.wars[selection.id];
      if (!w) return [];
      const sides = new Set([...w.attackers, ...w.defenders]);
      return Object.values(view.titles)
        .filter((t) => t.occupiedBy && sides.has(t.occupiedBy))
        .map((t) => TITLE_DEFS[t.id]?.provinceId)
        .filter((p): p is string => !!p);
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, view.characters, view.titles]);

  // --- Clavier.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const ui = useUi.getState();
      if (k === ' ') {
        e.preventDefault();
        clock.toggle();
        return;
      }
      if (k === '1' || k === '2' || k === '3') {
        clock.speed(Number(k) as 1 | 2 | 3);
        return;
      }
      if (k === 'Escape') {
        if (ui.dialog) useUi.setState({ dialog: null });
        else if (ui.contextMenu) useUi.setState({ contextMenu: null });
        else if (ui.openEventId) useUi.setState({ openEventId: null });
        else if (dev) setDev(false);
        else if (bell) setBell(false);
        else if (ui.chatOpen) useUi.setState({ chatOpen: false });
        else if (ui.screen) ui.openScreen(null);
        else if (ui.selection) ui.select(null);
        else setMenu((m) => !m);
        return;
      }
      if (k === 'f' || k === 'F' || k === '/') {
        e.preventDefault();
        ui.openScreen('search');
        return;
      }
      if (k === 'Home') {
        const cap = capitalProvinceOf(me);
        if (cap) ui.focusProvince(cap);
        return;
      }
      if (k === '`' && devTools) {
        setDev((d) => !d);
        return;
      }
      const pan = 60;
      const cam = useSettings.getState().cameraSpeed;
      if (k === 'ArrowUp' || k === 'z' || k === 'Z') return renderer.current?.panBy(0, pan * cam);
      if (k === 'ArrowDown' || k === 's' || k === 'S') return renderer.current?.panBy(0, -pan * cam);
      if (k === 'ArrowLeft' || k === 'q') return renderer.current?.panBy(pan * cam, 0);
      if (k === 'ArrowRight') return renderer.current?.panBy(-pan * cam, 0);
      if (k === '+' || k === '=') return renderer.current?.zoomBy(1.2);
      if (k === '-') return renderer.current?.zoomBy(1 / 1.2);
      const upper = k.toUpperCase();
      const mode = MAP_MODES.find((m) => m.key === upper);
      if (mode) {
        ui.setMapMode(mode.id as MapMode);
        return;
      }
      const nav = NAV.find((n) => n.key === upper);
      if (nav) ui.openScreen(ui.screen === nav.id ? null : (nav.id as ScreenId));
    },
    [clock, me, bell, devTools, dev],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // --- Survol de province : info-bulle.
  const hoverTimer = useRef<number | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);
  const onHover = (pid: string | null) => {
    useUi.setState({ hoverProvince: pid });
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    useTip.getState().hide();
    if (!pid) return;
    hoverTimer.current = window.setTimeout(() => {
      const w = useGame.getState().world;
      const ui = useUi.getState();
      if (w && ui.hoverProvince === pid && !ui.contextMenu && !ui.dialog) useTip.getState().show(<ProvinceTooltip view={w} provinceId={pid} />, mouse.current.x, mouse.current.y);
    }, 550);
  };

  const unread = notifications.filter((n) => !n.read).length;
  const openEvent = openEventId ? view.activeEvents[openEventId] : undefined;

  return (
    <div className={`game-screen mode-${mapMode}`} data-testid="game-screen">
      <MapView
        styleMode="game"
        view={view}
        mapMode={mapMode}
        playerId={meId}
        selectedProvince={selectedProvince}
        highlight={highlight}
        selectedArmy={selectedArmy}
        focus={focus}
        onReady={(r) => (renderer.current = r)}
        onHover={onHover}
        onClick={(pid) => {
          useUi.setState({ contextMenu: null });
          if (pid) {
            playSound('click');
            useUi.getState().select({ kind: 'province', id: pid });
          }
        }}
        onRightClick={async (pid, ev) => {
          if (!pid) return;
          const sel = useUi.getState().selection;
          const army = sel?.kind === 'army' ? view.armies[sel.id] : undefined;
          if (army && army.ownerId === meId) {
            const ack = await sendCommand({ type: 'army.move', payload: { armyId: army.id, to: pid } });
            if (ack.ok) playSound('confirm');
            return;
          }
          const holder = view.titles[PROVINCE_GEO[pid]?.countyTitleId ?? '']?.holderId;
          if (holder && holder !== meId) {
            useTip.getState().hide();
            useUi.setState({ contextMenu: { x: ev.clientX, y: ev.clientY, characterId: holder } });
          }
        }}
        onArmyClick={(id) => {
          playSound('click');
          useUi.getState().select({ kind: 'army', id });
        }}
        onBattleClick={(id) => useUi.getState().select({ kind: 'battle', id })}
        className="map-host game-map"
      />
      <TopBar view={view} me={me} />
      <button className="game-menu-btn icon-btn" onClick={() => setMenu(true)} aria-label="Menu (Échap)" title="Menu (Échap)" data-testid="game-menu">
        ☰
      </button>
      <Clock />
      <Outliner view={view} me={me} />
      <NotificationStack />
      <MapModes view={view} playerId={meId} />
      <NavBar onBell={() => setBell((b) => !b)} unread={unread} onChat={() => useUi.setState({ chatOpen: !chatOpen })} chatUnread={chatOpen ? 0 : Math.max(0, chat.length - chatSeen)} multiplayer={multiplayer} />
      {selection && <SelectionPanel key={`${selection.kind}:${selection.id}`} view={view} me={me} />}
      {screen && <ScreenHost view={view} me={me} />}
      {bell && <NotificationHistory onClose={() => setBell(false)} />}
      {chatOpen && multiplayer && <ChatPanel gameId={gameId} />}
      {contextMenu && <ContextMenu view={view} me={me} />}
      <DialogHost view={view} me={me} />
      {openEvent && <EventModal key={openEvent.id} view={view} ev={openEvent} />}
      <SuccessionModal view={view} meId={meId} />
      {tutorial && !openEvent && <Tutorial view={view} me={me} />}
      {dev && devTools && <DevPanel view={view} me={me} onClose={() => setDev(false)} />}
      {menu && <GameMenu onClose={() => setMenu(false)} onSettings={() => (setMenu(false), setSettings(true))} devTools={devTools} onDev={() => (setMenu(false), setDev(true))} />}
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {narrow && (
        <div className="narrow-notice" role="note">
          To The Crown est conçu pour un écran d’ordinateur (1366 px ou plus). L’affichage est simplifié.
          <button className="icon-btn" aria-label="Fermer" onClick={() => setNarrow(false)}>
            ✕
          </button>
        </div>
      )}
      {status === 'reconnecting' && <div className="reconnect-banner">Connexion perdue — reconnexion en cours…</div>}
    </div>
  );
}

