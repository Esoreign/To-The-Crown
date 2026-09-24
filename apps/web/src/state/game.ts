/**
 * État serveur synchronisé (vérité reçue) — distinct de l'état d'interface.
 * Les patches sont appliqués dans l'ordre ; un trou de séquence déclenche
 * une resynchronisation complète.
 */
import { create } from 'zustand';
import { applyPatches, type Patch } from 'immer';
import type {
  AckMessage,
  ChatMessage,
  ClockState,
  GameCommand,
  GameNotification,
  GameView,
  PatchMessage,
  PresenceEntry,
  PrivateView,
  SnapshotMessage,
} from '@ttc/shared';

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface UiNotification extends GameNotification {
  read: boolean;
  receivedAt: number;
}

interface GameStoreState {
  gameId: string | null;
  status: ConnStatus;
  error: string | null;
  seq: number;
  view: GameView | null;
  priv: PrivateView | null;
  /** Vue fusionnée (publique + privée) utilisée par l'interface. */
  world: GameView | null;
  clock: ClockState | null;
  presence: PresenceEntry[];
  youUserId: string | null;
  youCharacterId: string | null;
  devTools: boolean;
  notifications: UiNotification[];
  chat: ChatMessage[];
  latencyMs: number | null;
  applySnapshot(msg: SnapshotMessage): void;
  applyPatch(msg: PatchMessage): 'ok' | 'gap';
  pushNotifications(list: GameNotification[]): void;
  markRead(id?: string): void;
  reset(): void;
}

function merge(view: GameView, priv: PrivateView): GameView {
  return { ...view, ...priv };
}

const MAX_NOTIFS = 120;

export const useGame = create<GameStoreState>((set, get) => ({
  gameId: null,
  status: 'idle',
  error: null,
  seq: 0,
  view: null,
  priv: null,
  world: null,
  clock: null,
  presence: [],
  youUserId: null,
  youCharacterId: null,
  devTools: false,
  notifications: [],
  chat: [],
  latencyMs: null,
  applySnapshot(msg) {
    set({
      gameId: msg.gameId,
      seq: msg.seq,
      view: msg.view,
      priv: msg.privateView,
      world: merge(msg.view, msg.privateView),
      clock: msg.clock,
      presence: msg.presence,
      youUserId: msg.you.userId,
      youCharacterId: msg.you.characterId,
      devTools: msg.devTools,
      status: 'connected',
      error: null,
    });
  },
  applyPatch(msg) {
    const s = get();
    if (!s.view || msg.gameId !== s.gameId) return 'gap';
    if (msg.seq <= s.seq) return 'ok';
    if (msg.seq !== s.seq + 1) return 'gap';
    const view = msg.ops.length ? (applyPatches(s.view, msg.ops as Patch[]) as GameView) : { ...s.view, date: msg.date, version: msg.version };
    const priv = msg.privateView ?? s.priv!;
    // Le personnage joueur peut changer (succession) : on le relit dans l'état.
    let you = s.youCharacterId;
    if (s.youUserId) {
      const slot = view.players[s.youUserId];
      you = slot && !slot.gameOver ? slot.characterId : null;
    }
    set({ view, priv, world: merge(view, priv), seq: msg.seq, youCharacterId: you });
    return 'ok';
  },
  pushNotifications(list) {
    const now = Date.now();
    const items = list.map((n) => ({ ...n, read: false, receivedAt: now }));
    set({ notifications: [...items.reverse(), ...get().notifications].slice(0, MAX_NOTIFS) });
  },
  markRead(id) {
    set({ notifications: get().notifications.map((n) => (id === undefined || n.id === id ? { ...n, read: true } : n)) });
  },
  reset() {
    set({
      gameId: null,
      status: 'idle',
      error: null,
      seq: 0,
      view: null,
      priv: null,
      world: null,
      clock: null,
      presence: [],
      youCharacterId: null,
      notifications: [],
      chat: [],
    });
  },
}));

export type { AckMessage, GameCommand };
