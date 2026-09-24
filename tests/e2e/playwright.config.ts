import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout : serveur de jeu + client Vite.
 * Les serveurs de développement déjà lancés sont réutilisés en local.
 * Variables utiles : E2E_API_PORT, E2E_WEB_PORT, DATABASE_URL, E2E_CHROMIUM.
 */
const apiPort = Number(process.env.E2E_API_PORT ?? 3000);
const webPort = Number(process.env.E2E_WEB_PORT ?? 5173);
const baseURL = `http://localhost:${webPort}`;
const executablePath = process.env.E2E_CHROMIUM || undefined;

export default defineConfig({
  testDir: './specs',
  // Rendu WebGL logiciel en headless : les scénarios complets sont lents.
  timeout: 360_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      // Plusieurs joueurs dans le même navigateur : aucune page ne doit être ralentie en arrière-plan.
      args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } }],
  webServer: [
    {
      command: 'pnpm --filter @ttc/server exec tsx --env-file-if-exists=.env src/index.ts',
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(apiPort),
        APP_ORIGIN: baseURL,
        DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://ttc:ttc@localhost:5432/tothecrown',
        REDIS_URL: process.env.REDIS_URL ?? '',
        SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-session-secret-at-least-32-characters-long',
        DEV_TOOLS: 'true',
        MIGRATE_ON_START: 'true',
        REGISTER_LIMIT_PER_HOUR: '1000',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `pnpm --filter @ttc/web exec vite --port ${webPort} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_TARGET: `http://localhost:${apiPort}` },
    },
  ],
});
