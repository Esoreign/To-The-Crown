import type { EventDef } from '@ttc/shared';

/**
 * Événements d'intrigue, de secrets, de rivalité, de guerre et de diplomatie.
 *
 * Chaînes :
 *  - « Le sang sur le sceau » : intrigue_blood_on_seal → _name | _trap | _cold (→ _name)
 *  - Le maître chanteur : secrets_blackmail_letter → _second → _hunt
 *  - La coupe empoisonnée : intrigue_poisoned_cup → intrigue_conspiracy_trail → intrigue_conspiracy_unmasked
 *  - La querelle : rivalry_court_humiliation | rivalry_escalation → rivalry_duel_challenge
 *  - La poterne du nord : war_traitor_gates → war_traitor_gates_open | war_traitor_gates_trap
 */
export const EVENTS_INTRIGUE: EventDef[] = [
  // ===========================================================================
  // Chaîne : « Le sang sur le sceau »
  // ===========================================================================
  {
    id: 'intrigue_blood_on_seal',
    category: 'intrigue',
    title: 'Le sang sur le sceau',
    text:
      'Votre maître-espion attend que la salle du conseil se vide pour poser devant vous un sceau brisé, taché d’un brun qui n’est pas celui de l’encre. Selon lui, l’un de vos conseillers vend vos délibérations à la cour de {other.realm} : les relèves de vos gardes, l’état de vos coffres, jusqu’aux noms de vos alliés. Il n’a pas encore de preuve, seulement des coïncidences trop nombreuses pour en être. Il attend vos ordres, et chaque jour de silence est un jour de trahison de plus.',
    illustration: 'council_chamber',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 3650,
    conditions: { all: [{ hasCouncil: true }, { isAdult: true }] },
    target: { pool: 'councillor', where: { isAdult: true, who: 'target' } },
    other: { pool: 'neighbor_ruler' },
    portraits: ['root'],
    choices: [
      {
        id: 'name',
        label: '« Qu’on me rapporte son nom. »',
        tooltip: 'Votre maître-espion mènera l’enquête et vous livrera un coupable.',
        effects: [{ addStress: 5 }, { triggerEvent: { id: 'intrigue_blood_on_seal_name', days: 30 } }],
        ai: { base: 15, traits: { paranoid: 15, just: 10, wrathful: 5 }, personality: { caution: 10 } },
      },
      {
        id: 'false_lead',
        label: '« Lancez une fausse information et observons. »',
        tooltip: 'Un piège patient : s’il fonctionne, le traître se désignera lui-même.',
        conditions: { skill: 'intrigue', value: { min: 6 } },
        effects: [
          {
            chance: 60,
            then: [{ triggerEvent: { id: 'intrigue_blood_on_seal_trap', days: 60 } }],
            else: [{ triggerEvent: { id: 'intrigue_blood_on_seal_cold', days: 60 } }],
          },
        ],
        tags: ['deceitful'],
        hiddenEffects: true,
        ai: { base: 10, traits: { deceitful: 15, patient: 10, paranoid: 5 }, personality: { intrigue: 20 } },
      },
      {
        id: 'ignore',
        label: '« Il y a des problèmes plus urgents. »',
        effects: [{ addModifier: { id: 'intrigue_leaking_council', months: 24, values: { scheme_resistance: -10 } } }],
        ai: { base: 8, traits: { trusting: 15, lazy: 15, content: 5 }, personality: { caution: -10 } },
      },
    ],
  },
  {
    id: 'intrigue_blood_on_seal_name',
    category: 'intrigue',
    title: 'Un nom sous la cire',
    text:
      'Il a fallu un mois, trois pots-de-vin et un valet trop bavard. Votre maître-espion vous remet enfin un nom : {target.fullname}. Les lettres partaient cachées dans la doublure des sacs d’un marchand de sel, et revenaient chargées d’argent de {other.realm}. {target.name} siège toujours à votre table et vous salue chaque matin avec la même déférence tranquille. Ce que vous ferez de ce nom décidera de la loyauté de tous les autres.',
    illustration: 'council_chamber',
    trigger: 'chain',
    target: { pool: 'councillor' },
    other: { pool: 'neighbor_ruler' },
    portraits: ['root', 'target'],
    major: true,
    choices: [
      {
        id: 'arrest',
        label: '« Aux fers, sur-le-champ. »',
        effects: [{ imprison: { by: 'root' }, who: 'target' }, { addPrestige: 30 }],
        ai: { base: 15, traits: { just: 10, wrathful: 10, paranoid: 10 }, personality: { loyalty: 5 } },
      },
      {
        id: 'confront',
        label: '« Je veux l’entendre de sa bouche. »',
        tooltip: 'Un aveu vous donnerait prise sur le coupable ; un démenti indigné vous coûterait sa confiance.',
        effects: [
          {
            chance: 55,
            then: [
              { createHook: { on: 'target', strong: true } },
              { addOpinion: { towards: 'root', value: -10, reason: 'opinion.reason.intrigue_confronted' }, who: 'target' },
            ],
            else: [
              { addOpinion: { towards: 'root', value: -25, reason: 'opinion.reason.intrigue_accused' }, who: 'target' },
              { addStress: 10 },
            ],
          },
        ],
        tags: ['honest'],
        hiddenEffects: true,
        ai: { base: 10, traits: { honest: 15, brave: 5, just: 5 }, personality: { honor: 15 } },
      },
      {
        id: 'turn',
        label: '« Laissez ce traître écrire — mais sous ma dictée. »',
        conditions: { skill: 'intrigue', value: { min: 10 } },
        effects: [
          { createHook: { on: 'target', strong: true } },
          { addModifier: { id: 'intrigue_poisoned_well', months: 36, values: { scheme_power: 10 } } },
        ],
        tags: ['deceitful'],
        ai: { base: 12, traits: { deceitful: 15, patient: 10 }, personality: { intrigue: 25 } },
      },
      {
        id: 'doubt',
        label: '« Je ne crois pas un mot de cette accusation. »',
        effects: [
          { addOpinion: { towards: 'root', value: 15, reason: 'opinion.reason.intrigue_defended' }, who: 'target' },
          { addModifier: { id: 'intrigue_leaking_council', months: 24, values: { scheme_resistance: -10 } } },
        ],
        tags: ['forgiving'],
        ai: { base: 6, traits: { trusting: 20, loyal: 5 }, personality: { loyalty: 10, caution: -10 } },
      },
    ],
  },
  {
    id: 'intrigue_blood_on_seal_trap',
    category: 'intrigue',
    title: 'La flotte fantôme',
    text:
      'Six semaines après que vous avez laissé filer, en plein conseil, le récit d’une flotte imaginaire, les garnisons de {other.realm} se sont massées sur une côte que nul ne menace. Une seule personne avait entendu cette version-là : {target.fullname}. Votre maître-espion ne sourit pas. Il se contente de poser devant vous la liste des présents, un seul nom souligné à l’encre rouge, et de reculer d’un pas.',
    illustration: 'council_chamber',
    trigger: 'chain',
    target: { pool: 'councillor' },
    other: { pool: 'neighbor_ruler' },
    portraits: ['root', 'target'],
    major: true,
    choices: [
      {
        id: 'trial',
        label: '« Qu’on {target.le} juge devant toute la cour. »',
        effects: [
          { imprison: { by: 'root' }, who: 'target' },
          { addPrestige: 60 },
          { addVassalOpinion: 5, reason: 'opinion.reason.intrigue_traitor_judged' },
        ],
        ai: { base: 15, traits: { just: 15, honest: 5 }, personality: { honor: 10 } },
      },
      {
        id: 'execute',
        label: '« La trahison n’appelle qu’une réponse. »',
        tooltip: 'Une exécution sans procès glacera la cour.',
        effects: [
          { killCharacter: { cause: 'execution' }, who: 'target' },
          { addPrestige: 40 },
          { addVassalOpinion: -10, reason: 'opinion.reason.intrigue_harsh_justice' },
        ],
        tags: ['cruel', 'vengeful'],
        ai: { base: 3, traits: { cruel: 20, wrathful: 15, arbitrary: 10 }, personality: { compassion: -15 } },
      },
      {
        id: 'double',
        label: '« Désormais, c’est moi qui tiendrai sa plume. »',
        effects: [
          { createHook: { on: 'target', strong: true } },
          { addModifier: { id: 'intrigue_double_agent', months: 60, values: { scheme_power: 10, scheme_resistance: 10 } } },
        ],
        tags: ['deceitful'],
        ai: { base: 12, traits: { deceitful: 15, patient: 10 }, personality: { intrigue: 25 } },
      },
      {
        id: 'exile',
        label: '« Qu’{target.il} parte, et n’y revienne jamais. »',
        effects: [{ banish: true, who: 'target' }, { addStress: -5 }],
        tags: ['forgiving'],
        ai: { base: 8, traits: { compassionate: 15, content: 5 }, personality: { compassion: 10 } },
      },
    ],
  },
  {
    id: 'intrigue_blood_on_seal_cold',
    category: 'intrigue',
    title: 'Une piste qui refroidit',
    text:
      'La fausse nouvelle n’a jamais atteint {other.realm}, ou personne n’y a cru. Pire : votre maître-espion craint que le traître ait flairé le piège, car les fuites ont cessé net, comme on souffle une chandelle. Il demande de l’or pour acheter des langues plus bavardes au-delà de la frontière, et avoue à mi-voix qu’il ne peut plus rien garantir. Le coupable, lui, dort toujours sous votre toit.',
    illustration: 'night_alley',
    trigger: 'chain',
    target: { pool: 'councillor' },
    other: { pool: 'neighbor_ruler' },
    portraits: ['root'],
    choices: [
      {
        id: 'pay',
        label: '« Achetez ces langues. »',
        cost: { gold: 60 },
        effects: [
          {
            chance: 50,
            then: [{ triggerEvent: { id: 'intrigue_blood_on_seal_name', days: 30 } }],
            else: [{ addStress: 10 }],
          },
        ],
        hiddenEffects: true,
        ai: { base: 10, traits: { paranoid: 15, diligent: 5 }, personality: { greed: -10, caution: 10 } },
      },
      {
        id: 'lockdown',
        label: '« Des gardes à chaque porte, et des yeux dans chaque couloir. »',
        effects: [
          { addModifier: { id: 'intrigue_closed_doors', months: 24, values: { scheme_resistance: 15, general_opinion: -5 } } },
          { addStress: 10 },
        ],
        ai: { base: 10, traits: { paranoid: 20 }, personality: { caution: 15, sociability: -5 } },
      },
      {
        id: 'drop',
        label: '« Assez. On ne chasse pas les ombres. »',
        effects: [
          { addStress: -5 },
          { addModifier: { id: 'intrigue_leaking_council', months: 24, values: { scheme_resistance: -10 } } },
        ],
        ai: { base: 10, traits: { trusting: 10, lazy: 10, content: 10 } },
      },
    ],
  },

  // ===========================================================================
  // Chaîne : la coupe empoisonnée
  // ===========================================================================
  {
    id: 'intrigue_poisoned_cup',
    category: 'intrigue',
    title: 'La coupe renversée',
    text:
      'Au milieu du banquet, {target.fullname} renverse votre coupe d’un geste maladroit — ou trop précis. Le vin se répand sur les dalles, et le lévrier qui vient le laper se met à trembler avant de s’effondrer sans un cri. Autour de la table, les rires meurent un à un. Quelqu’un, dans cette salle, voulait vous voir mourir ce soir ; et {target.name} est peut-être seul{target.e} à savoir pourquoi cette main s’est levée à temps.',
    illustration: 'feast',
    trigger: 'pulse',
    weight: 7,
    cooldownDays: 3650,
    conditions: { isAdult: true },
    target: { pool: 'courtier', where: { isAdult: true, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'reward',
        label: '« Récompensez {target.le}, puis trouvez l’empoisonneur. »',
        cost: { gold: 30 },
        effects: [
          { addOpinion: { towards: 'root', value: 20, reason: 'opinion.reason.intrigue_rewarded' }, who: 'target' },
          { triggerEvent: { id: 'intrigue_conspiracy_trail', days: 45 } },
        ],
        tags: ['generous'],
        ai: { base: 15, traits: { just: 10, generous: 10, trusting: 5 }, personality: { honor: 10 } },
      },
      {
        id: 'suspect',
        label: '« Comment savait-{target.il} ? Qu’on {target.le} questionne. »',
        tooltip: 'Votre sauveur finira au cachot, mais parlera peut-être.',
        effects: [
          { imprison: { by: 'root' }, who: 'target' },
          { triggerEvent: { id: 'intrigue_conspiracy_trail', days: 30 } },
        ],
        tags: ['cruel'],
        ai: { base: 5, traits: { paranoid: 25, cruel: 10 }, personality: { caution: 10, compassion: -10 } },
      },
      {
        id: 'silence',
        label: '« Pas un mot. Laissez croire que le chien était malade. »',
        cost: { gold: 40 },
        effects: [
          { addModifier: { id: 'intrigue_food_tasters', months: 24, values: { scheme_resistance: 10 } } },
          { addStress: 10 },
        ],
        tags: ['deceitful'],
        ai: { base: 8, traits: { deceitful: 10, reclusive: 10 }, personality: { caution: 15 } },
      },
    ],
  },
  {
    id: 'intrigue_conspiracy_trail',
    category: 'intrigue',
    title: 'La racine de pâle-sombre',
    text:
      'La piste mène à une herboriste des faubourgs de {province.name}, qui a vendu de la racine de pâle-sombre à une servante des cuisines. Sous la menace, la servante a tout avoué : on l’a payée en pièces étrangères, frappées d’un sceau qu’elle ne sait pas lire. Elle ignore le nom du commanditaire, mais se souvient d’un homme en manteau de voyage, et d’un rendez-vous fixé à la prochaine lune, près du vieux gué.',
    illustration: 'night_alley',
    trigger: 'chain',
    conditions: { isAdult: true },
    portraits: ['root'],
    choices: [
      {
        id: 'ambush',
        label: '« Tendez une embuscade au gué. »',
        effects: [
          {
            chance: 60,
            then: [{ triggerEvent: { id: 'intrigue_conspiracy_unmasked', days: 30 } }],
            else: [{ addPrestige: -20 }, { addStress: 10 }],
          },
        ],
        tags: ['brave'],
        hiddenEffects: true,
        ai: { base: 12, traits: { brave: 15, wrathful: 5 }, personality: { aggression: 15 } },
      },
      {
        id: 'follow_silver',
        label: '« Suivez l’argent, patiemment. »',
        cost: { gold: 50 },
        effects: [{ triggerEvent: { id: 'intrigue_conspiracy_unmasked', days: 90 } }],
        ai: { base: 12, traits: { patient: 15, diligent: 10 }, personality: { intrigue: 15, greed: -10 } },
      },
      {
        id: 'hang_servant',
        label: '« Pendez la servante. Que l’exemple suffise. »',
        effects: [{ addPrestige: 20 }, { addAuthority: 10 }],
        tags: ['cruel'],
        ai: { base: 5, traits: { cruel: 20, wrathful: 10, lazy: 5 }, personality: { compassion: -15 } },
      },
      {
        id: 'spare_servant',
        label: '« Épargnez-la : libre, elle en dira plus qu’au gibet. »',
        effects: [
          {
            chance: 50,
            then: [{ triggerEvent: { id: 'intrigue_conspiracy_unmasked', days: 60 } }],
            else: [{ addStress: 5 }],
          },
        ],
        tags: ['compassionate'],
        hiddenEffects: true,
        ai: { base: 8, traits: { compassionate: 20 }, personality: { compassion: 15 } },
      },
    ],
  },
  {
    id: 'intrigue_conspiracy_unmasked',
    category: 'intrigue',
    title: 'Le sceau du commanditaire',
    text:
      'L’homme au manteau de voyage n’a pas résisté longtemps. Les lettres cousues dans sa ceinture portent le sceau de {other.fullname}, et promettent une récompense à qui verserait la pâle-sombre dans votre coupe. {other.name} vous a souri aux dernières fêtes, a partagé votre pain et vous a appelé ami. Vous tenez la preuve de sa perfidie ; reste à savoir si elle vaut davantage brandie, cachée, ou retournée contre son auteur.',
    illustration: 'dungeon',
    trigger: 'chain',
    other: { pool: 'neighbor_ruler' },
    portraits: ['root', 'other'],
    major: true,
    choices: [
      {
        id: 'denounce',
        label: '« Que toute la Caldria l’apprenne. »',
        effects: [
          { addPrestige: 80 },
          { addOpinion: { towards: 'root', value: -40, reason: 'opinion.reason.intrigue_denounced' }, who: 'other' },
          { createRelationship: { type: 'rival', with: 'other' } },
        ],
        tags: ['honest'],
        ai: { base: 12, traits: { honest: 15, just: 10, arrogant: 5 }, personality: { honor: 10 } },
      },
      {
        id: 'leverage',
        label: '« Gardons ces lettres. Elles valent une armée. »',
        effects: [
          { createSecret: { type: 'murder_plot', about: 'root', knownBy: ['root'] }, who: 'other' },
          { createHook: { on: 'other', strong: true, years: 10 } },
        ],
        tags: ['deceitful'],
        ai: { base: 12, traits: { deceitful: 10, patient: 10, ambitious: 5 }, personality: { intrigue: 20 } },
      },
      {
        id: 'retaliate',
        label: '« À son tour de goûter au poison. »',
        tooltip: 'Lance un complot de meurtre contre votre voisin.',
        effects: [{ startScheme: { type: 'murder', target: 'other' } }, { addStress: -10 }],
        tags: ['cruel', 'vengeful'],
        ai: { base: 2, traits: { cruel: 15, wrathful: 15, deceitful: 5 }, personality: { aggression: 10, compassion: -15 } },
      },
    ],
  },

  // ===========================================================================
  // Complots, espions et faussaires
  // ===========================================================================
  {
    id: 'intrigue_assassin_offer',
    category: 'intrigue',
    title: 'L’homme à l’anneau d’étain',
    text:
      'L’homme qui s’est introduit dans votre cabinet n’a pas donné de nom et ne semble pas en avoir besoin. Il parle bas, sans hâte, comme un marchand de draps. Pour cent pièces d’or, dit-il, {target.fullname} ne verra pas la fin de l’année : une chute de cheval, une fièvre, un escalier mal éclairé. Personne ne remontera jusqu’à vous. Il pose sur la table un anneau d’étain en gage de discrétion, et attend votre réponse.',
    illustration: 'night_alley',
    trigger: 'pulse',
    weight: 5,
    cooldownDays: 3650,
    conditions: { isAdult: true },
    target: {
      pool: 'neighbor_ruler',
      where: {
        any: [
          { hasRelation: 'rival', with: 'target' },
          { hasRelation: 'nemesis', with: 'target' },
          { opinion: { max: -10 }, towards: 'target' },
        ],
      },
    },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'accept',
        label: '« Faites. »',
        tooltip: 'Un complot de meurtre commence ; il peut échouer ou être découvert.',
        cost: { gold: 100 },
        effects: [{ startScheme: { type: 'murder', target: 'target' } }],
        tags: ['cruel', 'deceitful'],
        ai: { base: 2, traits: { cruel: 20, ambitious: 10, wrathful: 10 }, personality: { ambition: 10, honor: -20, compassion: -20 } },
      },
      {
        id: 'guards',
        label: '« Gardes ! »',
        effects: [{ addPrestige: 25 }],
        tags: ['honest'],
        ai: { base: 15, traits: { honest: 10, just: 10, brave: 5 }, personality: { honor: 15 } },
      },
      {
        id: 'warn',
        label: '« Faites prévenir {target.name}. Je ne tue pas dans l’ombre. »',
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'opinion.reason.intrigue_warned' }, who: 'target' },
          { addPrestige: 15 },
        ],
        tags: ['honest', 'compassionate'],
        ai: { base: 8, traits: { compassionate: 15, honest: 10 }, personality: { compassion: 15, honor: 10 } },
      },
    ],
  },
  {
    id: 'intrigue_spy_caught',
    category: 'intrigue',
    title: 'Un copiste trop zélé',
    text:
      'Vos gardes ont surpris un copiste dans les archives, bien après l’heure des vêpres, penché sur les registres de vos garnisons. Dans la doublure de ses chausses : un laissez-passer au sceau de {other.fullname}. L’homme tremble mais se tait. Votre geôlier vous rappelle, sans lever les yeux, que les langues les plus fidèles finissent toujours par se délier, pour peu qu’on y mette le temps et la manière.',
    illustration: 'dungeon',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    other: { pool: 'neighbor_ruler' },
    portraits: ['root', 'other'],
    choices: [
      {
        id: 'torture',
        label: '« Faites-le parler. »',
        effects: [
          {
            chance: 60,
            then: [
              { createSecret: { type: 'political_crime', knownBy: ['root'] }, who: 'other' },
              { createHook: { on: 'other', years: 5 } },
            ],
            else: [{ addStress: 5 }],
          },
        ],
        tags: ['cruel'],
        hiddenEffects: true,
        ai: { base: 8, traits: { cruel: 20, paranoid: 10 }, personality: { intrigue: 10, compassion: -15 } },
      },
      {
        id: 'hang',
        label: '« Pendez-le aux créneaux, face à la route de {other.realm}. »',
        effects: [
          { addPrestige: 40 },
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.intrigue_spy_hanged' }, who: 'other' },
        ],
        tags: ['vengeful'],
        ai: { base: 10, traits: { wrathful: 15, arrogant: 10 }, personality: { aggression: 10 } },
      },
      {
        id: 'return',
        label: '« Rendez-le à son maître, avec mes compliments. »',
        effects: [
          { addPrestige: 20 },
          { addOpinion: { towards: 'root', value: 10, reason: 'opinion.reason.intrigue_spy_returned' }, who: 'other' },
        ],
        tags: ['forgiving'],
        ai: { base: 10, traits: { compassionate: 10, patient: 10, content: 5 }, personality: { honor: 10 } },
      },
      {
        id: 'turn',
        label: '« Offrez-lui double salaire pour mentir à son maître. »',
        conditions: { skill: 'intrigue', value: { min: 8 } },
        cost: { gold: 40 },
        effects: [{ addModifier: { id: 'intrigue_double_agent', months: 36, values: { scheme_power: 10 } } }],
        tags: ['deceitful'],
        ai: { base: 10, traits: { deceitful: 15 }, personality: { intrigue: 20 } },
      },
    ],
  },
  {
    id: 'intrigue_courtier_spy_offer',
    category: 'intrigue',
    title: 'Entre deux haies de buis',
    text:
      'Pendant votre promenade, {target.fullname} vous rejoint entre deux haies de buis, là où nul ne peut entendre. Avant de venir à votre cour, {target.name} a servi dans la maison de {other.fullname}, et y garde des amis : une chambrière, un intendant, un capitaine criblé de dettes. Pour un peu d’or et beaucoup de discrétion, ces amis pourraient se mettre à écrire. Son visage ne trahit rien — c’est peut-être la meilleure des recommandations.',
    illustration: 'garden',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    target: { pool: 'courtier', where: { skill: 'intrigue', value: { min: 7 }, who: 'target' } },
    other: { pool: 'neighbor_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'accept',
        label: '« Qu’ils écrivent. Je paierai. »',
        cost: { gold: 50 },
        effects: [
          {
            chance: 65,
            then: [
              { createSecret: { type: 'debt', knownBy: ['root', 'target'] }, who: 'other' },
              { createHook: { on: 'other', years: 5 } },
            ],
            else: [
              { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.intrigue_spying_caught' }, who: 'other' },
              { addPrestige: -20 },
            ],
          },
        ],
        tags: ['deceitful'],
        hiddenEffects: true,
        ai: { base: 12, traits: { deceitful: 10, ambitious: 10 }, personality: { intrigue: 20, greed: -5 } },
      },
      {
        id: 'inward',
        label: '« Je préfère que vous surveilliez ma propre cour. »',
        cost: { gold: 25 },
        effects: [
          { addModifier: { id: 'intrigue_watchful_eyes', months: 36, values: { scheme_resistance: 10 } } },
          { addOpinion: { towards: 'root', value: 10, reason: 'opinion.reason.intrigue_trusted' }, who: 'target' },
        ],
        ai: { base: 12, traits: { paranoid: 20 }, personality: { caution: 15 } },
      },
      {
        id: 'refuse',
        label: '« Je ne paie pas pour des lettres volées. »',
        effects: [
          { addOpinion: { towards: 'root', value: -10, reason: 'opinion.reason.intrigue_rebuffed' }, who: 'target' },
          { addPrestige: 10 },
        ],
        tags: ['honest'],
        ai: { base: 10, traits: { honest: 20, just: 5 }, personality: { honor: 15 } },
      },
    ],
  },
  {
    id: 'intrigue_forged_charter',
    category: 'intrigue',
    title: 'Des chartes trop parfaites',
    text:
      'Le vieux clerc qui demande audience porte des mitaines trouées et une serviette de cuir qu’il ne lâche jamais. Il y garde, dit-il, des chartes « retrouvées » dans un monastère en ruine, qui établissent les droits de vos ancêtres sur les terres de {target.fullname}. Les parchemins ont l’odeur juste, les sceaux la bonne patine. Qu’ils soient vrais importe peu, murmure-t-il : il suffit qu’ils soient crus.',
    illustration: 'library',
    trigger: 'pulse',
    weight: 7,
    cooldownDays: 3650,
    conditions: { isAdult: true },
    target: { pool: 'neighbor_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'full',
        label: '« Je prends le tout : le titre entier. »',
        tooltip: 'Un faux aussi ambitieux risque d’être éventé.',
        cost: { gold: 150 },
        effects: [
          { addClaim: { title: 'targetPrimary' } },
          {
            chance: 25,
            then: [
              { addPrestige: -60 },
              { addOpinion: { towards: 'root', value: -30, reason: 'opinion.reason.intrigue_forgery_exposed' }, who: 'target' },
            ],
          },
        ],
        tags: ['deceitful', 'ambitious'],
        hiddenEffects: true,
        ai: { base: 6, traits: { ambitious: 20, deceitful: 10, greedy: 5 }, personality: { ambition: 20, honor: -10 } },
      },
      {
        id: 'county',
        label: '« Un seul comté suffira, et fera moins de bruit. »',
        cost: { gold: 60 },
        effects: [{ addClaim: { title: 'targetCounty' } }],
        tags: ['deceitful'],
        ai: { base: 10, traits: { ambitious: 10, patient: 10 }, personality: { ambition: 10, caution: 10 } },
      },
      {
        id: 'deliver',
        label: '« Qu’on livre ce faussaire à {target.name}. »',
        effects: [
          { addOpinion: { towards: 'root', value: 20, reason: 'opinion.reason.intrigue_forger_delivered' }, who: 'target' },
          { addPrestige: 15 },
        ],
        tags: ['honest'],
        ai: { base: 12, traits: { honest: 15, just: 10, content: 5 }, personality: { honor: 15 } },
      },
    ],
  },
  {
    id: 'intrigue_scheme_discovered_court',
    category: 'intrigue',
    title: 'Le serpent sous le toit',
    text:
      'Les preuves sont étalées devant vous : des lettres, un sceau imité, le témoignage d’un palefrenier acheté. {target.fullname} complotait contre vous, sous votre propre toit. Se sachant découvert{target.e}, {target.name} a demandé à vous voir seul — pour s’expliquer, ou pour implorer. Votre garde attend à la porte, la main sur la poignée de son épée, et la cour entière retient son souffle en attendant votre verdict.',
    illustration: 'throne_room',
    trigger: 'on:scheme_discovered',
    weight: 20,
    target: { pool: 'schemer_against' },
    conditions: {
      any: [
        { isVassalOf: 'root', who: 'target' },
        { isCouncillorOf: 'root', who: 'target' },
        { isRuler: false, who: 'target' },
      ],
    },
    portraits: ['root', 'target'],
    major: true,
    choices: [
      {
        id: 'imprison',
        label: '« Qu’on {target.le} mette aux fers. Le procès suivra. »',
        effects: [{ imprison: { by: 'root' }, who: 'target' }, { addPrestige: 20 }],
        ai: { base: 15, traits: { just: 15, wrathful: 10, paranoid: 10 }, personality: { caution: 5 } },
      },
      {
        id: 'execute',
        label: '« Qu’on dresse l’échafaud. »',
        tooltip: 'Une sentence exemplaire, qui inquiétera vos vassaux.',
        effects: [
          { killCharacter: { cause: 'execution' }, who: 'target' },
          { addPrestige: 30 },
          { addVassalOpinion: -10, reason: 'opinion.reason.intrigue_harsh_justice' },
        ],
        tags: ['cruel', 'vengeful'],
        ai: { base: 2, traits: { cruel: 20, wrathful: 15, arbitrary: 5 }, personality: { compassion: -15 } },
      },
      {
        id: 'hook',
        label: '« Vous vivrez, et vous me devrez tout. »',
        effects: [{ createHook: { on: 'target', strong: true, years: 10 } }],
        ai: { base: 12, traits: { deceitful: 10, patient: 10 }, personality: { intrigue: 20 } },
      },
      {
        id: 'forgive',
        label: '« Je vous pardonne. Ne m’y forcez pas deux fois. »',
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'opinion.reason.intrigue_spared' }, who: 'target' },
          { addPrestige: -15 },
        ],
        tags: ['forgiving', 'compassionate'],
        ai: { base: 6, traits: { compassionate: 20, trusting: 10 }, personality: { compassion: 15 } },
      },
    ],
  },
  {
    id: 'intrigue_scheme_discovered_foreign',
    category: 'intrigue',
    title: 'Une toile venue d’ailleurs',
    text:
      'Vos agents ont intercepté des lettres chiffrées : {target.fullname} tisse contre vous une toile patiente, faite d’argent versé à vos serviteurs et de promesses murmurées à vos vassaux. Au-delà de vos frontières, vous ne pouvez l’atteindre. Mais les secrets ont ceci de commun avec les lames qu’ils coupent dans les deux sens, pour qui sait les tenir par le bon bout.',
    illustration: 'library',
    trigger: 'on:scheme_discovered',
    weight: 20,
    target: { pool: 'schemer_against' },
    conditions: { all: [{ isRuler: true, who: 'target' }, { not: { isVassalOf: 'root', who: 'target' } }] },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'denounce',
        label: '« Lisez ces lettres à toutes les cours voisines. »',
        effects: [
          { addPrestige: 40 },
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.intrigue_denounced' }, who: 'target' },
          { createRelationship: { type: 'rival', with: 'target' } },
        ],
        tags: ['honest'],
        ai: { base: 12, traits: { honest: 10, arrogant: 10, wrathful: 5 }, personality: { honor: 10 } },
      },
      {
        id: 'reparation',
        label: '« Exigez réparation, en or sonnant. »',
        effects: [
          {
            chance: 50,
            then: [{ addGold: 60 }, { addGold: -60, who: 'target' }],
            else: [{ addPrestige: -20 }],
          },
        ],
        tags: ['greedy'],
        hiddenEffects: true,
        ai: { base: 10, traits: { greedy: 20 }, personality: { greed: 20 } },
      },
      {
        id: 'keep',
        label: '« Gardez ces lettres pour le jour où elles pèseront. »',
        effects: [
          { createSecret: { type: 'political_crime', about: 'root', knownBy: ['root'] }, who: 'target' },
          { createHook: { on: 'target', years: 10 } },
        ],
        tags: ['deceitful'],
        ai: { base: 12, traits: { patient: 15, deceitful: 10 }, personality: { intrigue: 20 } },
      },
      {
        id: 'guard',
        label: '« Doublez la garde et changez tous les serviteurs. »',
        effects: [{ addModifier: { id: 'intrigue_closed_doors', months: 24, values: { scheme_resistance: 15, general_opinion: -5 } } }],
        ai: { base: 10, traits: { paranoid: 20 }, personality: { caution: 15 } },
      },
    ],
  },

  // ===========================================================================
  // Secrets — chaîne du maître chanteur
  // ===========================================================================
  {
    id: 'secrets_blackmail_letter',
    category: 'secrets',
    title: 'Une lettre sans signature',
    text:
      'Glissée sous votre porte pendant la nuit, une lettre sans signature. L’écriture est soignée, presque aimable : son auteur prétend connaître « l’affaire que vous croyez enterrée » et promet de la garder pour lui contre cinquante pièces d’or, déposées au pied du calvaire de {province.name} avant la fin de la semaine. Il ne précise pas de quelle affaire il s’agit. Un maître chanteur habile sait que chacun comble lui-même ce silence avec ce qu’il redoute le plus.',
    illustration: 'bedchamber',
    trigger: 'pulse',
    weight: 6,
    cooldownDays: 3650,
    conditions: { isAdult: true },
    portraits: ['root'],
    choices: [
      {
        id: 'pay',
        label: '« Payez. Le silence n’a pas de prix. »',
        cost: { gold: 50 },
        effects: [{ addStress: 5 }, { triggerEvent: { id: 'secrets_blackmail_second', days: 90 } }],
        tags: ['craven'],
        ai: { base: 10, traits: { craven: 15, paranoid: 10 }, personality: { caution: 15 } },
      },
      {
        id: 'watch',
        label: '« Déposez une bourse de cailloux, et surveillez le calvaire. »',
        effects: [{ triggerEvent: { id: 'secrets_blackmail_hunt', days: 10 } }],
        tags: ['deceitful'],
        ai: { base: 12, traits: { deceitful: 10, diligent: 10 }, personality: { intrigue: 15 } },
      },
      {
        id: 'defy',
        label: '« Qu’il publie ce qu’il veut. Je ne crains rien. »',
        effects: [
          {
            chance: 50,
            then: [{ addPrestige: -50 }, { addStress: 15 }],
            else: [{ addPrestige: 20 }],
          },
        ],
        tags: ['brave'],
        hiddenEffects: true,
        ai: { base: 10, traits: { brave: 15, arrogant: 10, honest: 10 }, personality: { caution: -10 } },
      },
    ],
  },
  {
    id: 'secrets_blackmail_second',
    category: 'secrets',
    title: 'La faim du maître chanteur',
    text:
      'Trois mois ont passé, et la lettre revient, portée cette fois par un enfant des rues qui s’enfuit avant qu’on l’interroge. Même écriture, même politesse, mais la somme a doublé : cent pièces, faute de quoi « certains parchemins » prendront le chemin des chapelles de {province.name} et des cours voisines. Vous comprenez alors qu’un maître chanteur qu’on nourrit ne se rassasie jamais.',
    illustration: 'bedchamber',
    trigger: 'chain',
    portraits: ['root'],
    choices: [
      {
        id: 'pay_again',
        label: '« Payez encore. Une dernière fois. »',
        cost: { gold: 100 },
        effects: [{ addStress: 15 }],
        tags: ['craven'],
        ai: { base: 6, traits: { craven: 20 }, personality: { caution: 15 } },
      },
      {
        id: 'follow_child',
        label: '« Cette fois, qu’on suive l’enfant. »',
        effects: [{ triggerEvent: { id: 'secrets_blackmail_hunt', days: 15 } }],
        ai: { base: 14, traits: { diligent: 10, wrathful: 5 }, personality: { intrigue: 15 } },
      },
      {
        id: 'confess',
        label: '« Je parlerai le premier, devant toute la cour. »',
        tooltip: 'Si vous cachez un secret, il sera révélé par votre propre bouche.',
        effects: [{ exposeSecret: { of: 'root' } }, { addPrestige: -30 }, { addStress: -20 }],
        tags: ['honest'],
        ai: { base: 8, traits: { honest: 20, brave: 5 }, personality: { honor: 15 } },
      },
    ],
  },
  {
    id: 'secrets_blackmail_hunt',
    category: 'secrets',
    title: 'Pris au pied du calvaire',
    text:
      'À l’aube, vos hommes ramènent une silhouette trempée de rosée, saisie au pied du calvaire au moment où elle ramassait la bourse. Sous le capuchon, vous reconnaissez {target.fullname}, qui vit à votre cour depuis des années et mange à votre table. Pris{target.e} sur le fait, {target.name} ne nie rien. Des dettes, murmure-t-on, et la peur d’un créancier moins patient que vous ne l’êtes.',
    illustration: 'night_alley',
    trigger: 'chain',
    target: { pool: 'courtier', where: { isAdult: true, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'imprison',
        label: '« Au cachot. Qu’on y oublie son nom. »',
        effects: [{ imprison: { by: 'root' }, who: 'target' }, { addPrestige: 20 }],
        tags: ['vengeful'],
        ai: { base: 12, traits: { wrathful: 15, just: 10 }, personality: { aggression: 10 } },
      },
      {
        id: 'own_debts',
        label: '« Vos dettes sont les miennes, désormais. »',
        cost: { gold: 40 },
        effects: [
          { createSecret: { type: 'debt', knownBy: ['root'] }, who: 'target' },
          { createHook: { on: 'target', strong: true } },
        ],
        tags: ['deceitful'],
        ai: { base: 12, traits: { deceitful: 10, patient: 10 }, personality: { intrigue: 20 } },
      },
      {
        id: 'banish',
        label: '« Hors de ma cour avant la nuit. »',
        effects: [{ banish: true, who: 'target' }, { addStress: -5 }],
        ai: { base: 10, traits: { just: 5, content: 5 } },
      },
      {
        id: 'forgive',
        label: '« Relevez-vous. La peur fait faire bien des sottises. »',
        effects: [
          { addOpinion: { towards: 'root', value: 25, reason: 'opinion.reason.intrigue_spared' }, who: 'target' },
          { addStress: -5 },
        ],
        tags: ['forgiving', 'compassionate'],
        ai: { base: 6, traits: { compassionate: 20 }, personality: { compassion: 15 } },
      },
    ],
  },
  {
    id: 'secrets_anonymous_letter',
    category: 'secrets',
    title: 'Des comptes recopiés',
    text:
      'Parmi les requêtes du matin, votre secrétaire a trouvé un pli sans sceau. Il contient des comptes recopiés d’une main hâtive : les impôts que {target.fullname} prélève en votre nom, et ceux qui parviennent réellement à votre trésor. L’écart est considérable. L’auteur ne réclame rien, et c’est peut-être ce qui vous inquiète le plus : quelqu’un voulait que vous sachiez, et il faudra un jour vous demander pourquoi.',
    illustration: 'library',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    target: { pool: 'vassal', where: { isAdult: true, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'confront',
        label: '« Convoquez {target.le}, et exigez restitution. »',
        effects: [
          { addGold: 40 },
          { addGold: -40, who: 'target' },
          { addOpinion: { towards: 'root', value: -15, reason: 'opinion.reason.intrigue_accused' }, who: 'target' },
        ],
        tags: ['honest'],
        ai: { base: 12, traits: { just: 15, greedy: 10 }, personality: { greed: 10, honor: 5 } },
      },
      {
        id: 'leverage',
        label: '« Gardez ces pages. Un jour, elles serviront. »',
        effects: [
          { createSecret: { type: 'corruption', knownBy: ['root'] }, who: 'target' },
          { createHook: { on: 'target', years: 10 } },
        ],
        tags: ['deceitful'],
        ai: { base: 12, traits: { deceitful: 10, patient: 10 }, personality: { intrigue: 20 } },
      },
      {
        id: 'expose',
        label: '« Lisez-les à voix haute, devant le conseil. »',
        effects: [
          { createSecret: { type: 'corruption', knownBy: ['root'] }, who: 'target' },
          { exposeSecret: { of: 'target' } },
          { addPrestige: 25 },
          { addOpinion: { towards: 'root', value: -30, reason: 'opinion.reason.intrigue_humiliated_publicly' }, who: 'target' },
        ],
        tags: ['vengeful'],
        ai: { base: 6, traits: { wrathful: 15, arrogant: 10 }, personality: { aggression: 10 } },
      },
      {
        id: 'burn',
        label: '« Au feu. Je ne gouverne pas par délation. »',
        effects: [{ addStress: -5 }, { addPrestige: 10 }],
        tags: ['forgiving'],
        ai: { base: 8, traits: { trusting: 15, compassionate: 5, content: 5 }, personality: { honor: 10 } },
      },
    ],
  },
  {
    id: 'secrets_confessor_whisper',
    category: 'secrets',
    title: 'Le sceau de la confession',
    text:
      'Le vieux chapelain de votre maison vous retient après l’office, le visage gris. Il n’en dort plus, dit-il : {target.fullname} lui a confessé qu’{target.il} honore encore, en secret, les pierres dressées et les feux des anciens rites. Il sait qu’en parlant, il trahit le sceau le plus sacré de son ordre. Mais il craint davantage pour votre âme et pour votre maison que pour la sienne.',
    illustration: 'chapel',
    trigger: 'pulse',
    weight: 6,
    cooldownDays: 3650,
    target: { pool: 'courtier', where: { isAdult: true, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'denounce',
        label: '« Qu’on {target.le} livre au tribunal de la foi. »',
        effects: [
          { createSecret: { type: 'heresy', knownBy: ['root'] }, who: 'target' },
          { exposeSecret: { of: 'target' } },
          { addFervor: 20 },
          { addOpinion: { towards: 'root', value: -30, reason: 'opinion.reason.secrets_denounced_heresy' }, who: 'target' },
        ],
        tags: ['pious'],
        ai: { base: 10, traits: { zealous: 25, cruel: 5 }, personality: { zeal: 20 } },
      },
      {
        id: 'keep',
        label: '« Je garderai ce secret… et le souvenir de sa dette. »',
        effects: [
          { createSecret: { type: 'heresy', knownBy: ['root'] }, who: 'target' },
          { createHook: { on: 'target', years: 10 } },
        ],
        tags: ['deceitful'],
        ai: { base: 12, traits: { deceitful: 10, cynical: 10 }, personality: { intrigue: 15 } },
      },
      {
        id: 'rebuke',
        label: '« Un prêtre qui parle ne mérite plus qu’on se confesse à lui. »',
        effects: [{ addFervor: -10 }, { addPrestige: 15 }],
        tags: ['honest'],
        ai: { base: 10, traits: { honest: 10, cynical: 10, just: 5 }, personality: { honor: 10, zeal: -10 } },
      },
    ],
  },

  // ===========================================================================
  // Rivalités
  // ===========================================================================
  {
    id: 'rivalry_court_humiliation',
    category: 'rivalry',
    title: 'Un toast empoisonné',
    text:
      'Au plus fort du banquet, {target.fullname} lève sa coupe et, d’une voix qui porte jusqu’aux cuisines, propose de boire « à la santé de notre hôte, qui gouverne comme {root.il} chasse : beaucoup de cors, peu de gibier ». Le rire part des tables basses et remonte, hésitant, jusqu’à l’estrade. Certains regardent leurs assiettes. D’autres vous regardent, vous, et attendent de savoir ce que vaut votre dignité.',
    illustration: 'feast',
    trigger: 'pulse',
    weight: 9,
    cooldownDays: 2555,
    conditions: { isAdult: true },
    target: {
      pool: 'courtier',
      where: { all: [{ isAdult: true, who: 'target' }, { not: { hasRelation: 'rival', with: 'target' } }] },
    },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'laugh',
        label: 'Rire plus fort que tous les autres.',
        effects: [
          { addPrestige: -20 },
          { addOpinion: { towards: 'root', value: 10, reason: 'opinion.reason.rivalry_good_sport' }, who: 'target' },
        ],
        tags: ['humble'],
        ai: { base: 10, traits: { humble: 15, content: 10, sociable: 10 }, personality: { sociability: 10 } },
      },
      {
        id: 'retort',
        label: 'Une repartie qui {target.le} laisse sans voix.',
        conditions: { skill: 'diplomacy', value: { min: 10 } },
        effects: [
          { addPrestige: 40 },
          { addOpinion: { towards: 'root', value: -15, reason: 'opinion.reason.rivalry_humiliated' }, who: 'target' },
        ],
        ai: { base: 15, traits: { sociable: 10, arrogant: 5 }, personality: { sociability: 10 } },
      },
      {
        id: 'grudge',
        label: '« Je n’oublierai pas ce toast. »',
        tooltip: 'Une rivalité naît ; elle pourrait finir en duel.',
        effects: [
          { createRelationship: { type: 'rival', with: 'target' } },
          { addStress: -10 },
          { triggerEvent: { id: 'rivalry_duel_challenge', days: 120 } },
        ],
        tags: ['vengeful'],
        ai: { base: 8, traits: { wrathful: 20, arrogant: 15 }, personality: { aggression: 15 } },
      },
      {
        id: 'expel',
        label: '« Qu’on {target.le} jette dehors. »',
        cost: { authority: 10 },
        effects: [{ banish: true, who: 'target' }, { addPrestige: 15 }],
        ai: { base: 8, traits: { arrogant: 10, wrathful: 10 }, personality: { aggression: 10 } },
      },
    ],
  },
  {
    id: 'rivalry_escalation',
    category: 'rivalry',
    title: 'Une guerre de mots',
    text:
      'La rumeur a fait le tour des cours avant de revenir jusqu’à vous : {target.fullname} vous traite ouvertement de lâche et d’usurpateur, et paie des jongleurs pour chanter vos défaites sur les places de marché. Ce n’est plus une querelle d’orgueil entre gens de bonne naissance. C’est une guerre de mots, et les guerres de mots finissent rarement par des mots.',
    illustration: 'market',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 1825,
    conditions: { isAdult: true },
    target: { pool: 'rival', where: { not: { hasRelation: 'nemesis', with: 'target' } } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'nemesis',
        label: '« Dès ce jour, {target.name} est mon ennemi mortel. »',
        tooltip: 'La rivalité devient haine ; un duel se profile.',
        effects: [
          { createRelationship: { type: 'nemesis', with: 'target' } },
          { addStress: -15 },
          { triggerEvent: { id: 'rivalry_duel_challenge', days: 60 } },
        ],
        tags: ['vengeful'],
        ai: { base: 8, traits: { wrathful: 20, arrogant: 10 }, personality: { aggression: 15 } },
      },
      {
        id: 'jongleurs',
        label: '« Payez des jongleurs plus habiles que les siens. »',
        cost: { gold: 40 },
        effects: [
          { addPrestige: 30 },
          { addOpinion: { towards: 'root', value: -10, reason: 'opinion.reason.rivalry_mocked' }, who: 'target' },
        ],
        ai: { base: 12, traits: { sociable: 10, deceitful: 5 }, personality: { sociability: 10, greed: -10 } },
      },
      {
        id: 'ignore',
        label: '« Les chiens aboient. »',
        effects: [{ addStress: 15 }, { addPrestige: -15 }],
        tags: ['forgiving', 'humble'],
        ai: { base: 10, traits: { patient: 15, humble: 10, content: 5 }, personality: { caution: 10 } },
      },
    ],
  },
  {
    id: 'rivalry_duel_challenge',
    category: 'rivalry',
    title: 'Le gant sur les dalles',
    text:
      'Le gant de {target.fullname} gît sur les dalles de votre grande salle, là où son héraut l’a jeté. Le défi est dit dans les formes anciennes : au premier sang, ou jusqu’à ce que l’un des deux demande grâce, dans la lice de {province.name}, au lever du jour. Les témoins sont déjà désignés. Refuser, c’est porter le mot de lâche accolé à votre nom ; accepter, c’est remettre votre vie au hasard d’une lame.',
    illustration: 'tournament',
    trigger: 'chain',
    conditions: { isAdult: true },
    target: { pool: 'rival' },
    portraits: ['root', 'target'],
    major: true,
    choices: [
      {
        id: 'fight',
        label: 'Ramasser le gant soi-même.',
        tooltip: 'Votre science des armes pèsera dans l’issue.',
        effects: [
          {
            if: { skill: 'martial', value: { min: 12 } },
            then: [
              {
                chance: 70,
                then: [
                  { addPrestige: 120 },
                  { addStress: -20 },
                  { woundCharacter: true, who: 'target' },
                  { chance: 15, then: [{ killCharacter: { cause: 'duel' }, who: 'target' }] },
                ],
                else: [
                  { addPrestige: -60 },
                  { woundCharacter: true },
                  { chance: 8, then: [{ killCharacter: { cause: 'duel' } }] },
                ],
              },
            ],
            else: [
              {
                chance: 40,
                then: [
                  { addPrestige: 120 },
                  { addStress: -20 },
                  { woundCharacter: true, who: 'target' },
                  { chance: 15, then: [{ killCharacter: { cause: 'duel' }, who: 'target' }] },
                ],
                else: [
                  { addPrestige: -60 },
                  { woundCharacter: true },
                  { chance: 8, then: [{ killCharacter: { cause: 'duel' } }] },
                ],
              },
            ],
          },
        ],
        tags: ['brave'],
        hiddenEffects: true,
        ai: { base: 10, traits: { brave: 20, wrathful: 10, aggressive_attacker: 5 }, personality: { aggression: 15, caution: -10 } },
      },
      {
        id: 'champion',
        label: 'Désigner un champion.',
        cost: { gold: 60 },
        effects: [
          {
            chance: 55,
            then: [{ addPrestige: 40 }],
            else: [{ addPrestige: -40 }],
          },
        ],
        hiddenEffects: true,
        ai: { base: 12, traits: { patient: 5, craven: 10 }, personality: { caution: 15 } },
      },
      {
        id: 'refuse',
        label: '« Je ne croise pas le fer avec des braillards. »',
        effects: [{ addPrestige: -80 }, { addStress: 10 }],
        tags: ['craven'],
        ai: { base: 6, traits: { craven: 25, content: 5 }, personality: { caution: 20 } },
      },
      {
        id: 'reconcile',
        label: '« Proposez-lui plutôt de boire à la même coupe. »',
        conditions: { skill: 'diplomacy', value: { min: 12 } },
        effects: [
          {
            chance: 50,
            then: [
              { breakRelationship: { type: 'rival', with: 'target' } },
              { breakRelationship: { type: 'nemesis', with: 'target' } },
              { addMutualOpinion: { with: 'target', value: 20, reason: 'opinion.reason.rivalry_reconciled' } },
            ],
            else: [{ addPrestige: -40 }],
          },
        ],
        tags: ['forgiving'],
        hiddenEffects: true,
        ai: { base: 8, traits: { compassionate: 10, sociable: 10 }, personality: { compassion: 10, sociability: 10 } },
      },
    ],
  },
  {
    id: 'rivalry_reconciliation',
    category: 'rivalry',
    title: 'La cire blanche',
    text:
      'Un messager de {target.fullname} vous attend dans la cour, sans escorte et sans armes. Il porte une lettre scellée de cire blanche, la couleur des trêves : {target.name} y reconnaît des torts, évoque les années perdues en querelles stériles, et propose de vous rencontrer à la chapelle de {province.name}, devant témoins, pour échanger le baiser de paix. Rien, dans le ton, ne sonne faux. Et c’est précisément ce qui vous trouble.',
    illustration: 'chapel',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    target: {
      pool: 'rival',
      where: {
        all: [
          { not: { hasRelation: 'nemesis', with: 'target' } },
          { opinion: { min: -60 }, of: 'target', towards: 'root' },
        ],
      },
    },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'accept',
        label: 'Se rendre à la chapelle, le cœur ouvert.',
        effects: [
          { breakRelationship: { type: 'rival', with: 'target' } },
          { addMutualOpinion: { with: 'target', value: 25, reason: 'opinion.reason.rivalry_reconciled' } },
          { addStress: -10 },
        ],
        tags: ['forgiving'],
        ai: { base: 12, traits: { compassionate: 15, content: 10, humble: 10 }, personality: { compassion: 10 } },
      },
      {
        id: 'feign',
        label: '« Échangez le baiser, gardez le poignard. »',
        tooltip: 'Une paix de façade pour mieux fouiller ses secrets.',
        effects: [
          { breakRelationship: { type: 'rival', with: 'target' } },
          { addOpinion: { towards: 'root', value: 20, reason: 'opinion.reason.rivalry_reconciled' }, who: 'target' },
          { discoverSecret: { of: 'target' } },
          { createHook: { on: 'target', years: 5 } },
        ],
        tags: ['deceitful'],
        ai: { base: 8, traits: { deceitful: 20 }, personality: { intrigue: 15, honor: -10 } },
      },
      {
        id: 'refuse',
        label: '« Trop tard pour les regrets. »',
        effects: [
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.rivalry_spurned' }, who: 'target' },
          { addPrestige: 15 },
        ],
        tags: ['vengeful'],
        ai: { base: 10, traits: { wrathful: 15, arrogant: 10 }, personality: { aggression: 10 } },
      },
    ],
  },
  {
    id: 'rivalry_rival_misfortune',
    category: 'rivalry',
    title: 'Les greniers en cendres',
    text:
      'L’incendie a ravagé les greniers de {target.fullname} en une seule nuit de sécheresse. Ses paysans mangeront de l’écorce cet hiver, ses soldats déserteront au printemps, et ses créanciers se pressent déjà à sa porte. {target.name}, si fier{target.e} à la dernière assemblée, a écrit à tous ses voisins pour quémander du blé. À vous aussi, en des termes qui ont dû lui coûter plus cher que la famine elle-même.',
    illustration: 'fields',
    trigger: 'pulse',
    weight: 7,
    cooldownDays: 3650,
    target: { pool: 'rival' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'grain',
        label: 'Envoyer des charrettes de blé, sans condition.',
        cost: { gold: 50 },
        effects: [
          { addMutualOpinion: { with: 'target', value: 20, reason: 'opinion.reason.rivalry_generosity' } },
          { addPrestige: 25 },
        ],
        tags: ['compassionate', 'generous'],
        ai: { base: 10, traits: { compassionate: 20, generous: 15 }, personality: { compassion: 15 } },
      },
      {
        id: 'gloat',
        label: 'Lui répondre par une lettre de condoléances… ironique.',
        effects: [
          { addStress: -10 },
          { addPrestige: 10 },
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.rivalry_mocked' }, who: 'target' },
        ],
        tags: ['cruel'],
        ai: { base: 10, traits: { cruel: 15, arrogant: 15, wrathful: 5 }, personality: { compassion: -10 } },
      },
      {
        id: 'debts',
        label: 'Racheter discrètement ses créances.',
        cost: { gold: 60 },
        effects: [
          { createSecret: { type: 'debt', knownBy: ['root'] }, who: 'target' },
          { createHook: { on: 'target', strong: true, years: 10 } },
        ],
        tags: ['greedy', 'deceitful'],
        ai: { base: 8, traits: { greedy: 15, deceitful: 10, ambitious: 5 }, personality: { intrigue: 15 } },
      },
    ],
  },

  // ===========================================================================
  // Diplomatie
  // ===========================================================================
  {
    id: 'diplomacy_secret_envoy',
    category: 'diplomacy',
    title: 'Le pèlerin à la bague',
    text:
      'Un homme en habit de pèlerin s’est présenté à la poterne à la nuit tombée, porteur d’une bague que vous reconnaissez : celle de {target.fullname}. {target.name} voudrait s’entendre avec vous, loin des cours et des chapelains. Une bourse pour vous, sur-le-champ ; en échange, votre neutralité le jour où {target.il} prendra les armes, et votre silence d’ici là. L’envoyé ne demande aucune réponse écrite. Un signe de tête lui suffira.',
    illustration: 'night_alley',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    target: { pool: 'neighbor_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'accept',
        label: '« Un signe de tête ne coûte rien. »',
        effects: [
          { addGold: 80 },
          { createSecret: { type: 'political_crime', knownBy: ['target'] } },
          { addOpinion: { towards: 'root', value: 20, reason: 'opinion.reason.diplomacy_secret_pact' }, who: 'target' },
        ],
        tags: ['deceitful', 'greedy'],
        ai: { base: 10, traits: { greedy: 20, cynical: 10 }, personality: { greed: 20, honor: -10 } },
      },
      {
        id: 'refuse',
        label: '« Dites à votre maître que je n’ai pas de prix. »',
        effects: [
          { addPrestige: 20 },
          { addOpinion: { towards: 'root', value: -15, reason: 'opinion.reason.diplomacy_rebuffed' }, who: 'target' },
        ],
        tags: ['honest'],
        ai: { base: 12, traits: { honest: 15, loyal: 10, just: 5 }, personality: { honor: 15 } },
      },
      {
        id: 'double_game',
        label: '« Prenez la bourse… et gardez la bague comme preuve. »',
        conditions: { skill: 'intrigue', value: { min: 10 } },
        effects: [
          { addGold: 80 },
          { createHook: { on: 'target', years: 5 } },
          {
            chance: 30,
            then: [
              { addPrestige: -30 },
              { addOpinion: { towards: 'root', value: -40, reason: 'opinion.reason.diplomacy_double_dealing' }, who: 'target' },
            ],
          },
        ],
        tags: ['deceitful'],
        hiddenEffects: true,
        ai: { base: 10, traits: { deceitful: 20 }, personality: { intrigue: 20 } },
      },
    ],
  },
  {
    id: 'diplomacy_marriage_offer',
    category: 'diplomacy',
    title: 'L’arbre peint d’argent',
    text:
      'L’ambassade de {target.fullname} est arrivée avec des chevaux caparaçonnés et un coffret de noyer. Il ne contient ni or ni joyaux, mais un arbre généalogique peint à la feuille d’argent, où la maison {target.house} et la vôtre se rejoignent en une seule branche. On vous propose une promesse d’union entre vos lignées, et avec elle une amitié que l’on jure durable. Les frontières de {target.realm} sont longues ; il serait bon de ne plus avoir à les surveiller.',
    illustration: 'throne_room',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 3650,
    target: { pool: 'neighbor_ruler', where: { not: { hasRelation: 'rival', with: 'target' } } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'accept',
        label: '« Que nos maisons ne fassent plus qu’une. »',
        effects: [
          { addMutualOpinion: { with: 'target', value: 30, reason: 'opinion.reason.diplomacy_marriage_pledge', months: 120 } },
          { addPrestige: 20 },
        ],
        ai: { base: 15, traits: { sociable: 10, content: 10 }, personality: { sociability: 10, caution: 10 } },
      },
      {
        id: 'dowry',
        label: '« Volontiers — si la dot est à la hauteur de mon sang. »',
        effects: [
          {
            chance: 55,
            then: [
              { addGold: 80 },
              { addGold: -80, who: 'target' },
              { addMutualOpinion: { with: 'target', value: 15, reason: 'opinion.reason.diplomacy_marriage_pledge', months: 120 } },
            ],
            else: [{ addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.diplomacy_greedy_demand' }, who: 'target' }],
          },
        ],
        tags: ['greedy'],
        hiddenEffects: true,
        ai: { base: 10, traits: { greedy: 20, arrogant: 5 }, personality: { greed: 20 } },
      },
      {
        id: 'decline',
        label: '« Mon sang n’est pas une monnaie d’échange. »',
        effects: [
          { addPrestige: 15 },
          { addOpinion: { towards: 'root', value: -15, reason: 'opinion.reason.diplomacy_rebuffed' }, who: 'target' },
        ],
        ai: { base: 8, traits: { arrogant: 15, reclusive: 5 }, personality: { sociability: -10 } },
      },
    ],
  },
  {
    id: 'diplomacy_envoy_insult',
    category: 'diplomacy',
    title: 'Le chapeau sur la tête',
    text:
      'L’envoyé de {target.fullname} n’a pas mis genou à terre. Il a lu sa lettre debout, le chapeau sur la tête, d’une voix de maître d’école : {target.name}, dit-il, « s’étonne qu’on appelle encore royaume une terre si mal tenue » et exige le libre passage de ses marchands sur vos routes, sans péage. Puis il a replié le parchemin et attendu, avec l’assurance d’un homme qui sait sa personne inviolable.',
    illustration: 'throne_room',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 2555,
    target: { pool: 'neighbor_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'expel',
        label: '« Reconduisez-le à la frontière. À pied. »',
        effects: [
          { addPrestige: 30 },
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.diplomacy_envoy_expelled' }, who: 'target' },
        ],
        ai: { base: 12, traits: { arrogant: 15, wrathful: 10 }, personality: { aggression: 10 } },
      },
      {
        id: 'concede',
        label: '« Accordez le passage. Le commerce apaise les humeurs. »',
        effects: [
          { addPrestige: -30 },
          { addOpinion: { towards: 'root', value: 20, reason: 'opinion.reason.diplomacy_concession' }, who: 'target' },
          { addModifier: { id: 'diplomacy_open_roads', months: 36, values: { monthly_income_mult: -0.05 } } },
        ],
        tags: ['humble'],
        ai: { base: 8, traits: { humble: 15, craven: 10, content: 5 }, personality: { caution: 15 } },
      },
      {
        id: 'humiliate',
        label: '« Qu’il reparte sans chapeau, sans cheval et sans barbe. »',
        effects: [
          { addPrestige: 50 },
          { addOpinion: { towards: 'root', value: -40, reason: 'opinion.reason.diplomacy_envoy_humiliated' }, who: 'target' },
          { createRelationship: { type: 'rival', with: 'target' } },
        ],
        tags: ['cruel', 'vengeful'],
        ai: { base: 4, traits: { cruel: 15, wrathful: 15, arrogant: 10 }, personality: { aggression: 15 } },
      },
      {
        id: 'wit',
        label: '« Rendez-lui une réponse plus fine que sa lettre. »',
        conditions: { skill: 'diplomacy', value: { min: 12 } },
        effects: [
          { addPrestige: 40 },
          { addOpinion: { towards: 'root', value: -5, reason: 'opinion.reason.diplomacy_envoy_expelled' }, who: 'target' },
        ],
        ai: { base: 15, traits: { sociable: 10, patient: 5 }, personality: { sociability: 10 } },
      },
    ],
  },
  {
    id: 'diplomacy_hostage_exchange',
    category: 'diplomacy',
    title: 'Pupilles et otages',
    text:
      'Pour garantir la paix fragile qui vous lie à {target.fullname}, ses conseillers proposent un usage ancien : l’échange de pupilles. Un enfant de votre sang grandirait à sa cour, un enfant du sien à la vôtre, chacun à la fois otage et invité. La coutume a épargné bien des guerres à la Caldria. Elle a aussi rempli bien des tombes, les années où l’un des deux parents oubliait sa parole.',
    illustration: 'castle_walls',
    trigger: 'pulse',
    weight: 6,
    cooldownDays: 3650,
    conditions: { hasChildren: true },
    target: { pool: 'neighbor_ruler', where: { hasChildren: true, who: 'target' } },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'accept',
        label: '« Que les enfants voyagent. La paix vaut ce prix. »',
        effects: [
          { addMutualOpinion: { with: 'target', value: 30, reason: 'opinion.reason.diplomacy_hostages', months: 120 } },
          { addStress: 10 },
        ],
        ai: { base: 12, traits: { patient: 10, content: 10 }, personality: { caution: 10, compassion: -5 } },
      },
      {
        id: 'one_way',
        label: '« Qu’on m’envoie le sien ; le mien reste ici. »',
        effects: [
          {
            chance: 35,
            then: [{ addPrestige: 40 }, { createHook: { on: 'target', years: 10 } }],
            else: [{ addOpinion: { towards: 'root', value: -25, reason: 'opinion.reason.diplomacy_rebuffed' }, who: 'target' }],
          },
        ],
        tags: ['ambitious'],
        hiddenEffects: true,
        ai: { base: 8, traits: { arrogant: 15, ambitious: 10 }, personality: { ambition: 15 } },
      },
      {
        id: 'refuse',
        label: '« Mes enfants ne sont pas des gages. »',
        effects: [
          { addOpinion: { towards: 'root', value: -10, reason: 'opinion.reason.diplomacy_rebuffed' }, who: 'target' },
          { addStress: -5 },
        ],
        tags: ['compassionate'],
        ai: { base: 12, traits: { compassionate: 15, paranoid: 10 }, personality: { compassion: 15 } },
      },
    ],
  },
  {
    id: 'diplomacy_peace_envoys',
    category: 'diplomacy',
    title: 'Le drapeau blanc',
    text:
      'Sous un drapeau blanc déchiré par le vent, trois cavaliers de {target.fullname} ont franchi vos avant-postes. Ils ne portent pas de traité, seulement des paroles : {target.name} serait fatigué{target.e} de cette guerre et discuterait volontiers d’une trêve, si vous montriez quelque bonne volonté. Vos capitaines grondent qu’on ne parlemente pas avec ceux qu’on s’apprête à vaincre ; votre trésorier, lui, compte les jours de solde qui restent.',
    illustration: 'war_camp',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 730,
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'welcome',
        label: '« Qu’on leur serve à boire. Écoutons-les. »',
        effects: [
          { addMutualOpinion: { with: 'target', value: 20, reason: 'opinion.reason.diplomacy_parley' } },
          { addStress: -10 },
        ],
        tags: ['compassionate'],
        ai: { base: 12, traits: { compassionate: 10, content: 10, sociable: 5 }, personality: { caution: 10, compassion: 10 } },
      },
      {
        id: 'spy',
        label: '« Faites-les parler… et comptez leurs chevaux. »',
        conditions: { skill: 'intrigue', value: { min: 8 } },
        effects: [
          { addModifier: { id: 'diplomacy_parley_intel', months: 6, values: { commander_advantage: 2 } } },
          { addOpinion: { towards: 'root', value: -15, reason: 'opinion.reason.diplomacy_parley_betrayed' }, who: 'target' },
        ],
        tags: ['deceitful'],
        ai: { base: 10, traits: { deceitful: 15, strategist: 10 }, personality: { intrigue: 15 } },
      },
      {
        id: 'refuse',
        label: '« Rendez-leur leur drapeau. Nous parlerons après la victoire. »',
        effects: [
          { addPrestige: 30 },
          { addStress: 10 },
          { addOpinion: { towards: 'root', value: -10, reason: 'opinion.reason.diplomacy_rebuffed' }, who: 'target' },
        ],
        tags: ['brave'],
        ai: { base: 10, traits: { brave: 10, arrogant: 10, wrathful: 10 }, personality: { aggression: 15 } },
      },
    ],
  },

  // ===========================================================================
  // Guerre — réactions
  // ===========================================================================
  {
    id: 'war_rally_realm',
    category: 'war',
    title: 'L’heure des bannières',
    text:
      'Le héraut de {target.fullname} est reparti, et avec lui les derniers doutes : c’est la guerre. Dans votre grande salle, vassaux et capitaines se pressent déjà, les uns pâles, les autres avides. Ce que vous direz dans l’heure qui vient courra jusqu’aux villages les plus reculés de {root.realm}. Un royaume se bat rarement mieux que ne parle celui qui le mène.',
    illustration: 'throne_room',
    trigger: 'on:war_declared',
    weight: 20,
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'speech',
        label: '« Parlez-leur de leurs pères et de leurs terres. »',
        effects: [
          { addVassalOpinion: 10, reason: 'opinion.reason.war_rallied' },
          { addPrestige: 30 },
          { changeLevies: 60 },
        ],
        ai: { base: 15, traits: { sociable: 10, brave: 10 }, personality: { sociability: 10 } },
      },
      {
        id: 'treasury',
        label: '« Ouvrez le trésor : double solde pour qui marche. »',
        cost: { gold: 80 },
        effects: [{ changeLevies: 150 }, { addVassalOpinion: 5, reason: 'opinion.reason.war_rallied' }],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 15, strategist: 5 }, personality: { greed: -15 } },
      },
      {
        id: 'walls',
        label: '« Fermez les portes et doublez les murs. »',
        effects: [
          { addModifier: { id: 'war_defensive_stance', months: 12, values: { levy_size_mult: 0.1 } } },
          { addPrestige: -15 },
        ],
        ai: { base: 10, traits: { unyielding_defender: 20, craven: 10, patient: 5 }, personality: { caution: 15 } },
      },
      {
        id: 'vow',
        label: '« Je ne dormirai plus sous un toit avant la victoire. »',
        effects: [
          { addPrestige: 60 },
          { addStress: 20 },
          { addVassalOpinion: 5, reason: 'opinion.reason.war_rallied' },
        ],
        tags: ['brave'],
        ai: { base: 8, traits: { brave: 15, zealous: 10, arrogant: 5 }, personality: { zeal: 10, aggression: 10 } },
      },
    ],
  },
  {
    id: 'war_battle_won_celebrate',
    category: 'war',
    title: 'La bannière debout',
    text:
      'Le soir tombe sur le champ de bataille de {province.name}, et c’est votre bannière qui flotte encore. Les hommes de {target.fullname} fuient en désordre vers les bois, abandonnant bagages et blessés. Vos capitaines, ivres de sang et de soulagement, réclament la poursuite ; vos prêtres réclament les morts ; vos soldats réclament à boire. Il vous appartient de dire ce que sera cette victoire.',
    illustration: 'battlefield',
    trigger: 'on:battle_won',
    weight: 12,
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'pursue',
        label: '« Aux chevaux ! Pas de répit jusqu’à la nuit. »',
        effects: [
          {
            chance: 60,
            then: [{ addPrestige: 80 }, { chance: 25, then: [{ addTrait: 'war_hero' }] }],
            else: [{ woundCharacter: true }, { addPrestige: 20 }],
          },
        ],
        tags: ['brave'],
        hiddenEffects: true,
        ai: { base: 10, traits: { aggressive_attacker: 20, brave: 15, wrathful: 5 }, personality: { aggression: 15 } },
      },
      {
        id: 'feast',
        label: '« Mettez les tonneaux en perce. »',
        cost: { gold: 30 },
        effects: [{ addPrestige: 40 }, { addVassalOpinion: 5, reason: 'opinion.reason.war_victory_feast' }],
        tags: ['social'],
        ai: { base: 12, traits: { sociable: 15, generous: 5 }, personality: { sociability: 10 } },
      },
      {
        id: 'honor_dead',
        label: '« D’abord les morts. Les nôtres, et les leurs. »',
        effects: [
          { addPrestige: 20 },
          { addFervor: 15 },
          { addOpinion: { towards: 'root', value: 10, reason: 'opinion.reason.war_honored_dead' }, who: 'target' },
        ],
        tags: ['compassionate', 'pious'],
        ai: { base: 10, traits: { compassionate: 15, zealous: 10 }, personality: { compassion: 10, zeal: 10 } },
      },
    ],
  },
  {
    id: 'war_captured_knight',
    category: 'war',
    title: 'Le chevalier à l’épaule brisée',
    text:
      'Parmi les prisonniers qu’on pousse devant votre tente, un chevalier au service de {target.fullname} se tient plus droit que les autres, malgré une épaule brisée. Il a tué trois de vos hommes avant qu’on le désarçonne. Il ne supplie pas : il demande qu’on lui rende son épée pour mourir en combattant, ou sa liberté contre rançon, comme le veut la coutume des gens d’armes.',
    illustration: 'war_camp',
    trigger: 'on:battle_won',
    weight: 8,
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root'],
    choices: [
      {
        id: 'ransom',
        label: '« La coutume sera respectée : fixez sa rançon. »',
        effects: [{ addGold: 60 }, { addGold: -60, who: 'target' }, { addPrestige: 10 }],
        ai: { base: 14, traits: { greedy: 10, just: 10 }, personality: { greed: 10, honor: 5 } },
      },
      {
        id: 'service',
        label: '« Qu’il me serve, et il gardera son épée. »',
        effects: [
          { spawnCourtier: { traits: ['brave'], skill: 'martial' }, as: 'other' },
          { addOpinion: { towards: 'root', value: 20, reason: 'opinion.reason.war_spared_knight' }, who: 'other' },
          { addPrestige: 15 },
        ],
        tags: ['forgiving'],
        ai: { base: 10, traits: { compassionate: 10, strategist: 10 }, personality: { honor: 10 } },
      },
      {
        id: 'tower',
        label: '« Vivant, il vaut davantage. Qu’on l’enferme dans la tour. »',
        effects: [
          { spawnCourtier: { traits: ['brave'], skill: 'martial' }, as: 'other' },
          { imprison: { by: 'root' }, who: 'other' },
          { addOpinion: { towards: 'root', value: -10, reason: 'opinion.reason.war_knight_imprisoned' }, who: 'target' },
        ],
        ai: { base: 8, traits: { paranoid: 10, patient: 10 }, personality: { caution: 10 } },
      },
      {
        id: 'execute',
        label: '« Une épée de moins contre nous. »',
        effects: [
          { addPrestige: 15 },
          { addOpinion: { towards: 'root', value: -25, reason: 'opinion.reason.war_executed_knight' }, who: 'target' },
        ],
        tags: ['cruel'],
        ai: { base: 3, traits: { cruel: 20, wrathful: 10 }, personality: { compassion: -15 } },
      },
    ],
  },
  {
    id: 'war_battle_lost_blame',
    category: 'war',
    title: 'La boue de {province.name}',
    text:
      'La déroute de {province.name} vous coûte des centaines d’hommes, et plus encore de fierté. Dans la boue du camp, les murmures cherchent déjà un coupable. Beaucoup désignent {other.fullname}, qui tenait l’aile gauche et a cédé le premier devant les lances de {target.fullname}. D’autres, plus bas, rappellent que c’est vous qui avez choisi de livrer bataille ici, contre l’avis de tous.',
    illustration: 'war_camp',
    trigger: 'on:battle_lost',
    weight: 12,
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    other: { pool: 'courtier', where: { skill: 'martial', value: { min: 5 }, who: 'other' } },
    portraits: ['root', 'other'],
    choices: [
      {
        id: 'blame',
        label: '« Que {other.name} réponde de sa lâcheté. »',
        effects: [
          { addOpinion: { towards: 'root', value: -30, reason: 'opinion.reason.war_blamed' }, who: 'other' },
          { addStress: -10 },
          { addPrestige: 10 },
        ],
        tags: ['deceitful'],
        ai: { base: 10, traits: { arrogant: 15, wrathful: 10, deceitful: 5 }, personality: { honor: -10 } },
      },
      {
        id: 'own',
        label: '« C’est moi qui ai perdu cette bataille. »',
        effects: [
          { addPrestige: -30 },
          { addStress: 15 },
          { addVassalOpinion: 5, reason: 'opinion.reason.war_took_blame' },
        ],
        tags: ['honest', 'humble'],
        ai: { base: 10, traits: { honest: 15, humble: 15, just: 5 }, personality: { honor: 15 } },
      },
      {
        id: 'regroup',
        label: '« Les regrets plus tard. Ralliez les fuyards. »',
        effects: [
          { addModifier: { id: 'war_grim_resolve', months: 6, values: { commander_advantage: 1 } } },
          { addStress: 10 },
        ],
        tags: ['brave'],
        ai: { base: 12, traits: { brave: 10, strategist: 15, diligent: 5 }, personality: { aggression: 10 } },
      },
    ],
  },
  {
    id: 'war_won',
    category: 'war',
    title: 'Les cloches de la paix',
    text:
      'Les cloches de {root.realm} sonnent depuis l’aube : {target.fullname} a signé, et la guerre est finie. Sur la route du retour, vos soldats chantent des couplets que les nourrices apprendront bientôt aux enfants. Le vaincu, lui, attend de savoir quel visage vous montrerez dans la victoire, car la manière de gagner une guerre décide souvent de la suivante.',
    illustration: 'coronation',
    trigger: 'on:war_won',
    weight: 15,
    target: { pool: 'enemy_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'triumph',
        label: '« Un triomphe, par toutes les rues de la capitale. »',
        cost: { gold: 60 },
        effects: [{ addPrestige: 100 }, { addVassalOpinion: 10, reason: 'opinion.reason.war_triumph' }],
        tags: ['ambitious'],
        ai: { base: 12, traits: { arrogant: 15, ambitious: 10, sociable: 5 }, personality: { ambition: 10 } },
      },
      {
        id: 'magnanimous',
        label: '« Rendez ses bannières au vaincu. »',
        effects: [
          { addPrestige: 40 },
          { addOpinion: { towards: 'root', value: 25, reason: 'opinion.reason.war_magnanimous' }, who: 'target' },
        ],
        tags: ['compassionate', 'forgiving'],
        ai: { base: 10, traits: { compassionate: 15, just: 10, humble: 5 }, personality: { honor: 10, compassion: 10 } },
      },
      {
        id: 'humiliate',
        label: '« Qu’on traîne ses couleurs dans la boue. »',
        effects: [
          { addPrestige: 70 },
          { addOpinion: { towards: 'root', value: -40, reason: 'opinion.reason.war_humiliated' }, who: 'target' },
          { createRelationship: { type: 'rival', with: 'target' } },
        ],
        tags: ['cruel', 'vengeful'],
        ai: { base: 4, traits: { cruel: 15, wrathful: 15, arrogant: 10 }, personality: { aggression: 10 } },
      },
      {
        id: 'reward',
        label: '« Récompensez ceux qui ont saigné pour moi. »',
        cost: { gold: 80 },
        effects: [{ addVassalOpinion: 20, reason: 'opinion.reason.war_rewarded' }, { addPrestige: 20 }],
        tags: ['generous'],
        ai: { base: 10, traits: { generous: 20, just: 5 }, personality: { greed: -15, loyalty: 10 } },
      },
    ],
  },
  {
    id: 'war_lost',
    category: 'war',
    title: 'Le sceau du vaincu',
    text:
      'C’est fini. Le traité porte votre sceau à côté de celui de {target.fullname}, et chaque ligne vous a coûté davantage que la précédente. Dans les couloirs, on parle à voix basse ; vos vassaux vous observent comme on observe le ciel avant l’orage. Une défaite n’est jamais seulement affaire de terres perdues : c’est une blessure que chacun soupèse, en se demandant jusqu’où elle ira.',
    illustration: 'castle_walls',
    trigger: 'on:war_lost',
    weight: 15,
    target: { pool: 'enemy_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'dignity',
        label: '« Je porterai cette défaite la tête haute. »',
        effects: [
          { addStress: 20 },
          { addPrestige: 20 },
          { addVassalOpinion: 5, reason: 'opinion.reason.war_dignity' },
        ],
        tags: ['humble'],
        ai: { base: 12, traits: { humble: 10, just: 10, patient: 10 }, personality: { honor: 10 } },
      },
      {
        id: 'blame_vassals',
        label: '« Si mes vassaux avaient répondu à l’appel… »',
        effects: [{ addVassalOpinion: -15, reason: 'opinion.reason.war_blamed_vassals' }, { addStress: -15 }],
        tags: ['deceitful'],
        ai: { base: 8, traits: { arrogant: 15, arbitrary: 10 }, personality: { honor: -10 } },
      },
      {
        id: 'vow',
        label: '« Je n’oublierai pas. Ni {target.name}, ni ce jour. »',
        effects: [
          { createRelationship: { type: 'rival', with: 'target' } },
          { addStress: -10 },
          { addPrestige: 10 },
        ],
        tags: ['vengeful'],
        ai: { base: 10, traits: { wrathful: 20, ambitious: 10 }, personality: { aggression: 10 } },
      },
      {
        id: 'withdraw',
        label: '« Laissez-moi seul. »',
        effects: [
          { addStress: -20 },
          { addPrestige: -30 },
          { chance: 25, then: [{ addTrait: 'depressed' }] },
        ],
        tags: ['reclusive'],
        hiddenEffects: true,
        ai: { base: 6, traits: { reclusive: 20, depressed: 10 }, personality: { sociability: -10 } },
      },
    ],
  },

  // ===========================================================================
  // Guerre — la vie des camps
  // ===========================================================================
  {
    id: 'war_deserter_captain',
    category: 'war',
    title: 'La route du sud',
    text:
      'On vous amène à l’aube un capitaine de vos levées, rattrapé sur la route du sud avec quarante de ses hommes. Il ne se cache derrière aucune excuse : la solde n’arrive plus, la fièvre rôde, et il ne voulait que ramener ses gars chez eux pour les moissons. Autour du feu, toute l’armée attend. Chaque soldat sait que la sentence qui tombera ce matin le concernera, lui aussi, un jour.',
    illustration: 'war_camp',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 1095,
    conditions: { all: [{ atWar: true }, { isAdult: true }] },
    portraits: ['root'],
    choices: [
      {
        id: 'hang',
        label: '« La corde. Pour lui seul. »',
        effects: [
          { addModifier: { id: 'war_iron_discipline', months: 12, values: { commander_advantage: 1 } } },
          { addVassalOpinion: -5, reason: 'opinion.reason.war_harsh_discipline' },
        ],
        tags: ['cruel'],
        ai: { base: 10, traits: { cruel: 15, just: 5, wrathful: 10 }, personality: { compassion: -10 } },
      },
      {
        id: 'pay',
        label: '« Qu’on paie la solde due, et qu’ils reprennent leur rang. »',
        cost: { gold: 40 },
        effects: [{ changeLevies: 40 }, { addPrestige: 10 }],
        tags: ['generous'],
        ai: { base: 12, traits: { generous: 15, just: 10 }, personality: { greed: -10 } },
      },
      {
        id: 'release',
        label: '« Laissez-les rentrer pour la moisson. »',
        effects: [{ changeLevies: -60 }, { addVassalOpinion: 5, reason: 'opinion.reason.war_mercy_levies' }],
        tags: ['compassionate'],
        ai: { base: 8, traits: { compassionate: 20, content: 5 }, personality: { compassion: 15 } },
      },
    ],
  },
  {
    id: 'war_plunder_temptation',
    category: 'war',
    title: 'Un bourg oublié par la guerre',
    text:
      'Vos éclaireurs ont trouvé, à une journée de marche, un bourg de {target.realm} que la guerre semble avoir oublié : des greniers pleins, une abbaye aux vitraux dorés, des marchands qui n’ont pas eu le temps de fuir. Vos hommes n’ont pas vu de solde depuis deux mois. Ils ne demandent rien, mais ils regardent le clocher avec l’insistance des loups devant une bergerie.',
    illustration: 'village',
    trigger: 'pulse',
    weight: 10,
    cooldownDays: 1095,
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root', 'target'],
    choices: [
      {
        id: 'plunder',
        label: '« Il est à vous jusqu’au coucher du soleil. »',
        effects: [
          { addGold: 120 },
          { addFervor: -10 },
          { addOpinion: { towards: 'root', value: -30, reason: 'opinion.reason.war_plundered' }, who: 'target' },
        ],
        tags: ['cruel', 'greedy'],
        ai: { base: 8, traits: { greedy: 20, cruel: 15 }, personality: { greed: 20, compassion: -10 } },
      },
      {
        id: 'ransom',
        label: '« Qu’ils paient rançon, et qu’on n’y touche pas. »',
        effects: [
          { addGold: 50 },
          { addOpinion: { towards: 'root', value: -10, reason: 'opinion.reason.war_plundered' }, who: 'target' },
        ],
        ai: { base: 14, traits: { just: 5, patient: 5 }, personality: { greed: 5 } },
      },
      {
        id: 'spare',
        label: '« Pas une pierre ne sera prise. »',
        effects: [
          { addPrestige: 30 },
          { addFervor: 10 },
          { addModifier: { id: 'war_restless_troops', months: 3, values: { commander_advantage: -1 } } },
        ],
        tags: ['compassionate', 'pious'],
        ai: { base: 10, traits: { compassionate: 15, zealous: 10, just: 5 }, personality: { compassion: 10, zeal: 5 } },
      },
    ],
  },
  {
    id: 'war_mercenary_offer',
    category: 'war',
    title: 'La Compagnie du Chardon',
    text:
      'Le capitaine de la Compagnie du Chardon a dressé sa tente à portée de flèche de la vôtre, par courtoisie ou par défi. Deux cents piquiers aguerris, une centaine de cavaliers légers : des hommes qui ont vendu leur fer sur toutes les frontières de la Caldria. Son prix est élevé, sa parole réputée solide — tant que l’or arrive. On murmure qu’un émissaire de votre ennemi lui a déjà rendu visite.',
    illustration: 'war_camp',
    trigger: 'pulse',
    weight: 9,
    cooldownDays: 1095,
    conditions: { atWar: true },
    portraits: ['root'],
    choices: [
      {
        id: 'all',
        label: '« Je prends toute la compagnie. »',
        cost: { gold: 180 },
        effects: [{ recruitMaa: { unit: 'pikemen', men: 200 } }, { recruitMaa: { unit: 'light_cavalry', men: 100 } }],
        ai: { base: 10, traits: { strategist: 10, ambitious: 5 }, personality: { aggression: 10, greed: -10 } },
      },
      {
        id: 'pikes',
        label: '« Les piquiers seulement. »',
        cost: { gold: 100 },
        effects: [{ recruitMaa: { unit: 'pikemen', men: 200 } }],
        ai: { base: 12, traits: { patient: 5, unyielding_defender: 10 }, personality: { caution: 10 } },
      },
      {
        id: 'refuse',
        label: '« Je ne confie pas ma guerre à des marchands de fer. »',
        effects: [{ addPrestige: 10 }],
        ai: { base: 10, traits: { greedy: 15, arrogant: 5 }, personality: { greed: 15 } },
      },
    ],
  },
  {
    id: 'war_camp_fever',
    category: 'war',
    title: 'La fièvre grise',
    text:
      'La fièvre grise s’est levée dans le camp comme un brouillard d’automne. Elle commence par des frissons, continue par une toux sèche, et laisse les hommes blêmes et hébétés sur leur paille. Les chirurgiens réclament qu’on disperse l’armée ; les capitaines jurent que ce serait offrir la campagne à l’ennemi. Et chaque matin, on creuse une fosse de plus derrière les chariots.',
    illustration: 'plague',
    trigger: 'pulse',
    weight: 8,
    cooldownDays: 1825,
    conditions: { all: [{ atWar: true }, { not: { hasTrait: 'grey_fever' } }] },
    portraits: ['root'],
    choices: [
      {
        id: 'disperse',
        label: '« Dispersez les compagnies loin les unes des autres. »',
        effects: [{ changeLevies: -60 }],
        ai: { base: 12, traits: { patient: 10, diligent: 5 }, personality: { caution: 15 } },
      },
      {
        id: 'stay',
        label: '« Je resterai parmi eux. »',
        effects: [
          { addPrestige: 50 },
          { addVassalOpinion: 10, reason: 'opinion.reason.war_shared_hardship' },
          { chance: 30, then: [{ addTrait: 'grey_fever' }] },
        ],
        tags: ['brave', 'compassionate'],
        hiddenEffects: true,
        ai: { base: 8, traits: { brave: 15, compassionate: 15 }, personality: { compassion: 10, caution: -10 } },
      },
      {
        id: 'flee',
        label: '« Qu’on selle mon cheval. Je rentre au château. »',
        effects: [{ addPrestige: -40 }, { changeLevies: -120 }],
        tags: ['craven'],
        ai: { base: 5, traits: { craven: 25, paranoid: 10 }, personality: { caution: 15 } },
      },
      {
        id: 'burn',
        label: '« Brûlez tentes et paillasses, quoi qu’il en coûte. »',
        cost: { gold: 50 },
        effects: [{ changeLevies: -30 }],
        ai: { base: 10, traits: { diligent: 10, just: 5 }, personality: { greed: -10 } },
      },
    ],
  },

  // ===========================================================================
  // Chaîne : la poterne du nord
  // ===========================================================================
  {
    id: 'war_traitor_gates',
    category: 'war',
    title: 'L’homme au tablier',
    text:
      'Un homme maigre, en tablier de boulanger, a été conduit jusqu’à vous les yeux bandés. Il dit servir dans une forteresse de {target.fullname} et haïr le capitaine de la garnison, qui a pendu son frère. Pour quatre-vingts pièces d’or, il laissera la poterne du nord entrouverte la nuit de la nouvelle lune. Il jure sur ses enfants. Vos capitaines se méfient : un traître vendu une fois peut l’être deux fois.',
    illustration: 'castle_walls',
    trigger: 'pulse',
    weight: 7,
    cooldownDays: 1825,
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root'],
    choices: [
      {
        id: 'deal',
        label: '« Marché conclu. »',
        cost: { gold: 80 },
        effects: [
          {
            chance: 65,
            then: [{ triggerEvent: { id: 'war_traitor_gates_open', days: 20 } }],
            else: [{ triggerEvent: { id: 'war_traitor_gates_trap', days: 20 } }],
          },
        ],
        tags: ['deceitful'],
        hiddenEffects: true,
        ai: { base: 12, traits: { strategist: 10, deceitful: 5 }, personality: { intrigue: 10, aggression: 10 } },
      },
      {
        id: 'hostage',
        label: '« Ses enfants resteront chez nous jusqu’à la nouvelle lune. »',
        tooltip: 'Plus sûr, mais indigne.',
        conditions: { skill: 'intrigue', value: { min: 8 } },
        cost: { gold: 80 },
        effects: [
          {
            chance: 85,
            then: [{ triggerEvent: { id: 'war_traitor_gates_open', days: 20 } }],
            else: [{ triggerEvent: { id: 'war_traitor_gates_trap', days: 20 } }],
          },
        ],
        tags: ['cruel', 'deceitful'],
        hiddenEffects: true,
        ai: { base: 8, traits: { cruel: 10, paranoid: 10, deceitful: 5 }, personality: { caution: 10, compassion: -10 } },
      },
      {
        id: 'refuse',
        label: '« Je prendrai cette place par l’épée, pas par la trahison. »',
        effects: [{ addPrestige: 25 }],
        tags: ['honest'],
        ai: { base: 10, traits: { honest: 15, brave: 10, just: 5 }, personality: { honor: 15 } },
      },
    ],
  },
  {
    id: 'war_traitor_gates_open',
    category: 'war',
    title: 'La poterne s’ouvre',
    text:
      'À la nouvelle lune, la poterne du nord s’ouvre sans un grincement. Vos hommes s’engouffrent dans la cour avant que la cloche d’alarme ait sonné trois coups. Au matin, la garnison de {target.fullname} a déposé les armes, et les greniers de la forteresse sont à vous. Le boulanger attend à l’écart, tordant son tablier, qu’on lui dise ce que vaut la parole de ceux qui l’ont acheté.',
    illustration: 'castle_walls',
    trigger: 'chain',
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root'],
    choices: [
      {
        id: 'keep_word',
        label: '« Payez-le, et qu’il parte libre. »',
        effects: [
          { addPrestige: 60 },
          { addGold: 40 },
          { addModifier: { id: 'war_fortress_taken', months: 6, values: { commander_advantage: 2 } } },
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.war_fortress_betrayed' }, who: 'target' },
        ],
        tags: ['honest'],
        ai: { base: 14, traits: { honest: 15, just: 10 }, personality: { honor: 15 } },
      },
      {
        id: 'silence',
        label: '« Un traître se tait mieux sous la terre. »',
        effects: [
          { addPrestige: 50 },
          { addGold: 100 },
          { addModifier: { id: 'war_fortress_taken', months: 6, values: { commander_advantage: 2 } } },
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.war_fortress_betrayed' }, who: 'target' },
        ],
        tags: ['cruel', 'deceitful'],
        ai: { base: 5, traits: { cruel: 15, greedy: 15, deceitful: 5 }, personality: { greed: 10, honor: -15 } },
      },
      {
        id: 'hire',
        label: '« Un homme qui ouvre les portes vaut qu’on le garde. »',
        effects: [
          { spawnCourtier: { traits: ['deceitful'], skill: 'intrigue' } },
          { addPrestige: 50 },
          { addModifier: { id: 'war_fortress_taken', months: 6, values: { commander_advantage: 2 } } },
          { addOpinion: { towards: 'root', value: -20, reason: 'opinion.reason.war_fortress_betrayed' }, who: 'target' },
        ],
        ai: { base: 10, traits: { cynical: 10, strategist: 10 }, personality: { intrigue: 15 } },
      },
    ],
  },
  {
    id: 'war_traitor_gates_trap',
    category: 'war',
    title: 'La cour hérissée de piques',
    text:
      'La poterne s’est bien ouverte, mais sur une cour hérissée de piques et d’arbalètes. Le boulanger avait été vendu avant même de parvenir jusqu’à vous, ou peut-être ne vous avait-il jamais appartenu. Vos meilleurs hommes sont tombés dans l’étroit passage, et ceux qui en ont réchappé racontent déjà, autour des feux, que leur {root.seigneur} achète des portes comme on achète du pain.',
    illustration: 'castle_walls',
    trigger: 'chain',
    conditions: { atWar: true },
    target: { pool: 'enemy_ruler' },
    portraits: ['root'],
    choices: [
      {
        id: 'mourn',
        label: '« J’ai joué, et j’ai perdu. Je porterai ce deuil. »',
        effects: [{ addPrestige: -40 }, { addStress: 20 }, { changeLevies: -50 }],
        tags: ['honest', 'humble'],
        ai: { base: 12, traits: { honest: 10, humble: 15, just: 5 }, personality: { honor: 10 } },
      },
      {
        id: 'vengeance',
        label: '« Qu’on retrouve sa famille. »',
        effects: [
          { addStress: -10 },
          { addPrestige: -20 },
          { changeLevies: -50 },
          { addOpinion: { towards: 'root', value: -15, reason: 'opinion.reason.war_reprisals' }, who: 'target' },
        ],
        tags: ['cruel', 'vengeful'],
        ai: { base: 5, traits: { cruel: 15, wrathful: 20 }, personality: { aggression: 10, compassion: -15 } },
      },
      {
        id: 'again',
        label: '« Nous attaquerons encore — à découvert, cette fois. »',
        effects: [
          { addPrestige: -10 },
          { addStress: 10 },
          { changeLevies: -50 },
          { addModifier: { id: 'war_grim_resolve', months: 6, values: { commander_advantage: 1 } } },
        ],
        tags: ['brave'],
        ai: { base: 12, traits: { brave: 15, strategist: 5 }, personality: { aggression: 15 } },
      },
    ],
  },
];

