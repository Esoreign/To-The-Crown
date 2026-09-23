/**
 * Constantes d'équilibrage centralisées. Aucun nombre magique de gameplay
 * ne doit être disséminé dans les systèmes : ajouter ici et documenter.
 */
export const BALANCE = {
  age: {
    adult: 16,
    marriageMin: 16,
    fertileFemaleMax: 45,
    fertileMaleMax: 70,
    educationEnd: 16,
    old: 60,
  },
  economy: {
    /** Part du revenu d'un comté conservée par son détenteur direct. */
    domainTaxShare: 1,
    /** Part de l'impôt d'un vassal reversée au suzerain, par niveau d'autorité 0..3. */
    vassalTaxByAuthority: [0.12, 0.18, 0.24, 0.3],
    /** Part des levées d'un vassal disponibles pour le suzerain. */
    vassalLevyByAuthority: [0.2, 0.3, 0.4, 0.5],
    /** Bonus de revenu par point de gestion au-dessus de 10. */
    stewardshipIncomePerPoint: 0.02,
    /** Pénalité de revenu/levées par comté au-delà de la limite de domaine. */
    overDomainPenalty: 0.12,
    /** Coût de la cour (or/mois) par rang 1..4. */
    courtUpkeep: [0.1, 0.3, 0.8, 1.5],
    /** Or d'urgence visé par l'IA en mois de revenu. */
    aiEmergencyMonths: 6,
    /** Développement : croissance mensuelle de base. */
    developmentGrowth: 0.02,
    developmentMax: 100,
    /** Contrôle : récupération mensuelle de base. */
    controlGrowth: 0.6,
    /** Revenu par point de développement. */
    taxPerDevelopment: 0.03,
    /** Multiplicateur de levées par point de développement. */
    leviesPerDevelopment: 0.012,
  },
  domain: {
    base: 2,
    /** +1 par tranche de 6 points de gestion. */
    perStewardship: 6,
    byRank: [0, 1, 2, 3],
  },
  prestige: {
    monthlyByRank: [0.2, 0.5, 1.0, 1.6],
    monthlyFromDiplomacy: 0.02,
  },
  fervor: {
    monthlyBase: 0.3,
    monthlyFromLearning: 0.03,
  },
  authority: {
    monthlyBase: 0.2,
    monthlyByRank: [0.1, 0.3, 0.6, 1.0],
    monthlyFromStewardship: 0.03,
    crownAuthorityCost: [0, 150, 300, 500],
    crownAuthorityCooldownDays: 3650,
    /** Opinion des vassaux par niveau d'autorité royale. */
    crownAuthorityOpinion: [5, 0, -5, -15],
    revokeCost: 120,
    revokeTyrannyOpinion: -25,
    imprisonCost: 60,
    executeCost: 100,
  },
  health: {
    base: 5.5,
    /** Mortalité annuelle de Gompertz : q(âge) = A·e^(B·âge) (≈0,4 % à 30 ans, 12 % à 70 ans). */
    gompertzA: 0.0003,
    gompertzB: 0.085,
    /** Multiplicateur de mortalité par point de santé sous 5. */
    healthMortalityFactor: 0.35,
    childMortalityMonthly: 0.0025,
    illnessMonthlyChance: 0.004,
    plagueMonthlyChance: 0.0008,
    lowHealthDeathFactor: 0.012,
  },
  fertility: {
    base: 0.55,
    /** Chance mensuelle de conception pour un couple fertile de fertilité 1. */
    monthlyConception: 0.032,
    pregnancyDays: 270,
    maxChildren: 6,
    childbirthDeathChance: 0.012,
    twinChance: 0.02,
  },
  stress: {
    max: 300,
    levels: [100, 200, 300],
    monthlyDecay: 2.5,
  },
  opinion: {
    min: -100,
    max: 100,
    parent: 20,
    child: 20,
    sibling: 10,
    spouse: 20,
    sameDynasty: 10,
    ally: 15,
    atWar: -40,
    liege: 0,
    differentFaith: -20,
    sisterFaith: -8,
    differentCultureVassal: -6,
    relation: {
      friend: 40,
      best_friend: 80,
      rival: -40,
      nemesis: -80,
      lover: 30,
      soulmate: 60,
      mentor: 15,
      ward: 15,
    },
    giftPer10Gold: 1.2,
    giftMax: 40,
    newRuler: -15,
    newRulerYears: 3,
  },
  council: {
    /** Progression mensuelle par point de compétence. */
    taskProgressPerSkill: 1,
    relationsOpinionPerMonth: 1,
    prestigePerSkill: 0.04,
    trainLevyMult: 0.01,
    controlPerSkill: 0.25,
    taxPerSkill: 0.005,
    developPerSkill: 0.01,
    fervorPerSkill: 0.04,
    secretDiscoveryPerSkill: 0.004,
    disruptPerSkill: 0.4,
  },
  army: {
    /** Jours de base pour traverser une province. */
    baseMoveDays: 8,
    straitMoveDays: 16,
    terrainMoveMult: {
      plains: 1,
      farmlands: 1,
      steppe: 0.9,
      hills: 1.3,
      forest: 1.3,
      marsh: 1.6,
      mountains: 1.8,
      coast_cliffs: 1.2,
    } as Record<string, number>,
    maxBattleDays: 12,
    minBattleDays: 3,
    moraleLossPerCasualtyPct: 1.6,
    retreatMorale: 0.2,
    shatteredDays: 20,
    /** Aléatoire journalier des batailles (±). */
    battleNoise: 0.18,
    levyRegenMonthly: 0.06,
    garrisonPerFort: 150,
    raiseLeviesDays: 0,
    attritionOverSupply: 0.01,
    moraleRecoveryDaily: 0.01,
  },
  siege: {
    baseProgressDaily: 1.2,
    fortDivisor: 1.2,
    siegeEngineBonus: 0.6,
    menBonusPer1000: 0.15,
  },
  war: {
    battleScoreMax: 50,
    occupationScoreMax: 60,
    tickingMax: 25,
    tickingDaysToMax: 730,
    enforceThreshold: 100,
    aiAcceptWhitePeaceAt: -15,
    aiSurrenderAt: -80,
    maxDurationDays: 3650,
    prestigeWin: 150,
    prestigeLoss: -80,
    truceDays: 3650,
    declareCostAuthority: 0,
    declarePrestigeCost: 0,
    independencePrestige: 200,
  },
  schemes: {
    baseMonthlyProgress: 4,
    powerPerSkill: 0.6,
    resistancePerSkill: 0.5,
    discoveryBase: 0.03,
    successBase: 0.55,
    murderSuccessBase: 0.4,
  },
  ai: {
    /** Jours entre deux évaluations IA d'un dirigeant. */
    thinkIntervalDays: 30,
    thinkJitter: 20,
    warPowerRatio: 1.3,
    warMinGoldMonths: 3,
    marriageMinScore: 20,
    maxConcurrentSchemes: 1,
    constructionReserve: 50,
  },
  events: {
    /** Probabilité mensuelle qu'un dirigeant reçoive un événement (fréquence normale). */
    monthlyChance: { low: 0.12, normal: 0.22, high: 0.35 },
    defaultTimeoutDays: 60,
  },
  claims: {
    fabricateYears: 0,
    weakClaimExpiryYears: 0,
  },
  factions: {
    joinOpinionThreshold: -20,
    discontentMonthly: 4,
    powerThreshold: 0.8,
  },
} as const;

export type Balance = typeof BALANCE;
