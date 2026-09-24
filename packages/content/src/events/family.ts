import type { Condition, EventDef, ScopeRef } from '@ttc/shared';

/**
 * Événements familiaux : famille, enfance, romance, santé et succession.
 *
 * Chaînes :
 *  - family_marital_rift → family_marital_rift_letter → family_marital_rift_final
 *  - romance_courtly_glances → romance_garden_tryst → romance_lover_demand
 *  - childhood_choose_tutor → childhood_tutor_report
 *  - health_fever_at_court → health_dubious_cure
 *  - succession_bastard_rumour → succession_rumour_inquiry
 *  - romance_heir_lovesick → romance_heir_first_love
 */

/** Le personnage `who` est de sexe opposé au destinataire. */
const oppositeSex = (who: ScopeRef): Condition => ({
  any: [
    { all: [{ isFemale: true }, { isFemale: false, who }] },
    { all: [{ isFemale: false }, { isFemale: true, who }] },
  ],
});

/** Courtisan pouvant devenir l'objet d'une liaison. */
const SUITABLE_SUITOR: Condition = {
  all: [
    { isAdult: true, who: 'target' },
    { age: { min: 18, max: 50 }, who: 'target' },
    { isRuler: false, who: 'target' },
    { not: { isRelative: 'root', who: 'target' } },
    { not: { isSpouseOf: 'root', who: 'target' } },
    oppositeSex('target'),
  ],
};

/** Héritier en âge d'aimer : enfant adulte, non marié et encore jeune. */
const HEIR_OF_AGE_TO_LOVE: Condition = {
  all: [
    { isChildOf: 'root', who: 'target' },
    { isAdult: true, who: 'target' },
    { isMarried: false, who: 'target' },
    { age: { max: 30 }, who: 'target' },
  ],
};