/** Libellés des raisons d'opinion et des modificateurs introduits par ces événements. */
export const LOC_INTRIGUE: Record<string, string> = {
  // Raisons d'opinion
  'opinion.reason.intrigue_confronted': 'M’a confronté à mes fautes',
  'opinion.reason.intrigue_accused': 'M’a accusé',
  'opinion.reason.intrigue_defended': 'A pris ma défense',
  'opinion.reason.intrigue_traitor_judged': 'A jugé un traître',
  'opinion.reason.intrigue_harsh_justice': 'Justice impitoyable',
  'opinion.reason.intrigue_rewarded': 'M’a récompensé',
  'opinion.reason.intrigue_denounced': 'M’a dénoncé publiquement',
  'opinion.reason.intrigue_warned': 'M’a averti d’un assassin',
  'opinion.reason.intrigue_spy_hanged': 'A pendu mon espion',
  'opinion.reason.intrigue_spy_returned': 'M’a rendu mon espion',
  'opinion.reason.intrigue_spying_caught': 'Espionnage démasqué',
  'opinion.reason.intrigue_trusted': 'M’a accordé sa confiance',
  'opinion.reason.intrigue_rebuffed': 'A refusé mes services',
  'opinion.reason.intrigue_forgery_exposed': 'Faux documents éventés',
  'opinion.reason.intrigue_forger_delivered': 'M’a livré un faussaire',
  'opinion.reason.intrigue_spared': 'M’a épargné',
  'opinion.reason.intrigue_humiliated_publicly': 'M’a humilié devant le conseil',
  'opinion.reason.secrets_denounced_heresy': 'M’a livré au tribunal de la foi',
  'opinion.reason.rivalry_good_sport': 'A ri de bon cœur',
  'opinion.reason.rivalry_humiliated': 'M’a ridiculisé',
  'opinion.reason.rivalry_mocked': 'S’est moqué de moi',
  'opinion.reason.rivalry_reconciled': 'Réconciliation',
  'opinion.reason.rivalry_spurned': 'A repoussé ma main tendue',
  'opinion.reason.rivalry_generosity': 'Secours dans l’épreuve',
  'opinion.reason.diplomacy_secret_pact': 'Pacte secret',
  'opinion.reason.diplomacy_rebuffed': 'A repoussé mes avances',
  'opinion.reason.diplomacy_double_dealing': 'Double jeu',
  'opinion.reason.diplomacy_marriage_pledge': 'Promesse d’union',
  'opinion.reason.diplomacy_greedy_demand': 'Exigences cupides',
  'opinion.reason.diplomacy_envoy_expelled': 'A chassé mon envoyé',
  'opinion.reason.diplomacy_concession': 'M’a fait une concession',
  'opinion.reason.diplomacy_envoy_humiliated': 'A humilié mon envoyé',
  'opinion.reason.diplomacy_hostages': 'Échange de pupilles',
  'opinion.reason.diplomacy_parley': 'Pourparlers courtois',
  'opinion.reason.diplomacy_parley_betrayed': 'A abusé d’un parlementaire',
  'opinion.reason.war_rallied': 'Appel aux armes',
  'opinion.reason.war_victory_feast': 'Festin de victoire',
  'opinion.reason.war_honored_dead': 'A honoré nos morts',
  'opinion.reason.war_spared_knight': 'M’a laissé mon épée',
  'opinion.reason.war_knight_imprisoned': 'Retient un de mes chevaliers',
  'opinion.reason.war_executed_knight': 'A exécuté un de mes chevaliers',
  'opinion.reason.war_blamed': 'M’a fait porter la défaite',
  'opinion.reason.war_took_blame': 'A assumé la défaite',
  'opinion.reason.war_triumph': 'Triomphe',
  'opinion.reason.war_magnanimous': 'Magnanime dans la victoire',
  'opinion.reason.war_humiliated': 'M’a humilié dans la défaite',
  'opinion.reason.war_rewarded': 'Récompenses de guerre',
  'opinion.reason.war_dignity': 'Digne dans la défaite',
  'opinion.reason.war_blamed_vassals': 'Nous a rendus responsables de la défaite',
  'opinion.reason.war_harsh_discipline': 'Discipline impitoyable',
  'opinion.reason.war_mercy_levies': 'A renvoyé les levées aux moissons',
  'opinion.reason.war_plundered': 'A pillé mes terres',
  'opinion.reason.war_shared_hardship': 'A partagé nos épreuves',
  'opinion.reason.war_fortress_betrayed': 'A pris ma forteresse par trahison',
  'opinion.reason.war_reprisals': 'Représailles',
  // Modificateurs
  'modifier.intrigue_leaking_council': 'Conseil percé de fuites',
  'modifier.intrigue_poisoned_well': 'Informations empoisonnées',
  'modifier.intrigue_double_agent': 'Agent double',
  'modifier.intrigue_closed_doors': 'Portes closes',
  'modifier.intrigue_food_tasters': 'Goûteurs à la table',
  'modifier.intrigue_watchful_eyes': 'Yeux dans les couloirs',
  'modifier.diplomacy_open_roads': 'Routes sans péage',
  'modifier.diplomacy_parley_intel': 'Renseignements du parlementaire',
  'modifier.war_defensive_stance': 'Portes fermées',
  'modifier.war_grim_resolve': 'Sombre détermination',
  'modifier.war_iron_discipline': 'Discipline de fer',
  'modifier.war_restless_troops': 'Troupes frustrées',
  'modifier.war_fortress_taken': 'Forteresse prise',
};
