/**
 * Gestion des salles actives : chargement paresseux depuis le dernier
 * snapshot, déchargement des salles inactives, arrêt gracieux.
 */
import type { GameState } from '@ttc/shared';
import type { GameRepository } from './repository';
import { GameRoom, type RoomDeps } from './room';

const IDLE_UNLOAD_MS = 5 * 60_000;

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private loading = new Map<string, Promise<GameRoom | null>>();
  private sweeper: NodeJS.Timeout;

  constructor(
    private readonly repo: GameRepository,
    private readonly deps: RoomDeps,
  ) {
    this.sweeper = setInterval(() => void this.sweep(), 60_000);
    this.sweeper.unref();
  }

  get(gameId: string): GameRoom | undefined {
    return this.rooms.get(gameId);
  }

  list(): GameRoom[] {
    return [...this.rooms.values()];
  }

  create(init: { gameId: string; state: GameState; mode: 'solo' | 'multiplayer'; hostId: string }): GameRoom {
    const room = new GameRoom(init, this.deps);
    this.rooms.set(init.gameId, room);
    return room;
  }

  /** Charge (une seule fois) une partie en cours depuis la base. */
  async load(gameId: string): Promise<GameRoom | null> {
    const existing = this.rooms.get(gameId);
    if (existing) return existing;
    const pending = this.loading.get(gameId);
    if (pending) return pending;
    const p = (async () => {
      const game = await this.repo.getGame(gameId);
      if (!game || game.status === 'lobby') return null;
      const state = await this.repo.loadLatestSnapshot(gameId);
      if (!state) return null;
      const room = new GameRoom(
        { gameId, state, mode: game.mode as 'solo' | 'multiplayer', hostId: game.hostId, speed: game.speed, playedSeconds: game.playedSeconds },
        this.deps,
      );
      this.rooms.set(gameId, room);
      this.deps.log.info({ gameId, date: state.date }, 'Partie chargée depuis le snapshot');
      return room;
    })();
    this.loading.set(gameId, p);
    try {
      return await p;
    } finally {
      this.loading.delete(gameId);
    }
  }

  async unload(gameId: string): Promise<void> {
    const room = this.rooms.get(gameId);
    if (!room) return;
    this.rooms.delete(gameId);
    await room.stop();
  }

  private async sweep(): Promise<void> {
    for (const room of this.rooms.values()) {
      if (room.idleFor() > IDLE_UNLOAD_MS) {
        this.deps.log.info({ gameId: room.gameId }, 'Déchargement de la partie inactive');
        await this.unload(room.gameId).catch((err: unknown) => this.deps.log.error({ err }, 'unload'));
      }
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.sweeper);
    await Promise.all([...this.rooms.keys()].map((id) => this.unload(id)));
  }
}
