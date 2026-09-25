/**
 * Service de parties : création, lobby, sélection de souverain, démarrage,
 * résumés pour « Continuer ».
 */
import { randomInt } from 'node:crypto';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { getScenario } from '@ttc/content';
import { createGameState, isPlayableCharacter } from '@ttc/game-core';
import { ErrorCodes, type GameSummary, type LobbyState } from '@ttc/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Server as IoServer } from 'socket.io';
import type { Db } from '../db/client';
import { characters, gameSnapshots, houses } from '../db/schema';
import { HttpError } from '../lib/errors';
import type { RoomManager } from './manager';
import type { GameRepository, GameRow, GameSettingsRow } from './repository';

export const SCENARIO_ID = 'monde_1400';

export class GameService {
  io: IoServer | null = null;

  constructor(
    private readonly db: Db,
    private readonly repo: GameRepository,
    private readonly rooms: RoomManager,
    private readonly log: FastifyBaseLogger,
  ) {}

  private scenario() {
    return getScenario(SCENARIO_ID);
  }

  private assertPlayable(characterId: string): void {
    if (!isPlayableCharacter(this.scenario(), characterId)) throw new HttpError(400, ErrorCodes.CHARACTER_NOT_PLAYABLE, 'Ce personnage ne peut pas être joué');
  }

  async create(
    user: { id: string; username: string },
    input: { name: string; mode: 'solo' | 'multiplayer'; maxPlayers: number; characterId?: string; settings: GameSettingsRow },
  ): Promise<{ id: string; status: string }> {
    if (input.mode === 'solo') {
      if (!input.characterId) throw new HttpError(400, ErrorCodes.VALIDATION_FAILED, 'Choisissez un souverain');
      this.assertPlayable(input.characterId);
    } else if (input.characterId) this.assertPlayable(input.characterId);
    const game = await this.repo.createGame({
      name: input.name,
      mode: input.mode,
      hostId: user.id,
      maxPlayers: input.maxPlayers,
      settings: input.settings,
      scenarioId: SCENARIO_ID,
      seed: randomInt(1, 2 ** 31 - 1),
      hostCharacterId: input.characterId ?? null,
    });
    if (input.mode === 'solo') {
      await this.launch(game, [{ userId: user.id, displayName: user.username, characterId: input.characterId! }]);
      return { id: game.id, status: 'running' };
    }
    return { id: game.id, status: 'lobby' };
  }

  private async launch(game: GameRow, players: { userId: string; displayName: string; characterId: string }[]): Promise<void> {
    const settings = game.settings as GameSettingsRow;
    const state = createGameState(this.scenario(), {
      gameId: game.id,
      seed: game.seed,
      settings: { maxSpeed: settings.maxSpeed, autosave: settings.autosave, aiDifficulty: settings.aiDifficulty, eventFrequency: settings.eventFrequency },
      players,
    });
    await this.repo.setStatus(game.id, 'running');
    const room = this.rooms.create({ gameId: game.id, state, mode: game.mode as 'solo' | 'multiplayer', hostId: game.hostId });
    await room.save('start');
    this.log.info({ gameId: game.id, players: players.length }, 'Partie lancée');
  }

  async start(userId: string, gameId: string): Promise<void> {
    const game = await this.repo.mustGame(gameId);
    if (game.hostId !== userId) throw new HttpError(403, ErrorCodes.NOT_HOST, 'Seul l’hôte peut lancer la partie');
    if (game.status !== 'lobby') throw new HttpError(409, ErrorCodes.GAME_ALREADY_STARTED, 'La partie a déjà commencé');
    const players = await this.repo.players(gameId);
    const notReady = players.filter((p) => !p.characterId || (!p.ready && !p.isHost));
    if (notReady.length) throw new HttpError(409, ErrorCodes.PLAYERS_NOT_READY, 'Tous les joueurs doivent choisir un souverain et être prêts');
    for (const p of players) this.assertPlayable(p.characterId!);
    await this.launch(
      game,
      players.map((p) => ({ userId: p.userId, displayName: p.username, characterId: p.characterId! })),
    );
    this.io?.to(`lobby:${gameId}`).emit('lobby:started', { gameId });
  }

