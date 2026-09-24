import pg from 'pg';
import { runMigrations } from '../src/db/migrate';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://ttc:ttc@localhost:5432/tothecrown_test';

/** Crée la base de test si elle n'existe pas (CI : seule la base principale est fournie). */
async function ensureDatabase(): Promise<void> {
  const url = new URL(TEST_DB);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Nom de base de test invalide : ${name}`);
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (!exists.rowCount) await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }
}

export default async function setup(): Promise<void> {
  await ensureDatabase();
  const client = new pg.Client({ connectionString: TEST_DB });
  await client.connect();
  await client.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await client.end();
  await runMigrations(TEST_DB);
}
