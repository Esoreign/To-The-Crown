/**
 * Couche temps réel Socket.IO. Chaque connexion est authentifiée par le
 * cookie de session ; chaque événement est validé (zod), limité en débit et
 * vérifié (appartenance à la partie) avant d'atteindre la salle.
 */
import { z } from 'zod';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {
  ErrorCodes,
  PROTOCOL_VERSION,
  commandEnvelopeSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type AckMessage,
} from '@ttc/shared';
import type { FastifyInstance } from 'fastify';
import { SESSION_COOKIE, findSessionUser, parseCookieHeader } from '../auth/sessions';
import { TokenBucket } from '../lib/rate-limit';

interface SocketData {
  userId: string;
  username: string;
  gameId: string | null;
  commandBucket: TokenBucket;
  chatBucket: TokenBucket;
}

type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const gameIdSchema = z.object({ gameId: z.uuid() });
const joinSchema = z.object({ gameId: z.uuid(), protocolVersion: z.number().int() });
const speedSchema = z.object({ gameId: z.uuid(), speed: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) });
const pauseSchema = z.object({ gameId: z.uuid(), paused: z.boolean() });
const chatSchema = z.object({ gameId: z.uuid(), text: z.string().max(500) });
const advanceSchema = z.object({ gameId: z.uuid(), days: z.number().int().min(1).max(365) });

function fail(code: (typeof ErrorCodes)[keyof typeof ErrorCodes], message: string) {
  return { ok: false as const, error: { code, message } };
}

