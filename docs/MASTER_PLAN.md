# Plan directeur — To The Crown

Objectif : un grand jeu de stratégie dynastique médiévale complet, jouable dans le navigateur, persistant, multijoueur (2–8), testé et documenté. Ce document suit les phases de réalisation et l'état de chaque livrable.

## Phases

| #   | Phase               | Contenu                                                                                                                                                                                                                                                                             | État |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Fondations          | Monorepo pnpm, TypeScript strict, ESLint (règles de déterminisme), Prettier, contrats partagés (types, commandes zod, protocole, calendrier, i18n)                                                                                                                                  | Fait |
| 2   | Monde               | Terre réelle : pipeline géospatial (Natural Earth, relief AWS) → 5 747 provinces, 360 zones maritimes, tuiles de relief, frontières exactes ; hiérarchie comté → empire ; validation (voir `MAP_PIPELINE.md`)                                                                       | Fait |
| 3   | Scénario Monde 1400 | 293 entités historiques avec fiabilité, ~3 500 personnages, 148 cultures, 29 confessions, 18 gouvernements, contrats de sujétion, guerres de départ, 20 départs conseillés (voir `WORLD_1400.md`)                                                                                   | Fait |
| 4   | Moteur              | Simulation déterministe : personnages, famille, succession, titres, vassaux, économie, bâtiments, conseil, opinion, stress, secrets, complots, factions, diplomatie, guerre, armées, batailles, sièges, IA, chronique, fin de partie                                                | Fait |
| 5   | Contenu narratif    | 120 événements (famille, cour, intrigue, santé, succession…), 25 chaînes, vérificateur exhaustif                                                                                                                                                                                    | Fait |
| 6   | Serveur             | Fastify, Argon2id, sessions révocables, CSRF, limitation de débit, PostgreSQL/Drizzle (38 tables), salles de jeu, horloge, sauvegardes, projection relationnelle, Socket.IO, reconnexion                                                                                            | Fait |
| 7   | Client              | Écran titre animé, authentification, paramètres, choix du souverain sur parchemin, multijoueur et salon, HUD complet, carte du monde MapLibre (10 modes, niveaux de détail, antiméridien, recherche, signets, historique), panneaux, écrans, événements, audio procédural, tutoriel | Fait |
| 7b  | Institutions        | Gouvernements, légitimité, tributs, affranchissement (voir `POLITICAL_SYSTEM.md`)                                                                                                                                                                                                   | Fait |
| 8   | Qualité             | Tests unitaires, d'intégration et Playwright ; CI ; Docker ; documentation                                                                                                                                                                                                          | Fait |

## Critères de fin (liste de contrôle)

- [x] Partie solo complète de l'écran titre à la fin de dynastie.
- [x] Multijoueur 2–8 joueurs : salon, code d'invitation, choix, prêt, lancement, discussion, reconnexion, vues privées.
- [x] Persistance : snapshots versionnés (`SAVE_SCHEMA_VERSION`), journal des commandes et des événements, reprise après redémarrage.
- [x] Déterminisme : aucune source d'aléa hors PRNG d'état ; simulation de 30 ans sans violation d'invariant.
- [x] Chaque action joueur est une commande validée côté serveur, idempotente (`commandId`).
- [x] Chaque valeur affichée importante a une info-bulle de décomposition (ressources, compétences, opinion, acceptation IA, impôts…).
- [x] Aucun bouton factice ; aucun texte ou élément graphique repris d'un jeu existant.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` passent.
- [x] `docker compose up --build` décrit la pile complète (postgres, redis, serveur, nginx) avec contrôles de santé.

## Pistes d'évolution

- Traduction anglaise (l'architecture i18n est prête : tables de clés, `Locale`).
- Religion approfondie (hérésies, conversions de province) et cultures dynamiques.
- Carte : brouillard de guerre et connaissance géographique par culture.
- Ordres et états (noblesse, clergé, bourgeoisie…) comme acteurs politiques à part entière.
- Observateur de partie et relecture depuis le journal de commandes.
