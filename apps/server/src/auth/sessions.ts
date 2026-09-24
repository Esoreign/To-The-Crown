/**
 * Sessions serveur révocables. Le cookie contient un jeton aléatoire de
 * 256 bits ; la base ne stocke que son empreinte HMAC-SHA256 (SESSION_SECRET).
 */
import { createHmac, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'ttc_session';
export const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  sessionId: string;
}

export function tokenHash(secret: string, token: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export async function createSession(db: Db, secret: string, userId: string, userAgent: string | undefined): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  await db.insert(sessions).values({ userId, tokenHash: tokenHash(secret, token), expiresAt, userAgent: userAgent?.slice(0, 200) ?? null });
  return { token, expiresAt };
}

export async function findSessionUser(db: Db, secret: string, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 128) return null;
  const rows = await db
    .select({ id: users.id, username: users.username, email: users.email, createdAt: users.createdAt, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash(secret, token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export function cookieOptions(secure: boolean, expires?: Date) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    ...(expires ? { expires } : {}),
  };
}

/** Lecture minimale d'un en-tête Cookie (handshake Socket.IO). */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}
