# Sources de données et licences

Règle : **vérifier la licence d'une source avant d'intégrer ou de redistribuer ses données.** Aucune donnée n'est tirée d'un jeu, d'une carte ou d'un atlas propriétaire. Aucune frontière politique moderne n'est utilisée pour représenter 1400.

## Géographie physique

| Source                                                                                                                                                                                           | Usage                                                                        | Licence                                                                                                                                                                                                                                   | Redistribution                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [Natural Earth](https://www.naturalearthdata.com/) 10m et 50m (terres, îles mineures, lacs, fleuves, lieux habités, régions physiques, noms marins), via le dépôt `nvkelso/natural-earth-vector` | masque terre/eau, côtes, hydrographie, toponymes de départ, régions          | Domaine public ([conditions](https://www.naturalearthdata.com/about/terms-of-use/))                                                                                                                                                       | Oui, sans condition ; citation appréciée           |
| [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (format Terrarium, z5) — projet Mapzen / Tilezen Joerd                                                                      | altitude et bathymétrie : découpage des provinces, terrain, tuiles de relief | Données ouvertes à attribution ; sources et mentions détaillées dans [la liste d'attribution Joerd](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) (à basse résolution : ETOPO1 — NOAA, GMTED2010 — USGS, SRTM — NASA) | Oui, avec attribution (écran Crédits, ce document) |

Les frontières administratives modernes de Natural Earth (pays, régions) ne sont **pas** téléchargées.

## Histoire (1400)

Entités, souverains, dynasties, capitales, gouvernements, sujétions et notes (`packages/content/src/world1400/polities-*.ts`) sont **rédigés pour le projet** à partir de connaissances historiques générales (chronologies de règnes, capitales, relations de suzeraineté connues). Chaque entité porte un niveau de fiabilité affiché en jeu :

| Niveau                  | Sens                                                      |
| ----------------------- | --------------------------------------------------------- |
| `high`                  | faits bien établis (souverain, capitale, statut)          |
| `medium`                | reconstitution plausible, détails discutés                |
| `low`                   | sources lacunaires, étendue ou souverain incertain        |
| `gameplayApproximation` | regroupement pour le jeu (peuples non listés, chefferies) |

Les étendues territoriales sont des **reconstitutions de jeu** calculées par le pipeline (ancrages, portée), pas des tracés historiques précis. Les personnages secondaires (conjoints, enfants, gouverneurs) sont générés de façon déterministe lorsqu'ils ne sont pas documentés.

## Polices, bibliothèques

Polices SIL OFL 1.1 (Cinzel, Cormorant Garamond, Inter). MapLibre GL JS (BSD-3-Clause), topojson-client (ISC), sharp (Apache-2.0, outil de build seulement), polygon-clipping (MIT), flatbush (ISC).
