# Le monde de 1400

Scénario `monde_1400`, départ le **1er janvier 1400**. Données : `packages/content/src/world1400/` (entités, zones culturelles, toponymes, gouvernements) et `packages/content/data/world1400/` (monde compact produit par le pipeline, voir [MAP_PIPELINE.md](MAP_PIPELINE.md)).

## En chiffres

- 5 747 provinces (comtés) sur toutes les terres habitées, 360 zones maritimes, détroits ;
- 7 284 titres de jure (comtés, duchés, royaumes, empires, titres régionaux) ;
- 293 entités historiques rédigées (Europe 112, Asie de l'Est et du Sud-Est 49, Afrique 39, Amériques et Pacifique 34, Asie du Sud 30, Asie de l'Ouest et centrale 29) et des entités « approximation de jeu » pour les peuples non listés ;
- ~3 500 personnages vivants : souverains documentés, conjoints, enfants, gouverneurs et courtisans générés de façon déterministe (graine 1400) ;
- 148 cultures, 29 confessions, 18 formes de gouvernement.

## Principes

- **Non eurocentré** : chaque continent a ses États, ses titres propres (mansa, tlatoani, huey tlatoani, sapa inca, shogun, maharaja…), ses gouvernements et ses départs conseillés.
- **Fiabilité affichée** : chaque entité porte `conf` (`high`, `medium`, `low`, `gameplayApproximation`) et une note, visibles dans l'écran Nouvelle partie.
- **Pas de frontière moderne** : les territoires sont calculés à partir d'ancrages (capitale, villes, portée) sur le graphe des provinces.
- **Déterminisme** : `buildScenario()` produit toujours le même monde (PRNG à graine fixe).

## Décrire une entité

```ts
P({
  id: 'jos',
  name: 'Royaume de Joseon',
  short: 'Joseon',
  adj: 'coréen',
  rank: 'kingdom',
  gov: 'centralized_monarchy',
  culture: 'korean',
  faith: 'sanjiao',
  color: '#3a5ab8',
  cap: [126.55, 37.97, 'Kaesong'],
  house: 'Yi',
  ruler: ['Banggwa', 1357, 'M', 'Jeongjong'],
  title: ['Roi', 'Reine'],
  liege: 'ming',
  subject: 'tributary',
  conf: 'high',
});
```

`at` ajoute des ancrages (`[lon, lat]` ou `[lon, lat, portée]`), `reach` et `w` règlent l'étendue, `liege` + `subject` créent un contrat de sujétion, `union` place la couronne en union personnelle, `note` documente les choix. Après une modification : `pnpm world:politics`, puis `pnpm world:validate` et les tests.

## Départs conseillés

France (difficile), Angleterre, Castille (facile), Bourgogne, Ottomans, Timourides (facile), Ming (difficile), prince de Yan (difficile), Vijayanagara, Mali, Éthiopie, Japon (Ashikaga), Joseon (facile), Venise, Azcapotzalco, Cuzco (difficile), Kongo, Majapahit, Moscou (difficile).

Au départ : le prince de Yan mène sa guerre contre l'empereur Ming, Bayezid Ier assiège Constantinople, Timour ravage la Géorgie ; l'Angleterre revendique la couronne de France, Louis II d'Anjou celle de Naples.
