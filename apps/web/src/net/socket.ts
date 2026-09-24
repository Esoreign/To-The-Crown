/**
 * Connexion temps réel. Le client n'envoie que des intentions (commandes) ;
 * il applique les patches reçus et se resynchronise en cas de trou.
 */
import { io, type Socket } from 'socket.io-client';
import {
  PROTOCOL_VERSION,
  type AckMessage,
  type ClientToServerEvents,
  type GameCommand,
  type LobbyState,
  type ServerToClientEvents,
  type Speed,
} from '@ttc/shared';
import { useGame } from '../state/game';
import { playSound } from '../audio/audio';
import { pushToast } from '../state/ui';
import { errorMessage } from '../lib/i18n';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ClientSocket | null = null;
let currentGame: string | null = null;
let lobbyListeners = new Set<(l: LobbyState) => void>();
let lobbyStartListeners = new Set<(id: string) => void>();
let lobbyKickListeners = new Set<(id: string) => void>();

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSocket(): ClientSocket {
  if (socket) return socket;
  const s: ClientSocket = io({ path: '/socket.io', transports: ['websocket', 'polling'], withCredentials: true, reconnectionDelayMax: 4000 });
  socket = s;
  s.on('connect', () => {
    if (currentGame) {
      useGame.setState({ status: 'connecting' });
      joinGameRoom(currentGame);
    }
  });
  s.on('disconnect', () => {
    if (currentGame) useGame.setState({ status: 'reconnecting' });
  });
  s.on('connect_error', (err) => {
    useGame.setState({ status: 'error', error: errorMessage(err.message) });
  });
  s.on('game:snapshot', (msg) => {
    if (msg.gameId !== currentGame) return;
    useGame.getState().applySnapshot(msg);
  });
  s.on('game:patch', (msg) => {
    if (msg.gameId !== currentGame) return;
    if (useGame.getState().applyPatch(msg) === 'gap') s.emit('game:resync', { gameId: msg.gameId });
  });
  s.on('time:update', (clock) => useGame.setState({ clock }));
  s.on('presence:update', (presence) => useGame.setState({ presence }));
  s.on('notification:new', (list) => {
    useGame.getState().pushNotifications(list);
    const loud = list.find((n) => n.sound);
    if (loud?.sound) playSound(loud.sound);
  });
  s.on('chat:history', (msgs) => useGame.setState({ chat: msgs }));
  s.on('chat:message', (msg) => {
    useGame.setState({ chat: [...useGame.getState().chat, msg].slice(-200) });
    playSound('notify');
  });
  s.on('game:error', (e) => pushToast({ kind: 'error', text: errorMessage(e.code, e.message) }));
  s.on('lobby:update', (l) => lobbyListeners.forEach((f) => f(l)));
  s.on('lobby:started', (p) => lobbyStartListeners.forEach((f) => f(p.gameId)));
  s.on('lobby:kicked', (p) => lobbyKickListeners.forEach((f) => f(p.gameId)));
  return s;
}

function joinGameRoom(gameId: string): void {
  const s = getSocket();
  s.emit('game:join', { gameId, protocolVersion: PROTOCOL_VERSION }, (res) => {
    if (!res.ok) useGame.setState({ status: 'error', error: errorMessage(res.error.code, res.error.message) });
  });
}

export function connectGame(gameId: string): void {
  if (currentGame && currentGame !== gameId) leaveGame();
  currentGame = gameId;
  useGame.setState({ gameId, status: 'connecting', error: null });
  const s = getSocket();
  if (s.connected) joinGameRoom(gameId);
  else s.connect();
}

export function leaveGame(): void {
  if (currentGame && socket) socket.emit('game:leave', { gameId: currentGame });
  currentGame = null;
  useGame.getState().reset();
}

/** Envoie une commande et attend l'accusé du serveur. */
export function sendCommand(command: GameCommand, opts: { silent?: boolean } = {}): Promise<AckMessage> {
  const s = getSocket();
  const commandId = uuid();
  const started = performance.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ commandId, ok: false, error: { code: 'INTERNAL', message: 'Délai dépassé' }, version: 0 }), 10_000);
    s.emit('game:command', { commandId, expectedVersion: useGame.getState().view?.version, command }, (ack) => {
      clearTimeout(timer);
      useGame.setState({ latencyMs: Math.round(performance.now() - started) });
      if (!ack.ok && !opts.silent) {
        pushToast({ kind: 'error', text: errorMessage(ack.error?.code, ack.error?.message) });
        playSound('error');
      }
      resolve(ack);
    });
  });
}

export function setSpeed(speed: Speed): void {
  if (currentGame) getSocket().emit('time:set', { gameId: currentGame, speed });
}

export function requestPause(paused: boolean): void {
  if (currentGame) getSocket().emit('pause:request', { gameId: currentGame, paused });
}

export function sendChat(gameId: string, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    getSocket().emit('chat:send', { gameId, text }, (res) => {
      if (!res.ok) pushToast({ kind: 'error', text: errorMessage(res.error.code, res.error.message) });
      resolve(res.ok);
    });
  });
}

export function devAdvance(days: number): void {
  if (!currentGame) return;
  getSocket().emit('dev:advance', { gameId: currentGame, days }, (res) => {
    if (!res.ok) pushToast({ kind: 'error', text: res.error.message });
  });
}

export function joinLobby(gameId: string, onUpdate: (l: LobbyState) => void, onStart: (id: string) => void, onKick: (id: string) => void): () => void {
  const s = getSocket();
  lobbyListeners.add(onUpdate);
  lobbyStartListeners.add(onStart);
  lobbyKickListeners.add(onKick);
  const join = () =>
    s.emit('lobby:join', { gameId }, (res) => {
      if (res.ok) onUpdate(res.data);
      else pushToast({ kind: 'error', text: errorMessage(res.error.code, res.error.message) });
    });
  if (s.connected) join();
  s.on('connect', join);
  if (!s.connected) s.connect();
  return () => {
    s.off('connect', join);
    lobbyListeners.delete(onUpdate);
    lobbyStartListeners.delete(onStart);
    lobbyKickListeners.delete(onKick);
    s.emit('lobby:leave', { gameId });
  };
}

/** Après déconnexion d'un compte, la socket doit être recréée (nouveau cookie). */
export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
  currentGame = null;
  lobbyListeners = new Set();
  lobbyStartListeners = new Set();
  lobbyKickListeners = new Set();
}
