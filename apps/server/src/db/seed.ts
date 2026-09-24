/**
 * Seed idempotent : données de référence (cultures, confessions) et, hors
 * production, deux comptes de démonstration.
 *
 * Usage : pnpm db:seed
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { CULTURES, FAITHS } from '@ttc/content';
import { hashPassword } from '../auth/password';
import { createDb } from './client';
import { cultures, faiths, users } from './schema';

export const DEMO_USERS = [
  { email: 'alice@tothecrown.local', username: 'Alice', password: 'couronne2026' },
  { email: 'bob@tothecrown.local', username: 'Bob', password: 'couronne2026' },
];

export async function seed(url: string, withDemoUsers: boolean): Promise<void> {
  const { db, close } = createDb(url, 2);
  try {
    for (const c of CULTURES) {
      await db
        .insert(cultures)
        .values({ id: c.id, region: c.region, color: c.color, succession: c.succession })
        .onConflictDoUpdate({ target: cultures.id, set: { region: c.region, color: c.color, succession: c.succession } });
    }
    for (const f of FAITHS) {
      await db
        .insert(faiths)
        .values({ id: f.id, family: f.family, color: f.color, doctrines: f.doctrines })
        .onConflictDoUpdate({ target: faiths.id, set: { family: f.family, color: f.color, doctrines: f.doctrines } });
    }
    if (withDemoUsers) {
      for (const u of DEMO_USERS) {
        const exists = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`${users.email} = ${u.email} or lower(${users.username}) = lower(${u.username})`)
          .limit(1);
        if (exists.length) continue;
        await db.insert(users).values({ email: u.email, username: u.username, passwordHash: await hashPassword(u.password) }).onConflictDoNothing();
      }
    }
  } finally {
    await close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL manquant');
    process.exit(1);
  }
  const demo = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_USERS === 'true';
  seed(url, demo)
    .then(() => {
      console.log(`Seed terminé (${CULTURES.length} cultures, ${FAITHS.length} confessions${demo ? ', comptes démo alice/bob' : ''}).`);
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
