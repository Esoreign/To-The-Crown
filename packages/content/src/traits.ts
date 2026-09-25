import type { TraitDef } from '@ttc/shared';

/**
 * Traits data-driven. Chaque effet déclaré ici est appliqué par game-core :
 *  - skills : ajoutés aux caractéristiques effectives ;
 *  - modifiers : consommés par les systèmes (voir ModifierKey) ;
 *  - ai : axes de personnalité IA ;
 *  - stressTags : stress gagné (+) ou soulagé (−) en agissant selon un tag.
 */
export const TRAITS: TraitDef[] = [
  // --- Personnalité -------------------------------------------------------
  {
    id: 'ambitious', category: 'personality', icon: 'crown-rising', opposites: ['content'],
    skills: { diplomacy: 1, martial: 1, stewardship: 1, intrigue: 1, learning: 1 },
    modifiers: { stress_gain_mult: 0.25 },
    ai: { ambition: 75, aggression: 20, greed: 15 }, sameOpinion: -10, oppositeOpinion: -10,
    stressTags: { humble: 20, ambitious: -10 }, inherit: 0.12,
  },
  {
    id: 'content', category: 'personality', icon: 'cup', opposites: ['ambitious'],
    skills: { intrigue: -1, learning: 1 }, modifiers: { stress_gain_mult: -0.2 },
    ai: { ambition: -75, aggression: -20, loyalty: 25 }, sameOpinion: 10, oppositeOpinion: -10,
    stressTags: { ambitious: 15 }, inherit: 0.12,
  },
  {
    id: 'brave', category: 'personality', icon: 'lion', opposites: ['craven'],
    skills: { martial: 2 }, modifiers: { attraction_opinion: 5, commander_advantage: 1 },
    ai: { caution: -50, aggression: 30 }, sameOpinion: 10, oppositeOpinion: -15,
    stressTags: { craven: 20, brave: -5 }, inherit: 0.1,
  },
  {
    id: 'craven', category: 'personality', icon: 'hare', opposites: ['brave'],
    skills: { martial: -2, intrigue: 2 }, modifiers: { scheme_resistance: 10 },
    ai: { caution: 60, aggression: -40 }, sameOpinion: 5, oppositeOpinion: -15,
    stressTags: { brave: 20, craven: -5 }, inherit: 0.1,
  },
  {
    id: 'compassionate', category: 'personality', icon: 'heart-hand', opposites: ['cruel'],
    skills: { diplomacy: 2, intrigue: -2 }, modifiers: { general_opinion: 5 },
    ai: { compassion: 75, aggression: -15, honor: 20 }, sameOpinion: 15, oppositeOpinion: -25,
    stressTags: { cruel: 25, compassionate: -10 }, inherit: 0.1,
  },
  {
    id: 'cruel', category: 'personality', icon: 'thorn', opposites: ['compassionate'],
    skills: { diplomacy: -2, intrigue: 2 }, modifiers: { vassal_opinion: -5, scheme_power: 5 },
    ai: { compassion: -75, aggression: 20 }, sameOpinion: 5, oppositeOpinion: -25,
    stressTags: { compassionate: 20, cruel: -5 }, inherit: 0.1,
  },
  {
    id: 'honest', category: 'personality', icon: 'open-hand', opposites: ['deceitful'],
    skills: { diplomacy: 2, intrigue: -4 }, modifiers: { general_opinion: 5 },
    ai: { honor: 50, intrigue: -50 }, sameOpinion: 15, oppositeOpinion: -20,
    stressTags: { deceitful: 25, honest: -5 }, inherit: 0.1,
  },
  {
    id: 'deceitful', category: 'personality', icon: 'mask', opposites: ['honest'],
    skills: { diplomacy: -2, intrigue: 4 }, modifiers: { scheme_power: 10 },
    ai: { honor: -50, intrigue: 60 }, sameOpinion: -10, oppositeOpinion: -20,
    stressTags: { honest: 20, deceitful: -5 }, inherit: 0.1,
  },
  {
    id: 'patient', category: 'personality', icon: 'hourglass', opposites: ['wrathful'],
    skills: { learning: 2, intrigue: 1 }, modifiers: { scheme_power: 5 },
    ai: { caution: 30, aggression: -20 }, sameOpinion: 10, oppositeOpinion: -10,
    stressTags: { vengeful: 15 }, inherit: 0.1,
  },
  {
    id: 'wrathful', category: 'personality', icon: 'flame', opposites: ['patient'],
    skills: { martial: 3, diplomacy: -1, intrigue: -1 }, modifiers: { general_opinion: -5 },
    ai: { aggression: 50, caution: -20, compassion: -20 }, sameOpinion: -5, oppositeOpinion: -10,
    stressTags: { forgiving: 20, vengeful: -10 }, inherit: 0.1,
  },
  {
    id: 'generous', category: 'personality', icon: 'coins-open', opposites: ['greedy'],
    skills: { diplomacy: 3 }, modifiers: { general_opinion: 5, monthly_income_mult: -0.1 },
    ai: { greed: -60, compassion: 20, sociability: 20 }, sameOpinion: 10, oppositeOpinion: -15,
    stressTags: { greedy: 20, generous: -10 }, inherit: 0.1,
  },
  {
    id: 'greedy', category: 'personality', icon: 'coin-purse', opposites: ['generous'],
    skills: { diplomacy: -2, stewardship: 2 }, modifiers: { monthly_income_mult: 0.1, general_opinion: -5 },
    ai: { greed: 75, compassion: -10 }, sameOpinion: -10, oppositeOpinion: -15,
    stressTags: { generous: 25, greedy: -5 }, inherit: 0.1,
  },
  {
    id: 'just', category: 'personality', icon: 'scales', opposites: ['arbitrary'],
    skills: { stewardship: 2, learning: 1, intrigue: -2 }, modifiers: { vassal_opinion: 5 },
    ai: { honor: 60, intrigue: -20 }, sameOpinion: 15, oppositeOpinion: -15,
    stressTags: { deceitful: 15, cruel: 10 }, inherit: 0.1,
  },
  {
    id: 'arbitrary', category: 'personality', icon: 'dice', opposites: ['just'],
    skills: { stewardship: -2, intrigue: 3 }, modifiers: { vassal_opinion: -5, monthly_authority: 0.1 },
    ai: { honor: -40, intrigue: 30 }, sameOpinion: -5, oppositeOpinion: -15,
    stressTags: { honest: 10 }, inherit: 0.1,
  },
  {
    id: 'arrogant', category: 'personality', icon: 'peacock', opposites: ['humble'],
    skills: { diplomacy: -1 }, modifiers: { monthly_prestige: 0.5, general_opinion: -5 },
    ai: { ambition: 30, sociability: -10 }, sameOpinion: -15, oppositeOpinion: -15,
    stressTags: { humble: 25, ambitious: -5 }, inherit: 0.1,
  },
  {
    id: 'humble', category: 'personality', icon: 'bowed-head', opposites: ['arrogant'],
    skills: { diplomacy: 1 }, modifiers: { monthly_fervor: 0.5, general_opinion: 5 },
    ai: { ambition: -30, zeal: 20 }, sameOpinion: 10, oppositeOpinion: -15,
    stressTags: { ambitious: 20, humble: -5 }, inherit: 0.1,
  },
  {
    id: 'sociable', category: 'personality', icon: 'goblets', opposites: ['reclusive'],
    skills: { diplomacy: 2, learning: -1 }, modifiers: { general_opinion: 5 },
    ai: { sociability: 75 }, sameOpinion: 15, oppositeOpinion: -10,
    stressTags: { reclusive: 20, social: -10 }, inherit: 0.1,
  },
  {
    id: 'reclusive', category: 'personality', icon: 'tower', opposites: ['sociable'],
    skills: { diplomacy: -2, learning: 2, stewardship: 1 }, modifiers: { stress_gain_mult: 0.1 },
    ai: { sociability: -75 }, sameOpinion: 5, oppositeOpinion: -10,
    stressTags: { social: 20, reclusive: -10 }, inherit: 0.1,
  },
  {
    id: 'diligent', category: 'personality', icon: 'quill', opposites: ['lazy'],
    skills: { diplomacy: 1, martial: 1, stewardship: 2, intrigue: 1, learning: 1 },
    modifiers: { stress_gain_mult: 0.1, development_growth: 0.05 },
    ai: { ambition: 20 }, sameOpinion: 10, oppositeOpinion: -10, inherit: 0.1,
  },
  {
    id: 'lazy', category: 'personality', icon: 'pillow', opposites: ['diligent'],
    skills: { diplomacy: -1, martial: -1, stewardship: -2, intrigue: -1, learning: -1 },
    modifiers: { stress_gain_mult: -0.3 },
    ai: { ambition: -30, aggression: -10 }, sameOpinion: 5, oppositeOpinion: -10, inherit: 0.1,
  },
  {
    id: 'zealous', category: 'personality', icon: 'censer', opposites: ['cynical'],
    skills: { martial: 1, learning: 1 }, modifiers: { monthly_fervor: 1 },
    ai: { zeal: 80, aggression: 10 }, sameOpinion: 15, oppositeOpinion: -25,
    stressTags: { impious: 25, pious: -10 }, inherit: 0.1,
  },
  {
    id: 'cynical', category: 'personality', icon: 'raised-brow', opposites: ['zealous'],
    skills: { intrigue: 2, learning: 2 }, modifiers: { monthly_fervor: -0.5 },
    ai: { zeal: -80 }, sameOpinion: 5, oppositeOpinion: -20,
    stressTags: { pious: 10 }, inherit: 0.1,
  },
  {
    id: 'trusting', category: 'personality', icon: 'dove', opposites: ['paranoid'],
    skills: { diplomacy: 2, intrigue: -2 }, modifiers: { scheme_resistance: -10, general_opinion: 5 },
    ai: { caution: -20, loyalty: 20 }, sameOpinion: 10, oppositeOpinion: -10, inherit: 0.1,
  },
  {
    id: 'paranoid', category: 'personality', icon: 'eye', opposites: ['trusting'],
    skills: { diplomacy: -1, intrigue: 3 }, modifiers: { scheme_resistance: 20, stress_gain_mult: 0.25 },
    ai: { caution: 40, sociability: -20 }, sameOpinion: -10, oppositeOpinion: -10, inherit: 0.1,
  },
  {
    id: 'lustful', category: 'personality', icon: 'rose', opposites: ['chaste'],
    skills: { intrigue: 2 }, modifiers: { fertility: 0.25 },
    ai: { sociability: 20 }, sameOpinion: 10, oppositeOpinion: -15,
    stressTags: { reclusive: 5 }, inherit: 0.1,
  },
  {
    id: 'chaste', category: 'personality', icon: 'lily', opposites: ['lustful'],
    skills: { learning: 2 }, modifiers: { fertility: -0.25 },
    ai: { zeal: 20 }, sameOpinion: 10, oppositeOpinion: -15, inherit: 0.1,
  },
  {
    id: 'loyal', category: 'personality', icon: 'oath', opposites: ['fickle'],
    skills: { diplomacy: 1 }, modifiers: { general_opinion: 5 },
    ai: { loyalty: 80, honor: 20 }, sameOpinion: 15, oppositeOpinion: -20,
    stressTags: { deceitful: 15 }, inherit: 0.1,
  },
  {
    id: 'fickle', category: 'personality', icon: 'weathervane', opposites: ['loyal'],
    skills: { diplomacy: 1, intrigue: 1 },
    ai: { loyalty: -60, intrigue: 20 }, sameOpinion: -5, oppositeOpinion: -20, inherit: 0.1,
  },

  // --- Éducation ----------------------------------------------------------
  ...(['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning'] as const).flatMap((skill) =>
    [1, 2, 3].map(
      (lvl): TraitDef => ({
        id: `education_${skill}_${lvl}`,
        category: 'education',
        icon: `edu-${skill}`,
        educationSkill: skill,
        educationLevel: lvl,
        opposites: [1, 2, 3].filter((l) => l !== lvl).map((l) => `education_${skill}_${l}`),
        skills: { [skill]: lvl * 2 },
      }),
    ),
  ),

  // --- Commandement -------------------------------------------------------
  {
    id: 'strategist', category: 'commander', icon: 'banner-map',
    skills: { martial: 1 }, command: { advantage: 8 },
  },
  {
    id: 'aggressive_attacker', category: 'commander', icon: 'charge',
    command: { advantage: 5 },
  },
  {
    id: 'unyielding_defender', category: 'commander', icon: 'tower-shield',
    command: { advantage: 4, terrain: ['hills', 'mountains', 'forest'] },
  },
  {
    id: 'forest_fighter', category: 'commander', icon: 'pine',
    command: { advantage: 10, terrain: ['forest', 'marsh'] },
  },
  {
    id: 'rough_terrain_expert', category: 'commander', icon: 'crag',
    command: { advantage: 10, terrain: ['mountains', 'hills', 'coast_cliffs'] },
  },
  {
    id: 'open_terrain_expert', category: 'commander', icon: 'horseshoe',
    command: { advantage: 10, terrain: ['plains', 'farmlands', 'steppe'] },
  },

  // --- Santé --------------------------------------------------------------
  {
    id: 'ill', category: 'health', icon: 'fever',
    modifiers: { health: -1, fertility: -0.3 }, skills: { diplomacy: -1, stewardship: -1 },
    disease: { recoveryChance: 0.25, deathChance: 0.01 },
  },
  {
    id: 'grey_fever', category: 'health', icon: 'skull-drop',
    modifiers: { health: -2.5, fertility: -0.5 }, skills: { diplomacy: -2, martial: -2, stewardship: -2, intrigue: -2, learning: -2 },
    disease: { recoveryChance: 0.15, deathChance: 0.06, contagious: true },
  },
  {
    id: 'wounded', category: 'health', icon: 'bandage',
    modifiers: { health: -1.5 }, skills: { martial: -2 },
    disease: { recoveryChance: 0.3, deathChance: 0.015 },
  },
  {
    id: 'maimed', category: 'health', icon: 'crutch',
    modifiers: { health: -1, attraction_opinion: -10 }, skills: { martial: -3 },
  },
  {
    id: 'infirm', category: 'health', icon: 'cane',
    modifiers: { health: -1.5, fertility: -0.5 }, skills: { diplomacy: -2, martial: -4, stewardship: -2, intrigue: -2, learning: -2 },
  },
  {
    id: 'depressed', category: 'health', icon: 'rain-cloud',
    modifiers: { health: -0.5, stress_gain_mult: 0.2 }, skills: { diplomacy: -2, stewardship: -1 },
    disease: { recoveryChance: 0.08, deathChance: 0.004 },
  },
  {
    id: 'lunatic', category: 'health', icon: 'broken-crown',
    modifiers: { stress_gain_mult: 0.3, vassal_opinion: -10 }, skills: { diplomacy: -2, stewardship: -2, martial: -1 },
    ai: { caution: -20 },
  },

  // --- Congénitaux --------------------------------------------------------
  {
    id: 'robust', category: 'congenital', icon: 'oak', opposites: ['frail'],
    skills: { martial: 2 }, modifiers: { health: 1, fertility: 0.1, attraction_opinion: 5 }, inherit: 0.3,
  },
  {
    id: 'frail', category: 'congenital', icon: 'reed', opposites: ['robust'],
    skills: { martial: -2 }, modifiers: { health: -1, fertility: -0.1 }, inherit: 0.3,
  },
  {
    id: 'sharp', category: 'congenital', icon: 'lamp', opposites: ['dull'],
    skills: { diplomacy: 2, martial: 2, stewardship: 2, intrigue: 2, learning: 3 }, inherit: 0.3,
  },
  {
    id: 'dull', category: 'congenital', icon: 'fog', opposites: ['sharp'],
    skills: { diplomacy: -2, martial: -2, stewardship: -2, intrigue: -2, learning: -3 }, inherit: 0.3,
  },
  {
    id: 'comely', category: 'congenital', icon: 'mirror', opposites: ['homely'],
    skills: { diplomacy: 1 }, modifiers: { attraction_opinion: 20, fertility: 0.1 }, inherit: 0.3,
  },
  {
    id: 'homely', category: 'congenital', icon: 'broken-mirror', opposites: ['comely'],
    skills: { diplomacy: -1 }, modifiers: { attraction_opinion: -15, fertility: -0.1 }, inherit: 0.3,
  },

  // --- Réputation ---------------------------------------------------------
  {
    id: 'murderer', category: 'reputation', icon: 'dagger', shunned: true,
    modifiers: { general_opinion: -15, monthly_prestige: -0.3 }, ai: { honor: -20 },
  },
  {
    id: 'kinslayer', category: 'reputation', icon: 'broken-tree', shunned: true,
    modifiers: { general_opinion: -20, vassal_opinion: -10 },
  },
  {
    id: 'adulterer', category: 'reputation', icon: 'torn-veil', shunned: true,
    modifiers: { general_opinion: -10 },
  },
  {
    id: 'heretic', category: 'reputation', icon: 'cracked-sun', shunned: true,
    modifiers: { general_opinion: -10, monthly_fervor: -0.5 },
  },
  {
    id: 'war_hero', category: 'reputation', icon: 'laurel',
    skills: { martial: 2 }, modifiers: { monthly_prestige: 0.5, general_opinion: 5, commander_advantage: 2 },
  },
  {
    id: 'poet', category: 'reputation', icon: 'lyre',
    skills: { diplomacy: 2, learning: 1 }, modifiers: { monthly_prestige: 0.3, attraction_opinion: 5 },
  },
  {
    id: 'mystic', category: 'reputation', icon: 'candle',
    skills: { learning: 3 }, modifiers: { monthly_fervor: 1 },
  },
  {
    id: 'administrator', category: 'reputation', icon: 'ledger',
    skills: { stewardship: 3 }, modifiers: { domain_limit: 1, tax_mult: 0.05 },
  },
];

export const TRAIT_BY_ID: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export const PERSONALITY_TRAITS = TRAITS.filter((t) => t.category === 'personality').map((t) => t.id);
export const CONGENITAL_TRAITS = TRAITS.filter((t) => t.category === 'congenital').map((t) => t.id);
export const COMMANDER_TRAITS = TRAITS.filter((t) => t.category === 'commander').map((t) => t.id);
