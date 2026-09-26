# Pipeline de la carte du monde

Le monde du jeu est produit par un pipeline **reproductible** (`tools/worldgen`) à partir de données géographiques ouvertes. Aucune frontière moderne n'est reprise : seules la géographie physique (terres, relief, fleuves, lacs) et des toponymes servent d'entrée ; les découpages politiques de 1400 sont reconstruits à partir des entités historiques décrites dans `packages/content/src/world1400/`.

```bash
pnpm world:build       # tout : sources → rasters → provinces → géométries → tuiles → monde
pnpm world:politics    # seulement l'étape 6 (après une modification des entités historiques)
pnpm world:validate    # contrôles de cohérence du monde et du contenu
```

Les sources brutes sont téléchargées dans `.cache/` (non versionné, ré-téléchargeable). Les produits dérivés sont versionnés : le jeu ne dépend d'aucune API externe à l'exécution.

## Étapes

| Étape         | Script               | Sortie                                                                                                                                                 |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Sources    | `fetch-sources.ts`   | Natural Earth (GeoJSON 10m/50m), tuiles d'altitude Terrarium z5                                                                                        |
| 2. Rasters    | `build-rasters.ts`   | grilles 0,05° (≈ 5,5 km) : altitude, masque terre/eau/lac, déserts, force des fleuves                                                                  |
| 3. Provinces  | `build-provinces.ts` | `.cache/worldgen/provinces.{bin,json}` : 5 747 provinces, 360 zones maritimes, adjacences, détroits                                                    |
| 4. Géométries | `build-geometry.ts`  | `apps/web/public/world/` : `provinces.topo.json`, `borders.json`, `coast.geojson`, `seas.topo.json`, `rivers.geojson`, `lakes.geojson`, `minimap.webp` |
| 5. Tuiles     | `build-tiles.ts`     | `apps/web/public/world/terrain/{z}/{x}/{y}.webp` (z0–z5, relief ombré, bathymétrie)                                                                    |
| 6. Monde 1400 | `build-world.ts`     | `packages/content/data/world1400/{world,start}.json` (+ aperçu `.cache/worldgen/political.png`)                                                        |

### Découpage en provinces (étape 3)

1. Poids de peuplement par cellule : lieux habités, foyers historiques, fleuves, altitude, climat. Les déserts, la toundra et la haute montagne donnent de grandes provinces ; les vallées peuplées de petites.
2. Budgets par macro-région (`regions.ts`), graines tirées le long d'une courbe de Hilbert puis relaxation de Lloyd pondérée.
3. Remplissage Dijkstra multi-sources : le coût croît avec la pente et au franchissement des grands fleuves, de sorte que les frontières suivent crêtes et rivières.
4. Îles notables : une province chacune ; les îlots rejoignent la province la plus proche par la mer.
5. Zones maritimes : même procédé sur l'eau, plus denses près des côtes.
6. Adjacences terrestres, détroits (≤ 40 km d'eau, dédoublonnés), liens province–mer.

### Géométries et frontières (étape 4)

Les polygones sont lissés puis découpés par les terres Natural Earth pour obtenir des côtes nettes. Les frontières ne sont **pas** tirées des polygones découpés (des arcs internes y deviendraient orphelins) : `borders.json` contient les arcs communs exacts de la topologie lissée, densifiés (≤ 0,02°), réduits aux terres, avec les deux provinces voisines `a` et `b` (coordonnées en millidegrés, codage différentiel). Le client compose ainsi n'importe quelle frontière par un filtre : `clé(a) ≠ clé(b)` (royaume, vassal, province) ou `dedans(a) ≠ dedans(b)` (liseré du royaume du joueur).

### Monde 1400 (étape 6)

1. **Cultures et confessions** : Dijkstra multi-sources depuis les zones d'ancrage (`zones.ts`), puis depuis les capitales des entités.
2. **Territoires** : Dijkstra par entité depuis ses ancrages avec une portée et un poids ; attribution par score distance/poids, résolution des capitales, nettoyage de contiguïté et remplissage des enclaves.
3. **Peuples non listés** : les provinces restantes sont regroupées par culture en entités marquées « approximation de jeu » (étiquette discrète sur la carte).
4. **Toponymes** : lieux de 1400 (`places.ts`), lieux Natural Earth renommés à leur forme d'époque, lieu inutilisé le plus proche, île, fleuve (amont/cours moyen/aval), région physique ; déduplication par suffixe de direction.
5. **Hiérarchie de jure** : comté (province) → duché (division de l'entité, partition par graines éloignées et bissection) → royaume → empire (macro-région), titres régionaux et titres de terres désolées.

## Rendu (client)

`apps/web/src/map/WorldMap.ts` (MapLibre GL, projection Mercator avec copies du monde) :

- couches : relief raster, zones maritimes, remplissage des provinces piloté par `feature-state` (couleur, opacité, survol, sélection), lacs, fleuves, côtes, frontières de provinces / vassaux / royaumes, liseré et halo dorés du royaume du joueur, itinéraires, capitales ;
- niveaux de détail : opacités et épaisseurs interpolées au zoom, étiquettes de royaumes proportionnelles à l'emprise à l'écran (canevas superposé, `labels.ts`), noms de provinces au-delà du zoom 4,2 ;
- antiméridien (`geo.ts`) : `normalizeLongitude`, `unwrapGeometry`, `getWrappedBounds` (plus petite emprise déroulée), `fitFeatureSafely` ; un royaume à cheval sur ±180° (Tonga, Tchoukotka) est cadré sans dézoomer sur la planète ;
- navigation : H (royaume), Maj+H (capitale), Ctrl+F (recherche), Ctrl+1…5 / Maj+Ctrl+1…5 (signets), Alt+←/→ (historique), mini-carte cliquable, indicateur du royaume hors écran.
