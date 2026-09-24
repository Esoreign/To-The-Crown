/**
 * Salle de jeu active : l'état vit en mémoire, le serveur est l'unique
 * autorité sur le temps et les mutations. Chaque étape (jour ou commande)
 * produit des patches diffusés à chaque client avec un numéro de séquence.
 */
import { isFirstOfMonth, type AckMessage, type ClockState, type CommandEnvelope, type GameState, type PatchOp, type PresenceEntry, type Speed, type StepOutput, ErrorCodes, isGameError } from '@ttc/shared';
import { privateViewFor, publicPatches, publicView, runCommand, stepDay, type StepResult } from '@ttc/game-core';
import type { FastifyBaseLogger } from 'fastify';
import type { Socket } from 'socket.io';
import type { GameRepository } from './repository';

export interface RoomDeps {
  repo: GameRepository;
  log: FastifyBaseLogger;
  tickMs: [number, number, number];
  autosaveMinSeconds: number;
  devTools: boolean;
}

interface Member {
  userId: string;
  displayName: string;
  isHost: boolean;
  sockets: Map<string, Socket>;
}

interface SocketState {
  userId: string;
  lastPrivate: string;
}

const COMMAND_CACHE = 500;

export class GameRoom {
  readonly gameId: string;
  state: GameState;
  seq = 0;
  speed: Speed = 1;
  paused = true;
  pauseReason: string | null = 'start';
  readonly mode: 'solo' | 'multiplayer';
  hostId: string;
  private members = new Map<string, Member>();
  private sockets = new Map<string, SocketState>();
  private timer: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastSaveAt = Date.now();
  private dirty = false;
  private persistChain: Promise<void> = Promise.resolve();
  private recentCommands = new Map<string, AckMessage>();
  private lastActivity = Date.now();
  private runningSince: number | null = null;
  playedSeconds: number;
  stopped = false;

  constructor(
    init: { gameId: string; state: GameState; mode: 'solo' | 'multiplayer'; hostId: string; speed?: number; playedSeconds?: number },
    private readonly deps: RoomDeps,
  ) {
    this.gameId = init.gameId;
    this.state = init.state;
    this.mode = init.mode;
    this.hostId = init.hostId;
    this.speed = (Math.min(Math.max(1, init.speed || 1), 3) as Speed) || 1;
    this.playedSeconds = init.playedSeconds ?? 0;
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
    return { date: this.state.date, speed: this.paused ? 0 : this.speed, paused: this.paused, pauseReason: this.pauseReason, hostId: this.hostId, maxSpeed: this.maxSpeed };
  }

