import { eq, sql } from 'drizzle-orm';
import { ErrorCodes, loginSchema, registerSchema, type PublicUser } from '@ttc/shared';
import type { FastifyInstance } from 'fastify';
import { dummyHash, hashPassword, passwordProblems, verifyPassword } from '../auth/password';
import { SESSION_COOKIE, cookieOptions, createSession, revokeSession } from '../auth/sessions';
import { users } from '../db/schema';
import { HttpError } from '../lib/errors';

function toPublic(u: { id: string; username: string; email: string; createdAt: Date }): PublicUser {
  return { id: u.id, username: u.username, email: u.email, createdAt: u.createdAt.toISOString() };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { db, config, limiter } = app;

  app.post('/api/auth/register', async (req, reply) => {
    if (!(await limiter.hit(`register:${req.ip}`, config.REGISTER_LIMIT_PER_HOUR, 3600))) throw new HttpError(429, ErrorCodes.RATE_LIMITED, 'Trop d’inscriptions, réessayez plus tard.');
    const body = registerSchema.parse(req.body);
    const problem = passwordProblems(body.password);
    if (problem) throw new HttpError(400, ErrorCodes.VALIDATION_FAILED, problem);
    const exists = await db
      .select({ email: users.email, username: users.username })
      .from(users)
      .where(sql`${users.email} = ${body.email} or lower(${users.username}) = lower(${body.username})`)
      .limit(2);
    if (exists.some((u) => u.email === body.email)) throw new HttpError(409, ErrorCodes.EMAIL_TAKEN, 'Cette adresse est déjà utilisée');
    if (exists.length) throw new HttpError(409, ErrorCodes.USERNAME_TAKEN, 'Ce nom est déjà pris');
    const passwordHash = await hashPassword(body.password);
    let created;
    try {
      [created] = await db.insert(users).values({ email: body.email, username: body.username, passwordHash }).returning();
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new HttpError(409, ErrorCodes.USERNAME_TAKEN, 'Adresse ou nom déjà utilisé');
      throw err;
    }
    const session = await createSession(db, config.SESSION_SECRET, created!.id, req.headers['user-agent']);
    void reply.setCookie(SESSION_COOKIE, session.token, cookieOptions(config.cookieSecure, session.expiresAt));
    req.log.info({ userId: created!.id }, 'Nouveau compte');
    return reply.status(201).send({ user: toPublic(created!) });
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const okIp = await limiter.hit(`login-ip:${req.ip}`, 30, 600);
    const okEmail = await limiter.hit(`login-email:${body.email}`, 8, 600);
    if (!okIp || !okEmail) throw new HttpError(429, ErrorCodes.RATE_LIMITED, 'Trop de tentatives, patientez quelques minutes.');
    const rows = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    const user = rows[0];
    const valid = user ? await verifyPassword(user.passwordHash, body.password) : (await verifyPassword(await dummyHash(), body.password), false);
    if (!user || !valid) throw new HttpError(401, ErrorCodes.INVALID_CREDENTIALS, 'Adresse ou mot de passe incorrect');
    await limiter.reset(`login-email:${body.email}`);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const session = await createSession(db, config.SESSION_SECRET, user.id, req.headers['user-agent']);
    void reply.setCookie(SESSION_COOKIE, session.token, cookieOptions(config.cookieSecure, session.expiresAt));
    return { user: toPublic(user) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.user) await revokeSession(db, req.user.sessionId);
    void reply.clearCookie(SESSION_COOKIE, cookieOptions(config.cookieSecure));
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => {
    if (!req.user) throw new HttpError(401, ErrorCodes.AUTH_REQUIRED, 'Non connecté');
    return { user: toPublic(req.user) };
  });
}
