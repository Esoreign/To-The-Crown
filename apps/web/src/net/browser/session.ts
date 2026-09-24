/**
 * Partie en mode sans serveur.
 *
 * - L'hôte (créateur de la partie) fait tourner la simulation dans un Web
 *   Worker, applique ses propres patches comme s'ils venaient d'un serveur,
 *   diffuse des lots de patches aux invités sur un canal Supabase Realtime et
 *   enregistre l'état dans Supabase.
 * - Les invités chargent la dernière sauvegarde, appliquent les lots reçus,
 *   envoient leurs commandes à l'hôte et attendent son accusé.
 *
 * Un trou de séquence ou un nouvel hôte (autre « époque ») déclenche un
 * rechargement depuis la sauvegarde la plus récente.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { migrateSnapshot, privateViewFor, publicView } from '@ttc/game-core';
import {
  ErrorCodes,
  isGameError,
  type AckMessage,
  type ChatMessage,
  type ClockState,
  type ErrorCode,
  type GameCommand,
  type GameNotification,
  type PresenceEntry,
  type PrivateView,
  type Speed,
} from '@ttc/shared';
import { useGame } from '../../state/game';
import { pushToast } from '../../state/ui';
import { playSound } from '../../audio/audio';
import { errorMessage } from '../../lib/i18n';
import { ApiFailure } from '../failure';
import { mergeChat } from './lobby';
import { getToken, rpc, rpcAuth, supabase } from './supabase';
import type { HostSave, HostStep } from './hostRoom';
import type { ChannelMessage, WirePatch, WorkerIn, WorkerOut } from './protocol';

const FLUSH_MS = 400;
/** Taille maximale d'un message Realtime (limite Supabase gratuite : 256 Ko). */
const MAX_MESSAGE = 180_000;
const COMMAND_TIMEOUT = 10_000;
const DEV_TOOLS = import.meta.env.DEV;

interface SnapshotRow {
  id: number;
  meta: { epoch?: string; seq?: number };
  state: Record<string, unknown>;
}

interface Bootstrap {
  you: string;
  game: {
    id: string;
    mode: 'solo' | 'multiplayer';
    status: 'lobby' | 'running' | 'finished';
    hostId: string;
    seed: number;
    scenarioId: string;
    settings: {
      maxSpeed: 1 | 2 | 3;
      autosave: boolean;
      aiDifficulty: 'easy' | 'normal' | 'hard';
      eventFrequency: 'low' | 'normal' | 'high';
    };
    speed: number;
    playedSeconds: number;
    inviteCode: string | null;
  };
  players: { userId: string; displayName: string; characterId: string | null }[];
  snapshot: SnapshotRow | null;
  chat: ChatMessage[];
}

interface Batch {
  epoch: string;
  patches: WirePatch[];
  priv: Record<string, PrivateView>;
  notifs: Record<string, GameNotification[]>;
  clock: ClockState;
}

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fail(code: ErrorCode, message: string): AckMessage {
  return { commandId: '', ok: false, error: { code, message }, version: 0 };
}

export class BrowserSession {
  private closed = false;
  private boot: Bootstrap | null = null;
  private userId = '';
  private hostId = '';
  private isHost = false;
  private channel: RealtimeChannel | null = null;
  private online = new Set<string>();
  private readonly listeners: (() => void)[] = [];
  // Hôte
  private worker: Worker | null = null;
  private readonly epoch = uuid();
  private readonly localAcks = new Map<string, (ack: AckMessage) => void>();
  private batch: WirePatch[] = [];
  private batchPriv: Record<string, PrivateView> = {};
  private batchNotifs: Record<string, GameNotification[]> = {};
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFlush = 0;
  private saveChain: Promise<void> = Promise.resolve();
  private savesInFlight = 0;
  private lastSaved: { id: number; seq: number } | null = null;
  private snapWanted: number | null = null;
  private saveErrorShown = false;
  private stopping = false;
  private finalSaveQueued = false;
  // Invité
  private hostEpoch: string | null = null;
  private buffer: Batch[] = [];
  private loading = false;
  private lastHello = 0;
  private readonly guestAcks = new Map<string, (ack: AckMessage) => void>();
  private hostClock: ClockState | null = null;

