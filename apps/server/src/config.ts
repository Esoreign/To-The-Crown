/**
 * Configuration typée, validée au démarrage (erreur claire si une variable
 * critique manque).
 */
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis (postgres://…)'),
  REDIS_URL: z.string().default(''),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET doit contenir au moins 32 caractères'),
  APP_ORIGIN: z.string().url('APP_ORIGIN doit être une URL (ex. http://localhost:5173)'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DEV_TOOLS: bool,
  SERVE_WEB_DIST: z.string().default(''),
  SOCKET_REDIS_ADAPTER: bool,
  COOKIE_SECURE: z.enum(['auto', 'true', 'false']).default('auto'),
  /** Faire confiance à X-Forwarded-For (uniquement derrière un proxy inverse maîtrisé). */
  TRUST_PROXY: bool,
  /** Durée d'un jour de jeu en ms pour chaque vitesse (1x, 2x, 3x). */
  TICK_MS: z.string().default('600,250,90'),
  AUTOSAVE_MIN_SECONDS: z.coerce.number().int().min(1).default(20),
  /** Inscriptions autorisées par IP et par heure. */
  REGISTER_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(10),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide :\n${lines.join('\n')}\nVoir .env.example.`);
  }
  const c = parsed.data;
  const tick = c.TICK_MS.split(',').map((x) => Number(x.trim()));
  if (tick.length !== 3 || tick.some((x) => !Number.isFinite(x) || x < 10)) throw new Error('TICK_MS invalide (ex. 600,250,90)');
  return {
    ...c,
    isProd: c.NODE_ENV === 'production',
    isTest: c.NODE_ENV === 'test',
    cookieSecure: c.COOKIE_SECURE === 'auto' ? c.NODE_ENV === 'production' : c.COOKIE_SECURE === 'true',
    devTools: c.DEV_TOOLS && c.NODE_ENV !== 'production',
    tickMs: tick as [number, number, number],
  };
}
