import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Mêmes scénarios en mode sans serveur (simulation dans le navigateur de
 * l'hôte + Supabase). Nécessite une pile Supabase locale (`supabase start`)
 * avec `database/migrations/*.sql` puis `database/supabase/web_mode.sql`.
 * Variables : E2E_SUPABASE_URL, E2E_SUPABASE_KEY, E2E_WEB_PORT.
 */
// Active le scénario propre à ce mode (specs/browser-host.spec.ts).
process.env.E2E_BROWSER_HOST = '1';

const webPort = Number(process.env.E2E_WEB_PORT ?? 5174);
const baseURL = `http://localhost:${webPort}`;

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL },
  webServer: [
    {
      command: `pnpm --filter @ttc/web exec vite --mode supabase --port ${webPort} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321',
        VITE_SUPABASE_KEY: process.env.E2E_SUPABASE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      },
    },
  ],
});