  constructor(readonly gameId: string) {}

  // -------------------------------------------------------------------------
  // Ouverture
  // -------------------------------------------------------------------------
  async open(): Promise<void> {
    let boot: Bootstrap;
    try {
      boot = await rpcAuth<Bootstrap>('ttc_bootstrap', { p_game: this.gameId });
    } catch (e) {
      return this.fatal(
        e instanceof ApiFailure ? e.code : 'INTERNAL',
        e instanceof Error ? e.message : 'Erreur',
      );
    }
    if (this.closed) return;
    this.boot = boot;
    this.userId = boot.you;
    this.hostId = boot.game.hostId;
    this.isHost = boot.you === boot.game.hostId;
    useGame.setState({ chat: boot.chat });
    if (boot.game.status === 'lobby')
      return this.fatal(ErrorCodes.GAME_NOT_STARTED, 'La partie n’a pas commencé');
    if (this.isHost) this.startHost(boot);
    else await this.startGuest(boot);
  }

  private fatal(code: string, message: string): void {
    if (this.closed) return;
    useGame.setState({ status: 'error', error: errorMessage(code, message) });
  }

  private openChannel(): void {
    const code = this.boot?.game.inviteCode ?? 'solo';
    const channel = supabase().channel(`ttc:${this.gameId}:${code}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.userId } },
    });
    channel.on('broadcast', { event: 'm' }, ({ payload }) => this.onMessage(payload as ChannelMessage));
    channel.on('presence', { event: 'sync' }, () => {
      this.online = new Set(Object.keys(channel.presenceState()));
      this.online.add(this.userId);
      this.refreshPresence();
      if (!this.isHost) this.onHostPresence();
    });
    channel.subscribe((status) => {
      if (this.closed) return;
      if (status === 'SUBSCRIBED') {
        void channel.track({ userId: this.userId, at: Date.now() });
        if (this.isHost) this.requestSnapshot();
        else this.sendHello(true);
        if (useGame.getState().status === 'reconnecting') useGame.setState({ status: 'connected' });
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && useGame.getState().view) {
        useGame.setState({ status: 'reconnecting' });
      }
    });
    this.channel = channel;
  }

  private send(msg: ChannelMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'm', payload: msg });
  }

  private presence(): PresenceEntry[] {
    const view = useGame.getState().view;
    if (!view) return [];
    return Object.values(view.players).map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      characterId: p.gameOver ? null : p.characterId,
      online: this.online.has(p.userId) || p.userId === this.userId,
      isHost: p.userId === this.hostId,
    }));
  }

  private refreshPresence(): void {
    useGame.setState({ presence: this.presence() });
  }

  private onMessage(msg: ChannelMessage): void {
    if (this.closed) return;
    if (msg.t === 'chat') {
      if (msg.msg.gameId === this.gameId) mergeChat([msg.msg], this.userId);
      return;
    }
    if (this.isHost) this.hostMessage(msg);
    else this.guestMessage(msg);
  }

  // -------------------------------------------------------------------------
  // Hôte
  // -------------------------------------------------------------------------
  private startHost(boot: Bootstrap): void {
    const missing = boot.players.find((p) => !p.characterId);
    if (!boot.snapshot && missing)
      return this.fatal(ErrorCodes.PLAYERS_NOT_READY, 'Tous les joueurs doivent choisir un souverain');
    const worker = new Worker(new URL('./host.worker.ts', import.meta.url), {
      type: 'module',
      name: 'ttc-simulation',
    });
    this.worker = worker;
    worker.onmessage = (e: MessageEvent<WorkerOut>) => this.fromWorker(e.data);
    worker.onerror = (e) => {
      console.error('Simulation', e.message);
      this.fatal(ErrorCodes.INTERNAL, 'La simulation s’est arrêtée');
    };
    const s = boot.game.settings;
    this.post({
      t: 'init',
      gameId: this.gameId,
      mode: boot.game.mode,
      hostId: this.hostId,
      devTools: DEV_TOOLS,
      speed: boot.game.speed,
      playedSeconds: boot.game.playedSeconds,
      state: boot.snapshot?.state ?? null,
      create: boot.snapshot
        ? null
        : {
            scenarioId: boot.game.scenarioId,
            seed: boot.game.seed,
            settings: {
              maxSpeed: s.maxSpeed,
              autosave: s.autosave,
              aiDifficulty: s.aiDifficulty,
              eventFrequency: s.eventFrequency,
            },
            players: boot.players.map((p) => ({
              userId: p.userId,
              displayName: p.displayName,
              characterId: p.characterId!,
            })),
          },
    });
    const onHidden = () => {
      if (document.visibilityState === 'hidden') this.post({ t: 'save', reason: 'hidden', ifDirty: true });
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      this.post({ t: 'save', reason: 'unload', ifDirty: true });
      const clock = useGame.getState().clock;
      // Fermer la page de l'hôte arrête la partie pour tout le monde : on confirme.
      if (clock && !clock.paused) e.preventDefault();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', onUnload);
    this.listeners.push(
      () => document.removeEventListener('visibilitychange', onHidden),
      () => window.removeEventListener('beforeunload', onUnload),
    );
  }

  private post(msg: WorkerIn): void {
    this.worker?.postMessage(msg);
  }

  private fromWorker(msg: WorkerOut): void {
    switch (msg.t) {
      case 'ready': {
        if (this.closed) return;
        const slot = msg.view.players[this.userId];
        this.online.add(this.userId);
        useGame.getState().applySnapshot({
          gameId: this.gameId,
          seq: msg.seq,
          version: msg.version,
          view: msg.view,
          privateView: msg.priv,
          clock: msg.clock,
          you: { userId: this.userId, characterId: slot && !slot.gameOver ? slot.characterId : null },
          presence: [],
          devTools: DEV_TOOLS,
        });
        this.refreshPresence();
        if (this.boot?.game.mode === 'multiplayer') this.openChannel();
        break;
      }
      case 'step':
        this.onStep(msg.step);
        break;
      case 'clock':
        if (this.closed) return;
        useGame.setState({ clock: msg.clock });
        this.send({ t: 'clock', epoch: this.epoch, clock: msg.clock });
        break;
      case 'ack': {
        if (msg.userId === this.userId) {
          this.localAcks.get(msg.id)?.(msg.ack);
          this.localAcks.delete(msg.id);
        } else this.send({ t: 'ack', to: msg.userId, ack: msg.ack });
        break;
      }
      case 'save':
        if (this.stopping && msg.save.reason === 'leave') this.finalSaveQueued = true;
        this.upload(msg.save);
        break;
      case 'log':
        console.warn('[simulation]', msg.message, msg.details ?? '');
        break;
      case 'fatal':
        this.fatal(msg.code, msg.message);
        break;
    }
  }

  private onStep(step: HostStep): void {
    if (this.closed) return;
    const store = useGame.getState();
    store.applyPatch({
      gameId: this.gameId,
      seq: step.seq,
      version: step.version,
      date: step.date,
      ops: step.ops,
      ...(step.priv[this.userId] ? { privateView: step.priv[this.userId] } : {}),
    });
    const mine = step.notifs[this.userId];
    if (mine?.length) this.notify(mine);
    if (step.ops.some((o) => o.path[0] === 'players')) this.refreshPresence();
    if (!this.channel) return;
    this.batch.push({ seq: step.seq, version: step.version, date: step.date, ops: step.ops });
    for (const [uid, view] of Object.entries(step.priv)) if (uid !== this.userId) this.batchPriv[uid] = view;
    for (const [uid, list] of Object.entries(step.notifs))
      if (uid !== this.userId) (this.batchNotifs[uid] ??= []).push(...list);
    if (performance.now() - this.lastFlush >= FLUSH_MS) this.flush();
    else this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_MS);
  }

  private flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.lastFlush = performance.now();
    const clock = useGame.getState().clock;
    if (!this.batch.length || !clock) return;
    const patches = this.batch;
    const priv = this.batchPriv;
    const notifs = this.batchNotifs;
    this.batch = [];
    this.batchPriv = {};
    this.batchNotifs = {};
    const whole: ChannelMessage = { t: 'batch', epoch: this.epoch, patches, priv, notifs, clock };
    if (JSON.stringify(whole).length <= MAX_MESSAGE) return this.send(whole);
    // Trop gros pour un seul message : découpage ; un patch isolé trop gros force un rechargement.
    let chunk: WirePatch[] = [];
    let size = 0;
    const chunks: WirePatch[][] = [];
    for (const p of patches) {
      const s = JSON.stringify(p).length;
      if (s > MAX_MESSAGE) {
        this.requestSnapshot();
        return;
      }
      if (size + s > MAX_MESSAGE && chunk.length) {
        chunks.push(chunk);
        chunk = [];
        size = 0;
      }
      chunk.push(p);
      size += s;
    }
    if (chunk.length) chunks.push(chunk);
    chunks.forEach((c, i) => {
      const last = i === chunks.length - 1;
      this.send({
        t: 'batch',
        epoch: this.epoch,
        patches: c,
        priv: last ? priv : {},
        notifs: last ? notifs : {},
        clock,
      });
    });
  }

  private hostMessage(msg: ChannelMessage): void {
    switch (msg.t) {
      case 'hello':
        this.requestSnapshot();
        break;
      case 'cmd':
        if (this.isPlayer(msg.from)) this.post({ t: 'cmd', id: uuid(), userId: msg.from, env: msg.env });
        break;
      case 'pause':
        if (this.isPlayer(msg.from)) this.post({ t: 'pause', userId: msg.from, paused: msg.paused });
        break;
      default:
        break;
    }
  }

  private isPlayer(userId: string): boolean {
    return !!useGame.getState().view?.players[userId];
  }

  /** Enregistre l'état courant puis annonce aux invités qu'ils peuvent le charger. */
  private requestSnapshot(): void {
    const seq = useGame.getState().seq;
    if (this.lastSaved && this.lastSaved.seq >= seq && this.savesInFlight === 0) {
      this.announce(this.lastSaved);
      return;
    }
    if (this.snapWanted !== null && this.snapWanted >= seq) return;
    this.snapWanted = seq;
    this.post({ t: 'save', reason: 'sync' });
  }

  private announce(saved: { id: number; seq: number }): void {
    const clock = useGame.getState().clock;
    if (clock) this.send({ t: 'snap', epoch: this.epoch, seq: saved.seq, id: saved.id, clock });
  }

  private upload(save: HostSave): void {
    const token = getToken() ?? '';
    const meta = { ...save.meta, epoch: this.epoch, seq: save.seq };
    const body =
      `{"p_token":${JSON.stringify(token)},"p_game":${JSON.stringify(this.gameId)},"p_reason":${JSON.stringify(save.reason)},` +
      `"p_meta":${JSON.stringify(meta)},"p_speed":${save.speed},"p_played":${save.playedSeconds},"p_finished":${save.finished},"p_state":${save.json}}`;
    this.savesInFlight++;
    this.saveChain = this.saveChain
      .then(async () => {
        const r = await rpc<{ id: number }>('ttc_save', {}, body);
        this.lastSaved = { id: r.id, seq: save.seq };
        this.saveErrorShown = false;
        if (this.snapWanted !== null && save.seq >= this.snapWanted) {
          this.snapWanted = null;
          this.announce(this.lastSaved);
        }
      })
      .catch((err: unknown) => {
        console.warn('Sauvegarde', err instanceof Error ? err.message : err);
        if (!this.saveErrorShown && !this.closed) {
          this.saveErrorShown = true;
          pushToast({ kind: 'error', text: 'Échec de la sauvegarde : vérifiez votre connexion.' });
        }
      })
      .finally(() => {
        this.savesInFlight--;
        if (this.stopping && this.finalSaveQueued && this.savesInFlight === 0) this.dispose();
      });
  }

  // -------------------------------------------------------------------------
  // Invité
  // -------------------------------------------------------------------------
  private async startGuest(boot: Bootstrap): Promise<void> {
    this.openChannel();
    if (boot.snapshot) this.loadSnapshot(boot.snapshot);
  }

  private pausedClock(date: number, maxSpeed: 1 | 2 | 3): ClockState {
    return { date, speed: 0, paused: true, pauseReason: 'host_offline', hostId: this.hostId, maxSpeed };
  }

  private hostOnline(): boolean {
    return this.online.has(this.hostId);
  }

  private onHostPresence(): void {
    const s = useGame.getState();
    if (!s.clock) return;
    if (!this.hostOnline()) useGame.setState({ clock: this.pausedClock(s.clock.date, s.clock.maxSpeed) });
    else if (this.hostClock) useGame.setState({ clock: this.hostClock });
  }

  private sendHello(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHello < 2500) return;
    this.lastHello = now;
    this.send({ t: 'hello', from: this.userId });
  }

  private loadSnapshot(snap: SnapshotRow): void {
    let state;
    try {
      state = migrateSnapshot(snap.state);
    } catch (err) {
      return this.fatal(
        isGameError(err) ? err.code : ErrorCodes.INTERNAL,
        isGameError(err) ? err.message : 'Sauvegarde illisible',
      );
    }
    const slot = state.players[this.userId];
    const charId = slot && !slot.gameOver ? slot.characterId : null;
    const seq = snap.meta.seq ?? 0;
    this.hostEpoch = snap.meta.epoch ?? null;
    const clock =
      this.hostClock && this.hostOnline()
        ? { ...this.hostClock, date: state.date }
        : this.pausedClock(state.date, state.settings.maxSpeed);
    useGame.getState().applySnapshot({
      gameId: this.gameId,
      seq,
      version: state.version,
      view: publicView(state),
      privateView: privateViewFor(state, charId),
      clock,
      you: { userId: this.userId, characterId: charId },
      presence: [],
      devTools: false,
    });
    this.refreshPresence();
    const pending = this.buffer;
    this.buffer = [];
    for (const b of pending) if (b.epoch === this.hostEpoch) this.applyBatch(b);
  }

  private async reload(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const boot = await rpcAuth<Bootstrap>('ttc_bootstrap', { p_game: this.gameId });
      if (!this.closed && boot.snapshot) this.loadSnapshot(boot.snapshot);
    } catch (e) {
      if (e instanceof ApiFailure && e.code === ErrorCodes.NOT_GAME_MEMBER) this.fatal(e.code, e.message);
    } finally {
      this.loading = false;
    }
  }

  private guestMessage(msg: ChannelMessage): void {
    switch (msg.t) {
      case 'batch':
        this.hostClock = msg.clock;
        if (this.loading || msg.epoch !== this.hostEpoch) {
          this.buffer.push(msg);
          if (this.buffer.length > 300) this.buffer.shift();
          if (!this.loading) this.sendHello();
          return;
        }
        this.applyBatch(msg);
        break;
      case 'snap': {
        this.hostClock = msg.clock;
        const s = useGame.getState();
        if (msg.epoch === this.hostEpoch && s.view && s.seq >= msg.seq) {
          useGame.setState({ clock: msg.clock });
          return;
        }
        void this.reload();
        break;
      }
      case 'clock':
        this.hostClock = msg.clock;
        if (msg.epoch === this.hostEpoch) useGame.setState({ clock: msg.clock });
        break;
      case 'ack':
        if (msg.to === this.userId) {
          this.guestAcks.get(msg.ack.commandId)?.(msg.ack);
          this.guestAcks.delete(msg.ack.commandId);
        }
        break;
      default:
        break;
    }
  }

  private applyBatch(b: Batch): void {
    const store = useGame.getState();
    const mine = b.priv[this.userId];
    for (let i = 0; i < b.patches.length; i++) {
      const p = b.patches[i]!;
      const last = i === b.patches.length - 1;
      const res = store.applyPatch({
        gameId: this.gameId,
        ...p,
        ...(last && mine ? { privateView: mine } : {}),
      });
      if (res === 'gap') {
        this.buffer.push({ ...b, patches: b.patches.slice(i) });
        this.sendHello();
        return;
      }
    }
    useGame.setState({ clock: b.clock });
    if (b.patches.some((p) => p.ops.some((o) => o.path[0] === 'players'))) this.refreshPresence();
    const notifs = b.notifs[this.userId];
    if (notifs?.length) this.notify(notifs);
  }

  // -------------------------------------------------------------------------
  // Commun
  // -------------------------------------------------------------------------
  private notify(list: GameNotification[]): void {
    useGame.getState().pushNotifications(list);
    const loud = list.find((n) => n.sound);
    if (loud?.sound) playSound(loud.sound);
  }

  sendCommand(command: GameCommand): Promise<AckMessage> {
    const commandId = uuid();
    const env = { commandId, expectedVersion: useGame.getState().view?.version, command };
    return new Promise((resolve) => {
      const done = (ack: AckMessage) => {
        clearTimeout(timer);
        resolve(ack);
      };
      const timer = setTimeout(() => {
        this.localAcks.delete(commandId);
        this.guestAcks.delete(commandId);
        resolve({ ...fail(ErrorCodes.INTERNAL, 'Délai dépassé'), commandId });
      }, COMMAND_TIMEOUT);
      if (this.isHost) {
        this.localAcks.set(commandId, done);
        this.post({ t: 'cmd', id: commandId, userId: this.userId, env });
      } else if (!this.hostOnline()) {
        done({ ...fail(ErrorCodes.HOST_OFFLINE, 'L’hôte n’est pas connecté'), commandId });
      } else {
        this.guestAcks.set(commandId, done);
        this.send({ t: 'cmd', from: this.userId, env });
      }
    });
  }

  setSpeed(speed: Speed): void {
    if (this.isHost) this.post({ t: 'speed', userId: this.userId, speed });
  }

  requestPause(paused: boolean): void {
    if (this.isHost) this.post({ t: 'pause', userId: this.userId, paused });
    else this.send({ t: 'pause', from: this.userId, paused });
  }

  devAdvance(days: number): void {
    if (this.isHost) this.post({ t: 'advance', days });
  }

  async chat(text: string): Promise<boolean> {
    try {
      const msg = await rpcAuth<ChatMessage>('ttc_chat_send', { p_game: this.gameId, p_text: text });
      mergeChat([msg], this.userId);
      this.send({ t: 'chat', msg });
      return true;
    } catch (e) {
      pushToast({
        kind: 'error',
        text: e instanceof ApiFailure ? errorMessage(e.code, e.message) : 'Erreur inattendue',
      });
      return false;
    }
  }

  /** Quitte la partie ; l'hôte enregistre avant d'arrêter la simulation. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const off of this.listeners) off();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flush();
    for (const [, resolve] of this.localAcks) resolve(fail(ErrorCodes.INTERNAL, 'Partie quittée'));
    for (const [, resolve] of this.guestAcks) resolve(fail(ErrorCodes.INTERNAL, 'Partie quittée'));
    if (this.worker) {
      this.stopping = true;
      this.post({ t: 'stop', reason: 'leave' });
      // La dernière sauvegarde arrive du worker puis est envoyée avant la fermeture.
      setTimeout(() => this.dispose(), 30_000);
    } else this.dispose();
  }

  private dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    const ch = this.channel;
    this.channel = null;
    if (ch) void supabase().removeChannel(ch);
  }
}
