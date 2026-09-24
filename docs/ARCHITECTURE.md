# Architecture

## Vue d'ensemble

```
Navigateur (React + PixiJS)                     Serveur Node 24 (Fastify + Socket.IO)
┌────────────────────────────┐   commandes     ┌──────────────────────────────────────┐
│ state/game.ts (vérité reçue)│ ─────────────▶ │ GameRoom (une par partie active)      │
│ state/ui.ts (interface)     │   patches      │   runCommand / stepDay (game-core)    │
│ MapRenderer (Pixi)          │ ◀───────────── │   diffusion : patches publics + vue   │
│ game-core (prévisualisation)│  instantanés   │   privée par joueur                   │
└────────────────────────────┘                 │   sauvegarde → PostgreSQL            │
                                               └──────────────────────────────────────┘
```

## Paquets

| Paquet | Rôle | Dépend de |
| --- | --- | --- |
| `@ttc/shared` | Types d'état (`GameState`, `GameView`, `PrivateView`), commandes zod, protocole, calendrier, i18n, erreurs | zod |
| `@ttc/content` | Monde généré (`data/world.json`), scénario (`data/scenario-1087.json`), cultures, confessions, traits, bâtiments, unités, événements, textes français, validateurs | shared |
| `@ttc/game-core` | Simulation pure et déterministe | shared, content, immer |
| `@ttc/server` | HTTP, WebSocket, base de données, salles | les trois |
| `@ttc/web` | Interface | les trois |

## Moteur (`game-core`)

- **État normalisé** : collections `Record<id, entité>` (personnages, titres, provinces, guerres, armées…), sérialisables telles quelles.
- **Transactions** : `stepDay(state)` et `runCommand(state, actor, cmd)` utilisent `produceWithPatches` d'Immer. Le résultat contient le nouvel état, les patches, les notifications, le journal et une éventuelle demande de pause. Une erreur de commande (`GameError`) laisse l'état intact.
- **Déterminisme** : PRNG xoshiro128** dont l'état vit dans `state.rng` ; ESLint interdit `Math.random` et `Date.now` dans le moteur.
- **Contexte** (`context.ts`) : `Ctx` porte l'état brouillon, le PRNG et les sorties ; `safeRun` isole un traitement fautif et le journalise (une simulation longue compte ces erreurs comme violations).
- **Index structurels** (`index-cache.ts`) : vassaux, courtisans, relations, alliés, membres de maison/dynastie, guerres par personnage ; invalidés par identité de collection (nouvel état) ou par `bumpStructure()` ; `memo()` met en cache des calculs coûteux (succession, provinces du royaume, voisins).
- **Vues** (`views.ts`) : `publicView` retire le PRNG ; `privateViewFor(state, perso)` ne garde que les secrets connus, les complots propres ou découverts, les leviers et événements du joueur ; `publicPatches` filtre les patches touchant des collections privées.
- **Invariants** (`simulate.ts`) : titres tenus par des vivants, cohérence suzerain/rang, conjoints réciproques, armées valides… vérifiés en test sur 10 à 30 ans.

Performance mesurée : ~40–150 ms par jour simulé au début d'une partie (réflexion de l'IA), ~1 ms par commande.

## Serveur

- `app.ts` : Fastify, Helmet, cookies, limitation de débit (Redis ou mémoire), défense CSRF (origine exacte ou en-tête `x-requested-with: ttc`), routes, fichiers statiques optionnels, arrêt gracieux.
- `auth/` : Argon2id (m=19 456 Kio, t=2, p=1), sessions aléatoires dont seul le HMAC est stocké, révocables, cookie `ttc_session` HttpOnly/SameSite=Lax/Secure en production.
- `game/room.ts` : état en mémoire, horloge (vitesses configurables `TICK_MS`), pause (tout joueur) et reprise (hôte), commandes idempotentes (cache LRU + index unique en base), séquence de patches par socket, sauvegarde mensuelle et après pause, projection relationnelle.
- `game/manager.ts` : chargement paresseux depuis le dernier snapshot, déchargement des salles inactives.
- `socket/index.ts` : authentification par cookie à la connexion, validation zod de chaque message, seaux de jetons (commandes, discussion).

## Client

- `state/game.ts` : instantané + patches Immer appliqués dans l'ordre ; trou de séquence → `game:resync`. `world` = vue publique fusionnée à la vue privée.
- `state/ui.ts` : sélection, historique, écran ouvert, mode de carte, menus, toasts, boîtes de dialogue ; jamais synchronisé.
- `map/MapRenderer.ts` : PixiJS 8. Géométries statiques construites une fois (polygones blancs teintés par mode), frontières politiques reconstruites seulement si la structure change, index spatial en grille pour la sélection, niveaux de détail selon le zoom (royaumes → duchés → comtés, blasons, reliefs), armées, batailles, itinéraires. Variante sans `eval` pour une CSP stricte.
- `game/interactions.tsx` : liste des interactions avec un personnage, raisons d'indisponibilité et décomposition d'acceptation calculées avec `game-core` (identique au serveur).
- `lib/eventText.ts` : variables de texte des événements et description automatique des effets.
- Art procédural (`art/`) : blasons, portraits et illustrations d'événements en SVG ; audio (`audio/`) : musique modale et effets synthétisés en WebAudio.

## Flux d'une commande

1. L'interface appelle `sendCommand({ type, payload })` avec un `commandId` UUID.
2. Le serveur valide l'enveloppe (zod), vérifie l'appartenance, le débit et l'idempotence.
3. `runCommand` applique la règle ; en cas d'échec, accusé d'erreur localisé.
4. Succès : patches publics diffusés à tous, vue privée recalculée par joueur si nécessaire, accusé avec résultat (ex. acceptation), commande journalisée.
