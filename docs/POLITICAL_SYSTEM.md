# Système politique

Tout le code vit dans `packages/game-core/src/politics.ts` (et `realm.ts`, `economy.ts`, `war.ts`) ; les archétypes sont des données (`packages/content/src/world1400/governments.ts`) ; tous les nombres sont dans `balance.ts` (`politics`, `authority`, `domain`). Aucune règle ne teste un pays par son nom.

## Gouvernements

Chaque souverain porte un `government` (hérité par le successeur qui n'en a pas). 18 archétypes : monarchie féodale, centralisée ou élective, bureaucratie impériale, sultanat mamelouk, royaume à iqta, confédération des steppes ou tribale, shogunat, royaume de clans, république urbaine ou marchande, cité-État, théocratie, ordre religieux, empire tributaire, royaume mandala, chefferie.

| Champ                                            | Effet en jeu                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `subjectTax`, `subjectLevy`                      | multiplient l'impôt et les levées exigés des vassaux (référence 0,3 / 0,4 dans `balance.politics`) |
| `maxAuthority`, `authorityCost`                  | plafond (sur l'échelle 0–3) et coût en autorité pour renforcer le pouvoir central                  |
| `vassalWars`                                     | les vassaux d'un même suzerain peuvent se faire la guerre (si l'autorité est faible) ou non        |
| `succession`                                     | loi de succession coutumière des titres au départ                                                  |
| `legitimacyFrom`, `legitimacyDrift`              | sources de légitimité valorisées et dérive mensuelle                                               |
| `councilTitles`, `rulerTitles`, `authorityLabel` | intitulés affichés (conseil, souverain, pouvoir central)                                           |
| bonus de domaine (`balance.domain.byGovernment`) | nombre de comtés tenus sans pénalité                                                               |
| conquête (`war.ts`)                              | les gouvernements guerriers disposent d'un casus belli de conquête frontalière                     |

## Légitimité

Valeur 0–100 par souverain indépendant, qui converge chaque mois vers une **cible décomposée** (onglet Royaume › Institutions, info-bulle) : base, renommée dynastique, prestige (×1,5 si la victoire compte), faveur religieuse, richesse, élection, mandat (autorité), minorité, sagesse de l'âge, folie, crimes connus. Elle pèse sur l'opinion des vassaux ((légitimité − 50) / 5). Un héritier légal part d'une légitimité proche de celle du défunt ; un usurpateur qui s'empare d'un titre par la guerre tombe à 30 au plus.

## Contrats de sujétion

Un contrat (`state.pacts`) relie deux **titres** (il survit aux successions) avec un type, une date et un taux de tribut.

| Type                    | Dans le royaume ? | Effet                                                                                                                             |
| ----------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Vassal direct           | oui               | impôt et ost entiers                                                                                                              |
| Vassal autonome         | oui               | moitié de l'impôt habituel                                                                                                        |
| Union personnelle       | oui               | quart de l'impôt                                                                                                                  |
| Membre de confédération | oui               | 30 % de l'impôt                                                                                                                   |
| Tributaire              | non               | royaume distinct, verse un tribut mensuel (part du revenu de domaine), opinion −10 envers le suzerain, casus belli d'indépendance |
| État client             | non               | royaume distinct, tribut modeste                                                                                                  |

Le suzerain peut **fixer le tribut** (léger 8 %, ordinaire 15 %, lourd 25 % ; opinion du sujet modifiée) ou **affranchir** un sujet (contrat supprimé, sujet indépendant, opinion +40, prestige +60) — commandes `subject.tribute` et `subject.release`, validées côté serveur. Un tributaire victorieux dans une guerre d'indépendance rompt ses contrats. Le tribut apparaît dans les deux trésoreries (`tribute_received`, `tribute_paid`).

Au départ de 1400 : Joseon et d'autres voisins tributaires des Ming, principautés anatoliennes et balkaniques tributaires des Ottomans, vassaux de Timour et de la Horde d'Or, Dotawo sous les Mamelouks, Mexica sous Azcapotzalco, shugo japonais sous le shogun Ashikaga, princes d'Empire vassaux autonomes de l'empereur, Bohême en union personnelle avec la couronne impériale, etc.

## Carte

Modes **Gouvernements** (touche O) et **Sujétions** (touche P) ; les légendes ne montrent que les entrées présentes. L'écran Nouvelle partie affiche le gouvernement, les liens de sujétion et la fiabilité historique de chaque royaume.

## Tests

`packages/game-core/test/politics.test.ts` : contrat tributaire Corée–Ming, tribut dans les deux trésoreries, opinion du tributaire, commandes réservées au suzerain, affranchissement, bornes et convergence de la légitimité.
