# Tests

| Niveau | Où | Commande |
| --- | --- | --- |
| Contenu | `packages/content/test` — monde (connexité, hiérarchie, polygones), cultures, confessions, traits, bâtiments, événements, clés de localisation | `pnpm --filter @ttc/content test` |
| Moteur | `packages/game-core/test` — PRNG, calendrier, succession (4 lois), mariage, naissance, titres, économie, construction, conseil, opinion, complots, secrets, guerre, siège, paix, IA, déterminisme, simulation de 10 ans sans erreur | `pnpm --filter @ttc/game-core test` |
| Événements | chaque choix de chaque événement tiré sur des personnages éligibles, état vérifié | `pnpm --filter @ttc/game-core check:events` |
| Simulation longue | 30 ans sans joueur, invariants, statistiques démographiques | `pnpm simulate` |
| Client | `apps/web/src/**/*.test.ts` — titres et élisions, variables d'événements, description des effets, chronique | `pnpm --filter @ttc/web test` |
| Serveur (intégration) | `apps/server/test` — inscription/connexion/déconnexion, Argon2id, CSRF, force brute, partie solo, idempotence, sauvegarde et rechargement, multijoueur, discussion, reconnexion, resynchronisation, isolation des parties | `pnpm --filter @ttc/server test` |
| Bout en bout | `tests/e2e/specs` — solo complet avec sauvegarde et reprise, événement, multijoueur à deux navigateurs, guerre | `pnpm test:e2e` |

## Prérequis

- Tests serveur : PostgreSQL accessible par `TEST_DATABASE_URL` (défaut `postgres://ttc:ttc@localhost:5432/tothecrown_test`, créée si absente) et Redis optionnel (`TEST_REDIS_URL`).
- Bout en bout : Chromium de Playwright (`pnpm --filter @ttc/e2e exec playwright install chromium`), PostgreSQL (`DATABASE_URL`). La configuration démarre le serveur (migrations au démarrage, outils de développement) et Vite, ou réutilise ceux qui tournent déjà en local. `E2E_CHROMIUM` permet d'indiquer un binaire Chromium existant.

## Notes

- En headless, la carte est rendue par WebGL logiciel : les scénarios sont lents (1 à 3 minutes chacun) ; les délais de Playwright en tiennent compte, et les pages de plusieurs joueurs ne sont pas ralenties en arrière-plan.
- Les comptes créés par les tests ont des adresses uniques (`@e2e.tothecrown.local`) : la base de développement peut être partagée.
