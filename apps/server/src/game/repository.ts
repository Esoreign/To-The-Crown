/**
 * Accès base de données pour les parties : lobby, snapshots, journaux.
 */
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import {
  ErrorCodes,
  SAVE_SCHEMA_VERSION,
  type ChatMessage,
  type GameLogEntry,
  type GameNotification,
  type GameState,
  type GameStatus,
  type LobbyState,
} from '@ttc/shared';
import type { Db } from '../db/client';
import { chatMessages, gameCommands, gameEventLog, gameInvites, gamePlayers, games, gameSnapshots, notifications, users } from '../db/schema';
import { HttpError } from '../lib/errors';
import { writeProjection } from './projection';

export type GameRow = typeof games.$inferSelect;
export type PlayerRow = typeof gamePlayers.$inferSelect & { username: string };

export interface GameSettingsRow {
  maxSpeed: 1 | 2 | 3;
  autosave: boolean;
  aiDifficulty: 'easy' | 'normal' | 'hard';
  eventFrequency: 'low' | 'normal' | 'high';
  visibility: 'private' | 'public';
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newInviteCode(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Migrations de snapshot : SAVE_SCHEMA_VERSION → fonction de migration depuis la version précédente. */
const SNAPSHOT_MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrateSnapshot(raw: Record<string, unknown>): GameState {
  let version = Number(raw.schemaVersion ?? 0);
  let data = raw;
  if (version > SAVE_SCHEMA_VERSION) throw new HttpError(409, ErrorCodes.SAVE_INCOMPATIBLE, 'Sauvegarde créée par une version plus récente du jeu');
  while (version < SAVE_SCHEMA_VERSION) {
    const mig = SNAPSHOT_MIGRATIONS[version + 1];
    if (!mig) throw new HttpError(409, ErrorCodes.SAVE_INCOMPATIBLE, `Aucune migration de sauvegarde depuis la version ${version}`);
    data = mig(data);
    version++;
    data.schemaVersion = version;
  }
  return data as unknown as GameState;
}

export class GameRepository {
  constructor(private readonly db: Db) {}

  async createGame(input: {
    name: string;
    mode: 'solo' | 'multiplayer';
    hostId: string;
    maxPlayers: number;
    settings: GameSettingsRow;
    scenarioId: string;
    seed: number;
    hostCharacterId?: string | null;
  }): Promise<GameRow> {
    return this.db.transaction(async (tx) => {
      const [game] = await tx
        .insert(games)
        .values({
          name: input.name,
          mode: input.mode,
          hostId: input.hostId,
          maxPlayers: input.mode === 'solo' ? 1 : input.maxPlayers,
          visibility: input.settings.visibility,
          settings: input.settings,
          scenarioId: input.scenarioId,
          seed: input.seed,
        })
        .returning();
      await tx.insert(gamePlayers).values({ gameId: game!.id, userId: input.hostId, isHost: true, characterId: input.hostCharacterId ?? null, ready: input.mode === 'solo' });
      await tx.insert(gameInvites).values({ gameId: game!.id, code: newInviteCode(), createdBy: input.hostId });
      return game!;
    });
  }

  async getGame(id: string): Promise<GameRow | null> {
    const rows = await this.db.select().from(games).where(eq(games.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async mustGame(id: string): Promise<GameRow> {
    const g = await this.getGame(id);
    if (!g) throw new HttpError(404, ErrorCodes.GAME_NOT_FOUND, 'Partie introuvable');
    return g;
  }

  async inviteCode(gameId: string): Promise<string | null> {
    const rows = await this.db.select({ code: gameInvites.code }).from(gameInvites).where(eq(gameInvites.gameId, gameId)).limit(1);
    return rows[0]?.code ?? null;
  }

  async gameByInvite(code: string): Promise<string | null> {
    const rows = await this.db.select({ gameId: gameInvites.gameId }).from(gameInvites).where(eq(gameInvites.code, code.toUpperCase())).limit(1);
    return rows[0]?.gameId ?? null;
  }

  async players(gameId: string): Promise<PlayerRow[]> {
    const rows = await this.db
      .select({ p: gamePlayers, username: users.username })
      .from(gamePlayers)
      .innerJoin(users, eq(users.id, gamePlayers.userId))
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(asc(gamePlayers.joinedAt));
    return rows.map((r) => ({ ...r.p, username: r.username }));
  }

  async isMember(gameId: string, userId: string): Promise<boolean> {
    const rows = await this.db.select({ u: gamePlayers.userId }).from(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId))).limit(1);
    return rows.length > 0;
  }

  async addPlayer(gameId: string, userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Verrou de ligne : évite de dépasser le nombre de places en cas de jonctions simultanées.
      const locked = await tx.execute(sql`select max_players, status from games where id = ${gameId} for update`);
      const row = locked.rows[0] as { max_players: number; status: GameStatus } | undefined;
      if (!row) throw new HttpError(404, ErrorCodes.GAME_NOT_FOUND, 'Partie introuvable');
      if (row.status !== 'lobby') throw new HttpError(409, ErrorCodes.GAME_ALREADY_STARTED, 'La partie a déjà commencé');
      const count = await tx.select({ n: sql<number>`count(*)::int` }).from(gamePlayers).where(eq(gamePlayers.gameId, gameId));
      if ((count[0]?.n ?? 0) >= row.max_players) throw new HttpError(409, ErrorCodes.GAME_FULL, 'La partie est complète');
      await tx.insert(gamePlayers).values({ gameId, userId }).onConflictDoNothing();
    });
  }

  async removePlayer(gameId: string, userId: string): Promise<void> {
    await this.db.delete(gamePlayers).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)));
  }

  async setCharacter(gameId: string, userId: string, characterId: string | null): Promise<void> {
    try {
      await this.db.update(gamePlayers).set({ characterId, ready: false }).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)));
    } catch (err) {
      if ((err as { code?: string }).code === '23505' || String((err as { cause?: { code?: string } }).cause?.code) === '23505') {
        throw new HttpError(409, ErrorCodes.CHARACTER_TAKEN, 'Ce souverain est déjà choisi par un autre joueur');
      }
      throw err;
    }
  }

  async setReady(gameId: string, userId: string, ready: boolean): Promise<void> {
    await this.db.update(gamePlayers).set({ ready }).where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)));
  }

  async updateSettings(gameId: string, settings: GameSettingsRow): Promise<void> {
    await this.db.update(games).set({ settings, visibility: settings.visibility, updatedAt: new Date() }).where(eq(games.id, gameId));
  }

  async setStatus(gameId: string, status: GameStatus): Promise<void> {
    await this.db
      .update(games)
      .set({ status, updatedAt: new Date(), ...(status === 'running' ? { startedAt: new Date() } : {}) })
      .where(eq(games.id, gameId));
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.db.delete(games).where(eq(games.id, gameId));
  }

  async lobbyState(gameId: string, online: Set<string>): Promise<LobbyState> {
    const g = await this.mustGame(gameId);
    const players = await this.players(gameId);
    const settings = g.settings as GameSettingsRow;
    return {
      gameId,
      name: g.name,
      inviteCode: (await this.inviteCode(gameId)) ?? '',
      hostId: g.hostId,
      status: g.status as GameStatus,
      maxPlayers: g.maxPlayers,
      mode: g.mode as 'solo' | 'multiplayer',
      players: players.map((p) => ({ userId: p.userId, displayName: p.username, characterId: p.characterId, ready: p.ready, isHost: p.isHost, online: online.has(p.userId) })),
      settings,
    };
  }

  async listForUser(userId: string): Promise<(GameRow & { memberCharacterId: string | null; isMember: boolean })[]> {
    const mine = await this.db
      .select({ g: games, characterId: gamePlayers.characterId })
      .from(gamePlayers)
      .innerJoin(games, eq(games.id, gamePlayers.gameId))
      .where(eq(gamePlayers.userId, userId))
      .orderBy(desc(games.updatedAt))
      .limit(50);
    const publicLobbies = await this.db
      .select()
      .from(games)
      .where(and(eq(games.status, 'lobby'), eq(games.visibility, 'public'), eq(games.mode, 'multiplayer')))
      .orderBy(desc(games.createdAt))
      .limit(30);
    const out = mine.map((r) => ({ ...r.g, memberCharacterId: r.characterId, isMember: true }));
    for (const g of publicLobbies) if (!out.some((o) => o.id === g.id)) out.push({ ...g, memberCharacterId: null, isMember: false });
    return out;
  }

  async playerCounts(gameIds: string[]): Promise<Map<string, number>> {
    if (!gameIds.length) return new Map();
    const rows = await this.db
      .select({ gameId: gamePlayers.gameId, n: sql<number>`count(*)::int` })
      .from(gamePlayers)
      .where(inArray(gamePlayers.gameId, gameIds))
      .groupBy(gamePlayers.gameId);
    return new Map(rows.map((r) => [r.gameId, r.n]));
  }

  // -------------------------------------------------------------------------
  // Snapshots
  // -------------------------------------------------------------------------
  async saveSnapshot(gameId: string, state: GameState, reason: string, opts: { projection: boolean; speed: number; playedSeconds: number }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(gameSnapshots).values({
        gameId,
        version: state.version,
        gameDate: state.date,
        schemaVersion: state.schemaVersion,
        reason,
        state: state as unknown as Record<string, unknown>,
        meta: { players: Object.values(state.players).map((p) => ({ userId: p.userId, characterId: p.characterId })) },
      });
      await tx
        .update(games)
        .set({ gameDate: state.date, version: state.version, lastSavedAt: new Date(), updatedAt: new Date(), speed: opts.speed, playedSeconds: opts.playedSeconds })
        .where(eq(games.id, gameId));
      if (opts.projection) await writeProjection(tx, gameId, state);
      // Conserver les 6 derniers snapshots.
      const keep = await tx.select({ id: gameSnapshots.id }).from(gameSnapshots).where(eq(gameSnapshots.gameId, gameId)).orderBy(desc(gameSnapshots.id)).limit(6);
      const minKeep = keep[keep.length - 1]?.id;
      if (minKeep !== undefined && keep.length === 6) {
        await tx.delete(gameSnapshots).where(and(eq(gameSnapshots.gameId, gameId), lt(gameSnapshots.id, minKeep)));
      }
    });
  }

  async loadLatestSnapshot(gameId: string): Promise<GameState | null> {
    const rows = await this.db.select({ state: gameSnapshots.state }).from(gameSnapshots).where(eq(gameSnapshots.gameId, gameId)).orderBy(desc(gameSnapshots.id)).limit(1);
    if (!rows[0]) return null;
    return migrateSnapshot(rows[0].state as Record<string, unknown>);
  }

  // -------------------------------------------------------------------------
  // Journaux
  // -------------------------------------------------------------------------
  async recordCommand(row: typeof gameCommands.$inferInsert): Promise<void> {
    await this.db.insert(gameCommands).values(row).onConflictDoNothing();
  }

  async findCommand(gameId: string, commandId: string) {
    const rows = await this.db.select().from(gameCommands).where(and(eq(gameCommands.gameId, gameId), eq(gameCommands.commandId, commandId))).limit(1);
    return rows[0] ?? null;
  }

  async appendLog(gameId: string, sequence: number, entries: GameLogEntry[]): Promise<void> {
    const rows = entries
      .filter((e) => e.type !== 'command')
      .map((e) => ({ gameId, sequence, dateInGame: e.date, type: e.type, actorId: e.actorId, payload: e.payload, visibleTo: e.visibleTo }));
    for (let i = 0; i < rows.length; i += 500) await this.db.insert(gameEventLog).values(rows.slice(i, i + 500));
  }

  async appendNotifications(gameId: string, items: { userId: string; characterId: string; n: GameNotification }[]): Promise<void> {
    if (!items.length) return;
    await this.db.insert(notifications).values(
      items.map(({ userId, characterId, n }) => ({
        gameId,
        userId,
        characterId,
        level: n.level,
        kind: n.kind,
        vars: n.vars,
        focus: n.focus ?? null,
        dateInGame: n.date,
      })),
    );
  }

  async recentNotifications(gameId: string, userId: string, limit = 40) {
    return this.db.select().from(notifications).where(and(eq(notifications.gameId, gameId), eq(notifications.userId, userId))).orderBy(desc(notifications.id)).limit(limit);
  }

  async addChat(gameId: string, userId: string, text: string): Promise<ChatMessage> {
    const [row] = await this.db.insert(chatMessages).values({ gameId, userId, text }).returning();
    const u = await this.db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
    return { id: row!.id, gameId, userId, displayName: u[0]?.username ?? '?', text: row!.text, createdAt: row!.createdAt.toISOString() };
  }

  async chatHistory(gameId: string, limit = 50): Promise<ChatMessage[]> {
    const rows = await this.db
      .select({ m: chatMessages, username: users.username })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.userId))
      .where(eq(chatMessages.gameId, gameId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return rows
      .reverse()
      .map((r) => ({ id: r.m.id, gameId, userId: r.m.userId, displayName: r.username, text: r.m.text, createdAt: r.m.createdAt.toISOString() }));
  }

  async runningGames(): Promise<GameRow[]> {
    return this.db.select().from(games).where(or(eq(games.status, 'running')));
  }
}
