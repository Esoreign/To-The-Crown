import { sql } from 'drizzle-orm';
import { GAME_VERSION_LABEL, PROTOCOL_VERSION } from '@ttc/shared';
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ status: 'ok', version: GAME_VERSION_LABEL, protocolVersion: PROTOCOL_VERSION }));

  app.get('/api/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail' | 'disabled'> = {};
    try {
      await app.db.execute(sql`select 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }
    if (app.redis) {
      try {
        await app.redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'fail';
      }
    } else checks.redis = 'disabled';
    const ok = !Object.values(checks).includes('fail') && !app.shuttingDown;
    return reply.status(ok ? 200 : 503).send({ status: ok ? 'ready' : 'unavailable', checks, rooms: app.rooms.list().length });
  });
}
