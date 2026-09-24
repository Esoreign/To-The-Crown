/**
 * Migrations de sauvegarde : partagées par le serveur et par l'hôte navigateur.
 * Changer la forme de `GameState` impose d'incrémenter `SAVE_SCHEMA_VERSION`
 * et d'ajouter ici la migration depuis la version précédente.
 */
import { ErrorCodes, GameError, SAVE_SCHEMA_VERSION, type GameState } from '@ttc/shared';

/** SAVE_SCHEMA_VERSION → fonction de migration depuis la version précédente. */
export const SNAPSHOT_MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> =
  {};

export function migrateSnapshot(raw: Record<string, unknown>): GameState {
  let version = Number(raw.schemaVersion ?? 0);
  let data = raw;
  if (version > SAVE_SCHEMA_VERSION)
    throw new GameError(ErrorCodes.SAVE_INCOMPATIBLE, 'Sauvegarde créée par une version plus récente du jeu');
  while (version < SAVE_SCHEMA_VERSION) {
    const mig = SNAPSHOT_MIGRATIONS[version + 1];
    if (!mig)
      throw new GameError(
        ErrorCodes.SAVE_INCOMPATIBLE,
        `Aucune migration de sauvegarde depuis la version ${version}`,
      );
    data = mig(data);
    version++;
    data.schemaVersion = version;
  }
  return data as unknown as GameState;
}
