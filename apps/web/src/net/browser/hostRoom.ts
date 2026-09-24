/**
 * Salle de jeu hébergée dans le navigateur de l'hôte (mode sans serveur).
 * Portage de `apps/server/src/game/room.ts` : même horloge, mêmes commandes
 * idempotentes, mêmes patches publics ; la diffusion et la persistance sont
 * déléguées à `HostOutput` (fil principal → Supabase Realtime / RPC).
 */
import {
  ErrorCodes,
  commandEnvelopeSchema,
  isFirstOfMonth,
  isGameError,
  type AckMessage,
  type ClockState,
  type GameNotification,
  type GameState,
  type PatchOp,
  type PrivateView,
  type Speed,
} from '@ttc/shared';
import { privateViewFor, publicPatches, runCommand, stepDay, type StepResult } from '@ttc/game-core';

export interface HostStep {
  seq: number;
  version: number;
  date: number;
  ops: PatchOp[];
  /** Vues privées modifiées, par utilisateur. */
  priv: Record<string, PrivateView>;
  /** Notifications à remettre, par utilisateur. */
  notifs: Record<string, GameNotification[]>;
}

export interface HostSave {
  json: string;
  reason: string;
  seq: number;
  speed: number;
  playedSeconds: number;
  finished: boolean;
  meta: { players: { userId: string; characterId: string; rulerName: string | null }[] };
}

export interface HostOutput {
  step(s: HostStep): void;
  clock(c: ClockState): void;
  save(s: HostSave): void;
  log(message: string, details?: unknown): void;
}

export interface HostInit {
  gameId: string;
  state: GameState;
  mode: 'solo' | 'multiplayer';
  hostId: string;
  speed?: number;
  playedSeconds?: number;
  devTools: boolean;
  tickMs?: [number, number, number];
  /** Intervalle minimal entre deux sauvegardes automatiques mensuelles. */
  autosaveMinSeconds?: number;
  /** Sauvegarde de sécurité pendant que le temps s'écoule. */
  periodicSaveSeconds?: number;
}

const COMMAND_CACHE = 500;
const DEFAULT_TICKS: [number, number, number] = [600, 250, 90];