  async join(user: { id: string }, gameId: string, inviteCode?: string): Promise<void> {
    const game = await this.repo.mustGame(gameId);
    if (await this.repo.isMember(gameId, user.id)) return;
    if (game.mode === 'solo') throw new HttpError(403, ErrorCodes.FORBIDDEN, 'Partie solo');
    if (game.visibility !== 'public') {
      const code = await this.repo.inviteCode(gameId);
      if (!inviteCode || inviteCode.toUpperCase() !== code) throw new HttpError(403, ErrorCodes.INVALID_INVITE, 'Code d’invitation invalide');
    }
    await this.repo.addPlayer(gameId, user.id);
    await this.broadcastLobby(gameId);
  }

  async joinByCode(user: { id: string }, code: string): Promise<string> {
    const gameId = await this.repo.gameByInvite(code);
    if (!gameId) throw new HttpError(404, ErrorCodes.INVALID_INVITE, 'Code d’invitation inconnu');
    await this.join(user, gameId, code);
    return gameId;
  }

  async leave(userId: string, gameId: string): Promise<void> {
    const game = await this.repo.mustGame(gameId);
    if (game.status !== 'lobby') throw new HttpError(409, ErrorCodes.GAME_ALREADY_STARTED, 'Impossible de quitter une partie commencée : vous pouvez vous reconnecter à tout moment');
    if (game.hostId === userId) {
      await this.repo.deleteGame(gameId);
      this.io?.to(`lobby:${gameId}`).emit('lobby:kicked', { gameId });
      return;
    }
    await this.repo.removePlayer(gameId, userId);
    await this.broadcastLobby(gameId);
  }

  async kick(hostId: string, gameId: string, targetId: string): Promise<void> {
    const game = await this.repo.mustGame(gameId);
    if (game.hostId !== hostId) throw new HttpError(403, ErrorCodes.NOT_HOST, 'Réservé à l’hôte');
    if (game.status !== 'lobby') throw new HttpError(409, ErrorCodes.GAME_ALREADY_STARTED, 'Impossible d’expulser après le lancement');
    if (targetId === hostId) throw new HttpError(400, ErrorCodes.INVALID_TARGET, 'L’hôte ne peut pas s’expulser');
    await this.repo.removePlayer(gameId, targetId);
    for (const [, s] of this.io?.sockets.sockets ?? []) {
      if ((s.data as { userId?: string }).userId === targetId) {
        s.emit('lobby:kicked', { gameId });
        void s.leave(`lobby:${gameId}`);
      }
    }
    await this.broadcastLobby(gameId);
  }

  async selectCharacter(userId: string, gameId: string, characterId: string | null): Promise<void> {
    const game = await this.repo.mustGame(gameId);
    if (!(await this.repo.isMember(gameId, userId))) throw new HttpError(403, ErrorCodes.NOT_GAME_MEMBER, 'Vous n’êtes pas membre');
    if (game.status !== 'lobby') throw new HttpError(409, ErrorCodes.GAME_ALREADY_STARTED, 'La partie a déjà commencé');
    if (characterId) this.assertPlayable(characterId);
    await this.repo.setCharacter(gameId, userId, characterId);
    await this.broadcastLobby(gameId);
  }

  async setReady(userId: string, gameId: string, ready: boolean): Promise<void> {
    const game = await this.repo.mustGame(gameId);
    if (game.status !== 'lobby') throw new HttpError(409, ErrorCodes.GAME_ALREADY_STARTED, 'La partie a déjà commencé');
    const me = (await this.repo.players(gameId)).find((p) => p.userId === userId);
    if (!me) throw new HttpError(403, ErrorCodes.NOT_GAME_MEMBER, 'Vous n’êtes pas membre');
    if (ready && !me.characterId) throw new HttpError(400, ErrorCodes.VALIDATION_FAILED, 'Choisissez d’abord un souverain');
    await this.repo.setReady(gameId, userId, ready);
    await this.broadcastLobby(gameId);
  }

