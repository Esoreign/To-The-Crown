import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: '../../database/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://ttc:ttc@localhost:5432/tothecrown' },
  strict: true,
});