  presence(): PresenceEntry[] {
    return Object.values(this.state.players).map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      characterId: p.gameOver ? null : p.characterId,
      online: (this.members.get(p.userId)?.sockets.size ?? 0) > 0,
      isHost: p.userId === this.hostId,
    }));
  }

  onlineCount(): number {
    let n = 0;
    for (const m of this.members.values()) if (m.sockets.size) n++;
    return n;
  }

  idleFor(): number {
    return this.onlineCount() ? 0 : Date.now() - this.lastActivity;
  }

  // -------------------------------------------------------------------------
  // Connexions
  // -------------------------------------------------------------------------
  join(socket: Socket, userId: string, displayName: string): void {
    if (!this.state.players[userId]) throw Object.assign(new Error('not member'), { code: ErrorCodes.NOT_GAME_MEMBER });
    let m = this.members.get(userId);
    if (!m) {
      m = { userId, displayName, isHost: userId === this.hostId, sockets: new Map() };
      this.members.set(userId, m);
    }
    m.sockets.set(socket.id, socket);
    this.sockets.set(socket.id, { userId, lastPrivate: '' });
    void socket.join(`game:${this.gameId}`);
    this.lastActivity = Date.now();
    this.sendSnapshot(socket);
    this.broadcastPresence();
    this.broadcastClock();
  }

  leave(socketId: string): void {
    const st = this.sockets.get(socketId);
    if (!st) return;
    this.sockets.delete(socketId);
    const m = this.members.get(st.userId);
    m?.sockets.delete(socketId);
    this.lastActivity = Date.now();
    this.broadcastPresence();
    // Plus aucun joueur connecté : pause de sécurité.
    if (this.onlineCount() === 0 && !this.paused) this.setPaused(null, true, 'no_players');
  }

  sendSnapshot(socket: Socket): void {
    const st = this.sockets.get(socket.id);
    if (!st) return;
    const charId = this.characterOf(st.userId);
    const priv = privateViewFor(this.state, charId);
    st.lastPrivate = JSON.stringify(priv);
    socket.emit('game:snapshot', {
      gameId: this.gameId,
      seq: this.seq,
      version: this.state.version,
      view: publicView(this.state),
      privateView: priv,
      clock: this.clock(),
      you: { userId: st.userId, characterId: charId },
      presence: this.presence(),
      devTools: this.deps.devTools,
    });
  }

  private broadcastPresence(): void {
    const p = this.presence();
    for (const m of this.members.values()) for (const s of m.sockets.values()) s.emit('presence:update', p);
  }

  private broadcastClock(): void {
    const c = this.clock();
    for (const m of this.members.values()) for (const s of m.sockets.values()) s.emit('time:update', c);
  }

  // -------------------------------------------------------------------------
  // Temps
  // -------------------------------------------------------------------------
  setSpeed(userId: string, speed: Speed): void {
    if (this.stopped) return;
    if (userId !== this.hostId) return;
    if (speed === 0) {
      this.setPaused(userId, true, 'player');
      return;
    }
    this.speed = Math.min(speed, this.maxSpeed) as Speed;
    if (this.paused) this.setPaused(userId, false);
    else {
      this.schedule();
      this.broadcastClock();
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
      if (this.runningSince) {
        this.playedSeconds += Math.round((Date.now() - this.runningSince) / 1000);
        this.runningSince = null;
      }
      this.clearTimer();
      if (this.dirty) this.scheduleSave(3000);
    } else {
      this.runningSince ??= Date.now();
      this.schedule();
    }
    this.broadcastClock();
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
    const ms = this.deps.tickMs[this.speed - 1] ?? 600;
    this.timer = setTimeout(() => this.tick(), ms);
  }

  /** Avance d'un jour (également utilisé par les outils de développement). */
  tick(): void {
    this.timer = null;
    if (this.stopped) return;
    let result: StepResult;
    try {
      result = stepDay(this.state, { dev: this.deps.devTools });
    } catch (err) {
      this.deps.log.error({ err, gameId: this.gameId }, 'Échec du tick de simulation');
      this.setPaused(null, true, 'error');
      return;
    }
    this.applyStep(result);
    if (result.output.pauseRequested && this.mode === 'solo') this.setPaused(null, true, 'event');
    if (this.everyoneGameOver()) {
      this.setPaused(null, true, 'game_over');
      void this.deps.repo.setStatus(this.gameId, 'finished').catch((err) => this.deps.log.error({ err }, 'setStatus'));
    }
    if (isFirstOfMonth(this.state.date) && this.state.settings.autosave && Date.now() - this.lastSaveAt > this.deps.autosaveMinSeconds * 1000) {
      void this.save('monthly');
    }
    this.schedule();
  }

  advanceDays(days: number): void {
    for (let i = 0; i < days && !this.stopped; i++) {
      const r = stepDay(this.state, { dev: this.deps.devTools });
      this.applyStep(r);
    }
  }

  // -------------------------------------------------------------------------
  // Commandes
  // -------------------------------------------------------------------------
  handleCommand(userId: string, env: CommandEnvelope): AckMessage {
    const cached = this.recentCommands.get(env.commandId);
    if (cached) return cached;
    this.lastActivity = Date.now();
    const charId = this.characterOf(userId);
    const base = { commandId: env.commandId, version: this.state.version };
    if (!charId) return this.remember(env.commandId, { ...base, ok: false, error: { code: ErrorCodes.GAME_OVER, message: 'Vous ne contrôlez plus aucun personnage' } });
    if (env.expectedVersion !== undefined && this.state.version - env.expectedVersion > 2000) {
      return this.remember(env.commandId, { ...base, ok: false, error: { code: ErrorCodes.STALE_GAME_VERSION, message: 'État client obsolète, resynchronisation nécessaire' } });
    }
    const date = this.state.date;
    try {
      const r = runCommand(this.state, charId, env.command, { dev: this.deps.devTools });
      this.applyStep(r);
      const ack: AckMessage = { commandId: env.commandId, ok: true, result: r.result, version: this.state.version };
      this.persist(() =>
        this.deps.repo.recordCommand({
          gameId: this.gameId,
          commandId: env.commandId,
          userId,
          characterId: charId,
          type: env.command.type,
          payload: env.command.payload as Record<string, unknown>,
          status: 'ok',
          gameVersion: this.state.version,
          gameDate: date,
        }),
      );
      if (r.output.pauseRequested && this.mode === 'solo') this.setPaused(null, true, 'event');
      this.markDirty();
      return this.remember(env.commandId, ack);
    } catch (err) {
      if (!isGameError(err)) {
        this.deps.log.error({ err, gameId: this.gameId, commandId: env.commandId, type: env.command.type }, 'Erreur de commande');
        return { ...base, ok: false, error: { code: ErrorCodes.INTERNAL, message: 'Erreur interne' } };
      }
      this.persist(() =>
        this.deps.repo.recordCommand({
          gameId: this.gameId,
          commandId: env.commandId,
          userId,
          characterId: charId,
          type: env.command.type,
          payload: env.command.payload as Record<string, unknown>,
          status: 'rejected',
          errorCode: err.code,
          gameVersion: this.state.version,
          gameDate: date,
        }),
      );
      return this.remember(env.commandId, { ...base, ok: false, error: { code: err.code, message: err.message, details: err.details } });
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
    const ops: PatchOp[] = publicPatches(r.patches as { op: string; path: (string | number)[]; value?: unknown }[], this.state);
    for (const [socketId, st] of this.sockets) {
      const m = this.members.get(st.userId);
      const socket = m?.sockets.get(socketId);
      if (!socket) continue;
      const priv = privateViewFor(this.state, this.characterOf(st.userId));
      const json = JSON.stringify(priv);
      const changed = json !== st.lastPrivate;
      if (changed) st.lastPrivate = json;
      socket.emit('game:patch', { gameId: this.gameId, seq: this.seq, version: this.state.version, ops, date: this.state.date, ...(changed ? { privateView: priv } : {}) });
    }
    this.dispatchOutput(r.output);
  }

  private dispatchOutput(out: StepOutput): void {
    if (out.notifications.length) {
      const perUser = new Map<string, typeof out.notifications>();
      const rows: { userId: string; characterId: string; n: (typeof out.notifications)[number] }[] = [];
      for (const n of out.notifications) {
        for (const charId of n.to) {
          const userId = this.userOfCharacter(charId);
          if (!userId) continue;
          (perUser.get(userId) ?? perUser.set(userId, []).get(userId)!).push(n);
          rows.push({ userId, characterId: charId, n });
        }
      }
      for (const [userId, list] of perUser) {
        const m = this.members.get(userId);
        if (m) for (const s of m.sockets.values()) s.emit('notification:new', list);
      }
      this.persist(() => this.deps.repo.appendNotifications(this.gameId, rows));
    }
    const logs = out.log.filter((l) => l.type !== 'command');
    if (logs.length) {
      const seq = this.seq;
      this.persist(() => this.deps.repo.appendLog(this.gameId, seq, logs));
      for (const l of logs) if (l.type === 'error') this.deps.log.warn({ gameId: this.gameId, payload: l.payload }, 'Erreur système de simulation');
    }
  }

  // -------------------------------------------------------------------------
  // Persistance
  // -------------------------------------------------------------------------
  private persist(fn: () => Promise<unknown>): void {
    this.persistChain = this.persistChain.then(fn).then(
      () => undefined,
      (err: unknown) => {
        this.deps.log.error({ err, gameId: this.gameId }, 'Échec de persistance');
      },
    );
  }

  private markDirty(): void {
    this.dirty = true;
    if (this.paused) this.scheduleSave(3000);
  }

  private scheduleSave(ms: number): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.save('debounced');
    }, ms);
  }

  save(reason: string, projection = true): Promise<void> {
    const snapshot = this.state;
    const played = this.playedSeconds + (this.runningSince ? Math.round((Date.now() - this.runningSince) / 1000) : 0);
    this.lastSaveAt = Date.now();
    this.dirty = false;
    const speed = this.paused ? 0 : this.speed;
    this.persist(() => this.deps.repo.saveSnapshot(this.gameId, snapshot, reason, { projection, speed, playedSeconds: played }));
    return this.persistChain;
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.setPaused(null, true, 'shutdown');
    this.stopped = true;
    this.clearTimer();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    await this.save('shutdown');
    await this.persistChain;
  }

  flush(): Promise<void> {
    return this.persistChain;
  }

  socketsOf(userId: string): Socket[] {
    return [...(this.members.get(userId)?.sockets.values() ?? [])];
  }

  allSockets(): Socket[] {
    return [...this.members.values()].flatMap((m) => [...m.sockets.values()]);
  }
}