/** Seau à jetons : limite le débit de commandes d'un joueur distant. */
class Bucket {
  private tokens: number;
  private last = performance.now();
  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
  ) {
    this.tokens = capacity;
  }
  take(): boolean {
    const now = performance.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export class HostRoom {
  readonly gameId: string;
  state: GameState;
  seq = 0;
  speed: Speed = 1;
  paused = true;
  pauseReason: string | null = 'start';
  readonly mode: 'solo' | 'multiplayer';
  readonly hostId: string;
  playedSeconds: number;
  stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSaveAt = Date.now();
  private dirty = false;
  private runningSince: number | null = null;
  private recentCommands = new Map<string, AckMessage>();
  private lastPrivate = new Map<string, string>();
  private buckets = new Map<string, Bucket>();
  private readonly tickMs: [number, number, number];
  private readonly autosaveMinMs: number;
  private readonly periodicMs: number;
  private readonly devTools: boolean;

  constructor(
    init: HostInit,
    private readonly out: HostOutput,
  ) {
    this.gameId = init.gameId;
    this.state = init.state;
    this.mode = init.mode;
    this.hostId = init.hostId;
    this.speed = Math.min(Math.max(1, init.speed || 1), 3) as Speed;
    this.playedSeconds = init.playedSeconds ?? 0;
    this.devTools = init.devTools;
    this.tickMs = init.tickMs ?? DEFAULT_TICKS;
    this.autosaveMinMs = (init.autosaveMinSeconds ?? 30) * 1000;
    this.periodicMs = (init.periodicSaveSeconds ?? 120) * 1000;
    for (const p of Object.values(this.state.players))
      this.lastPrivate.set(p.userId, JSON.stringify(privateViewFor(this.state, this.characterOf(p.userId))));
  }

  get maxSpeed(): 1 | 2 | 3 {
    return this.state.settings.maxSpeed;
  }

  characterOf(userId: string): string | null {
    const slot = this.state.players[userId];
    return slot && !slot.gameOver ? slot.characterId : null;
  }

  userOfCharacter(charId: string): string | null {
    for (const p of Object.values(this.state.players)) if (p.characterId === charId) return p.userId;
    return null;
  }

  clock(): ClockState {
    return {
      date: this.state.date,
      speed: this.paused ? 0 : this.speed,
      paused: this.paused,
      pauseReason: this.pauseReason,
      hostId: this.hostId,
      maxSpeed: this.maxSpeed,
    };
  }

  // -------------------------------------------------------------------------
  // Temps
  // -------------------------------------------------------------------------
  setSpeed(userId: string, speed: Speed): void {
    if (this.stopped || userId !== this.hostId) return;
    if (speed === 0) {
      this.setPaused(userId, true, 'player');
      return;
    }
    this.speed = Math.min(speed, this.maxSpeed) as Speed;
    if (this.paused) this.setPaused(userId, false);
    else {
      this.schedule();
      this.out.clock(this.clock());
    }
  }

  /** Tout joueur peut mettre en pause ; seul l'hôte relance. */
  setPaused(userId: string | null, paused: boolean, reason: string | null = 'player'): void {
    if (this.stopped) return;
    if (!paused && userId !== null && userId !== this.hostId) return;
    if (!paused && this.everyoneGameOver()) return;
    this.paused = paused;
    this.pauseReason = paused ? reason : null;
    if (paused) {
      this.accountPlayed();
      this.clearTimer();
      if (this.dirty) this.scheduleSave(2000);
    } else {
      this.runningSince ??= Date.now();
      this.schedule();
    }
    this.out.clock(this.clock());
  }

  private accountPlayed(): void {
    if (this.runningSince) {
      this.playedSeconds += Math.round((Date.now() - this.runningSince) / 1000);
      this.runningSince = null;
    }
  }

  private everyoneGameOver(): boolean {
    const players = Object.values(this.state.players);
    return players.length > 0 && players.every((p) => p.gameOver);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.clearTimer();
    if (this.paused || this.stopped) return;
    this.timer = setTimeout(() => this.tick(), this.tickMs[this.speed - 1] ?? 600);
  }

  tick(): void {
    this.timer = null;
    if (this.stopped) return;
    let result: StepResult;
    try {
      result = stepDay(this.state, { dev: this.devTools });
    } catch (err) {
      this.out.log('Échec du tick de simulation', String(err));
      this.setPaused(null, true, 'error');
      return;
    }
    this.applyStep(result);
    this.dirty = true;
    if (result.output.pauseRequested && this.mode === 'solo') this.setPaused(null, true, 'event');
    if (this.everyoneGameOver()) {
      this.setPaused(null, true, 'game_over');
      this.save('finished');
    } else if (
      this.state.settings.autosave &&
      isFirstOfMonth(this.state.date) &&
      Date.now() - this.lastSaveAt > this.autosaveMinMs
    ) {
      this.save('monthly');
    } else if (Date.now() - this.lastSaveAt > this.periodicMs) {
      this.save('periodic');
    }
    this.schedule();
  }

  advanceDays(days: number): void {
    for (let i = 0; i < days && !this.stopped; i++)
      this.applyStep(stepDay(this.state, { dev: this.devTools }));
    this.markDirty();
  }

  // -------------------------------------------------------------------------
  // Commandes
  // -------------------------------------------------------------------------
  handleCommand(userId: string, raw: unknown): AckMessage {
    const parsed = commandEnvelopeSchema.safeParse(raw);
    const commandId =
      typeof (raw as { commandId?: unknown })?.commandId === 'string'
        ? (raw as { commandId: string }).commandId
        : 'invalid';
    const base = { commandId, version: this.state.version };
    if (!parsed.success)
      return {
        ...base,
        ok: false,
        error: { code: ErrorCodes.INVALID_COMMAND, message: 'Commande invalide' },
      };
    const env = parsed.data;
    const cached = this.recentCommands.get(env.commandId);
    if (cached) return cached;
    if (userId !== this.hostId) {
      let bucket = this.buckets.get(userId);
      if (!bucket) this.buckets.set(userId, (bucket = new Bucket(15, 6)));
      if (!bucket.take())
        return { ...base, ok: false, error: { code: ErrorCodes.RATE_LIMITED, message: 'Trop de commandes' } };
    }
    if (env.command.type.startsWith('dev.') && !this.devTools)
      return {
        ...base,
        ok: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Outils de développement désactivés' },
      };
    const charId = this.characterOf(userId);
    if (!charId)
      return this.remember(env.commandId, {
        ...base,
        ok: false,
        error: { code: ErrorCodes.GAME_OVER, message: 'Vous ne contrôlez plus aucun personnage' },
      });
    if (env.expectedVersion !== undefined && this.state.version - env.expectedVersion > 2000) {
      return this.remember(env.commandId, {
        ...base,
        ok: false,
        error: {
          code: ErrorCodes.STALE_GAME_VERSION,
          message: 'État client obsolète, resynchronisation nécessaire',
        },
      });
    }
    try {
      const r = runCommand(this.state, charId, env.command, { dev: this.devTools });
      this.applyStep(r);
      if (r.output.pauseRequested && this.mode === 'solo') this.setPaused(null, true, 'event');
      this.markDirty();
      return this.remember(env.commandId, {
        commandId: env.commandId,
        ok: true,
        result: r.result,
        version: this.state.version,
      });
    } catch (err) {
      if (!isGameError(err)) {
        this.out.log('Erreur de commande', { type: env.command.type, err: String(err) });
        return { ...base, ok: false, error: { code: ErrorCodes.INTERNAL, message: 'Erreur interne' } };
      }
      return this.remember(env.commandId, {
        ...base,
        ok: false,
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
  }

  private remember(commandId: string, ack: AckMessage): AckMessage {
    this.recentCommands.set(commandId, ack);
    if (this.recentCommands.size > COMMAND_CACHE) {
      const first = this.recentCommands.keys().next().value;
      if (first !== undefined) this.recentCommands.delete(first);
    }
    return ack;
  }

  // -------------------------------------------------------------------------
  // Diffusion
  // -------------------------------------------------------------------------
  private applyStep(r: StepResult): void {
    this.state = r.state;
    this.seq++;
    const ops = publicPatches(
      r.patches as { op: string; path: (string | number)[]; value?: unknown }[],
      this.state,
    );
    const priv: Record<string, PrivateView> = {};
    for (const p of Object.values(this.state.players)) {
      const view = privateViewFor(this.state, this.characterOf(p.userId));
      const json = JSON.stringify(view);
      if (json !== this.lastPrivate.get(p.userId)) {
        this.lastPrivate.set(p.userId, json);
        priv[p.userId] = view;
      }
    }
    const notifs: Record<string, GameNotification[]> = {};
    for (const n of r.output.notifications) {
      for (const charId of n.to) {
        const userId = this.userOfCharacter(charId);
        if (userId) (notifs[userId] ??= []).push(n);
      }
    }
    for (const l of r.output.log)
      if (l.type === 'error') this.out.log('Erreur système de simulation', l.payload);
    this.out.step({ seq: this.seq, version: this.state.version, date: this.state.date, ops, priv, notifs });
  }

  /** Vue privée courante d'un joueur (resynchronisation). */
  privateFor(userId: string): PrivateView {
    return privateViewFor(this.state, this.characterOf(userId));
  }

  // -------------------------------------------------------------------------
  // Persistance
  // -------------------------------------------------------------------------
  private markDirty(): void {
    this.dirty = true;
    if (this.paused) this.scheduleSave(2000);
  }

  private scheduleSave(ms: number): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.dirty) this.save('debounced');
    }, ms);
  }

  /** Sauvegarde seulement si l'état a changé depuis la dernière. */
  saveIfDirty(reason: string): void {
    if (this.dirty) this.save(reason);
  }

  save(reason: string): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const running = this.runningSince ? Math.round((Date.now() - this.runningSince) / 1000) : 0;
    this.lastSaveAt = Date.now();
    this.dirty = false;
    const players = Object.values(this.state.players).map((p) => {
      const c = this.state.characters[p.characterId];
      const h = c?.houseId ? this.state.houses[c.houseId] : undefined;
      return {
        userId: p.userId,
        characterId: p.characterId,
        rulerName: c ? (h ? `${c.firstName} de ${h.name}` : c.firstName) : null,
      };
    });
    this.out.save({
      json: JSON.stringify(this.state),
      reason,
      seq: this.seq,
      speed: this.paused ? 0 : this.speed,
      playedSeconds: this.playedSeconds + running,
      finished: this.everyoneGameOver(),
      meta: { players },
    });
  }

  stop(): void {
    if (this.stopped) return;
    this.clearTimer();
    this.accountPlayed();
    this.paused = true;
    this.stopped = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}