/** Nettoie un message : caractères de contrôle retirés, espaces normalisés. */
export function sanitizeChat(text: string): string {
  // eslint-disable-next-line no-control-regex -- suppression volontaire des caractères de contrôle
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function attachSocket(app: FastifyInstance): Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> {
  const { config } = app;
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(app.server, {
    path: '/socket.io',
    cors: { origin: config.APP_ORIGIN, credentials: true },
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 10_000,
    pingTimeout: 8_000,
  });
  if (config.SOCKET_REDIS_ADAPTER && app.redis) {
    const pub = app.redis.duplicate();
    const sub = app.redis.duplicate();
    io.adapter(createAdapter(pub, sub));
    app.log.info('Adaptateur Redis Socket.IO activé');
  }

  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== config.APP_ORIGIN && !config.isTest) return next(new Error(ErrorCodes.FORBIDDEN));
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const user = await findSessionUser(app.db, config.SESSION_SECRET, cookies[SESSION_COOKIE]);
      if (!user) return next(new Error(ErrorCodes.AUTH_REQUIRED));
      socket.data = {
        userId: user.id,
        username: user.username,
        gameId: null,
        commandBucket: new TokenBucket(15, 6),
        chatBucket: new TokenBucket(5, 0.5),
      };
      next();
    } catch (err) {
      app.log.error({ err }, 'Authentification socket');
      next(new Error(ErrorCodes.INTERNAL));
    }
  });

  io.on('connection', (socket: IoSocket) => {
    const log = app.log.child({ userId: socket.data.userId, socketId: socket.id });
    log.debug('Socket connecté');

    socket.on('lobby:join', async (p, ack) => {
      if (typeof ack !== 'function') return;
      const parsed = gameIdSchema.safeParse(p);
      if (!parsed.success) return ack(fail(ErrorCodes.VALIDATION_FAILED, 'Requête invalide'));
      try {
        if (!(await app.repo.isMember(parsed.data.gameId, socket.data.userId))) return ack(fail(ErrorCodes.NOT_GAME_MEMBER, 'Vous n’êtes pas membre'));
        await socket.join(`lobby:${parsed.data.gameId}`);
        const lobby = await app.games.lobby(parsed.data.gameId);
        ack({ ok: true, data: lobby });
        socket.emit('chat:history', await app.repo.chatHistory(parsed.data.gameId));
        await app.games.broadcastLobby(parsed.data.gameId);
      } catch (err) {
        log.warn({ err }, 'lobby:join');
        ack(fail(ErrorCodes.INTERNAL, 'Erreur serveur'));
      }
    });

    socket.on('lobby:leave', async (p) => {
      const parsed = gameIdSchema.safeParse(p);
      if (!parsed.success) return;
      await socket.leave(`lobby:${parsed.data.gameId}`);
      await app.games.broadcastLobby(parsed.data.gameId);
    });

    socket.on('game:join', async (p, ack) => {
      if (typeof ack !== 'function') return;
      const parsed = joinSchema.safeParse(p);
      if (!parsed.success) return ack(fail(ErrorCodes.VALIDATION_FAILED, 'Requête invalide'));
      if (parsed.data.protocolVersion !== PROTOCOL_VERSION) return ack(fail(ErrorCodes.PROTOCOL_MISMATCH, 'Client obsolète : rechargez la page'));
      try {
        const { gameId } = parsed.data;
        if (!(await app.repo.isMember(gameId, socket.data.userId))) return ack(fail(ErrorCodes.NOT_GAME_MEMBER, 'Vous n’êtes pas membre de cette partie'));
        const room = await app.rooms.load(gameId);
        if (!room) return ack(fail(ErrorCodes.GAME_NOT_STARTED, 'La partie n’a pas commencé'));
        if (socket.data.gameId && socket.data.gameId !== gameId) app.rooms.get(socket.data.gameId)?.leave(socket.id);
        socket.data.gameId = gameId;
        ack({ ok: true, data: { joined: true } });
        room.join(socket, socket.data.userId, socket.data.username);
        socket.emit('chat:history', await app.repo.chatHistory(gameId));
      } catch (err) {
        log.warn({ err }, 'game:join');
        ack(fail(ErrorCodes.INTERNAL, 'Erreur serveur'));
      }
    });

    socket.on('game:leave', (p) => {
      const parsed = gameIdSchema.safeParse(p);
      if (!parsed.success) return;
      app.rooms.get(parsed.data.gameId)?.leave(socket.id);
      void socket.leave(`game:${parsed.data.gameId}`);
      if (socket.data.gameId === parsed.data.gameId) socket.data.gameId = null;
    });

    socket.on('game:command', (env, ack) => {
      if (typeof ack !== 'function') return;
      const parsed = commandEnvelopeSchema.safeParse(env);
      const commandId = typeof (env as { commandId?: unknown })?.commandId === 'string' ? (env as { commandId: string }).commandId : 'invalid';
      const room = socket.data.gameId ? app.rooms.get(socket.data.gameId) : undefined;
      const nack = (code: (typeof ErrorCodes)[keyof typeof ErrorCodes], message: string): AckMessage => ({
        commandId,
        ok: false,
        error: { code, message },
        version: room?.state.version ?? 0,
      });
      if (!parsed.success) return ack(nack(ErrorCodes.INVALID_COMMAND, 'Commande invalide'));
      if (!room) return ack(nack(ErrorCodes.NOT_GAME_MEMBER, 'Rejoignez d’abord une partie'));
      if (!socket.data.commandBucket.take()) return ack(nack(ErrorCodes.RATE_LIMITED, 'Trop de commandes'));
      if (parsed.data.command.type.startsWith('dev.') && !config.devTools) return ack(nack(ErrorCodes.FORBIDDEN, 'Outils de développement désactivés'));
      const res = room.handleCommand(socket.data.userId, parsed.data);
      log.debug({ gameId: room.gameId, commandId, type: parsed.data.command.type, ok: res.ok }, 'Commande');
      ack(res);
    });

    socket.on('game:resync', (p) => {
      const parsed = gameIdSchema.safeParse(p);
      if (!parsed.success || parsed.data.gameId !== socket.data.gameId) return;
      app.rooms.get(parsed.data.gameId)?.sendSnapshot(socket);
    });

    socket.on('time:set', (p) => {
      const parsed = speedSchema.safeParse(p);
      if (!parsed.success || parsed.data.gameId !== socket.data.gameId) return;
      app.rooms.get(parsed.data.gameId)?.setSpeed(socket.data.userId, parsed.data.speed);
    });

    socket.on('pause:request', (p) => {
      const parsed = pauseSchema.safeParse(p);
      if (!parsed.success || parsed.data.gameId !== socket.data.gameId) return;
      app.rooms.get(parsed.data.gameId)?.setPaused(socket.data.userId, parsed.data.paused, 'player');
    });

    socket.on('chat:send', async (p, ack) => {
      if (typeof ack !== 'function') return;
      const parsed = chatSchema.safeParse(p);
      if (!parsed.success) return ack(fail(ErrorCodes.VALIDATION_FAILED, 'Message invalide'));
      const text = sanitizeChat(parsed.data.text);
      if (!text) return ack(fail(ErrorCodes.VALIDATION_FAILED, 'Message vide'));
      if (!socket.data.chatBucket.take()) return ack(fail(ErrorCodes.RATE_LIMITED, 'Vous écrivez trop vite'));
      try {
        if (!(await app.repo.isMember(parsed.data.gameId, socket.data.userId))) return ack(fail(ErrorCodes.NOT_GAME_MEMBER, 'Accès refusé'));
        const msg = await app.repo.addChat(parsed.data.gameId, socket.data.userId, text);
        io.to(`game:${parsed.data.gameId}`).to(`lobby:${parsed.data.gameId}`).emit('chat:message', msg);
        ack({ ok: true, data: { sent: true } });
      } catch (err) {
        log.warn({ err }, 'chat:send');
        ack(fail(ErrorCodes.INTERNAL, 'Erreur serveur'));
      }
    });

    socket.on('dev:advance', (p, ack) => {
      if (typeof ack !== 'function') return;
      if (!config.devTools) return ack(fail(ErrorCodes.FORBIDDEN, 'Outils de développement désactivés'));
      const parsed = advanceSchema.safeParse(p);
      if (!parsed.success || parsed.data.gameId !== socket.data.gameId) return ack(fail(ErrorCodes.VALIDATION_FAILED, 'Requête invalide'));
      const room = app.rooms.get(parsed.data.gameId);
      if (!room) return ack(fail(ErrorCodes.GAME_NOT_FOUND, 'Partie introuvable'));
      room.advanceDays(parsed.data.days);
      ack({ ok: true, data: { date: room.state.date } });
    });

    socket.on('disconnect', () => {
      if (socket.data.gameId) app.rooms.get(socket.data.gameId)?.leave(socket.id);
      for (const r of socket.rooms) if (r.startsWith('lobby:')) void app.games.broadcastLobby(r.slice(6));
    });
  });

  return io;
}
