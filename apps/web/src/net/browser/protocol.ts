/**
 * Messages du mode sans serveur : fil principal ↔ worker de simulation, et
 * hôte ↔ invités sur le canal Supabase Realtime de la partie.
 */
import type {
  AckMessage,
  ChatMessage,
  ClockState,
  GameNotification,
  GameState,
  GameView,
  PatchOp,
  PrivateView,
  Speed,
} from '@ttc/shared';
import type { HostSave, HostStep } from './hostRoom';

export interface CreateSpec {
  scenarioId: string;
  seed: number;
  settings: GameState['settings'];
  players: { userId: string; displayName: string; characterId: string }[];
}

export type WorkerIn =
  | {
      t: 'init';
      gameId: string;
      mode: 'solo' | 'multiplayer';
      hostId: string;
      devTools: boolean;
      speed: number;
      playedSeconds: number;
      state: Record<string, unknown> | null;
      create: CreateSpec | null;
    }
  | { t: 'cmd'; id: string; userId: string; env: unknown }
  | { t: 'speed'; userId: string; speed: Speed }
  | { t: 'pause'; userId: string; paused: boolean; reason?: string }
  | { t: 'advance'; days: number }
  | { t: 'save'; reason: string; ifDirty?: boolean }
  | { t: 'stop'; reason: string };

export type WorkerOut =
  | { t: 'ready'; seq: number; version: number; view: GameView; priv: PrivateView; clock: ClockState }
  | { t: 'step'; step: HostStep }
  | { t: 'clock'; clock: ClockState }
  | { t: 'ack'; id: string; userId: string; ack: AckMessage }
  | { t: 'save'; save: HostSave }
  | { t: 'log'; message: string; details?: unknown }
  | { t: 'fatal'; code: string; message: string };

/** Patch diffusé aux invités (sans vue privée : elle voyage à part). */
export interface WirePatch {
  seq: number;
  version: number;
  date: number;
  ops: PatchOp[];
}

/** Charge utile des messages « broadcast » du canal `ttc:<partie>:<code>`. */
export type ChannelMessage =
  /** Lot de patches de l'hôte (≈ toutes les 400 ms quand le temps s'écoule). */
  | {
      t: 'batch';
      epoch: string;
      patches: WirePatch[];
      priv: Record<string, PrivateView>;
      notifs: Record<string, GameNotification[]>;
      clock: ClockState;
    }
  /** L'hôte vient d'enregistrer l'état `seq` : les invités en retard le rechargent. */
  | { t: 'snap'; epoch: string; seq: number; id: number; clock: ClockState }
  | { t: 'clock'; epoch: string; clock: ClockState }
  | { t: 'ack'; to: string; ack: AckMessage }
  /** Un invité demande un état complet (arrivée, trou de séquence). */
  | { t: 'hello'; from: string }
  | { t: 'cmd'; from: string; env: unknown }
  | { t: 'pause'; from: string; paused: boolean }
  | { t: 'chat'; msg: ChatMessage };
