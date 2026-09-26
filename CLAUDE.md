# CLAUDE.md — règles du dépôt To The Crown

Guide pour les agents et contributeurs. Lire aussi `docs/ARCHITECTURE.md`.

## Environnement

- Node 24 (`.nvmrc`), pnpm 10, TypeScript 6.0 strict (`verbatimModuleSyntax`, `moduleResolution: Bundler`).
- Les paquets internes (`@ttc/*`) exportent leur source TypeScript ; pas d'étape de build intermédiaire.
- PostgreSQL et Redis locaux pour le serveur et ses tests ; `apps/server/.env` (non versionné) à partir de `.env.example`.

## Commandes à lancer avant de conclure un changement

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @ttc/game-core check:events   # si le contenu ou le moteur d'événements change
pnpm test:e2e                                # si l'interface ou le protocole change
```

## Règles non négociables

1. **Serveur autoritaire.** Le client n'envoie que des _commandes_ (`packages/shared/src/commands.ts`, validées par zod). Toute règle vit dans `packages/game-core` et est vérifiée côté serveur ; le client ne calcule que des prévisualisations avec les mêmes fonctions.
2. **Déterminisme.** Dans `game-core` : pas de `Math.random`, `Date.now`, `new Date`, ni d'E/S (ESLint l'interdit). Aléa via `ctx.rng` (xoshiro128**, état dans `state.rng`). Une même graine et les mêmes commandes produisent la même partie.
3. **Mutation transactionnelle.** Les systèmes mutent un brouillon Immer dans `stepDay`/`runCommand` ; une erreur de commande annule tout. Les traitements système passent par `safeRun` pour isoler une entité fautive.
4. **Index structurels.** Après toute modification de suzerain, cour, décès, naissance, alliance, relation, maison ou guerre : `bumpStructure()`.
5. **Vues privées.** Secrets, complots, leviers et événements actifs ne transitent que filtrés (`privateViewFor`). Ne jamais ajouter une donnée privée à une collection publique.
6. **Équilibrage centralisé.** Tout nombre de gameplay va dans `packages/game-core/src/balance.ts`.
7. **Données, pas code.** Traits, bâtiments, cultures, confessions, unités et événements sont des données (`packages/content`). Un événement se décrit avec le DSL `Condition`/`Effect` (voir `docs/EVENTS.md`).
8. **Localisation.** Aucun texte d'interface codé en dur hors français naturel des composants ; les libellés de données passent par `LOCALE_FR` (`t('clé')`). Nouvelle clé → `packages/content/src/locales/fr.ts`.
9. **Sauvegardes.** Changer la forme de `GameState` impose d'incrémenter `SAVE_SCHEMA_VERSION` et d'écrire une migration de snapshot (`packages/game-core/src/save.ts`, partagée par le serveur et l'hôte navigateur).
10. **Sécurité.** Mots de passe en Argon2id uniquement ; ne jamais journaliser mot de passe, hash, secret de session, cookie ou jeton. Cookies `HttpOnly`, `SameSite=Lax`, `Secure` en production. Toute route d'état exige l'origine attendue ou l'en-tête `x-requested-with: ttc`. Toute nouvelle table doit activer la RLS dans sa migration (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`) : sur Supabase, le schéma public est exposé par l'API.
11. **Pas de faux.** Pas de bouton « bientôt », pas de test vide, pas de contenu repris d'un jeu existant.

## Deux modes réseau

- **Serveur** (défaut) : `apps/server`, REST + Socket.IO.
- **Sans serveur** (`vite --mode supabase`, déploiement Vercel) : simulation dans un Web Worker de l'hôte (`apps/web/src/net/browser/`), API SQL `database/supabase/web_mode.sql`, temps réel Supabase. Toute nouvelle route REST utilisée par l'interface doit aussi être traduite dans `net/browser/api.ts` (et sa fonction `ttc_*` ajoutée au script SQL) ; toute évolution de `GameRoom` doit être reportée dans `HostRoom`.

## Où modifier quoi

| Besoin                                     | Fichier(s)                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Nouvelle commande joueur                   | `shared/src/commands.ts` → `game-core/src/commands.ts` → interface (`apps/web/src/game/…`)                            |
| Nouveau système mensuel                    | `game-core/src/tick.ts` (+ `safeRun`)                                                                                 |
| Nouvel événement                           | `content/src/events/*.ts` puis `check:events`                                                                         |
| Nouvel écran                               | `apps/web/src/game/screens/` + `ScreenHost.tsx` + `state/ui.ts` (`ScreenId`)                                          |
| Entité historique de 1400                  | `content/src/world1400/polities-*.ts` puis `pnpm world:politics` et `pnpm world:validate` (voir `docs/WORLD_1400.md`) |
| Géographie (provinces, géométries, relief) | `tools/worldgen` puis `pnpm world:build` (voir `docs/MAP_PIPELINE.md`)                                                |
| Gouvernement, légitimité, sujétion         | données `content/src/world1400/governments.ts`, règles `game-core/src/politics.ts` (voir `docs/POLITICAL_SYSTEM.md`)  |
| Mode ou couche de carte                    | `apps/web/src/map/colors.ts` (`computeColors`), `map/WorldMap.ts`, `game/hud/MapModes.tsx`                            |
| Nouvelle table                             | `apps/server/src/db/schema.ts` puis `pnpm db:generate`                                                                |
| Protocole réseau                           | `shared/src/protocol.ts` (incrémenter `PROTOCOL_VERSION` si incompatible)                                             |

## Monde et carte

- Le monde vient de données ouvertes (Natural Earth, relief AWS) ; **vérifier la licence** de toute nouvelle source (`docs/DATA_SOURCES.md`). Jamais de frontière moderne présentée comme celle de 1400, jamais de carte propriétaire.
- Chaque entité historique porte un niveau de fiabilité (`conf`) et, si besoin, une note : pas d'affirmation historique inventée présentée comme sûre.
- Les produits du pipeline sont versionnés (`packages/content/data/world1400`, `apps/web/public/world`) : le jeu ne dépend d'aucune API externe à l'exécution.
- Dans `game-core`, lire les grandes collections via `ctx.r` (vue de lecture, `view.ts`) et n'écrire que via `ctx.s` ; ne jamais muter un objet obtenu par `ctx.r`.
- Coordonnées : longitudes toujours passées par `map/geo.ts` (antiméridien) côté client.

## Style

Commentaires et interface en français, code en anglais. Prettier (`pnpm format`). Composants React fonctionnels ; état serveur (`state/game.ts`) séparé de l'état d'interface (`state/ui.ts`).
