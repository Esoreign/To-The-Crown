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

1. **Serveur autoritaire.** Le client n'envoie que des *commandes* (`packages/shared/src/commands.ts`, validées par zod). Toute règle vit dans `packages/game-core` et est vérifiée côté serveur ; le client ne calcule que des prévisualisations avec les mêmes fonctions.
2. **Déterminisme.** Dans `game-core` : pas de `Math.random`, `Date.now`, `new Date`, ni d'E/S (ESLint l'interdit). Aléa via `ctx.rng` (xoshiro128**, état dans `state.rng`). Une même graine et les mêmes commandes produisent la même partie.
3. **Mutation transactionnelle.** Les systèmes mutent un brouillon Immer dans `stepDay`/`runCommand` ; une erreur de commande annule tout. Les traitements système passent par `safeRun` pour isoler une entité fautive.
4. **Index structurels.** Après toute modification de suzerain, cour, décès, naissance, alliance, relation, maison ou guerre : `bumpStructure()`.
5. **Vues privées.** Secrets, complots, leviers et événements actifs ne transitent que filtrés (`privateViewFor`). Ne jamais ajouter une donnée privée à une collection publique.
6. **Équilibrage centralisé.** Tout nombre de gameplay va dans `packages/game-core/src/balance.ts`.
7. **Données, pas code.** Traits, bâtiments, cultures, confessions, unités et événements sont des données (`packages/content`). Un événement se décrit avec le DSL `Condition`/`Effect` (voir `docs/EVENTS.md`).
8. **Localisation.** Aucun texte d'interface codé en dur hors français naturel des composants ; les libellés de données passent par `LOCALE_FR` (`t('clé')`). Nouvelle clé → `packages/content/src/locales/fr.ts`.
9. **Sauvegardes.** Changer la forme de `GameState` impose d'incrémenter `SAVE_SCHEMA_VERSION` et d'écrire une migration de snapshot (`apps/server/src/game/repository.ts`).
10. **Sécurité.** Mots de passe en Argon2id uniquement ; ne jamais journaliser mot de passe, hash, secret de session, cookie ou jeton. Cookies `HttpOnly`, `SameSite=Lax`, `Secure` en production. Toute route d'état exige l'origine attendue ou l'en-tête `x-requested-with: ttc`.
11. **Pas de faux.** Pas de bouton « bientôt », pas de test vide, pas de contenu repris d'un jeu existant.

## Où modifier quoi

| Besoin | Fichier(s) |
| --- | --- |
| Nouvelle commande joueur | `shared/src/commands.ts` → `game-core/src/commands.ts` → interface (`apps/web/src/game/…`) |
| Nouveau système mensuel | `game-core/src/tick.ts` (+ `safeRun`) |
| Nouvel événement | `content/src/events/*.ts` puis `check:events` |
| Nouvel écran | `apps/web/src/game/screens/` + `ScreenHost.tsx` + `state/ui.ts` (`ScreenId`) |
| Nouvelle table | `apps/server/src/db/schema.ts` puis `pnpm db:generate` |
| Protocole réseau | `shared/src/protocol.ts` (incrémenter `PROTOCOL_VERSION` si incompatible) |

## Style

Commentaires et interface en français, code en anglais. Prettier (`pnpm format`). Composants React fonctionnels ; état serveur (`state/game.ts`) séparé de l'état d'interface (`state/ui.ts`).
