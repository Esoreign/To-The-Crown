/**
 * Applique les migrations SQL versionnées (database/migrations).
 * Usage : pnpm db:migrate
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

export async function runMigrations(url: string, folder?: string): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = folder ?? process.env.MIGRATIONS_DIR ?? resolve(here, '../../../../database/migrations');
  const handle = createDb(url, 1);
  try {
    await migrate(handle.db, { migrationsFolder });
  } finally {
    await handle.close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL manquant');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migrations appliquées.'))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
