# Multijoueur

## Parcours

1. Un joueur crée un salon (2–8 places, privé sur invitation ou public).
2. Les autres rejoignent avec le **code d'invitation** ou depuis la liste des salons publics.
3. Chacun choisit un souverain (unicité garantie) puis se déclare prêt ; l'hôte règle la difficulté de l'IA et la vitesse maximale, peut expulser.
4. L'hôte lance : la partie est créée côté serveur avec tous les joueurs ; les clients basculent sur l'écran de jeu (`lobby:started`).
5. En jeu : tout joueur peut mettre en pause, seul l'hôte règle la vitesse et relance. Les propositions entre joueurs (mariage, alliance, vassalité, appel aux armes, paix blanche) attendent la réponse de l'autre joueur.
6. Un joueur déconnecté retrouve sa partie en rechargeant la page ou via « Continuer ». Sans joueur connecté, la partie se met en pause.

## Protocole Socket.IO

Chemin `/socket.io`, authentification par le cookie de session. Version de protocole : `PROTOCOL_VERSION` (refus explicite si différente).

| Client → serveur | Charge | Réponse |
| --- | --- | --- |
| `lobby:join` / `lobby:leave` | `{ gameId }` | `LobbyState` puis `lobby:update` |
| `game:join` | `{ gameId, protocolVersion }` | `game:snapshot`, `chat:history` |
| `game:command` | `{ commandId, expectedVersion?, command }` | `AckMessage { ok, error?, result?, version }` |
| `game:resync` | `{ gameId }` | `game:snapshot` |
| `time:set` | `{ gameId, speed }` | `time:update` (hôte seulement) |
| `pause:request` | `{ gameId, paused }` | `time:update` |
| `chat:send` | `{ gameId, text }` (500 caractères, nettoyé) | `chat:message` |
| `dev:advance` | `{ gameId, days }` | outils de développement uniquement |

| Serveur → client | Contenu |
| --- | --- |
| `game:snapshot` | vue publique, vue privée du joueur, horloge, présence, `seq` |
| `game:patch` | `{ seq, version, ops, privateView?, date }` — `seq` strictement croissant par socket |
| `notification:new` | notifications destinées au personnage du joueur |
| `presence:update`, `time:update`, `lobby:update`, `lobby:started`, `lobby:kicked` | état partagé |

## Cohérence

- Les patches publics proviennent d'Immer ; ceux qui touchent des collections privées sont retirés et remplacés, pour chaque joueur concerné, par sa vue privée complète recalculée.
- Le client applique les patches dans l'ordre ; un trou de `seq` déclenche une resynchronisation complète.
- Les commandes sont idempotentes : un `commandId` rejoué renvoie le même accusé (cache mémoire + contrainte unique en base).

## Sécurité

- Le client n'est jamais cru : chaque commande est validée (schéma zod puis règles du moteur avec le personnage du joueur comme acteur).
- Débit : seaux de jetons par socket (commandes, discussion), limites HTTP (inscription, connexion par IP et par compte).
- Vues privées : un joueur ne reçoit que les secrets qu'il connaît, ses complots et ceux qu'il a découverts, ses leviers et ses événements.
- Discussion : texte nettoyé, longueur bornée, réservée aux membres de la partie.

## Mise à l'échelle

Une partie vit dans un seul processus. Avec `SOCKET_REDIS_ADAPTER=true`, plusieurs instances partagent la diffusion Socket.IO ; l'affinité de partie (répartition par `gameId`) doit alors être assurée par le proxy.

## Mode sans serveur (Vercel + Supabase)

Version compilée avec `vite build --mode supabase` (`apps/web/.env.supabase`) : aucun serveur Node, le site est statique.

| Rôle | Où |
| --- | --- |
| Comptes, salons, sauvegardes, discussion | fonctions `ttc_*` de Supabase (`database/supabase/web_mode.sql`), appelées en RPC avec un jeton de session |
| Simulation | Web Worker dans la page de l'**hôte** (`apps/web/src/net/browser/hostRoom.ts`, portage de `GameRoom`) |
| Temps réel | canal Supabase Realtime `ttc:<partie>:<code d'invitation>` (broadcast + présence) |

- L'interface ne change pas : `net/api.ts` traduit les chemins REST en RPC, `net/socket.ts` délègue à `net/browser/session.ts`.
- L'hôte applique ses propres patches comme s'ils venaient d'un serveur et diffuse aux invités des **lots** (toutes les 400 ms) : patches publics numérotés, vues privées modifiées, notifications, horloge. Un lot trop gros (> 180 Ko, limite Realtime 256 Ko) est découpé.
- Les lots arrivés dans le désordre (repli HTTP du temps réel) sont remis en ordre par l'invité ; un trou qui persiste plus de 1,5 s est traité comme une perte.
- Arrivée d'un invité, trou de séquence persistant ou nouvel hôte (« époque ») : l'invité envoie `hello`, l'hôte enregistre l'état (`ttc_save`, avec `seq` et époque) et l'annonce (`snap`) ; l'invité le recharge puis applique les lots reçus entre-temps.
- Commandes des invités : message `cmd` → exécutées par le worker de l'hôte (validation zod + moteur, idempotence, débit limité) → accusé `ack`.
- Salon : sondage `ttc_lobby` toutes les 1,5 s (état, discussion, présence).
- Sauvegardes : début de partie, 1er du mois, toutes les 2 min de jeu, 2 s après une pause ou une commande en pause, onglet masqué, départ de la partie. Les 4 dernières sont conservées.

Limites assumées (partie entre amis) :

- Un état du monde 1400 pèse ~7 Mo : fermer brutalement l'onglet de l'hôte peut perdre les toutes dernières secondes ; « Sauvegarder et quitter » attend la fin de l'envoi.
- **La page de l'hôte doit rester ouverte** ; sinon la partie est en pause (« En attente de l'hôte ») et les invités ne peuvent pas agir.
- L'hôte détient l'état complet : un joueur technique pourrait tricher ou lire les secrets depuis son navigateur ; les invités reçoivent les vues privées de tous. Le mode serveur reste la référence pour un jeu public.
- Mots de passe en bcrypt (pgcrypto) au lieu d'Argon2id ; jeton de session dans le stockage local du navigateur.
