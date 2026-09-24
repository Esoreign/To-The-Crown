/**
 * Construction de l'application Fastify (réutilisée par les tests).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { Redis } from 'ioredis';
import { ErrorCodes } from '@ttc/shared';
import { SESSION_COOKIE, findSessionUser, type SessionUser } from './auth/sessions';
import type { Config } from './config';
import { createDb, type Db, type DbHandle } from './db/client';
import { RoomManager } from './game/manager';
import { GameRepository } from './game/repository';
import { GameService } from './game/service';
import { errorHandler, HttpError } from './lib/errors';
import { createRateLimiter, type RateLimiter } from './lib/rate-limit';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/games';
import { healthRoutes } from './routes/health';
import { attachSocket } from './socket';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    db: Db;
    dbHandle: DbHandle;
    redis: Redis | null;
    limiter: RateLimiter;
    repo: GameRepository;
    rooms: RoomManager;
    games: GameService;
    shuttingDown: boolean;
  }
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]', '*.password', '*.passwordHash', 'password'],
        censor: '[masqué]',
      },
      ...(config.isProd || config.isTest ? {} : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
    },
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  const dbHandle = createDb(config.DATABASE_URL);
  const redis = config.REDIS_URL ? new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false }) : null;
  redis?.on('error', (err) => app.log.warn({ err: err.message }, 'Redis'));
  const repo = new GameRepository(dbHandle.db);
  const rooms = new RoomManager(repo, {
    repo,
    log: app.log,
    tickMs: config.tickMs,
    autosaveMinSeconds: config.AUTOSAVE_MIN_SECONDS,
    devTools: config.devTools,
  });
  const games = new GameService(dbHandle.db, repo, rooms, app.log);

  app.decorate('config', config);
  app.decorate('db', dbHandle.db);
  app.decorate('dbHandle', dbHandle);
  app.decorate('redis', redis);
  app.decorate('limiter', createRateLimiter(redis));
  app.decorate('repo', repo);
  app.decorate('rooms', rooms);
  app.decorate('games', games);
  app.decorate('shuttingDown', false);
  app.decorateRequest('user', null);

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  app.setErrorHandler(errorHandler);

  // Session : chargée pour toutes les routes API.
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    req.user = await findSessionUser(app.db, config.SESSION_SECRET, req.cookies[SESSION_COOKIE]);
  });

  // Défense CSRF (en plus de SameSite=Lax) : origine stricte ou en-tête applicatif.
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const origin = req.headers.origin;
    if (origin && origin !== config.APP_ORIGIN) throw new HttpError(403, ErrorCodes.FORBIDDEN, 'Origine refusée');
    if (!origin && req.headers['x-requested-with'] !== 'ttc') throw new HttpError(403, ErrorCodes.FORBIDDEN, 'En-tête X-Requested-With requis');
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(gameRoutes);

  // Client web statique (production / e2e) avec repli SPA.
  const webDist = config.SERVE_WEB_DIST ? resolve(config.SERVE_WEB_DIST) : '';
  if (webDist && existsSync(resolve(webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false, maxAge: '1h', index: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io')) {
        return reply.status(404).send({ error: { code: ErrorCodes.NOT_FOUND, message: 'Route inconnue' } });
      }
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: ErrorCodes.NOT_FOUND, message: 'Route inconnue' } }));
  }

  let io: ReturnType<typeof attachSocket> | null = null;
  app.addHook('onClose', async () => {
    app.shuttingDown = true;
    if (io) {
      const server = io;
      await new Promise<void>((r) => {
        server.close(() => r());
      });
    }
    await rooms.shutdown();
    await dbHandle.close();
    if (redis) await redis.quit().catch(() => undefined);
  });

  await app.ready();
  io = attachSocket(app);
  games.io = io;
  return app;
}
