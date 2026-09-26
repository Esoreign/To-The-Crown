# Architecture

## Vue d'ensemble

```
Navigateur (React + MapLibre)                   Serveur Node 24 (Fastify + Socket.IO)
┌────────────────────────────┐   commandes     ┌──────────────────────────────────────┐
│ state/game.ts (vérité reçue)│ ─────────────▶ │ GameRoom (une par partie active)      │
│ state/ui.ts (interface)     │   patches      │   runCommand / stepDay (game-core)    │
│ WorldMap (MapLibre GL)      │ ◀───────────── │   diffusion : patches publics + vue   │
│ game-core (prévisualisation)│  instantanés   │   privée par joueur                   │
└────────────────────────────┘                 │   sauvegarde → PostgreSQL            │
                                               └──────────────────────────────────────┘
```

## Paquets

| Paquet                     | Rôle                                                                                                                                                                                                                                                               | Dépend de              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `@ttc/shared`              | Types d'état (`GameState`, `GameView`, `PrivateView`), commandes zod, protocole, calendrier, i18n, erreurs                                                                                                                                                         | zod                    |
| `@ttc/content`             | Monde 1400 (`data/world1400/*.json` produit par `tools/worldgen`), entités historiques, cultures, confessions, gouvernements, construction déterministe du scénario (`world1400/scenario.ts`), traits, bâtiments, unités, événements, textes français, validateurs | shared                 |
| `@ttc/worldgen` (`tools/`) | Pipeline géospatial hors ligne (voir `MAP_PIPELINE.md`)                                                                                                                                                                                                            | shared, content        |
| `@ttc/game-core`           | Simulation pure et déterministe                                                                                                                                                                                                                                    | shared, content, immer |
| `@ttc/server`              | HTTP, WebSocket, base de données, salles                                                                                                                                                                                                                           | les trois              |
| `@ttc/web`                 | Interface                                                                                                                                                                                                                                                          | les trois              |

## Moteur (`game-core`)

- **État normalisé** : collections `Record<id, entité>` (personnages, titres, provinces, guerres, armées…), sérialisables telles quelles.
- **Transactions** : `stepDay(state)` et `runCommand(state, actor, cmd)` utilisent `produceWithPatches` d'Immer. Le résultat contient le nouvel état, les patches, les notifications, le journal et une éventuelle demande de pause. Une erreur de commande (`GameError`) laisse l'état intact.
- **Déterminisme** : PRNG xoshiro128** dont l'état vit dans `state.rng` ; ESLint interdit `Math.random` et `Date.now` dans le moteur.
- **Contexte** (`context.ts`) : `Ctx` porte l'état brouillon, le PRNG et les sorties ; `safeRun` isole un traitement fautif et le journalise (une simulation longue compte ces erreurs comme violations).
- **Index structurels** (`index-cache.ts`) : vassaux, courtisans, relations, alliés, membres de maison/dynastie, guerres par personnage ; invalidés par identité de collection (nouvel état) ou par `bumpStructure()` ; `memo()` met en cache des calculs coûteux (succession, provinces du royaume, voisins).
- **Vues** (`views.ts`) : `publicView` retire le PRNG ; `privateViewFor(state, perso)` ne garde que les secrets connus, les complots propres ou découverts, les leviers et événements du joueur ; `publicPatches` filtre les patches touchant des collections privées.
- **Vue de lecture** (`view.ts`) : `ctx.r` lit un brouillon Immer sans créer de proxy par entité (objet d'origine si non modifié, brouillon sinon) ; les parcours de collections et l'IA lisent par `ctx.r`, les écritures passent par `ctx.s`. `forEachValue` sert aux index.
- **Politique** (`politics.ts`) : gouvernements, légitimité, contrats de sujétion et tributs (voir `POLITICAL_SYSTEM.md`).
- **Étalement** : cycle mensuel des personnages réparti sur les jours 1–28, réflexion de l'IA selon le rang, croissance des provinces annuelle.
- **Invariants** (`simulate.ts`) : titres tenus par des vivants, cohérence suzerain/rang, conjoints réciproques, armées valides… vérifiés en test sur 10 à 30 ans.

Performance mesurée (`pnpm --filter @ttc/game-core perf`, monde entier, ~3 500 personnages) : médiane ~140 ms par jour simulé, p95 ~270 ms ; ~1 ms par commande.

## Serveur

- `app.ts` : Fastify, Helmet, cookies, limitation de débit (Redis ou mémoire), défense CSRF (origine exacte ou en-tête `x-requested-with: ttc`), routes, fichiers statiques optionnels, arrêt gracieux.
- `auth/` : Argon2id (m=19 456 Kio, t=2, p=1), sessions aléatoires dont seul le HMAC est stocké, révocables, cookie `ttc_session` HttpOnly/SameSite=Lax/Secure en production.
- `game/room.ts` : état en mémoire, horloge (vitesses configurables `TICK_MS`), pause (tout joueur) et reprise (hôte), commandes idempotentes (cache LRU + index unique en base), séquence de patches par socket, sauvegarde mensuelle et après pause, projection relationnelle.
- `game/manager.ts` : chargement paresseux depuis le dernier snapshot, déchargement des salles inactives.
- `socket/index.ts` : authentification par cookie à la connexion, validation zod de chaque message, seaux de jetons (commandes, discussion).

## Client

- `state/game.ts` : instantané + patches Immer appliqués dans l'ordre ; trou de séquence → `game:resync`. `world` = vue publique fusionnée à la vue privée.
- `state/ui.ts` : sélection, historique, écran ouvert, mode de carte, menus, toasts, boîtes de dialogue ; jamais synchronisé.
- `map/WorldMap.ts` : MapLibre GL (tuiles de relief, provinces colorées par `feature-state`, frontières composées depuis les arcs exacts de `borders.json`, liseré du royaume du joueur, marqueurs d'armées et de batailles, itinéraires), `map/labels.ts` (étiquettes sur canevas), `map/geo.ts` (antiméridien, emprises), `map/worldData.ts` (chargement unique des géométries). Mini-carte, indicateur hors écran, signets et historique de caméra.
- `game/interactions.tsx` : liste des interactions avec un personnage, raisons d'indisponibilité et décomposition d'acceptation calculées avec `game-core` (identique au serveur).
- `lib/eventText.ts` : variables de texte des événements et description automatique des effets.
- Art procédural (`art/`) : blasons, portraits et illustrations d'événements en SVG ; audio (`audio/`) : musique modale et effets synthétisés en WebAudio.

## Flux d'une commande

1. L'interface appelle `sendCommand({ type, payload })` avec un `commandId` UUID.
2. Le serveur valide l'enveloppe (zod), vérifie l'appartenance, le débit et l'idempotence.
3. `runCommand` applique la règle ; en cas d'échec, accusé d'erreur localisé.
4. Succès : patches publics diffusés à tous, vue privée recalculée par joueur si nécessaire, accusé avec résultat (ex. acceptation), commande journalisée.
