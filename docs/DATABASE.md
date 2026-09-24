# Base de données et sauvegardes

PostgreSQL, schéma décrit avec Drizzle (`apps/server/src/db/schema.ts`), migrations SQL versionnées dans `database/migrations` (générées par `pnpm db:generate`, appliquées par `pnpm db:migrate` ou `MIGRATE_ON_START=true`).

## Tables (38)

| Domaine | Tables |
| --- | --- |
| Plateforme | `users`, `sessions` |
| Parties | `games`, `game_players`, `game_invites`, `chat_messages`, `notifications` |
| Persistance | `game_snapshots`, `game_commands`, `game_event_log` |
| Référence | `cultures`, `faiths` (données de contenu, idempotentes via `pnpm db:seed`) |
| Projection relationnelle | `characters`, `character_traits`, `houses`, `dynasties`, `titles`, `title_claims`, `vassal_contracts`, `provinces`, `buildings`, `construction_queues`, `council_positions`, `marriages`, `relationships`, `alliances`, `wars`, `war_participants`, `armies`, `army_regiments`, `battles`, `sieges`, `schemes`, `scheme_agents`, `secrets`, `hooks`, `active_events`, `succession_votes` |

## Stratégie de persistance

1. **Snapshots** (`game_snapshots`) : l'état complet (`GameState` en JSONB) avec `schema_version`, date de jeu, version et motif (`start`, `monthly`, `debounced`, `shutdown`). Les 6 derniers sont conservés.
2. **Journal de commandes** (`game_commands`) : chaque commande acceptée ou refusée, avec son `command_id` unique (idempotence), l'acteur, la charge, la version et la date de jeu.
3. **Journal d'événements** (`game_event_log`) : sorties du moteur (naissances, morts, guerres…) avec leur visibilité.
4. **Projection** : à chaque snapshot, les tables relationnelles sont réécrites pour la partie (requêtes d'analyse, administration, statistiques). La vérité reste le snapshot.

Sauvegarde automatique : chaque 1er du mois de jeu (au plus une fois toutes les `AUTOSAVE_MIN_SECONDS`), trois secondes après une pause, à l'arrêt du serveur (SIGTERM) et au lancement.

## Versions de sauvegarde

`SAVE_SCHEMA_VERSION` (`packages/shared/src/state.ts`) est enregistré avec chaque snapshot. Au chargement, `migrateSnapshot` applique les migrations successives ; une sauvegarde plus récente que le serveur est refusée (`SAVE_INCOMPATIBLE`).

## Sécurité des données

- Mots de passe : Argon2id uniquement (`password_hash`), jamais journalisés.
- Sessions : seul le HMAC du jeton est stocké (`token_hash`), expiration et révocation.
- Aucune donnée secrète dans les journaux applicatifs.
