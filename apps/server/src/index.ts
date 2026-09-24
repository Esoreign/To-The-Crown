/**
 * Point d'entrée : configuration, migrations éventuelles, écoute, arrêt
 * gracieux (sauvegarde des parties actives).
 */
import { CONTENT, WORLD, validateContent, validateWorld } from '@ttc/content';
import { buildApp } from './app';
import { loadConfig } from './config';
import { runMigrations } from './db/migrate';

async function main(): Promise<void> {
  const config = loadConfig();
  // Contenu invalide : échec immédiat.
  const contentErrors = [...validateWorld(WORLD), ...validateContent(CONTENT)];
  if (contentErrors.length) throw new Error(`Contenu invalide :\n${contentErrors.join('\n')}`);
  if (process.env.MIGRATE_ON_START === 'true') await runMigrations(config.DATABASE_URL);
  const app = await buildApp(config);
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(`To The Crown — serveur prêt sur http://${config.HOST}:${config.PORT}`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'Arrêt gracieux : sauvegarde des parties…');
    const force = setTimeout(() => process.exit(1), 20_000);
    force.unref();
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Erreur à l’arrêt');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
