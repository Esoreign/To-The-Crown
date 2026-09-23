/**
 * Contrat réseau Socket.IO et REST.
 */
import { z } from 'zod';
import type { CommandEnvelope } from './commands';
import type { ErrorCode } from './errors';
import type { GameNotification, GameView, PrivateView } from './state';

export const PROTOCOL_VERSION = 1;
export const GAME_VERSION_LABEL = '0.1.0';

export type Speed = 0 | 1 | 2 | 3;

/** Opération de patch (format Immer / JSON Patch simplifié). */
export interface PatchOp {
  op: 'replace' | 'add' | 'remove';
  path: (string | number)[];
  value?: unknown;
}

export interface ClockState {
  date: number;
  speed: Speed;
  paused: boolean;
  /** Raison de la pause (clé de localisation). */
  pauseReason: string | null;
  hostId: string;
  maxSpeed: 1 | 2 | 3;
}

export interface PresenceEntry {
  userId: string;
  displayName: string;
  characterId: string | null;
  online: boolean;
  isHost: boolean;
}

export interface SnapshotMessage {
  gameId: string;
  seq: number;
  version: number;
  view: GameView;
  privateView: PrivateView;
  clock: ClockState;
  you: { userId: string; characterId: string | null };
  presence: PresenceEntry[];
  devTools: boolean;
}

export interface PatchMessage {
  gameId: string;
  seq: number;
  version: number;
  ops: PatchOp[];
  /** Remplacement complet de la vue privée si elle a changé. */
  privateView?: PrivateView;
  date: number;
}

export interface AckMessage {
  commandId: string;
  ok: boolean;
  error?: { code: ErrorCode; message: string; details?: Record<string, unknown> };
  /** Données de résultat (ex. acceptation d'une proposition). */
  result?: Record<string, unknown>;
  version: number;
}

export interface ChatMessage {
  id: string;
  gameId: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
}

export interface LobbyPlayer {
  userId: string;
  displayName: string;
  characterId: string | null;
  ready: boolean;
  isHost: boolean;
  online: boolean;
}

export interface LobbyState {
  gameId: string;
  name: string;
  inviteCode: string;
  hostId: string;
  status: GameStatus;
  maxPlayers: number;
  mode: 'solo' | 'multiplayer';
  players: LobbyPlayer[];
  settings: {
    maxSpeed: 1 | 2 | 3;
    autosave: boolean;
    aiDifficulty: 'easy' | 'normal' | 'hard';
    eventFrequency: 'low' | 'normal' | 'high';
    visibility: 'private' | 'public';
  };
}

export type GameStatus = 'lobby' | 'running' | 'finished';

export interface ServerToClientEvents {
  'game:snapshot': (msg: SnapshotMessage) => void;
  'game:patch': (msg: PatchMessage) => void;
  'game:error': (err: { code: ErrorCode; message: string }) => void;
  'game:ack': (ack: AckMessage) => void;
  'time:update': (clock: ClockState) => void;
  'presence:update': (presence: PresenceEntry[]) => void;
  'notification:new': (notifications: GameNotification[]) => void;
  'chat:message': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'lobby:update': (lobby: LobbyState) => void;
  'lobby:started': (info: { gameId: string }) => void;
  'lobby:kicked': (info: { gameId: string }) => void;
}

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }) => void;

export interface ClientToServerEvents {
  'lobby:join': (p: { gameId: string }, ack: Ack<LobbyState>) => void;
  'lobby:leave': (p: { gameId: string }) => void;
  'game:join': (p: { gameId: string; protocolVersion: number }, ack: Ack<{ joined: true }>) => void;
  'game:leave': (p: { gameId: string }) => void;
  'game:command': (env: CommandEnvelope, ack: (ack: AckMessage) => void) => void;
  'game:resync': (p: { gameId: string }) => void;
  'time:set': (p: { gameId: string; speed: Speed }) => void;
  'pause:request': (p: { gameId: string; paused: boolean }) => void;
  'chat:send': (p: { gameId: string; text: string }, ack: Ack<{ sent: true }>) => void;
  'dev:advance': (p: { gameId: string; days: number }, ack: Ack<{ date: number }>) => void;
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.email().max(254).transform((s) => s.trim().toLowerCase()),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[\p{L}\p{N}_\- ]+$/u, 'Caractères autorisés : lettres, chiffres, espace, _ et -'),
  password: z.string().min(10).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(200),
});

export const createGameSchema = z.object({
  name: z.string().trim().min(3).max(48),
  mode: z.enum(['solo', 'multiplayer']),
  maxPlayers: z.number().int().min(1).max(8).default(8),
  characterId: z.string().min(1).max(64).optional(),
  settings: z
    .object({
      maxSpeed: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
      autosave: z.boolean().default(true),
      aiDifficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
      eventFrequency: z.enum(['low', 'normal', 'high']).default('normal'),
      visibility: z.enum(['private', 'public']).default('private'),
    })
    .default({ maxSpeed: 3, autosave: true, aiDifficulty: 'normal', eventFrequency: 'normal', visibility: 'private' }),
});

export const joinGameSchema = z.object({ inviteCode: z.string().trim().min(4).max(16).optional() });
export const selectCharacterSchema = z.object({ characterId: z.string().min(1).max(64).nullable() });
export const readySchema = z.object({ ready: z.boolean() });
export const kickSchema = z.object({ userId: z.string().min(1).max(64) });
export const updateSettingsSchema = createGameSchema.shape.settings.unwrap().partial();

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface GameSummary {
  id: string;
  name: string;
  mode: 'solo' | 'multiplayer';
  status: GameStatus;
  hostId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  visibility: 'private' | 'public';
  inviteCode: string | null;
  isMember: boolean;
  /** Pour « Continuer » : souverain et date. */
  rulerName: string | null;
  rulerCharacterId: string | null;
  gameDate: number | null;
  lastSavedAt: string | null;
  playedSeconds: number;
  createdAt: string;
}

export interface ApiError {
  error: { code: ErrorCode; message: string; details?: unknown };
}