  async updateSettings(userId: string, gameId: string, patch: Partial<GameSettingsRow>): Promise<void> {
    const game = await this.repo.mustGame(gameId);
    if (game.hostId !== userId) throw new HttpError(403, ErrorCodes.NOT_HOST, 'Réservé à l’hôte');
    if (game.status !== 'lobby') throw new HttpError(409, ErrorCodes.GAME_ALREADY_STARTED, 'La partie a déjà commencé');
    await this.repo.updateSettings(gameId, { ...(game.settings as GameSettingsRow), ...patch });
    await this.broadcastLobby(gameId);
  }

  onlineInLobby(gameId: string): Set<string> {
    const out = new Set<string>();
    const room = this.io?.sockets.adapter.rooms.get(`lobby:${gameId}`);
    if (!room) return out;
    for (const sid of room) {
      const s = this.io!.sockets.sockets.get(sid);
      const uid = (s?.data as { userId?: string } | undefined)?.userId;
      if (uid) out.add(uid);
    }
    return out;
  }

  async lobby(gameId: string): Promise<LobbyState> {
    return this.repo.lobbyState(gameId, this.onlineInLobby(gameId));
  }

  async broadcastLobby(gameId: string): Promise<void> {
    if (!this.io) return;
    try {
      const state = await this.lobby(gameId);
      this.io.to(`lobby:${gameId}`).emit('lobby:update', state);
    } catch (err) {
      this.log.warn({ err, gameId }, 'broadcastLobby');
    }
  }

  // -------------------------------------------------------------------------
  // Résumés
  // -------------------------------------------------------------------------
  async list(userId: string): Promise<GameSummary[]> {
    const rows = await this.repo.listForUser(userId);
    const counts = await this.repo.playerCounts(rows.map((r) => r.id));
    const summaries: GameSummary[] = [];
    for (const g of rows) summaries.push(await this.summary(g, userId, counts.get(g.id) ?? 0, g.isMember));
    return summaries;
  }

  async summary(g: GameRow, userId: string, playerCount: number, isMember: boolean): Promise<GameSummary> {
    let rulerCharacterId: string | null = null;
    let rulerName: string | null = null;
    let gameDate = g.gameDate;
    const room = this.rooms.get(g.id);
    if (room) {
      rulerCharacterId = room.characterOf(userId);
      gameDate = room.state.date;
      const c = rulerCharacterId ? room.state.characters[rulerCharacterId] : undefined;
      const h = c?.houseId ? room.state.houses[c.houseId] : undefined;
      if (c) rulerName = h ? `${c.firstName} de ${h.name}` : c.firstName;
    } else if (g.status !== 'lobby' && isMember) {
      const snap = await this.db
        .select({ meta: gameSnapshots.meta })
        .from(gameSnapshots)
        .where(eq(gameSnapshots.gameId, g.id))
        .orderBy(desc(gameSnapshots.id))
        .limit(1);
      const players = (snap[0]?.meta as { players?: { userId: string; characterId: string }[] } | undefined)?.players ?? [];
      rulerCharacterId = players.find((p) => p.userId === userId)?.characterId ?? null;
      if (rulerCharacterId) {
        const rows = await this.db
          .select({ firstName: characters.firstName, houseName: houses.name })
          .from(characters)
          .leftJoin(houses, and(eq(houses.gameId, characters.gameId), eq(houses.id, characters.houseId)))
          .where(and(eq(characters.gameId, g.id), inArray(characters.id, [rulerCharacterId])))
          .limit(1);
        const r = rows[0];
        if (r) rulerName = r.houseName ? `${r.firstName} de ${r.houseName}` : r.firstName;
      }
    }
    const settings = g.settings as GameSettingsRow;
    const hostName = (await this.repo.players(g.id)).find((p) => p.userId === g.hostId)?.username ?? '?';
    return {
      id: g.id,
      name: g.name,
      mode: g.mode as 'solo' | 'multiplayer',
      status: g.status as GameSummary['status'],
      hostId: g.hostId,
      hostName,
      playerCount,
      maxPlayers: g.maxPlayers,
      visibility: settings.visibility,
      inviteCode: isMember ? await this.repo.inviteCode(g.id) : null,
      isMember,
      rulerName,
      rulerCharacterId,
      gameDate,
      lastSavedAt: g.lastSavedAt?.toISOString() ?? null,
      playedSeconds: room?.playedSeconds ?? g.playedSeconds,
      createdAt: g.createdAt.toISOString(),
    };
  }
}
