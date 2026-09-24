import { z } from 'zod';
import {
  ErrorCodes,
  PROTOCOL_VERSION,
  createGameSchema,
  joinGameSchema,
  kickSchema,
  readySchema,
  selectCharacterSchema,
  updateSettingsSchema,
} from '@ttc/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError } from '../lib/errors';

const idParams = z.object({ id: z.uuid() });

function requireUser(req: FastifyRequest) {
  if (!req.user) throw new HttpError(401, ErrorCodes.AUTH_REQUIRED, 'Connexion requise');
  return req.user;
}

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  const { games, repo, rooms } = app;

  app.get('/api/games', async (req) => {
    const user = requireUser(req);
    return { games: await games.list(user.id) };
  });

  app.post('/api/games', async (req, reply) => {
    const user = requireUser(req);
    if (!(await app.limiter.hit(`create-game:${user.id}`, 20, 3600))) throw new HttpError(429, ErrorCodes.RATE_LIMITED, 'Trop de parties créées');
    const body = createGameSchema.parse(req.body);
    const res = await games.create(user, body);
    return reply.status(201).send(res);
  });

  app.post('/api/games/join', async (req) => {
    const user = requireUser(req);
    const body = z.object({ inviteCode: z.string().trim().min(4).max(16) }).parse(req.body);
    const id = await games.joinByCode(user, body.inviteCode);
    return { id };
  });

  app.get('/api/games/:id', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    const game = await repo.mustGame(id);
    const member = await repo.isMember(id, user.id);
    if (!member && (game.visibility !== 'public' || game.status !== 'lobby')) throw new HttpError(403, ErrorCodes.NOT_GAME_MEMBER, 'Accès refusé');
    const players = await repo.players(id);
    return {
      game: await games.summary(game, user.id, players.length, member),
      lobby: game.status === 'lobby' ? await games.lobby(id) : null,
    };
  });

  app.post('/api/games/:id/join', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    const body = joinGameSchema.parse(req.body ?? {});
    await games.join(user, id, body.inviteCode);
    return { ok: true };
  });

  app.post('/api/games/:id/leave', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    await games.leave(user.id, id);
    return { ok: true };
  });

  app.post('/api/games/:id/select', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    const body = selectCharacterSchema.parse(req.body);
    await games.selectCharacter(user.id, id, body.characterId);
    return { ok: true };
  });

  app.post('/api/games/:id/ready', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    const body = readySchema.parse(req.body);
    await games.setReady(user.id, id, body.ready);
    return { ok: true };
  });

  app.post('/api/games/:id/kick', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    const body = kickSchema.parse(req.body);
    await games.kick(user.id, id, body.userId);
    return { ok: true };
  });

  app.patch('/api/games/:id/settings', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    const body = updateSettingsSchema.parse(req.body);
    await games.updateSettings(user.id, id, body);
    return { ok: true };
  });

  app.post('/api/games/:id/start', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    await games.start(user.id, id);
    return { ok: true };
  });

  app.get('/api/games/:id/bootstrap', async (req) => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    const game = await repo.mustGame(id);
    if (!(await repo.isMember(id, user.id))) throw new HttpError(403, ErrorCodes.NOT_GAME_MEMBER, 'Accès refusé');
    const room = game.status === 'running' ? await rooms.load(id) : null;
    return {
      gameId: id,
      status: game.status,
      mode: game.mode,
      protocolVersion: PROTOCOL_VERSION,
      scenarioId: game.scenarioId,
      characterId: room?.characterOf(user.id) ?? null,
      notifications: (await repo.recentNotifications(id, user.id)).map((n) => ({
        id: `db${n.id}`,
        date: n.dateInGame,
        level: n.level,
        kind: n.kind,
        vars: n.vars,
        to: [n.characterId],
        focus: n.focus ?? undefined,
      })),
    };
  });
}
