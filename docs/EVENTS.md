# Écrire des événements — To The Crown

Les événements sont des **petites scènes narratives** reçues par les dirigeants. Ils sont entièrement
data-driven : aucune logique spécifique dans le moteur. Le type exact est `EventDef` dans
`packages/shared/src/content-schema.ts` (source de vérité).

## Où ?

`packages/content/src/events/<groupe>.ts` exporte un tableau `EventDef[]`, agrégé dans
`packages/content/src/events/index.ts`. Chaque identifiant est **unique** et en `snake_case`,
préfixé par sa catégorie : `court_spy_leak`, `family_twins_rivalry`…

## Anatomie

```ts
{
  id: 'court_spy_leak',
  category: 'court',             // famille, cour, intrigue… (EventCategory)
  title: 'Le sang sur le sceau',
  text: 'Votre maître-espion affirme qu’un membre du conseil vend des informations à la cour de {other.realm}…',
  illustration: 'council_chamber', // IllustrationKey
  trigger: 'pulse',              // 'pulse' | 'chain' | 'on:<action>'
  weight: 10,                    // poids relatif du tirage
  cooldownDays: 1825,            // délai avant réapparition pour ce personnage (défaut 5 ans)
  once: false,                   // vrai = une seule fois par personnage
  rulerOnly: true,               // défaut : seuls les dirigeants titrés reçoivent l'événement
  conditions: { all: [ { hasCouncil: true }, { isAdult: true } ] },
  target: { pool: 'councillor', where: { skill: 'intrigue', value: { min: 6 }, who: 'target' } },
  other: { pool: 'neighbor_ruler', optional: true },
  portraits: ['root', 'target'],
  major: false,                  // vrai = met la partie en pause en solo
  timeoutDays: 60,               // résolution IA automatique ensuite
  choices: [ /* 2 à 4 choix */ ],
}
```

### Déclencheurs

- `pulse` : tirage aléatoire mensuel parmi les événements éligibles (≈ 1 événement tous les 3–5 mois
  pour un joueur).
- `chain` : jamais tiré au hasard ; déclenché par un effet `triggerEvent` d'un autre événement.
- `on:<action>` : réaction à un fait du jeu. Actions disponibles : `birth` (cible = nouveau-né),
  `death_of_liege` (autre = défunt), `marriage` (cible = conjoint de la famille), `war_declared`
  (cible = agresseur), `battle_won` / `battle_lost` (cible = adversaire, province = lieu),
  `war_won` / `war_lost` (cible = adversaire), `coming_of_age` (racine = jeune adulte, `rulerOnly: false`
  nécessaire), `scheme_discovered` (cible = comploteur), `succession` (autre = prédécesseur),
  `stress_crisis` (racine stressée), `title_gained`, `building_complete` (province = lieu).

### Portées

`root` (le destinataire), `target`, `other`, `actor`, et pour le texte `province`
(province de l'événement, sinon capitale du destinataire).

### Pools de cibles (`target` / `other`)

`spouse`, `heir`, `child`, `adult_child`, `minor_child`, `sibling`, `parent`, `liege`, `vassal`,
`councillor`, `courtier`, `rival`, `friend`, `lover`, `neighbor_ruler`, `enemy_ruler`, `ally`,
`prisoner`, `schemer_against`, `relative`. Le filtre `where` s'évalue avec le candidat en portée
`target` (ou `other`). Sans candidat, l'événement ne se déclenche pas (sauf `optional: true`).

### Variables de texte

Syntaxe `{portée.variable}`. Variables : `name` (prénom), `fullname` (prénom + maison),
`title` (« le duc de Veyr »), `house`, `age`, `culture`, `faith`, `realm` (nom du royaume/titre
principal), `rel` (lien avec le destinataire : « votre fils », « votre vassale »…), et accords :
`il` (il/elle), `le` (le/la), `e` (« » / « e » : `venu{target.e}`), `fils` (fils/fille),
`seigneur` (seigneur/dame). Province : `{province.name}` uniquement.
Le texte s'adresse au joueur au **vouvoiement** (« Votre intendant… »).

### Choix

```ts
{
  id: 'expose',
  label: '« Qu’on me rapporte son nom. »',
  tooltip: 'Vous risquez de froisser le conseil.',   // facultatif
  conditions: { skill: 'intrigue', value: { min: 10 } }, // facultatif : choix réservé
  cost: { gold: 50 },                                   // vérifié et prélevé
  effects: [ { addOpinion: { towards: 'root', value: -15, reason: 'accused' }, who: 'target' } ],
  tags: ['cruel'],                                      // stress selon la personnalité
  ai: { base: 10, traits: { paranoid: 20 }, personality: { intrigue: 0.5 } },
  hiddenEffects: false,                                 // vrai = conséquences affichées « ??? »
}
```

Les effets affichés au joueur sont **générés automatiquement** à partir de `effects` : ce qui est
annoncé est exactement ce qui est appliqué.

### Conditions et effets

Voir `Condition` et `Effect` dans `content-schema.ts`. Exemples d'effets : `addGold`,
`addPrestige`, `addAuthority`, `addFervor`, `addRenown`, `addStress`, `addHealth`, `addOpinion`,
`addMutualOpinion`, `addTrait`, `removeTrait`, `addSkill`, `addModifier`, `setFlag`, `createSecret`,
`discoverSecret`, `exposeSecret`, `createHook`, `addClaim`, `startScheme`, `changeControl`,
`changeDevelopment`, `changeLevies`, `killCharacter`, `woundCharacter`, `imprison`, `release`,
`createRelationship`, `breakRelationship`, `triggerEvent`, `chronicle`, `chance` (en %),
`if/then/else`, `spawnCourtier`, `banish`, `recruitMaa`, `addVassalOpinion`.

`addModifier` : `{ addModifier: { id: 'inspired_court', months: 24, values: { monthly_prestige: 0.5 } } }`
(clés : voir `ModifierKey`). Chaque identifiant de modificateur doit avoir un libellé dans la table de
localisation (`modifier.<id>`), ajouté par le mainteneur si besoin.

### Ordres de grandeur

| Effet                    | Petit | Moyen  | Fort    |
| ------------------------ | ----- | ------ | ------- |
| Or                       | 15–40 | 50–120 | 150–300 |
| Prestige                 | 15–40 | 50–100 | 150–300 |
| Opinion                  | ±5–10 | ±15–25 | ±30–50  |
| Stress                   | ±10   | ±20–30 | ±40–60  |
| Contrôle / développement | ±3–5  | ±8–12  | ±15–25  |

### Qualité d'écriture

- Français soigné, ton médiéval sobre, textes originaux (aucune reprise de textes existants).
  Le monde est la Terre de 1400 : un événement reste **générique** (variables de personnages,
  de lieux et de titres) et n'invente aucun fait sur un personnage historique réel.
- 40 à 120 mots par texte, 2 à 4 choix **réellement différents** (compromis, coûts, risques).
- Pas deux événements identiques à deux mots près. Privilégier les situations qui touchent la
  famille, les relations, les secrets et la politique.
- Les chaînes (`triggerEvent` vers un événement `trigger: 'chain'`) racontent une histoire en
  plusieurs étapes, avec délai `days`.

## Vérifier

```bash
pnpm --filter @ttc/content typecheck
pnpm --filter @ttc/content world:validate     # validation structurelle (ids, traits, chaînes)
pnpm --filter @ttc/game-core check:events     # résout chaque choix sur une copie de l'état
```