export const EVENTS_FAMILY: EventDef[] = [
  // =========================================================================
  // FAMILLE
  // =========================================================================

  // --- Chaîne : la brouille conjugale ------------------------------------
  {
    id: 'family_marital_rift',
    category: 'family',
    title: 'Le silence à la table',
    text:
      'Depuis trois semaines, {target.name} ne vous adresse plus la parole qu’en présence des serviteurs, et les repas se prennent dans un silence que même les chiens semblent respecter. Nul ne sait plus très bien quelle parole a ouvert la blessure : un mot trop sec au conseil, une promesse oubliée, peut-être rien de plus qu’une lassitude. La cour, elle, a remarqué, et l’on commence à parier sur celui des deux qui cédera le premier.',
    illustration: 'feast',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 1825,
    conditions: {
      all: [{ isAdult: true }, { isMarried: true }, { opinion: { max: 40 }, of: 'target', towards: 'root' }],
    },
    target: { pool: 'spouse' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'apologize',
        label: '« J’ai eu tort. Pardonnez-moi. »',
        effects: [
          { addOpinion: { towards: 'root', value: 20, reason: 'marital_apology' }, who: 'target' },
          { addPrestige: -15 },
        ],
        tags: ['humble', 'forgiving'],
        ai: { base: 10, traits: { humble: 15, compassionate: 10, arrogant: -10 }, personality: { compassion: 0.1 } },
      },
      {
        id: 'jewel',
        label: 'Offrir un joyau en gage de paix',
        cost: { gold: 60 },
        effects: [{ addOpinion: { towards: 'root', value: 15, reason: 'marital_gift' }, who: 'target' }],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 15, greedy: -10 } },
      },
      {
        id: 'separate',
        label: 'Faire préparer des appartements séparés',
        tooltip: 'La brouille risque de s’installer.',
        effects: [
          { addModifier: { id: 'family_separate_chambers', months: 24, values: { fertility: -0.3 } } },
          { addOpinion: { towards: 'root', value: -10, reason: 'marital_rift' }, who: 'target' },
          { addStress: -10 },
          { triggerEvent: { id: 'family_marital_rift_letter', days: 90 } },
        ],
        tags: ['reclusive'],
        ai: { base: 10, traits: { reclusive: 15, arrogant: 10, wrathful: 10 }, personality: { sociability: -0.1 } },
      },
    ],
  },
  {
    id: 'family_marital_rift_letter',
    category: 'family',
    title: 'Une lettre sous la porte',
    text:
      'Un matin, une lettre scellée attend sur votre écritoire. L’écriture est celle de {target.name}, plus hésitante que de coutume. La lettre rappelle les premières années, les promesses échangées devant l’autel, les enfants, et avoue que cette distance lui pèse autant qu’à vous. Elle s’achève sans un reproche, sur une seule question, tracée d’une main qui tremble : faut-il vraiment que cela dure ?',
    illustration: 'bedchamber',
    trigger: 'chain',
    conditions: { isSpouseOf: 'target' },
    target: { pool: 'spouse' },
    portraits: ['target'],
    choices: [
      {
        id: 'come_back',
        label: '« Non. Revenez. »',
        effects: [
          { removeModifier: 'family_separate_chambers' },
          { addMutualOpinion: { with: 'target', value: 25, reason: 'marital_reconciled' } },
          { addStress: -20 },
        ],
        tags: ['forgiving'],
        ai: { base: 15, traits: { compassionate: 15, patient: 10, wrathful: -10 }, personality: { compassion: 0.1 } },
      },
      {
        id: 'on_my_terms',
        label: '« Je reviendrai, mais à mes conditions. »',
        effects: [
          { removeModifier: 'family_separate_chambers' },
          { addOpinion: { towards: 'root', value: 5, reason: 'marital_reconciled' }, who: 'target' },
          { addAuthority: 15 },
        ],
        tags: ['ambitious'],
        ai: { base: 10, traits: { arrogant: 15, ambitious: 10 } },
      },
      {
        id: 'no_answer',
        label: 'Laisser la lettre sans réponse',
        effects: [
          { addOpinion: { towards: 'root', value: -20, reason: 'marital_rift' }, who: 'target' },
          { triggerEvent: { id: 'family_marital_rift_final', days: 120 } },
        ],
        tags: ['reclusive', 'vengeful'],
        ai: { base: 5, traits: { wrathful: 15, reclusive: 10, compassionate: -10 } },
      },
    ],
  },
  {
    id: 'family_marital_rift_final',
    category: 'family',
    title: 'Deux étrangers sous un même toit',
    text:
      'Une saison a passé depuis la lettre restée sans réponse. {target.name} ne vient plus aux offices, ne paraît plus aux banquets, et ses fidèles se sont peu à peu éloignés de votre entourage. Hier, votre chambellan vous a rapporté qu’une correspondance suivie partait chaque semaine vers sa famille d’origine. Ce qui n’était qu’une querelle est devenu une frontière, et chacun à la cour a déjà choisi son côté.',
    illustration: 'throne_room',
    trigger: 'chain',
    conditions: { isSpouseOf: 'target' },
    target: { pool: 'spouse' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'last_attempt',
        label: 'Tenter une ultime réconciliation',
        tooltip: 'Il est peut-être trop tard.',
        cost: { prestige: 30 },
        effects: [
          {
            chance: 50,
            then: [
              { removeModifier: 'family_separate_chambers' },
              { addMutualOpinion: { with: 'target', value: 30, reason: 'marital_reconciled' } },
            ],
            else: [{ addOpinion: { towards: 'root', value: -10, reason: 'marital_rift' }, who: 'target' }, { addStress: 20 }],
          },
        ],
        tags: ['humble', 'forgiving'],
        ai: { base: 10, traits: { compassionate: 15, humble: 10, arrogant: -15 } },
      },
      {
        id: 'cold_peace',
        label: 'Accepter cette paix froide',
        effects: [
          { addModifier: { id: 'family_cold_marriage', months: 60, values: { fertility: -0.4, stress_gain_mult: 0.1 } } },
          { removeModifier: 'family_separate_chambers' },
          { addPrestige: -20 },
        ],
        tags: ['reclusive'],
        ai: { base: 10, traits: { content: 10, reclusive: 10, patient: 10 } },
      },
      {
        id: 'strip_household',
        label: 'Lui retirer sa maison et ses revenus',
        effects: [
          { addGold: 50 },
          { addOpinion: { towards: 'root', value: -40, reason: 'marital_humiliation' }, who: 'target' },
          { createRelationship: { type: 'rival', with: 'target' } },
        ],
        tags: ['cruel', 'vengeful'],
        ai: { base: 5, traits: { cruel: 20, wrathful: 15, greedy: 10, compassionate: -20 } },
      },
    ],
  },

  // --- Ambitions du conjoint -------------------------------------------------
  {
    id: 'family_spouse_ambition',
    category: 'family',
    title: 'Une place à vos côtés',
    text:
      '{target.name} a pris l’habitude d’assister aux audiences depuis la tribune, et vous savez que chaque nom, chaque grief y est retenu. Ce soir, {target.rel} vous demande ouvertement ce qui n’était jusqu’ici que suggéré : siéger à vos côtés, entendre les requêtes, gérer en votre nom les revenus d’un domaine. « Je ne vous demande pas de régner à deux, dit {target.name}. Seulement de ne plus me laisser à la porte. »',
    illustration: 'throne_room',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 3650,
    conditions: {
      all: [
        { isAdult: true },
        { isMarried: true },
        {
          any: [
            { hasTrait: 'ambitious', who: 'target' },
            { skill: 'diplomacy', value: { min: 9 }, who: 'target' },
            { skill: 'stewardship', value: { min: 9 }, who: 'target' },
          ],
        },
      ],
    },
    target: { pool: 'spouse', where: { isAdult: true, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'share_audiences',
        label: 'Lui ouvrir la salle d’audience',
        effects: [
          { addModifier: { id: 'family_spouse_counsel', months: 60, values: { diplomacy: 2, monthly_authority: -0.1 } } },
          { addOpinion: { towards: 'root', value: 25, reason: 'shared_power' }, who: 'target' },
        ],
        tags: ['humble'],
        ai: { base: 10, traits: { trusting: 15, humble: 10, paranoid: -15 } },
      },
      {
        id: 'give_domain',
        label: 'Lui confier l’intendance d’un domaine',
        effects: [
          { addModifier: { id: 'family_spouse_stewardship', months: 60, values: { monthly_income_mult: 0.05 } } },
          { addOpinion: { towards: 'root', value: 15, reason: 'spouse_stewardship' }, who: 'target' },
          { addSkill: { skill: 'stewardship', value: 1 }, who: 'target' },
        ],
        ai: { base: 10, traits: { diligent: 10, greedy: 5 } },
      },
      {
        id: 'refuse',
        label: '« Votre place est ailleurs. »',
        effects: [
          { addOpinion: { towards: 'root', value: -20, reason: 'denied_ambition' }, who: 'target' },
          { addAuthority: 10 },
        ],
        ai: { base: 5, traits: { paranoid: 20, arrogant: 15 }, personality: { ambition: 0.1 } },
      },
    ],
  },

  // --- Retour d'un parent éloigné -------------------------------------------
  {
    id: 'family_estranged_relative',
    category: 'family',
    title: 'Le retour de l’absent',
    text:
      'Un voyageur couvert de la poussière des routes s’est présenté ce matin à la poterne, et le garde a mis longtemps à reconnaître {target.fullname}, {target.rel}. Des années ont passé depuis la dispute qui l’avait éloigné{target.e} des vôtres ; nul ne se souvient plus très bien qui avait raison. Amaigri{target.e}, les bottes usées, le regard méfiant, {target.name} ne réclame rien d’autre qu’une place au feu. Du moins pour l’instant.',
    illustration: 'castle_walls',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 3650,
    conditions: { isAdult: true },
    target: { pool: 'relative', where: { all: [{ isAdult: true, who: 'target' }, { isRuler: false, who: 'target' }] } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'embrace',
        label: 'L’accueillir à bras ouverts',
        cost: { gold: 40 },
        effects: [{ addMutualOpinion: { with: 'target', value: 25, reason: 'family_welcomed' } }],
        tags: ['forgiving', 'compassionate'],
        ai: { base: 10, traits: { compassionate: 15, sociable: 10, generous: 10 } },
      },
      {
        id: 'watch',
        label: 'Lui offrir le gîte, et rien de plus',
        tooltip: 'Vos gens surveilleront ses allées et venues.',
        effects: [
          { addOpinion: { towards: 'root', value: 5, reason: 'family_welcomed' }, who: 'target' },
          { chance: 30, then: [{ discoverSecret: { of: 'target' } }] },
        ],
        ai: { base: 10, traits: { paranoid: 15, patient: 5 }, personality: { caution: 0.1 } },
      },
      {
        id: 'send_away',
        label: 'Renvoyer {target.name} sur les routes',
        effects: [
          { addOpinion: { towards: 'root', value: -35, reason: 'family_rejected' }, who: 'target' },
          { banish: true, who: 'target' },
          { addAuthority: 10 },
        ],
        tags: ['cruel', 'vengeful'],
        ai: { base: 5, traits: { wrathful: 15, cruel: 15, compassionate: -20 } },
      },
    ],
  },

  // --- Dernières volontés d'un parent -------------------------------------------
  {
    id: 'family_parent_last_wishes',
    category: 'family',
    title: 'Les dernières volontés',
    text:
      '{target.fullname} vous a fait mander au chevet de son lit. Le souffle est court, mais la main qui serre la vôtre est étonnamment ferme. « Je n’ai plus beaucoup d’hivers devant moi, murmure {target.rel}. Promettez-moi que notre maison ne se déchirera pas quand je ne serai plus là, et que vous veillerez sur les vôtres avant de veiller sur vos terres. » Les serviteurs se sont retirés ; personne d’autre n’entendra votre réponse.',
    illustration: 'bedchamber',
    trigger: 'pulse',
    weight: 10,
    once: true,
    conditions: { isAdult: true },
    target: { pool: 'parent', where: { age: { min: 60 }, who: 'target' } },
    portraits: ['target'],
    choices: [
      {
        id: 'swear',
        label: '« Je vous le jure. »',
        tooltip: 'Une promesse faite au lit de mort engage toute une maison.',
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'deathbed_oath' }, who: 'target' },
          { setFlag: 'family_deathbed_oath', months: 120 },
          { addPrestige: 20 },
          { addRenown: 10 },
        ],
        tags: ['honest'],
        ai: { base: 15, traits: { honest: 15, loyal: 15 }, personality: { honor: 0.1 } },
      },
      {
        id: 'truth',
        label: '« Je ne ferai pas de promesse que je ne puis tenir. »',
        effects: [
          { addOpinion: { towards: 'root', value: -10, reason: 'refused_oath' }, who: 'target' },
          { addStress: -10 },
        ],
        tags: ['honest'],
        ai: { base: 5, traits: { just: 10, honest: 10, ambitious: 10 } },
      },
      {
        id: 'comfort_lie',
        label: 'Promettre, sans y croire',
        effects: [{ addOpinion: { towards: 'root', value: 25, reason: 'deathbed_oath' }, who: 'target' }],
        tags: ['deceitful'],
        ai: { base: 5, traits: { deceitful: 20, fickle: 10 }, personality: { intrigue: 0.1 } },
      },
    ],
  },

  // --- Mariage d'un enfant ------------------------------------------------------
  {
    id: 'family_child_wedding',
    category: 'family',
    title: 'Un enfant qui s’en va',
    text:
      'Les cloches ont sonné, les vœux ont été prononcés, et {target.name}, {target.rel}, appartient désormais à un autre foyer autant qu’au vôtre. Au banquet, entre deux coupes, vous observez ce visage rire avec sa nouvelle famille, et vous vous surprenez à compter les années écoulées depuis ses premiers pas. Avant le départ du cortège, il vous reste à décider de ce que vous lui donnerez.',
    illustration: 'wedding',
    trigger: 'on:marriage',
    weight: 10,
    conditions: { isChildOf: 'root', who: 'target' },
    target: { pool: 'adult_child', where: { isMarried: true, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'dowry',
        label: 'Une dot généreuse',
        cost: { gold: 80 },
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'wedding_gift' }, who: 'target' },
          { addPrestige: 30 },
        ],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 15, greedy: -15 } },
      },
      {
        id: 'counsel',
        label: 'Un conseil, rien de plus',
        effects: [
          { addSkill: { skill: 'diplomacy', value: 1 }, who: 'target' },
          { addOpinion: { towards: 'root', value: 10, reason: 'parental_counsel' }, who: 'target' },
        ],
        ai: { base: 10, traits: { patient: 10, greedy: 10 } },
      },
      {
        id: 'remind_duty',
        label: '« N’oubliez jamais à qui vous devez ce mariage. »',
        effects: [
          { addOpinion: { towards: 'root', value: -10, reason: 'stern_reminder' }, who: 'target' },
          { createHook: { on: 'target', years: 10 } },
        ],
        tags: ['ambitious'],
        ai: { base: 5, traits: { ambitious: 15, arrogant: 10 }, personality: { intrigue: 0.1 } },
      },
    ],
  },

  // =========================================================================
  // ENFANCE
  // =========================================================================
  {
    id: 'childhood_talent_revealed',
    category: 'childhood',
    title: 'Un don précoce',
    text:
      'Le chapelain vous a remis, un peu gêné, une liasse de feuillets couverts d’une écriture d’enfant : des calculs d’arpentage, des cartes de vos terres, une chronique de la maison où ne manque aucune date. L’auteur en est {target.name}, {target.rel}, qui n’a que {target.age} ans. « Je n’ai rien eu à lui enseigner, avoue le prêtre. Il faudrait maintenant quelqu’un qui en sache davantage que moi. »',
    illustration: 'library',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 1825,
    conditions: { isAdult: true },
    target: { pool: 'minor_child', where: { age: { min: 6, max: 15 }, who: 'target' } },
    portraits: ['target'],
    choices: [
      {
        id: 'master',
        label: 'Faire venir un maître de l’université',
        cost: { gold: 70 },
        effects: [
          { addSkill: { skill: 'learning', value: 2 }, who: 'target' },
          { addOpinion: { towards: 'root', value: 15, reason: 'nurtured_talent' }, who: 'target' },
        ],
        ai: { base: 10, traits: { diligent: 10, greedy: -10 }, personality: { greed: -0.1 } },
      },
      {
        id: 'praise',
        label: '« Montrez-moi tout cela devant la cour. »',
        effects: [
          { addPrestige: 15 },
          { addSkill: { skill: 'learning', value: 1 }, who: 'target' },
          { addOpinion: { towards: 'root', value: 20, reason: 'praised_publicly' }, who: 'target' },
          { chance: 30, then: [{ addTrait: 'arrogant', who: 'target' }] },
        ],
        tags: ['social'],
        ai: { base: 10, traits: { sociable: 10, arrogant: 10 } },
      },
      {
        id: 'temper',
        label: '« Qu’on ne lui monte pas la tête. »',
        effects: [
          { addOpinion: { towards: 'root', value: -10, reason: 'belittled' }, who: 'target' },
          { chance: 50, then: [{ addTrait: 'humble', who: 'target' }] },
        ],
        ai: { base: 5, traits: { humble: 10, just: 5, sociable: -5 } },
      },
    ],
  },
  {
    id: 'childhood_cruel_streak',
    category: 'childhood',
    title: 'Ce que l’on trouve au fond du puits',
    text:
      'Le maître des chiens est venu vous trouver, le bonnet à la main. Depuis plusieurs semaines, des bêtes disparaissent des chenils et des cuisines ; ce matin, on en a retrouvé une au fond du puits, et {target.name}, {target.rel}, se tenait sur la margelle, parfaitement calme. Interrogé{target.e}, l’enfant n’a montré ni honte ni peur, seulement une curiosité tranquille qui a glacé le vieil homme jusqu’aux os.',
    illustration: 'castle_walls',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 3650,
    conditions: { isAdult: true },
    target: {
      pool: 'minor_child',
      where: { all: [{ age: { min: 5, max: 15 }, who: 'target' }, { not: { hasTrait: 'compassionate', who: 'target' } }] },
    },
    portraits: ['target'],
    choices: [
      {
        id: 'punish',
        label: 'Une punition exemplaire',
        effects: [
          { addOpinion: { towards: 'root', value: -20, reason: 'harsh_punishment' }, who: 'target' },
          { chance: 50, then: [{ removeTrait: 'cruel', who: 'target' }], else: [{ addTrait: 'wrathful', who: 'target' }] },
        ],
        ai: { base: 10, traits: { just: 10, wrathful: 10 } },
      },
      {
        id: 'puppy',
        label: 'Lui confier un chiot à élever',
        effects: [
          { addOpinion: { towards: 'root', value: 10, reason: 'gentle_lesson' }, who: 'target' },
          { chance: 60, then: [{ addTrait: 'compassionate', who: 'target' }], else: [{ addTrait: 'cruel', who: 'target' }] },
        ],
        tags: ['compassionate'],
        ai: { base: 10, traits: { compassionate: 20, patient: 10 } },
      },
      {
        id: 'shrug',
        label: '« Les loups ne naissent pas agneaux. »',
        effects: [{ addTrait: 'cruel', who: 'target' }, { addStress: -5 }],
        tags: ['cruel'],
        ai: { base: 5, traits: { cruel: 25, compassionate: -20 }, personality: { compassion: -0.2 } },
      },
    ],
  },

  // --- Chaîne : le précepteur -----------------------------------------------
  {
    id: 'childhood_choose_tutor',
    category: 'childhood',
    title: 'Le choix d’un précepteur',
    text:
      '{target.name} atteint l’âge où l’on cesse de courir dans les cuisines pour apprendre ce que sera sa vie. Trois noms circulent au conseil : un lettré des Veilleurs de l’Aube, réputé aussi sévère que savant ; un vieux capitaine couturé de cicatrices, qui a servi trois seigneurs ; une dame de cour dont on dit qu’elle connaît les secrets de chaque maison de {root.realm}. Le choix vous revient, et l’enfant le sait.',
    illustration: 'library',
    trigger: 'pulse',
    weight: 12,
    cooldownDays: 1095,
    conditions: { isAdult: true },
    target: {
      pool: 'minor_child',
      where: { all: [{ age: { min: 7, max: 12 }, who: 'target' }, { not: { hasFlag: 'childhood_has_tutor', who: 'target' } }] },
    },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'scholar',
        label: 'Le lettré des Veilleurs',
        cost: { gold: 50 },
        effects: [
          { addSkill: { skill: 'learning', value: 2 }, who: 'target' },
          { setFlag: 'childhood_has_tutor', who: 'target' },
          { setFlag: 'childhood_tutor_scholar', who: 'target' },
          { triggerEvent: { id: 'childhood_tutor_report', days: 180 } },
        ],
        ai: { base: 10, traits: { patient: 10, zealous: 5, cynical: 5 }, personality: { zeal: 0.05 } },
      },
      {
        id: 'captain',
        label: 'Le vieux capitaine',
        cost: { gold: 30 },
        effects: [
          { addSkill: { skill: 'martial', value: 2 }, who: 'target' },
          { setFlag: 'childhood_has_tutor', who: 'target' },
          { setFlag: 'childhood_tutor_captain', who: 'target' },
          { triggerEvent: { id: 'childhood_tutor_report', days: 180 } },
        ],
        ai: { base: 10, traits: { brave: 15, wrathful: 5 }, personality: { aggression: 0.1 } },
      },
      {
        id: 'courtier',
        label: 'La dame de cour',
        cost: { gold: 40 },
        effects: [
          { addSkill: { skill: 'intrigue', value: 2 }, who: 'target' },
          { setFlag: 'childhood_has_tutor', who: 'target' },
          { setFlag: 'childhood_tutor_courtier', who: 'target' },
          { triggerEvent: { id: 'childhood_tutor_report', days: 180 } },
        ],
        ai: { base: 10, traits: { deceitful: 15, paranoid: 5 }, personality: { intrigue: 0.1 } },
      },
      {
        id: 'myself',
        label: '« Je l’instruirai moi-même. »',
        tooltip: 'Des heures prises sur les affaires du royaume.',
        effects: [
          { createRelationship: { type: 'mentor', with: 'target' } },
          { addOpinion: { towards: 'root', value: 20, reason: 'personal_tutor' }, who: 'target' },
          { addSkill: { skill: 'diplomacy', value: 1 }, who: 'target' },
          { setFlag: 'childhood_has_tutor', who: 'target' },
          { addStress: 15 },
        ],
        tags: ['humble'],
        ai: { base: 5, traits: { diligent: 15, compassionate: 5, lazy: -15 } },
      },
    ],
  },
  {
    id: 'childhood_tutor_report',
    category: 'childhood',
    title: 'Le rapport du précepteur',
    text:
      'Six mois ont passé, et le maître de {target.name} a demandé audience. Ses éloges sont sincères, mais mesurés : l’enfant apprend vite, retient tout et discute plus encore. Il y a eu une porte claquée, une leçon désertée pour suivre les chasseurs, un livre jeté au feu dans un accès de colère. « Il y a là de quoi faire quelqu’un de remarquable, conclut le maître, ou quelqu’un d’insupportable. Tout dépendra de vous. »',
    illustration: 'library',
    trigger: 'chain',
    conditions: { isAdult: false, who: 'target' },
    target: { pool: 'minor_child' },
    portraits: ['target'],
    choices: [
      {
        id: 'stricter',
        label: '« Redoublez d’exigence. »',
        effects: [
          {
            if: { hasFlag: 'childhood_tutor_captain', who: 'target' },
            then: [{ addSkill: { skill: 'martial', value: 1 }, who: 'target' }],
            else: [
              {
                if: { hasFlag: 'childhood_tutor_courtier', who: 'target' },
                then: [{ addSkill: { skill: 'intrigue', value: 1 }, who: 'target' }],
                else: [{ addSkill: { skill: 'learning', value: 1 }, who: 'target' }],
              },
            ],
          },
          { addOpinion: { towards: 'root', value: -10, reason: 'strict_upbringing' }, who: 'target' },
          { chance: 30, then: [{ addTrait: 'diligent', who: 'target' }] },
        ],
        ai: { base: 10, traits: { diligent: 10, just: 10, lazy: -10 } },
      },
      {
        id: 'slack',
        label: '« Laissez-lui un peu de bride. »',
        effects: [
          { addOpinion: { towards: 'root', value: 15, reason: 'indulgent_parent' }, who: 'target' },
          { chance: 30, then: [{ addTrait: 'lazy', who: 'target' }] },
        ],
        tags: ['compassionate'],
        ai: { base: 10, traits: { compassionate: 10, lazy: 10, content: 5 } },
      },
      {
        id: 'attend',
        label: 'Assister vous-même à quelques leçons',
        effects: [
          { addStress: 10 },
          { addMutualOpinion: { with: 'target', value: 15, reason: 'shared_lessons' } },
          { addSkill: { skill: 'diplomacy', value: 1 }, who: 'target' },
        ],
        ai: { base: 5, traits: { diligent: 10, sociable: 5 } },
      },
    ],
  },

  // --- Rivalité entre enfants -------------------------------------------------
  {
    id: 'childhood_sibling_rivalry',
    category: 'childhood',
    title: 'Le sang contre le sang',
    text:
      'La querelle a commencé dans la cour d’armes, pour une épée de bois, et s’est achevée dans le sang : {other.name} porte une entaille au sourcil, et {target.name}, à qui doit revenir un jour votre héritage, refuse obstinément de s’excuser. Les serviteurs murmurent que ce n’est pas la première fois, que l’un des deux supporte mal l’ombre de l’autre, et que la maison entière finira par devoir choisir.',
    illustration: 'castle_walls',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 2555,
    conditions: { isAdult: true },
    target: { pool: 'heir', where: { all: [{ isChildOf: 'root', who: 'target' }, { age: { min: 8, max: 25 }, who: 'target' }] } },
    other: { pool: 'child', where: { age: { min: 8, max: 25 }, who: 'other' } },
    portraits: ['target', 'other'],
    choices: [
      {
        id: 'back_heir',
        label: 'Soutenir {target.name} : l’héritage l’exige',
        effects: [
          { addOpinion: { towards: 'root', value: 15, reason: 'favored_child' }, who: 'target' },
          { addOpinion: { towards: 'root', value: -25, reason: 'slighted_child' }, who: 'other' },
        ],
        ai: { base: 10, traits: { arrogant: 10, ambitious: 5 } },
      },
      {
        id: 'public_apology',
        label: 'Exiger de {target.name} des excuses publiques',
        effects: [
          { addOpinion: { towards: 'root', value: -20, reason: 'public_rebuke' }, who: 'target' },
          { addOpinion: { towards: 'root', value: 15, reason: 'favored_child' }, who: 'other' },
          { addAuthority: 10 },
        ],
        tags: ['honest'],
        ai: { base: 10, traits: { just: 15, honest: 5 } },
      },
      {
        id: 'hunt_together',
        label: 'Les envoyer chasser ensemble tout l’hiver',
        cost: { gold: 40 },
        effects: [
          { addMutualOpinion: { with: 'other', value: 20, reason: 'shared_hardship' }, who: 'target' },
          { chance: 25, then: [{ createRelationship: { type: 'friend', with: 'other' }, who: 'target' }] },
        ],
        ai: { base: 10, traits: { compassionate: 10, patient: 10 } },
      },
      {
        id: 'let_fight',
        label: '« Qu’ils se mesurent : le plus fort régnera. »',
        effects: [
          { createRelationship: { type: 'rival', with: 'other' }, who: 'target' },
          { addSkill: { skill: 'martial', value: 1 }, who: 'target' },
          { addSkill: { skill: 'martial', value: 1 }, who: 'other' },
        ],
        tags: ['cruel'],
        ai: { base: 5, traits: { cruel: 15, wrathful: 10 }, personality: { aggression: 0.1 } },
      },
    ],
  },

  // --- Pupille à l'étranger -----------------------------------------------------
  {
    id: 'childhood_ward_abroad',
    category: 'childhood',
    title: 'Un gage de courtoisie',
    text:
      'Un messager envoyé par {other.fullname} a apporté une proposition courtoise : sa cour serait honorée d’accueillir {target.name}, {target.rel}, pour y parfaire son éducation parmi ses propres enfants. L’usage est ancien et respecté ; il noue entre les maisons des amitiés qui durent une vie entière. Il fait aussi, chacun le sait, de l’enfant un gage entre deux voisins qui n’ont pas toujours été amis.',
    illustration: 'throne_room',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 3650,
    conditions: { all: [{ isAdult: true }, { opinion: { min: -10 }, of: 'other', towards: 'root' }] },
    target: { pool: 'minor_child', where: { age: { min: 8, max: 14 }, who: 'target' } },
    other: { pool: 'neighbor_ruler', where: { isAdult: true, who: 'other' } },
    portraits: ['target', 'other'],
    choices: [
      {
        id: 'send',
        label: 'Accepter et confier l’enfant',
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'ward_trust' }, who: 'other' },
          { createRelationship: { type: 'ward', with: 'target' }, who: 'other' },
          { addOpinion: { towards: 'root', value: -10, reason: 'sent_away' }, who: 'target' },
          { addSkill: { skill: 'diplomacy', value: 2 }, who: 'target' },
        ],
        ai: { base: 10, traits: { trusting: 15, paranoid: -20 }, personality: { caution: -0.1 } },
      },
      {
        id: 'send_spy',
        label: 'Accepter, et glisser un espion dans sa suite',
        effects: [
          { addOpinion: { towards: 'root', value: 15, reason: 'ward_trust' }, who: 'other' },
          { addOpinion: { towards: 'root', value: -10, reason: 'sent_away' }, who: 'target' },
          { addSkill: { skill: 'diplomacy', value: 1 }, who: 'target' },
          { chance: 40, then: [{ discoverSecret: { of: 'other' } }] },
        ],
        tags: ['deceitful'],
        ai: { base: 5, traits: { deceitful: 15 }, personality: { intrigue: 0.2 } },
      },
      {
        id: 'decline',
        label: 'Décliner avec gratitude',
        effects: [{ addOpinion: { towards: 'root', value: -10, reason: 'refused_ward' }, who: 'other' }],
        ai: { base: 10, traits: { paranoid: 15, compassionate: 5 }, personality: { caution: 0.1 } },
      },
    ],
  },

  // --- Naissances -------------------------------------------------------------
  {
    id: 'childhood_naming_feast',
    category: 'childhood',
    title: 'Une naissance à célébrer',
    text:
      'Les sages-femmes ont annoncé la nouvelle au petit jour : {target.name} est né{target.e}, et ses cris ont réveillé l’aile entière du château. Selon l’usage, la naissance doit être célébrée avant la nouvelle lune ; les intendants attendent vos ordres et les cuisines, déjà, font chauffer les fours. La manière dont on accueille un enfant, disent les anciens, annonce la manière dont on le pleurera.',
    illustration: 'nursery',
    trigger: 'on:birth',
    weight: 12,
    cooldownDays: 365,
    conditions: { all: [{ isChildOf: 'root', who: 'target' }, { age: { max: 1 }, who: 'target' }] },
    target: { pool: 'minor_child', where: { age: { max: 1 }, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'feast',
        label: 'Un festin pour toute la province',
        cost: { gold: 80 },
        effects: [{ addPrestige: 50 }, { addVassalOpinion: 5, reason: 'birth_feast', months: 24 }],
        tags: ['social', 'generous'],
        ai: { base: 10, traits: { sociable: 15, generous: 10, greedy: -10 } },
      },
      {
        id: 'thanksgiving',
        label: 'Une messe d’action de grâce',
        effects: [{ addFervor: 25 }],
        tags: ['pious'],
        ai: { base: 10, traits: { zealous: 20, cynical: -10 }, personality: { zeal: 0.1 } },
      },
      {
        id: 'intimate',
        label: 'Une fête intime, en famille',
        effects: [{ addStress: -15 }, { addPrestige: -10 }],
        ai: { base: 10, traits: { reclusive: 15, greedy: 10, humble: 5 } },
      },
    ],
  },
  {
    id: 'childhood_sickly_newborn',
    category: 'childhood',
    title: 'Un souffle trop faible',
    text:
      'L’enfant est venu au monde trop tôt, et trop menu. {target.name} ne crie presque pas ; les sages-femmes se relaient autour du berceau et échangent des regards qu’elles croient discrets. Le médecin de la cour parle de bains tièdes et de bouillons de moelle ; une vieille nourrice des Anciens Chemins propose des racines et une amulette ; le chapelain, lui, suggère de bénir l’enfant au plus vite.',
    illustration: 'nursery',
    trigger: 'on:birth',
    weight: 6,
    cooldownDays: 365,
    conditions: { all: [{ isChildOf: 'root', who: 'target' }, { age: { max: 1 }, who: 'target' }] },
    target: { pool: 'minor_child', where: { age: { max: 1 }, who: 'target' } },
    portraits: ['target'],
    choices: [
      {
        id: 'physician',
        label: 'Écouter le médecin',
        cost: { gold: 50 },
        effects: [{ chance: 70, then: [{ addHealth: 1, who: 'target' }], else: [{ addTrait: 'frail', who: 'target' }] }],
        ai: { base: 10, traits: { cynical: 10, greedy: -10 } },
      },
      {
        id: 'nurse',
        label: 'Confier l’enfant à la vieille nourrice',
        effects: [
          {
            chance: 50,
            then: [{ addHealth: 1, who: 'target' }, { chance: 30, then: [{ addTrait: 'robust', who: 'target' }] }],
            else: [{ addTrait: 'frail', who: 'target' }],
          },
        ],
        ai: { base: 10, traits: { trusting: 10, greedy: 5 } },
      },
      {
        id: 'pray',
        label: 'Prier, et s’en remettre au ciel',
        effects: [{ addFervor: 15 }, { addTrait: 'frail', who: 'target' }, { addStress: -10 }],
        tags: ['pious'],
        ai: { base: 5, traits: { zealous: 20 }, personality: { zeal: 0.1 } },
      },
    ],
  },
  {
    id: 'childhood_birth_omen',
    category: 'childhood',
    title: 'Le présage de la sage-femme',
    text:
      'Tandis que l’on lavait {target.name}, la vieille sage-femme a poussé un cri : l’enfant porte au creux de l’épaule une tache de naissance en forme de couronne, dit-elle, ou d’étoile, selon l’angle. Avant la tombée de la nuit, toute la domesticité jurait qu’un grand destin l’attend. Les rumeurs de cette sorte ont fait des rois ; elles en ont aussi défait, et les aînés de la maison n’aiment guère les présages qui ne les concernent pas.',
    illustration: 'nursery',
    trigger: 'on:birth',
    weight: 5,
    cooldownDays: 1825,
    conditions: { all: [{ isChildOf: 'root', who: 'target' }, { age: { max: 1 }, who: 'target' }] },
    target: { pool: 'minor_child', where: { age: { max: 1 }, who: 'target' } },
    other: { pool: 'heir', optional: true },
    portraits: ['target'],
    choices: [
      {
        id: 'proclaim',
        label: 'Faire proclamer le présage',
        effects: [
          { addPrestige: 40 },
          { setFlag: 'childhood_marked_by_omen', who: 'target' },
          { addOpinion: { towards: 'root', value: -10, reason: 'omen_favoritism' }, who: 'other' },
        ],
        tags: ['ambitious'],
        ai: { base: 10, traits: { ambitious: 15, arrogant: 10 } },
      },
      {
        id: 'silence',
        label: 'Payer la sage-femme pour qu’elle se taise',
        cost: { gold: 20 },
        effects: [{ addStress: -5 }],
        tags: ['humble'],
        ai: { base: 10, traits: { paranoid: 10, humble: 10 } },
      },
      {
        id: 'priests',
        label: 'Soumettre le signe aux prêtres',
        effects: [{ addFervor: 20 }, { setFlag: 'childhood_marked_by_omen', who: 'target' }],
        tags: ['pious'],
        ai: { base: 10, traits: { zealous: 15 }, personality: { zeal: 0.1 } },
      },
    ],
  },

  // --- Majorité ---------------------------------------------------------------
  {
    id: 'childhood_coming_of_age_vow',
    category: 'childhood',
    title: 'Le jour des vœux',
    text:
      'Ce matin, pour la première fois, vous avez pris place à la grande table non plus parmi les enfants, mais parmi les adultes de la maison. Les regards ont changé : les serviteurs s’inclinent un peu plus bas, les conseillers un peu moins. Selon la vieille coutume, il vous revient de prononcer un vœu devant les vôtres, un serment qui dira à tous quelle sorte de personne vous entendez devenir.',
    illustration: 'chapel',
    trigger: 'on:coming_of_age',
    rulerOnly: false,
    weight: 10,
    once: true,
    conditions: { all: [{ isAdult: true }, { age: { max: 20 } }] },
    portraits: ['root'],
    choices: [
      {
        id: 'arms',
        label: '« Je jure de ne jamais reculer devant l’ennemi. »',
        effects: [{ addSkill: { skill: 'martial', value: 1 } }, { addPrestige: 20 }, { chance: 50, then: [{ addTrait: 'brave' }] }],
        tags: ['brave'],
        ai: { base: 10, traits: { brave: 15, craven: -15 }, personality: { aggression: 0.1 } },
      },
      {
        id: 'wisdom',
        label: '« Je jure de chercher la sagesse avant la gloire. »',
        effects: [{ addSkill: { skill: 'learning', value: 2 } }, { chance: 30, then: [{ addTrait: 'patient' }] }],
        tags: ['humble'],
        ai: { base: 10, traits: { sharp: 10, patient: 10, arrogant: -10 } },
      },
      {
        id: 'faith',
        label: '« Je jure de servir la foi de mes pères. »',
        effects: [{ addFervor: 20 }, { chance: 40, then: [{ addTrait: 'zealous' }] }],
        tags: ['pious'],
        ai: { base: 5, traits: { zealous: 20, cynical: -15 }, personality: { zeal: 0.2 } },
      },
      {
        id: 'renown',
        label: '« Je jure que mon nom sera connu jusqu’aux confins de Caldria. »',
        effects: [{ addPrestige: 40 }, { addStress: 10 }, { chance: 40, then: [{ addTrait: 'ambitious' }] }],
        tags: ['ambitious'],
        ai: { base: 5, traits: { ambitious: 15, arrogant: 10 }, personality: { ambition: 0.2 } },
      },
    ],
  },

  // =========================================================================
  // ROMANCE
  // =========================================================================

  // --- Chaîne : la liaison ------------------------------------------------------
  {
    id: 'romance_courtly_glances',
    category: 'romance',
    title: 'Un regard trop long',
    text:
      'Depuis le dernier banquet, {target.fullname} s’arrange pour se trouver sur votre passage : à la chapelle, dans la galerie, au retour de la chasse. Ce soir, un page vous a glissé un billet plié en quatre, sans signature, où quelques vers maladroits parlent d’un jardin, d’une heure tardive et d’une fontaine qui ne répète jamais ce qu’elle entend. Nul besoin de signature : le papier porte le parfum de {target.name}.',
    illustration: 'garden',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    conditions: { all: [{ isAdult: true }, { isMarried: true }, { age: { max: 55 } }] },
    target: {
      pool: 'courtier',
      where: { all: [SUITABLE_SUITOR, { not: { hasRelation: 'lover', with: 'root', who: 'target' } }] },
    },
    portraits: ['target'],
    choices: [
      {
        id: 'go',
        label: 'Se rendre au jardin à l’heure dite',
        effects: [
          { addMutualOpinion: { with: 'target', value: 10, reason: 'secret_glances' } },
          { triggerEvent: { id: 'romance_garden_tryst', days: 30 } },
        ],
        ai: { base: 5, traits: { lustful: 25, chaste: -20 }, personality: { honor: -0.1 } },
      },
      {
        id: 'return_note',
        label: 'Rendre le billet, poliment',
        effects: [{ addOpinion: { towards: 'root', value: -10, reason: 'rebuffed' }, who: 'target' }, { addPrestige: 10 }],
        tags: ['honest'],
        ai: { base: 10, traits: { chaste: 15, honest: 10, loyal: 10 } },
      },
      {
        id: 'banish',
        label: 'Faire éloigner {target.name} de la cour',
        effects: [
          { addOpinion: { towards: 'root', value: -30, reason: 'banished_from_court' }, who: 'target' },
          { banish: true, who: 'target' },
        ],
        tags: ['cruel'],
        ai: { base: 5, traits: { paranoid: 15, zealous: 10, compassionate: -10 } },
      },
    ],
  },
  {
    id: 'romance_garden_tryst',
    category: 'romance',
    title: 'La fontaine qui se tait',
    text:
      'La lune est basse et le jardin désert, à l’exception d’une silhouette assise au bord de la fontaine. {target.name} s’est levé{target.e} en vous voyant approcher, sans un mot. Vous avez parlé longtemps, de tout sauf de ce qui vous réunissait ici, jusqu’à ce que la cloche de l’aube vous rappelle l’heure. Au moment de partir, une main a saisi la vôtre, et ne l’a pas lâchée.',
    illustration: 'garden',
    trigger: 'chain',
    conditions: { isMarried: true },
    target: { pool: 'courtier', where: SUITABLE_SUITOR },
    portraits: ['target'],
    choices: [
      {
        id: 'lovers',
        label: 'Ne pas la retirer',
        tooltip: 'Une liaison adultère est un secret dangereux.',
        effects: [
          { createRelationship: { type: 'lover', with: 'target' } },
          { createSecret: { type: 'forbidden_love', about: 'target', knownBy: ['target'] } },
          { addStress: -20 },
          { triggerEvent: { id: 'romance_lover_demand', days: 180 } },
        ],
        ai: { base: 5, traits: { lustful: 25, chaste: -20, loyal: -10 }, personality: { honor: -0.1 } },
      },
      {
        id: 'never_again',
        label: '« Nous ne devons plus nous revoir. »',
        effects: [{ addOpinion: { towards: 'root', value: -15, reason: 'rebuffed' }, who: 'target' }, { addStress: 10 }],
        tags: ['honest'],
        ai: { base: 10, traits: { honest: 15, chaste: 15, loyal: 10 } },
      },
      {
        id: 'friends',
        label: '« Soyons amis, et rien de plus. »',
        effects: [
          { createRelationship: { type: 'friend', with: 'target' } },
          { addMutualOpinion: { with: 'target', value: 10, reason: 'secret_glances' } },
        ],
        tags: ['social'],
        ai: { base: 10, traits: { sociable: 10, patient: 5 } },
      },
    ],
  },
  {
    id: 'romance_lover_demand',
    category: 'romance',
    title: 'Le prix de la discrétion',
    text:
      '{target.name} a changé. Les billets se font plus rares, les silences plus longs, et ce soir, dans la chambre de la tour où vous vous retrouvez depuis des mois, le manteau n’a pas quitté ses épaules. « Je risque tout pour vous : mon nom, ma place, peut-être ma vie. Vous, vous ne risquez rien. Il est temps que cela change. » Suit une demande précise : une somme d’argent, et la promesse d’une position à la cour.',
    illustration: 'bedchamber',
    trigger: 'chain',
    conditions: { hasRelation: 'lover', with: 'target' },
    target: { pool: 'lover' },
    portraits: ['target'],
    choices: [
      {
        id: 'pay',
        label: 'Payer, et garder le secret',
        cost: { gold: 100 },
        effects: [{ addOpinion: { towards: 'root', value: 20, reason: 'lover_rewarded' }, who: 'target' }],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 15, lustful: 10, greedy: -15 } },
      },
      {
        id: 'refuse',
        label: '« Vous vous oubliez. »',
        effects: [
          { addOpinion: { towards: 'root', value: -30, reason: 'lover_spurned' }, who: 'target' },
          { chance: 50, then: [{ createHook: { on: 'root', years: 10 }, who: 'target' }] },
        ],
        ai: { base: 10, traits: { arrogant: 15, greedy: 10 } },
      },
      {
        id: 'end_affair',
        label: 'Mettre fin à la liaison',
        effects: [
          { breakRelationship: { type: 'lover', with: 'target' } },
          { addOpinion: { towards: 'root', value: -40, reason: 'lover_spurned' }, who: 'target' },
          { addStress: 15 },
          { chance: 30, then: [{ createRelationship: { type: 'rival', with: 'root' }, who: 'target' }] },
        ],
        ai: { base: 5, traits: { chaste: 15, honest: 10, paranoid: 10 } },
      },
      {
        id: 'stay',
        label: '« Alors restez. Pour de bon. »',
        tooltip: 'Il faut que ce lien soit sincère.',
        conditions: { opinion: { min: 40 }, of: 'target', towards: 'root' },
        effects: [
          { createRelationship: { type: 'soulmate', with: 'target' } },
          { addOpinion: { towards: 'root', value: 30, reason: 'soulmate_vow' }, who: 'target' },
          { addStress: -20 },
        ],
        ai: { base: 5, traits: { lustful: 10, compassionate: 10 }, personality: { compassion: 0.1 } },
      },
    ],
  },

  // --- Autres romances --------------------------------------------------------
  {
    id: 'romance_lovers_hour',
    category: 'romance',
    title: 'L’heure volée',
    text:
      'Le conseil s’est prolongé jusqu’à la nuit, les requêtes se sont succédé, et vous n’avez pas vu {target.name} depuis des jours. Un serviteur discret vous apprend que l’on vous attend au pavillon de chasse, à une heure de cheval du château. Vous pourriez prétexter une battue, un pèlerinage, une migraine : votre maison a l’habitude de vos absences. Mais chaque absence est une question de plus.',
    illustration: 'forest',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 1095,
    conditions: { isAdult: true },
    target: { pool: 'lover', where: { isAdult: true, who: 'target' } },
    other: { pool: 'spouse', optional: true },
    portraits: ['target'],
    choices: [
      {
        id: 'ride',
        label: 'Seller un cheval',
        effects: [
          { addStress: -25 },
          { addMutualOpinion: { with: 'target', value: 10, reason: 'stolen_hours' } },
          {
            if: { exists: 'other' },
            then: [{ chance: 25, then: [{ addOpinion: { towards: 'root', value: -25, reason: 'suspected_infidelity' }, who: 'other' }] }],
          },
        ],
        ai: { base: 15, traits: { lustful: 15, chaste: -10 } },
      },
      {
        id: 'gift',
        label: 'Envoyer un présent à votre place',
        cost: { gold: 40 },
        effects: [{ addOpinion: { towards: 'root', value: 10, reason: 'lover_gift' }, who: 'target' }],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 10, paranoid: 10, greedy: -10 } },
      },
      {
        id: 'duty',
        label: 'Rester à vos devoirs',
        effects: [
          { addOpinion: { towards: 'root', value: -10, reason: 'neglected_lover' }, who: 'target' },
          { addStress: 10 },
          { addAuthority: 10 },
        ],
        ai: { base: 5, traits: { diligent: 15, chaste: 10 } },
      },
    ],
  },
  {
    id: 'romance_heir_lovesick',
    category: 'romance',
    title: 'L’esprit ailleurs',
    text:
      'Depuis le début de la saison, {target.name} n’est plus que l’ombre de sa personne : absent{target.e} au conseil, distrait{target.e} à l’escrime, surpris{target.e} deux fois à griffonner des vers dans la marge des registres. Les rires étouffés des pages disent assez que toute la cour connaît le nom qui occupe ces pensées. Vous seul{root.e}, semble-t-il, l’ignorez encore.',
    illustration: 'garden',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 2555,
    conditions: { isAdult: true },
    target: { pool: 'heir', where: HEIR_OF_AGE_TO_LOVE },
    portraits: ['target'],
    choices: [
      {
        id: 'inquire',
        label: 'Découvrir de qui il s’agit',
        effects: [
          { spawnCourtier: { flag: 'romance_heir_beloved' }, as: 'other' },
          { triggerEvent: { id: 'romance_heir_first_love', days: 10 } },
        ],
        ai: { base: 15, traits: { paranoid: 10, ambitious: 5 }, personality: { caution: 0.1 } },
      },
      {
        id: 'let_be',
        label: '« Cela lui passera. »',
        effects: [{ addOpinion: { towards: 'root', value: 5, reason: 'left_in_peace' }, who: 'target' }],
        ai: { base: 10, traits: { content: 10, lazy: 5, trusting: 5 } },
      },
      {
        id: 'occupy',
        label: 'Lui trouver de quoi s’occuper l’esprit',
        effects: [
          { addSkill: { skill: 'stewardship', value: 1 }, who: 'target' },
          { addOpinion: { towards: 'root', value: -10, reason: 'burdened_with_duties' }, who: 'target' },
        ],
        ai: { base: 10, traits: { diligent: 15, lazy: -10 } },
      },
    ],
  },
  {
    id: 'romance_heir_first_love',
    category: 'romance',
    title: 'Un premier amour',
    text:
      'Vos gens n’ont pas eu à chercher longtemps : {target.name} passe ses soirées avec {other.fullname}, qui n’a ni terres, ni fortune, ni alliance à offrir. On les a vus à la volière, au marché, sur les remparts à l’heure où changent les sentinelles. Ce n’est sans doute qu’un amour de jeunesse, de ceux qui passent avec l’été. Mais {target.name} doit un jour vous succéder, et ceux qui règnent n’ont guère le loisir des étés.',
    illustration: 'castle_walls',
    trigger: 'chain',
    conditions: { all: [{ isMarried: false, who: 'target' }, { exists: 'other' }] },
    target: { pool: 'heir', where: HEIR_OF_AGE_TO_LOVE },
    other: { pool: 'courtier', where: { all: [{ isAdult: true, who: 'other' }, { isRuler: false, who: 'other' }] } },
    portraits: ['target', 'other'],
    choices: [
      {
        id: 'bless',
        label: '« Laissez la jeunesse à la jeunesse. »',
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'blessed_love' }, who: 'target' },
          { createRelationship: { type: 'lover', with: 'other' }, who: 'target' },
          { addPrestige: -20 },
        ],
        tags: ['compassionate'],
        ai: { base: 10, traits: { compassionate: 15, lustful: 5, arrogant: -10 } },
      },
      {
        id: 'forbid',
        label: 'Interdire ces rencontres',
        effects: [
          { addOpinion: { towards: 'root', value: -20, reason: 'love_forbidden' }, who: 'target' },
          { addStress: 20, who: 'target' },
        ],
        ai: { base: 10, traits: { arrogant: 10, just: 5 }, personality: { ambition: 0.1 } },
      },
      {
        id: 'send_away',
        label: 'Éloigner {other.name} de la cour',
        effects: [
          { banish: true, who: 'other' },
          { addOpinion: { towards: 'root', value: -35, reason: 'lost_love' }, who: 'target' },
          { chance: 30, then: [{ addTrait: 'depressed', who: 'target' }] },
        ],
        tags: ['cruel'],
        ai: { base: 5, traits: { cruel: 15, paranoid: 10, compassionate: -15 } },
      },
      {
        id: 'talk',
        label: 'En parler longuement avec {target.name}',
        effects: [
          { addStress: 10 },
          { addOpinion: { towards: 'root', value: 10, reason: 'heart_to_heart' }, who: 'target' },
          { addSkill: { skill: 'diplomacy', value: 1 }, who: 'target' },
        ],
        tags: ['social'],
        ai: { base: 10, traits: { patient: 10, sociable: 10 } },
      },
    ],
  },
  {
    id: 'romance_spouse_suspicion',
    category: 'romance',
    title: 'Les soupçons',
    text:
      '{target.name} vous attendait dans vos appartements, dans la pénombre. Sur la table, un ruban que vous connaissez bien, trouvé, dit {target.rel}, dans la paille des écuries. Le nom de {other.name} n’a pas été prononcé, pas encore, mais il flotte entre vous comme la fumée d’une chandelle qu’on vient de souffler. « Je ne vous demande qu’une chose, finit par dire {target.name} : la vérité. »',
    illustration: 'bedchamber',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 1825,
    conditions: { all: [{ isAdult: true }, { isMarried: true }] },
    target: { pool: 'spouse' },
    other: { pool: 'lover', where: { not: { isSpouseOf: 'root', who: 'other' } } },
    portraits: ['target', 'other'],
    choices: [
      {
        id: 'deny',
        label: '« Vous vous faites des idées. »',
        effects: [
          {
            chance: 60,
            then: [{ addOpinion: { towards: 'root', value: 5, reason: 'reassured' }, who: 'target' }],
            else: [{ addOpinion: { towards: 'root', value: -30, reason: 'caught_lying' }, who: 'target' }],
          },
        ],
        tags: ['deceitful'],
        ai: { base: 10, traits: { deceitful: 20, honest: -15 }, personality: { intrigue: 0.1 } },
      },
      {
        id: 'confess',
        label: 'Tout avouer',
        effects: [
          { addOpinion: { towards: 'root', value: -30, reason: 'confessed_infidelity' }, who: 'target' },
          { addStress: -20 },
        ],
        tags: ['honest'],
        ai: { base: 5, traits: { honest: 20, just: 5 } },
      },
      {
        id: 'confess_and_end',
        label: 'Avouer, et promettre de rompre',
        effects: [
          { breakRelationship: { type: 'lover', with: 'other' } },
          { breakRelationship: { type: 'soulmate', with: 'other' } },
          { addOpinion: { towards: 'root', value: -30, reason: 'lover_spurned' }, who: 'other' },
          { addOpinion: { towards: 'root', value: -10, reason: 'confessed_infidelity' }, who: 'target' },
          { addStress: 10 },
        ],
        tags: ['honest'],
        ai: { base: 10, traits: { chaste: 10, loyal: 10 }, personality: { honor: 0.1 } },
      },
    ],
  },
  {
    id: 'romance_wedding_night',
    category: 'romance',
    title: 'La nuit des noces',
    text:
      'Le dernier invité a enfin quitté la salle, les musiciens rangent leurs instruments et l’on a mouché les torches du couloir. Pour la première fois, vous voici seul{root.e} avec {target.fullname}, qui partage désormais votre vie devant les hommes et devant le ciel. Les accords ont été signés par d’autres, les dots comptées par des intendants ; ce qui naîtra entre vous, en revanche, ne dépend que de vous deux.',
    illustration: 'wedding',
    trigger: 'on:marriage',
    weight: 12,
    conditions: { isSpouseOf: 'target' },
    target: { pool: 'spouse' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'talk_till_dawn',
        label: 'Parler longuement, jusqu’à l’aube',
        effects: [{ addMutualOpinion: { with: 'target', value: 20, reason: 'tender_wedding' } }],
        tags: ['social', 'compassionate'],
        ai: { base: 10, traits: { compassionate: 10, sociable: 10 } },
      },
      {
        id: 'heirloom',
        label: 'Offrir un bijou de famille',
        cost: { gold: 40 },
        effects: [{ addOpinion: { towards: 'root', value: 15, reason: 'wedding_gift' }, who: 'target' }, { addPrestige: 10 }],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 15, greedy: -10 } },
      },
      {
        id: 'house_rules',
        label: 'Poser clairement les règles de la maison',
        effects: [{ addOpinion: { towards: 'root', value: -10, reason: 'cold_wedding' }, who: 'target' }, { addAuthority: 15 }],
        ai: { base: 5, traits: { arrogant: 15, paranoid: 10 } },
      },
    ],
  },
  {
    id: 'romance_second_spring',
    category: 'romance',
    title: 'Un second printemps',
    text:
      'Le hasard d’une averse vous a retenu{root.e} avec {target.name} dans une chapelle de campagne, loin des secrétaires et des gardes. Vous avez parlé comme vous ne l’aviez plus fait depuis des années : des enfants, des morts, de ce que vous étiez l’un pour l’autre avant que les affaires ne s’installent entre vous. Sur le chemin du retour, {target.name} a ri d’un rien, et ce rire vous a surpris{root.e} comme un souvenir.',
    illustration: 'chapel',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 3650,
    conditions: { all: [{ isMarried: true }, { age: { min: 35 } }, { opinion: { min: 20 }, of: 'target', towards: 'root' }] },
    target: { pool: 'spouse' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'journey',
        label: 'Partir quelques semaines, rien que vous deux',
        cost: { gold: 60 },
        effects: [
          { addMutualOpinion: { with: 'target', value: 20, reason: 'second_spring' } },
          { addModifier: { id: 'romance_second_spring', months: 12, values: { fertility: 0.2, stress_gain_mult: -0.15 } } },
          { addStress: -20 },
          { changeControl: -3 },
        ],
        ai: { base: 10, traits: { sociable: 10, lustful: 10, diligent: -10 } },
      },
      {
        id: 'portrait',
        label: 'Commander un double portrait',
        cost: { gold: 40 },
        effects: [{ addPrestige: 25 }, { addOpinion: { towards: 'root', value: 10, reason: 'second_spring' }, who: 'target' }],
        ai: { base: 10, traits: { arrogant: 10 } },
      },
      {
        id: 'back_to_work',
        label: 'Remercier le ciel, et retourner au travail',
        effects: [{ addAuthority: 10 }, { addOpinion: { towards: 'root', value: -5, reason: 'neglected_spouse' }, who: 'target' }],
        ai: { base: 5, traits: { diligent: 15, reclusive: 5 } },
      },
    ],
  },

  // =========================================================================
  // SANTÉ
  // =========================================================================

  // --- Chaîne : la fièvre -----------------------------------------------------
  {
    id: 'health_fever_at_court',
    category: 'health',
    title: 'La fièvre franchit les portes',
    text:
      'Une fièvre est arrivée avec les bateliers, s’est installée dans la ville basse de {province.name}, puis a franchi les portes du château. Deux pages sont alités, une lavandière est morte hier soir. Ce matin, vous avez senti vos tempes battre plus fort qu’à l’ordinaire, et votre coupe avait un goût de fer. Votre médecin prétend connaître un remède, votre chapelain préfère la prière ; votre intendant, lui, suggère de fermer les portes.',
    illustration: 'plague',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    conditions: { all: [{ isAdult: true }, { not: { hasTrait: 'ill' } }, { not: { hasTrait: 'grey_fever' } }] },
    portraits: ['root'],
    choices: [
      {
        id: 'physician',
        label: 'Faire appeler le médecin',
        tooltip: 'Le mal est déjà là ; reste à le soigner.',
        effects: [{ addTrait: 'ill' }, { triggerEvent: { id: 'health_dubious_cure', days: 20 } }],
        ai: { base: 10, traits: { cynical: 10, trusting: 5 } },
      },
      {
        id: 'close_gates',
        label: 'Fermer les portes et attendre',
        cost: { gold: 40 },
        effects: [{ addStress: 10 }, { changeDevelopment: -2 }, { chance: 30, then: [{ addTrait: 'ill' }] }],
        tags: ['craven'],
        ai: { base: 10, traits: { craven: 15, paranoid: 10, brave: -10 }, personality: { caution: 0.1 } },
      },
      {
        id: 'hold_court',
        label: 'Tenir audience comme si de rien n’était',
        effects: [
          { addPrestige: 30 },
          { addVassalOpinion: 5, reason: 'fearless_ruler', months: 24 },
          { chance: 60, then: [{ addTrait: 'ill' }] },
        ],
        tags: ['brave'],
        ai: { base: 5, traits: { brave: 20, craven: -15 } },
      },
    ],
  },
  {
    id: 'health_dubious_cure',
    category: 'health',
    title: 'Le remède du docteur',
    text:
      'Votre médecin est revenu, un coffret sous le bras. Il en tire des sangsues, une fiole de liqueur d’argent vif et un onguent dont il refuse de nommer les ingrédients, puis vous expose son traitement avec l’aplomb de ceux qui n’ont jamais eu tort. Derrière lui, votre chambellan secoue imperceptiblement la tête. La fièvre, elle, ne faiblit pas, et chaque nuit semble un peu plus longue que la précédente.',
    illustration: 'bedchamber',
    trigger: 'chain',
    conditions: { hasTrait: 'ill' },
    portraits: ['root'],
    choices: [
      {
        id: 'treatment',
        label: 'Se soumettre au traitement',
        hiddenEffects: true,
        effects: [
          {
            chance: 55,
            then: [{ removeTrait: 'ill' }],
            else: [{ addHealth: -1 }, { addStress: 15 }],
          },
        ],
        ai: { base: 10, traits: { trusting: 15, paranoid: -10 } },
      },
      {
        id: 'herbalist',
        label: 'Préférer les simples d’une herboriste',
        cost: { gold: 20 },
        effects: [{ chance: 40, then: [{ removeTrait: 'ill' }] }, { addStress: -5 }],
        ai: { base: 10, traits: { humble: 10, cynical: 5 } },
      },
      {
        id: 'dismiss',
        label: 'Chasser ce charlatan',
        effects: [
          { addStress: -10 },
          {
            chance: 25,
            then: [{ removeTrait: 'ill' }],
            else: [{ addModifier: { id: 'health_lingering_fever', months: 6, values: { health: -0.5 } } }],
          },
        ],
        ai: { base: 5, traits: { paranoid: 15, cynical: 10, wrathful: 10 } },
      },
    ],
  },

  // --- Vieillesse -------------------------------------------------------------
  {
    id: 'health_old_age',
    category: 'health',
    title: 'La main qui tremble',
    text:
      'Ce matin, en scellant une charte, votre main a tremblé au point que la cire a coulé sur la table. Le secrétaire a feint de ne rien voir ; vous, vous avez tout vu. Il y a aussi ces marches de la tour, chaque hiver plus nombreuses, ces noms qui vous échappent au conseil, ces nuits trop courtes et ces matins trop longs. Le corps rend ses comptes à son heure, et la vôtre approche.',
    illustration: 'council_chamber',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 2555,
    conditions: { all: [{ age: { min: 58 } }, { not: { hasTrait: 'infirm' } }] },
    other: { pool: 'heir', where: { isAdult: true, who: 'other' }, optional: true },
    portraits: ['root'],
    choices: [
      {
        id: 'springs',
        label: 'Partir prendre les eaux',
        cost: { gold: 80 },
        effects: [{ addModifier: { id: 'health_thermal_cure', months: 24, values: { health: 1 } } }, { changeControl: -3 }],
        ai: { base: 10, traits: { greedy: -10, lazy: 5 } },
      },
      {
        id: 'delegate',
        label: 'Confier davantage à {other.name}',
        conditions: { exists: 'other' },
        effects: [
          { addOpinion: { towards: 'root', value: 20, reason: 'trusted_heir' }, who: 'other' },
          { addSkill: { skill: 'stewardship', value: 1 }, who: 'other' },
          { addAuthority: -20 },
          { addStress: -20 },
        ],
        tags: ['humble'],
        ai: { base: 10, traits: { content: 15, trusting: 10, paranoid: -15 } },
      },
      {
        id: 'hide',
        label: 'N’en rien laisser paraître',
        effects: [{ addStress: 20 }, { addPrestige: 20 }, { chance: 30, then: [{ addTrait: 'infirm' }] }],
        tags: ['deceitful'],
        ai: { base: 5, traits: { arrogant: 15, paranoid: 10, ambitious: 5 } },
      },
    ],
  },

  // --- Maladie du conjoint ----------------------------------------------------
  {
    id: 'health_spouse_illness',
    category: 'health',
    title: 'Au chevet',
    text:
      '{target.name} s’est effondré{target.e} au sortir de la chapelle, et les médecins ne s’accordent ni sur le nom du mal, ni sur son remède. Depuis trois jours, la fièvre monte chaque soir et retombe à l’aube, laissant {target.rel} un peu plus pâle, un peu plus absent{target.e}. Dans l’antichambre, les affaires s’entassent : des lettres, des requêtes, un émissaire qui s’impatiente et le fait savoir.',
    illustration: 'bedchamber',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    conditions: { isMarried: true },
    target: { pool: 'spouse', where: { not: { hasTrait: 'ill', who: 'target' } } },
    portraits: ['target'],
    choices: [
      {
        id: 'bedside',
        label: 'Rester à son chevet',
        effects: [
          { addTrait: 'ill', who: 'target' },
          { addOpinion: { towards: 'root', value: 30, reason: 'bedside_vigil' }, who: 'target' },
          { changeControl: -3 },
          { chance: 25, then: [{ addTrait: 'ill' }] },
        ],
        tags: ['compassionate'],
        ai: { base: 10, traits: { compassionate: 20, loyal: 10 } },
      },
      {
        id: 'best_physician',
        label: 'Faire venir le meilleur médecin du royaume',
        cost: { gold: 90 },
        effects: [
          { chance: 60, then: [{ none: true }], else: [{ addTrait: 'ill', who: 'target' }] },
          { addOpinion: { towards: 'root', value: 15, reason: 'cared_for' }, who: 'target' },
        ],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 10, greedy: -15 } },
      },
      {
        id: 'duty',
        label: 'Retourner aux affaires',
        effects: [
          { addTrait: 'ill', who: 'target' },
          { addOpinion: { towards: 'root', value: -20, reason: 'abandoned_sickbed' }, who: 'target' },
          { addAuthority: 15 },
        ],
        ai: { base: 5, traits: { diligent: 10, compassionate: -20 }, personality: { compassion: -0.1 } },
      },
    ],
  },

  // --- Crises de stress -------------------------------------------------------
  {
    id: 'health_stress_outburst',
    category: 'health',
    title: 'Le vase brisé',
    text:
      'Personne ne sait exactement ce qui s’est passé. Un serviteur a renversé une aiguière, rien de plus ; et soudain vous vous êtes retrouvé{root.e} debout, les mains tremblantes, au milieu des éclats d’un vase qui avait appartenu à votre mère, tandis que la salle entière retenait son souffle. Des semaines de veilles et de décisions sans appel ont trouvé leur faille. Quelque chose doit céder : à vous de choisir quoi.',
    illustration: 'throne_room',
    trigger: 'on:stress_crisis',
    weight: 10,
    portraits: ['root'],
    choices: [
      {
        id: 'rage',
        label: 'Laisser éclater votre colère',
        effects: [
          { addStress: -50 },
          { addPrestige: -30 },
          { addVassalOpinion: -5, reason: 'ruler_outburst', months: 24 },
          { chance: 30, then: [{ addTrait: 'wrathful' }] },
        ],
        ai: { base: 10, traits: { wrathful: 20, patient: -15 } },
      },
      {
        id: 'weep',
        label: 'Vous retirer, et pleurer tout votre soûl',
        effects: [{ addStress: -35 }, { addPrestige: -15 }],
        ai: { base: 10, traits: { compassionate: 10, humble: 10, arrogant: -10 } },
      },
      {
        id: 'vigil',
        label: 'Passer la nuit en prière',
        cost: { fervor: 25 },
        effects: [{ addStress: -40 }],
        tags: ['pious'],
        ai: { base: 5, traits: { zealous: 20, cynical: -10 } },
      },
      {
        id: 'endure',
        label: 'Serrer les dents',
        effects: [{ addStress: -10 }, { addAuthority: 15 }, { chance: 40, then: [{ addTrait: 'depressed' }] }],
        ai: { base: 5, traits: { diligent: 10, brave: 5, arrogant: 5 } },
      },
    ],
  },
  {
    id: 'health_stress_wine',
    category: 'health',
    title: 'Le fond de la coupe',
    text:
      'Le vin de {province.name} n’a jamais été aussi bon, ou peut-être n’avez-vous jamais eu autant besoin de le trouver bon. Une coupe pour trouver le sommeil, une autre pour oublier le conseil, une troisième parce que la deuxième ne suffisait plus. Ce matin, votre échanson a hésité avant de remplir votre gobelet, et vous avez vu dans ses yeux quelque chose qui ressemblait à de la pitié.',
    illustration: 'feast',
    trigger: 'on:stress_crisis',
    weight: 10,
    portraits: ['root'],
    choices: [
      {
        id: 'pour',
        label: '« Remplissez. »',
        effects: [
          { addStress: -50 },
          { addModifier: { id: 'health_wine_habit', months: 36, values: { health: -0.5, diplomacy: -1 } } },
        ],
        ai: { base: 10, traits: { lazy: 15, lustful: 5, diligent: -10 } },
      },
      {
        id: 'company',
        label: 'Boire, mais en bonne compagnie',
        cost: { gold: 60 },
        effects: [{ addStress: -40 }, { addPrestige: 10 }],
        tags: ['social'],
        ai: { base: 5, traits: { sociable: 20, generous: 5, reclusive: -10 } },
      },
      {
        id: 'abstain',
        label: 'Faire vider les caves',
        effects: [{ addStress: -15 }, { addAuthority: 10 }],
        tags: ['humble'],
        ai: { base: 5, traits: { diligent: 15, chaste: 10, zealous: 5 } },
      },
    ],
  },
  {
    id: 'health_stress_retreat',
    category: 'health',
    title: 'Loin des murs',
    text:
      'Chaque visage au château vous réclame quelque chose : une grâce, une terre, une réponse, une sentence. Ce matin, en voyant l’intendant approcher avec ses registres, vous avez senti monter une envie presque physique de fuir. Il existe, à deux jours de cheval, un pavillon de chasse perdu dans les bois, et plus loin encore un monastère dont les frères ne parlent qu’une heure par jour.',
    illustration: 'forest',
    trigger: 'on:stress_crisis',
    weight: 10,
    target: { pool: 'spouse', optional: true },
    portraits: ['root'],
    choices: [
      {
        id: 'hunt',
        label: 'Partir chasser, seul{root.e}',
        effects: [{ addStress: -45 }, { changeControl: -5 }, { chance: 15, then: [{ woundCharacter: true }] }],
        tags: ['reclusive'],
        ai: { base: 10, traits: { brave: 10, reclusive: 10 } },
      },
      {
        id: 'monastery',
        label: 'Faire retraite chez les moines',
        effects: [
          { addStress: -60 },
          { addFervor: 15 },
          { addModifier: { id: 'health_withdrawn', months: 6, values: { vassal_opinion: -10 } } },
        ],
        tags: ['pious', 'reclusive'],
        ai: { base: 5, traits: { zealous: 15, reclusive: 15, sociable: -10 } },
      },
      {
        id: 'confide',
        label: 'Tout confier à {target.name}',
        conditions: { all: [{ exists: 'target' }, { opinion: { min: 0 }, of: 'target', towards: 'root' }] },
        effects: [{ addStress: -30 }, { addMutualOpinion: { with: 'target', value: 10, reason: 'confided_in' } }],
        tags: ['social'],
        ai: { base: 10, traits: { sociable: 15, trusting: 10, paranoid: -10 } },
      },
    ],
  },

  // =========================================================================
  // SUCCESSION
  // =========================================================================
  {
    id: 'succession_new_reign',
    category: 'succession',
    title: 'Le poids de la couronne',
    text:
      'La dépouille de {other.fullname} repose dans la chapelle, veillée par des moines qui se relaient jour et nuit. Dans la grande salle, les vassaux attendent : ils ont prêté serment au défunt, pas à vous, et chacun scrute votre visage en se demandant ce que ce nouveau règne lui coûtera ou lui rapportera. Les premiers jours d’un règne, dit-on, en écrivent déjà la dernière page.',
    illustration: 'coronation',
    trigger: 'on:succession',
    major: true,
    weight: 10,
    other: { pool: 'parent', optional: true },
    portraits: ['root'],
    timeoutDays: 90,
    choices: [
      {
        id: 'funeral',
        label: 'Des funérailles dignes d’une légende',
        cost: { gold: 100 },
        effects: [{ addPrestige: 80 }, { addVassalOpinion: 10, reason: 'grand_funeral', months: 36 }],
        ai: { base: 10, traits: { generous: 10, arrogant: 10 } },
      },
      {
        id: 'homage',
        label: 'Recevoir sur-le-champ l’hommage de chacun',
        effects: [
          { addAuthority: 30 },
          { addModifier: { id: 'succession_firm_hand', months: 24, values: { monthly_authority: 0.3, vassal_opinion: -5 } } },
        ],
        tags: ['ambitious'],
        ai: { base: 10, traits: { ambitious: 15, arrogant: 10 } },
      },
      {
        id: 'mourning',
        label: 'Prendre le deuil, et gouverner avec douceur',
        effects: [
          { addStress: -20 },
          { addModifier: { id: 'succession_mourning', months: 12, values: { stress_gain_mult: -0.2, diplomacy: 1 } } },
          { addVassalOpinion: 5, reason: 'respectful_mourning', months: 24 },
        ],
        tags: ['humble'],
        ai: { base: 10, traits: { humble: 10, compassionate: 10 } },
      },
      {
        id: 'largesse',
        label: 'Ouvrir le trésor aux grands vassaux',
        cost: { gold: 150 },
        effects: [{ addVassalOpinion: 20, reason: 'accession_gifts', months: 60 }],
        tags: ['generous'],
        ai: { base: 5, traits: { generous: 20, greedy: -20 } },
      },
    ],
  },
  {
    id: 'succession_mourning',
    category: 'succession',
    title: 'Le fauteuil vide',
    text:
      'Les tentures noires ont été tendues dans la grande salle, et la cloche de la chapelle sonne à intervalles réguliers depuis l’aube. On vous présente des condoléances, des requêtes, des comptes à signer ; chacun semble attendre de vous des gestes que vous accomplissez sans les sentir. Ce n’est que ce soir, seul{root.e} devant le fauteuil vide de {other.fullname}, que le chagrin vous rattrape enfin.',
    illustration: 'crypt',
    trigger: 'on:death_of_liege',
    weight: 10,
    other: { pool: 'parent', optional: true },
    portraits: ['root'],
    choices: [
      {
        id: 'grieve',
        label: 'Laisser couler les larmes',
        effects: [{ addStress: -20 }, { addPrestige: -10 }],
        ai: { base: 10, traits: { compassionate: 15, humble: 5 } },
      },
      {
        id: 'vigil',
        label: 'Veiller le corps toute la nuit',
        effects: [{ addFervor: 20 }, { addRenown: 10 }, { addStress: 10 }],
        tags: ['pious'],
        ai: { base: 10, traits: { zealous: 15, loyal: 10 } },
      },
      {
        id: 'harden',
        label: '« Il n’est pas temps de pleurer. »',
        effects: [{ addAuthority: 20 }, { addStress: 20 }],
        ai: { base: 5, traits: { ambitious: 15, diligent: 10, compassionate: -10 } },
      },
    ],
  },
  {
    id: 'succession_inheritance_quarrel',
    category: 'succession',
    title: 'La part de chacun',
    text:
      'La dépouille de {other.fullname} n’est pas encore en terre que {target.fullname}, {target.rel}, demande à vous voir en privé. La voix est calme, les mots préparés : le défunt aurait promis un domaine, une somme dont personne n’a trouvé trace dans les registres, une charge à la cour. « Je ne réclame que mon dû, dit {target.name}. Ce que vous en ferez dira qui vous êtes. »',
    illustration: 'council_chamber',
    trigger: 'on:death_of_liege',
    weight: 8,
    target: { pool: 'sibling', where: { all: [{ isAdult: true, who: 'target' }, { isRuler: false, who: 'target' }] } },
    other: { pool: 'parent', optional: true },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'compensate',
        label: 'Lui verser une compensation',
        cost: { gold: 100 },
        effects: [{ addOpinion: { towards: 'root', value: 20, reason: 'inheritance_honored' }, who: 'target' }],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 15, just: 10, greedy: -15 } },
      },
      {
        id: 'sworn_quittance',
        label: 'Payer moins, contre une quittance scellée',
        cost: { gold: 50 },
        effects: [
          { addOpinion: { towards: 'root', value: -5, reason: 'inheritance_bargained' }, who: 'target' },
          { createHook: { on: 'target', years: 10 } },
        ],
        ai: { base: 5, traits: { deceitful: 10, greedy: 10 }, personality: { intrigue: 0.2 } },
      },
      {
        id: 'refuse',
        label: '« Il n’y a pas de dû. »',
        effects: [
          { addOpinion: { towards: 'root', value: -30, reason: 'inheritance_denied' }, who: 'target' },
          { chance: 40, then: [{ createRelationship: { type: 'rival', with: 'target' } }] },
        ],
        tags: ['greedy'],
        ai: { base: 10, traits: { greedy: 20, arrogant: 10 } },
      },
    ],
  },

  // --- Chaîne : la rumeur de bâtardise ----------------------------------------
  {
    id: 'succession_bastard_rumour',
    category: 'succession',
    title: 'Le sang de l’héritier',
    text:
      'Une chanson court les tavernes de {province.name}, et votre maître des cérémonies a fini par vous la répéter, rouge de honte. Elle dit, en mots à peine voilés, que {target.name} n’est pas de votre sang, et nomme pour père un écuyer depuis longtemps disparu. Ce n’est qu’une chanson. Mais les chansons voyagent plus vite que les hérauts, et vos rivaux savent lire entre les rimes.',
    illustration: 'night_alley',
    trigger: 'pulse',
    weight: 6,
    cooldownDays: 5475,
    conditions: { all: [{ isAdult: true }, { isFemale: false }] },
    target: { pool: 'heir', where: { isChildOf: 'root', who: 'target' } },
    other: { pool: 'spouse', optional: true },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'inquiry',
        label: 'Ordonner une enquête discrète',
        cost: { gold: 50 },
        effects: [{ triggerEvent: { id: 'succession_rumour_inquiry', days: 60 } }],
        ai: { base: 10, traits: { paranoid: 20, trusting: -10 }, personality: { caution: 0.1 } },
      },
      {
        id: 'stand_by',
        label: 'Paraître en public aux côtés de {target.name}',
        effects: [{ addOpinion: { towards: 'root', value: 20, reason: 'defended_honour' }, who: 'target' }, { addPrestige: -20 }],
        ai: { base: 10, traits: { trusting: 10, loyal: 10, compassionate: 5 } },
      },
      {
        id: 'arrest_singers',
        label: 'Faire arrêter les chanteurs',
        effects: [{ addAuthority: 15 }, { addVassalOpinion: -5, reason: 'harsh_censorship', months: 24 }],
        tags: ['cruel'],
        ai: { base: 5, traits: { wrathful: 15, cruel: 10 } },
      },
      {
        id: 'laugh',
        label: 'Rire de la chanson',
        effects: [{ chance: 30, then: [{ addPrestige: -30 }], else: [{ addPrestige: 10 }] }],
        ai: { base: 10, traits: { content: 10, sociable: 5, paranoid: -10 } },
      },
    ],
  },
  {
    id: 'succession_rumour_inquiry',
    category: 'succession',
    title: 'Le rapport cacheté',
    text:
      'Votre enquêteur est revenu avec une besace pleine de dépositions et le visage de quelqu’un qui a mal dormi. Il a retrouvé la trace de l’écuyer, interrogé les servantes d’alors, recoupé les dates. Il pose devant vous un rapport scellé de cire noire. « Tout est là, dit-il. Je puis aussi le jeter au feu sans que vous l’ayez lu. Certaines vérités ne profitent qu’à ceux qui les colportent. »',
    illustration: 'council_chamber',
    trigger: 'chain',
    target: { pool: 'heir', where: { isChildOf: 'root', who: 'target' } },
    other: { pool: 'spouse', optional: true },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'read',
        label: 'Briser le sceau',
        hiddenEffects: true,
        effects: [
          {
            if: { hasSecret: 'bastard', who: 'other' },
            then: [{ discoverSecret: { of: 'other' } }, { addStress: 30 }],
            else: [{ addStress: -20 }, { addPrestige: 20 }],
          },
        ],
        ai: { base: 10, traits: { paranoid: 15, honest: 5 } },
      },
      {
        id: 'burn',
        label: 'Le jeter au feu',
        effects: [{ addOpinion: { towards: 'root', value: 10, reason: 'defended_honour' }, who: 'target' }, { addStress: 10 }],
        tags: ['forgiving'],
        ai: { base: 10, traits: { trusting: 15, compassionate: 10 } },
      },
      {
        id: 'publish',
        label: 'Le faire lire en place publique, quoi qu’il contienne',
        hiddenEffects: true,
        effects: [
          {
            if: { hasSecret: 'bastard', who: 'other' },
            then: [{ exposeSecret: { of: 'other' } }, { addPrestige: -40 }],
            else: [{ addPrestige: 40 }, { addAuthority: 10 }],
          },
        ],
        tags: ['honest'],
        ai: { base: 5, traits: { honest: 15, just: 10 } },
      },
    ],
  },

  // --- Régence ----------------------------------------------------------------
  {
    id: 'succession_regency',
    category: 'succession',
    title: 'Si je venais à disparaître',
    text:
      '{target.name}, qui doit vous succéder, n’a que {target.age} ans, et chacun de vos hivers pèse un peu plus que le précédent. Au conseil, on n’ose pas l’évoquer devant vous, mais on y pense : si la mort vous surprenait demain, qui tiendrait {root.realm} jusqu’à la majorité de l’enfant ? Votre chancelier suggère de coucher vos volontés par écrit, tant qu’il en est encore temps.',
    illustration: 'council_chamber',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 3650,
    conditions: { age: { min: 50 } },
    target: { pool: 'heir', where: { isAdult: false, who: 'target' } },
    other: { pool: 'spouse', where: { isAdult: true, who: 'other' }, optional: true },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'spouse_regent',
        label: 'Désigner {other.name} pour la régence',
        conditions: { exists: 'other' },
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'named_regent' }, who: 'other' },
          { setFlag: 'succession_regent_named' },
        ],
        ai: { base: 10, traits: { trusting: 10, loyal: 5, paranoid: -10 } },
      },
      {
        id: 'regency_council',
        label: 'Instituer un conseil de régence',
        cost: { gold: 40 },
        effects: [{ addVassalOpinion: 10, reason: 'regency_council', months: 60 }, { setFlag: 'succession_regent_named' }],
        ai: { base: 10, traits: { just: 10, diligent: 5 } },
      },
      {
        id: 'train_heir',
        label: 'Préparer l’enfant vous-même, sans tarder',
        effects: [
          { addSkill: { skill: 'diplomacy', value: 1 }, who: 'target' },
          { addSkill: { skill: 'stewardship', value: 1 }, who: 'target' },
          { addOpinion: { towards: 'root', value: 15, reason: 'prepared_heir' }, who: 'target' },
          { addStress: 15 },
        ],
        ai: { base: 5, traits: { diligent: 15, lazy: -10 } },
      },
      {
        id: 'refuse',
        label: '« Je ne compte pas mourir. »',
        effects: [{ addPrestige: 10 }, { addVassalOpinion: -5, reason: 'uncertain_succession', months: 36 }],
        ai: { base: 5, traits: { arrogant: 20, brave: 10 } },
      },
    ],
  },
];

