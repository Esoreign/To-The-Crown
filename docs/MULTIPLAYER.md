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
