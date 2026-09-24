# Conception du jeu

Toutes les valeurs numériques citées proviennent de `packages/game-core/src/balance.ts` (source unique de vérité).

## Boucle de jeu

Le temps s'écoule en jours (années de 365 jours, mois réels). Trois vitesses ; les événements majeurs mettent la partie en pause en solo. Chaque jour : déplacements, batailles, sièges, constructions, file d'événements. Chaque 1er du mois : économie, santé, fertilité, éducation, stress, conseil, complots, factions, IA, événements aléatoires. Chaque 1er janvier : vieillissement, statistiques dynastiques.

**Défaite** : le joueur n'a plus d'héritier jouable à la mort de son personnage. **Score dynastique** : comtés, prestige, descendants, durée, guerres et batailles gagnées, renommée.

## Personnages

- Cinq compétences (diplomatie, martial, gestion, intrigue, savoir) = base + traits + modificateurs, décomposées en info-bulle.
- 69 traits : personnalité (axes d'IA, tags de stress), éducation (niveaux 1–4), commandement, santé et maladies, réputation, congénitaux (héritables).
- Santé 0–10 et mortalité de Gompertz (≈0,4 %/an à 30 ans, 12 %/an à 70 ans), mortalité infantile, maladies et épidémies.
- Fertilité et conception mensuelle (0,032 pour un couple fertile), grossesse de 270 jours, jumeaux, décès en couches.
- Éducation de l'enfance à 16 ans : orientation et précepteur déterminent le trait d'éducation.
- Stress 0–300 : trois paliers (100, 200, 300) déclenchent crises et séquelles ; décroissance mensuelle 2,5. Les choix contraires à la personnalité stressent (tags).

## Famille et succession

- Mariage à partir de 16 ans ; les mariages entre souverains créent des alliances ; fiançailles d'enfants.
- Lois : **partage** (titres répartis entre fils/filles, l'aîné garde le principal), **primogéniture** (autorité royale 2 requise), **élection** (vassaux électeurs, votes pondérés par l'opinion et les qualités), **ancienneté** (le plus âgé de la dynastie).
- Doctrines de confession : femmes exclues, admises ou égales.
- Héritier désigné, bâtards cachés (secret), nouvelle opinion des vassaux à l'avènement (−15 pendant 3 ans).

## Titres et royaume

- Comté → duché → royaume → empire, hiérarchie *de jure* ; création d'un titre avec 50 %/60 %/70 % des terres de jure et un coût en or et prestige.
- Limite de domaine = 2 + gestion/6 + bonus de rang ; au-delà, pénalité de 12 % par comté sur impôts et levées.
- Autorité royale 0–3 : part des impôts vassaux 12 %→30 %, des levées 20 %→50 %, opinion +5→−15 ; coûts 150/300/500 d'autorité, 10 ans entre deux changements.
- Révocation (120 autorité si injustifiée, tyrannie), emprisonnement (60), exécution (100), indépendance, octroi de titres.
- Factions de vassaux mécontents (indépendance, réduction d'autorité, prétendant, autonomie) : puissance comparée, mécontentement jusqu'à l'ultimatum puis la révolte.

## Économie

- Impôt de province = développement × 0,03 × modificateurs (bâtiments, culture, confession, seigneur), réduit par le contrôle et l'occupation.
- Revenus : domaine, taxes vassales, intendant, bonus de gestion, traits. Dépenses : tribut au suzerain, cour (selon le rang), levées en campagne, hommes d'armes, intérêts de la dette.
- 19 bâtiments (économie, militaire, défense, prestige) avec niveaux, prérequis (côte, terrain, développement, bâtiment) et emplacements par province.
- Développement (croissance 0,02/mois) et contrôle (récupération 0,6/mois).

## Conseil

Cinq sièges, deux tâches chacun : relations/prestige, entraînement/contrôle, impôts/développement, secrets/contre-espionnage, ferveur/savoir. L'effet dépend de la compétence du conseiller et s'affiche dans l'écran du conseil.

## Opinion

Somme décomposée : réputation (traits), attirance, liens familiaux (+20 parent/enfant/conjoint, +10 fratrie et dynastie), foi (−20 différente, −8 sœur), culture, alliance (+15), guerre (−40), relations (ami +40, meilleur ami +80, rival −40, ennemi juré −80, amant +30, âme sœur +60…), souvenirs datés (cadeaux, emprisonnement, révocation…).

## Diplomatie et intrigue

- Cadeaux (1,2 d'opinion par 10 or, plafond 40), alliances, vassalisation, invitation à la cour, appel aux armes, rançons. Chaque proposition à l'IA affiche la décomposition d'acceptation ; entre joueurs, elle devient une proposition à accepter ou refuser.
- Complots : puissance (compétence, agents recrutés) contre résistance (compétence de la cible, maître-espion) ; chance de réussite et de découverte mensuelle ; complot découvert = crime, justifie emprisonnement et révocation.
- Secrets (amour interdit, corruption, meurtre, bâtardise, dette, crime politique, hérésie) → leviers ; un levier force l'acceptation d'une proposition ; révéler un secret provoque un scandale.

## Guerre

- Casus belli : revendications (comté, duché, royaume), indépendance, prétendant, guerre sainte, conquête des steppes, révolte de faction ; trêve après la paix.
- Levées (selon développement, contrôle, bâtiments) et hommes d'armes (fantassins, archers, piquiers, cavalerie légère et lourde, engins de siège) avec contre-unités et terrains favorables.
- Déplacement par A* sur le graphe des provinces (8 jours de base, multiplicateurs de terrain, détroits 16 jours) ; ravitaillement.
- Batailles en phases (escarmouche, mêlée, poursuite), avantage du commandant et du terrain, moral ; sièges selon le niveau de fort et les engins ; occupation.
- Score de guerre = batailles + occupations + tenue de l'objectif ; 100 pour imposer ses conditions ; paix blanche évaluée par l'IA ; guerre enlisée forcée à la paix.

## Événements

120 événements pilotés par données (conditions, cibles, choix, coûts, effets, pondération IA). Les effets affichés sont générés depuis les effets réels ; les choix « incertains » affichent `???`. Voir `docs/EVENTS.md`.

## Intelligence artificielle

Chaque souverain IA réfléchit périodiquement selon sa personnalité (ambition, honneur, agressivité, cupidité, sociabilité, prudence, intrigue, loyauté, compassion, zèle) : conseil, mariages de sa famille, constructions, création de titres, guerres si le rapport de force le permet, alliances, complots, factions, choix d'événements. Difficulté (clémente, normale, impitoyable) et fréquence des événements réglables.