/** Libellés des raisons d'opinion et des modificateurs introduits ici. */
export const LOC_FAMILY: Record<string, string> = {
  // Raisons d'opinion
  'opinion.reason.marital_apology': 'A présenté ses excuses',
  'opinion.reason.marital_gift': 'Présent de réconciliation',
  'opinion.reason.marital_rift': 'Brouille conjugale',
  'opinion.reason.marital_reconciled': 'Réconciliation',
  'opinion.reason.marital_humiliation': 'Humiliation conjugale',
  'opinion.reason.shared_power': 'Associé·e au pouvoir',
  'opinion.reason.spouse_stewardship': 'Intendance confiée',
  'opinion.reason.denied_ambition': 'Ambition refusée',
  'opinion.reason.family_welcomed': 'Accueilli·e en famille',
  'opinion.reason.family_rejected': 'Chassé·e de la famille',
  'opinion.reason.deathbed_oath': 'Serment au lit de mort',
  'opinion.reason.refused_oath': 'Serment refusé',
  'opinion.reason.wedding_gift': 'Présent de noces',
  'opinion.reason.parental_counsel': 'Conseil parental',
  'opinion.reason.stern_reminder': 'Rappel au devoir',
  'opinion.reason.nurtured_talent': 'Talent encouragé',
  'opinion.reason.praised_publicly': 'Loué·e devant la cour',
  'opinion.reason.belittled': 'Rabaissé·e',
  'opinion.reason.harsh_punishment': 'Punition sévère',
  'opinion.reason.gentle_lesson': 'Leçon bienveillante',
  'opinion.reason.personal_tutor': 'Instruit·e par son parent',
  'opinion.reason.strict_upbringing': 'Éducation stricte',
  'opinion.reason.indulgent_parent': 'Parent indulgent',
  'opinion.reason.shared_lessons': 'Leçons partagées',
  'opinion.reason.favored_child': 'Enfant favorisé',
  'opinion.reason.slighted_child': 'Enfant délaissé',
  'opinion.reason.public_rebuke': 'Réprimande publique',
  'opinion.reason.shared_hardship': 'Épreuves partagées',
  'opinion.reason.ward_trust': 'Pupille confié',
  'opinion.reason.sent_away': 'Envoyé·e au loin',
  'opinion.reason.refused_ward': 'Pupille refusé',
  'opinion.reason.omen_favoritism': 'Présage favorisant un cadet',
  'opinion.reason.secret_glances': 'Regards complices',
  'opinion.reason.rebuffed': 'Avances repoussées',
  'opinion.reason.banished_from_court': 'Chassé·e de la cour',
  'opinion.reason.lover_rewarded': 'Discrétion récompensée',
  'opinion.reason.lover_spurned': 'Amant·e éconduit·e',
  'opinion.reason.soulmate_vow': 'Serment d’âme sœur',
  'opinion.reason.stolen_hours': 'Heures volées',
  'opinion.reason.suspected_infidelity': 'Soupçons d’infidélité',
  'opinion.reason.lover_gift': 'Présent galant',
  'opinion.reason.neglected_lover': 'Amant·e négligé·e',
  'opinion.reason.blessed_love': 'Amour béni',
  'opinion.reason.love_forbidden': 'Amour interdit',
  'opinion.reason.lost_love': 'Amour arraché',
  'opinion.reason.heart_to_heart': 'Conversation à cœur ouvert',
  'opinion.reason.left_in_peace': 'Laissé·e en paix',
  'opinion.reason.burdened_with_duties': 'Accablé·e de devoirs',
  'opinion.reason.reassured': 'Rassuré·e',
  'opinion.reason.caught_lying': 'Pris·e à mentir',
  'opinion.reason.confessed_infidelity': 'Infidélité avouée',
  'opinion.reason.tender_wedding': 'Nuit de noces tendre',
  'opinion.reason.cold_wedding': 'Nuit de noces glaciale',
  'opinion.reason.second_spring': 'Second printemps',
  'opinion.reason.neglected_spouse': 'Conjoint·e négligé·e',
  'opinion.reason.bedside_vigil': 'Veillé·e dans la maladie',
  'opinion.reason.cared_for': 'Soins prodigués',
  'opinion.reason.abandoned_sickbed': 'Abandonné·e malade',
  'opinion.reason.trusted_heir': 'Héritier de confiance',
  'opinion.reason.confided_in': 'Confidences',
  'opinion.reason.fearless_ruler': 'Souverain sans peur',
  'opinion.reason.ruler_outburst': 'Accès de colère',
  'opinion.reason.birth_feast': 'Festin de naissance',
  'opinion.reason.grand_funeral': 'Funérailles fastueuses',
  'opinion.reason.respectful_mourning': 'Deuil respectueux',
  'opinion.reason.accession_gifts': 'Largesses d’avènement',
  'opinion.reason.inheritance_honored': 'Héritage honoré',
  'opinion.reason.inheritance_bargained': 'Héritage marchandé',
  'opinion.reason.inheritance_denied': 'Héritage refusé',
  'opinion.reason.defended_honour': 'Honneur défendu',
  'opinion.reason.harsh_censorship': 'Censure brutale',
  'opinion.reason.named_regent': 'Nommé·e régent·e',
  'opinion.reason.regency_council': 'Conseil de régence',
  'opinion.reason.prepared_heir': 'Préparé·e à régner',
  'opinion.reason.uncertain_succession': 'Succession incertaine',
  // Modificateurs
  'modifier.family_separate_chambers': 'Appartements séparés',
  'modifier.family_cold_marriage': 'Mariage glacé',
  'modifier.family_spouse_counsel': 'Conjoint·e aux audiences',
  'modifier.family_spouse_stewardship': 'Intendance du conjoint',
  'modifier.romance_second_spring': 'Second printemps',
  'modifier.health_lingering_fever': 'Fièvre persistante',
  'modifier.health_thermal_cure': 'Cure thermale',
  'modifier.health_wine_habit': 'Penchant pour le vin',
  'modifier.health_withdrawn': 'Retraite monastique',
  'modifier.succession_firm_hand': 'Main de fer',
  'modifier.succession_mourning': 'Période de deuil',
};
