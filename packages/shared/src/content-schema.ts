/**
 * Schéma des définitions de contenu data-driven (traits, bâtiments, cultures,
 * confessions, événements…). Le contenu lui-même vit dans @ttc/content.
 */

export type SkillKey = 'diplomacy' | 'martial' | 'stewardship' | 'intrigue' | 'learning';
export const SKILL_KEYS: readonly SkillKey[] = ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning'];

export type Skills = Record<SkillKey, number>;

export type TitleRank = 'county' | 'duchy' | 'kingdom' | 'empire';
export const RANK_ORDER: Record<TitleRank, number> = { county: 1, duchy: 2, kingdom: 3, empire: 4 };

export type Terrain =
  | 'plains'
  | 'farmlands'
  | 'hills'
  | 'mountains'
  | 'forest'
  | 'marsh'
  | 'steppe'
  | 'coast_cliffs'
  | 'jungle'
  | 'desert'
  | 'savanna'
  | 'tundra'
  | 'ice';

export type UnitType =
  | 'levy'
  | 'footmen'
  | 'archers'
  | 'pikemen'
  | 'light_cavalry'
  | 'heavy_cavalry'
  | 'horse_archers'
  | 'war_elephants'
  | 'siege_engines';

/**
 * Clés de modificateurs reconnues par le moteur. Chaque clé est consommée par
 * un système précis : ajouter une clé ici sans l'utiliser dans game-core est
 * interdit (voir tests de cohérence).
 */
export type ModifierKey =
  // personnages
  | 'diplomacy'
  | 'martial'
  | 'stewardship'
  | 'intrigue'
  | 'learning'
  | 'health'
  | 'fertility'
  | 'stress_gain_mult'
  | 'monthly_prestige'
  | 'monthly_fervor'
  | 'monthly_authority'
  | 'general_opinion'
  | 'vassal_opinion'
  | 'attraction_opinion'
  | 'same_trait_opinion'
  | 'domain_limit'
  | 'scheme_power'
  | 'scheme_resistance'
  | 'commander_advantage'
  | 'monthly_income_mult'
  | 'build_cost_mult'
  | 'maa_upkeep_mult'
  | 'levy_size_mult'
  // provinces
  | 'tax_mult'
  | 'levy_mult'
  | 'development_growth'
  | 'control_growth'
  | 'fort_level'
  | 'garrison_size'
  | 'monthly_gold'
  | 'defender_advantage'
  | 'supply_limit';

export type ModifierMap = Partial<Record<ModifierKey, number>>;

export type TraitCategory = 'personality' | 'education' | 'commander' | 'health' | 'reputation' | 'congenital';

export interface AiPersonality {
  ambition: number; // -100..100
  honor: number;
  aggression: number;
  greed: number;
  sociability: number;
  caution: number;
  intrigue: number;
  loyalty: number;
  compassion: number;
  zeal: number;
}

export interface TraitDef {
  id: string;
  category: TraitCategory;
  icon: string;
  /** Traits mutuellement exclusifs. */
  opposites?: string[];
  skills?: Partial<Skills>;
  modifiers?: ModifierMap;
  ai?: Partial<AiPersonality>;
  /** Opinion entre deux porteurs du même trait (personnalité). */
  sameOpinion?: number;
  /** Opinion entre porteurs de traits opposés. */
  oppositeOpinion?: number;
  /** Probabilité (0..1) qu'un enfant hérite du trait si un parent le porte. */
  inherit?: number;
  /** Maladie : chance mensuelle de guérison et d'aggravation mortelle. */
  disease?: { recoveryChance: number; deathChance: number; contagious?: boolean };
  /** Niveau d'éducation (1..4) pour les traits d'éducation. */
  educationSkill?: SkillKey;
  educationLevel?: number;
  /** Tags d'actions contraires : choisir une action portant ce tag cause du stress. */
  stressTags?: Partial<Record<StressTag, number>>;
  /** Trait perçu comme criminel/vil (réputation). */
  shunned?: boolean;
  /** Trait de commandement : avantage en bataille et terrain préféré. */
  command?: { advantage: number; terrain?: Terrain[] };
}

/**
 * Tags d'actions : lorsqu'un personnage choisit une action portant un tag,
 * les traits associés génèrent (ou soulagent) du stress.
 */
export type StressTag =
  | 'cruel'
  | 'compassionate'
  | 'deceitful'
  | 'honest'
  | 'greedy'
  | 'generous'
  | 'brave'
  | 'craven'
  | 'social'
  | 'reclusive'
  | 'vengeful'
  | 'forgiving'
  | 'pious'
  | 'impious'
  | 'ambitious'
  | 'humble';

export type BuildingCategory = 'economy' | 'military' | 'defense' | 'prestige';

export interface BuildingDef {
  id: string;
  category: BuildingCategory;
  icon: string;
  maxLevel: number;
  /** Coût en or par niveau (index 0 = niveau 1). */
  cost: number[];
  /** Durée en jours par niveau. */
  days: number[];
  requires?: {
    coastal?: boolean;
    terrain?: Terrain[];
    notTerrain?: Terrain[];
    building?: { id: string; level: number };
    minDevelopment?: number;
  };
  /** Effets appliqués par niveau (cumulés : niveau N applique N × effet). */
  perLevel: ModifierMap;
  /** Hommes supplémentaires de levée par niveau. */
  leviesPerLevel?: number;
}

export interface CultureDef {
  id: string;
  color: string;
  region: string;
  maleNames: string[];
  femaleNames: string[];
  houseNames: string[];
  /** Syllabes pour générer les toponymes. */
  placeSyllables: { start: string[]; mid: string[]; end: string[] };
  modifiers: ModifierMap;
  /** Unité privilégiée : bonus de combat. */
  favoredUnit?: UnitType;
  /** Préférence d'apparence des portraits. */
  appearance: { skinTones: number[]; hairColors: number[]; clothing: string };
  succession: SuccessionLaw;
}

export interface FaithDef {
  id: string;
  color: string;
  symbol: string;
  /** Doctrines simplifiées. */
  doctrines: {
    divorce: boolean;
    femaleRulers: 'equal' | 'allowed' | 'disallowed';
    holyWar: boolean;
    /** Tolérance envers les autres confessions : -2 hostile .. +2 tolérante. */
    tolerance: number;
  };
  /** Confessions sœurs (même famille) : pénalité d'opinion réduite. */
  family: string;
  modifiers: ModifierMap;
  virtues: string[];
  sins: string[];
}

export type SuccessionLaw = 'partition' | 'primogeniture' | 'elective' | 'seniority';

export interface UnitDef {
  id: UnitType;
  icon: string;
  damage: number;
  toughness: number;
  pursuit: number;
  screen: number;
  siege: number;
  /** Coût de recrutement par tranche de 100 hommes. */
  cost: number;
  /** Entretien mensuel par tranche de 100 hommes lorsque levés. */
  upkeep: number;
  counters?: UnitType[];
  goodTerrain?: Terrain[];
  badTerrain?: Terrain[];
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

/** Référence de portée dans un événement. */
export type ScopeRef = 'root' | 'target' | 'other' | 'actor';

export type Comparison = { min?: number; max?: number };

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { exists: ScopeRef }
  | { hasTrait: string; who?: ScopeRef }
  | { hasTraitCategory: TraitCategory; who?: ScopeRef }
  | { isAdult: boolean; who?: ScopeRef }
  | { isRuler: boolean; who?: ScopeRef }
  | { isIndependent: boolean; who?: ScopeRef }
  | { isMarried: boolean; who?: ScopeRef }
  | { hasHeir: boolean; who?: ScopeRef }
  | { atWar: boolean; who?: ScopeRef }
  | { isPlayer: boolean; who?: ScopeRef }
  | { isFemale: boolean; who?: ScopeRef }
  | { hasChildren: boolean; who?: ScopeRef }
  | { hasCouncil: boolean; who?: ScopeRef }
  | { age: Comparison; who?: ScopeRef }
  | { skill: SkillKey; value: Comparison; who?: ScopeRef }
  | { gold: Comparison; who?: ScopeRef }
  | { prestige: Comparison; who?: ScopeRef }
  | { fervor: Comparison; who?: ScopeRef }
  | { authority: Comparison; who?: ScopeRef }
  | { stress: Comparison; who?: ScopeRef }
  | { health: Comparison; who?: ScopeRef }
  | { rank: Comparison; who?: ScopeRef }
  | { realmSize: Comparison; who?: ScopeRef }
  | { hasFlag: string; who?: ScopeRef }
  | { opinion: Comparison; of?: ScopeRef; towards: ScopeRef }
  | { hasRelation: RelationType; with: ScopeRef; who?: ScopeRef }
  | { sameFaith: ScopeRef; who?: ScopeRef }
  | { sameCulture: ScopeRef; who?: ScopeRef }
  | { isRelative: ScopeRef; who?: ScopeRef }
  | { isSpouseOf: ScopeRef; who?: ScopeRef }
  | { isChildOf: ScopeRef; who?: ScopeRef }
  | { isVassalOf: ScopeRef; who?: ScopeRef }
  | { isCouncillorOf: ScopeRef; who?: ScopeRef }
  | { hasSecret: SecretType | true; who?: ScopeRef }
  | { knowsSecretOf: ScopeRef; who?: ScopeRef }
  | { hasHookOn: ScopeRef; who?: ScopeRef }
  | { hasClaims: boolean; who?: ScopeRef }
  | { hasBuildingSlot: boolean }
  | { domainDevelopment: Comparison }
  | { domainControl: Comparison };

export type Effect =
  | { addGold: number; who?: ScopeRef }
  | { addPrestige: number; who?: ScopeRef }
  | { addAuthority: number; who?: ScopeRef }
  | { addFervor: number; who?: ScopeRef }
  | { addRenown: number; who?: ScopeRef }
  | { addStress: number; who?: ScopeRef }
  | { addHealth: number; who?: ScopeRef }
  | { addOpinion: { towards: ScopeRef; value: number; reason: string; months?: number }; who?: ScopeRef }
  | { addMutualOpinion: { with: ScopeRef; value: number; reason: string; months?: number }; who?: ScopeRef }
  | { addTrait: string; who?: ScopeRef }
  | { removeTrait: string; who?: ScopeRef }
  | { addSkill: { skill: SkillKey; value: number }; who?: ScopeRef }
  | { addModifier: { id: string; months?: number; values: ModifierMap }; who?: ScopeRef }
  | { removeModifier: string; who?: ScopeRef }
  | { setFlag: string; months?: number; who?: ScopeRef }
  | { clearFlag: string; who?: ScopeRef }
  | { createSecret: { type: SecretType; about?: ScopeRef; knownBy?: ScopeRef[] }; who?: ScopeRef }
  | { discoverSecret: { of: ScopeRef }; who?: ScopeRef }
  | { exposeSecret: { of: ScopeRef } }
  | { createHook: { on: ScopeRef; strong?: boolean; years?: number }; who?: ScopeRef }
  | { addClaim: { title: 'targetPrimary' | 'targetCounty'; pressed?: boolean }; who?: ScopeRef }
  | { startScheme: { type: SchemeType; target: ScopeRef }; who?: ScopeRef }
  | { changeControl: number }
  | { changeDevelopment: number }
  | { changeLevies: number }
  | { killCharacter: { cause: DeathCause }; who?: ScopeRef }
  | { woundCharacter: true; who?: ScopeRef }
  | { imprison: { by: ScopeRef }; who?: ScopeRef }
  | { release: true; who?: ScopeRef }
  | { createRelationship: { type: RelationType; with: ScopeRef }; who?: ScopeRef }
  | { breakRelationship: { type: RelationType; with: ScopeRef }; who?: ScopeRef }
  | { triggerEvent: { id: string; days?: number; who?: ScopeRef } }
  | { chronicle: string }
  | { chance: number; then: Effect[]; else?: Effect[] }
  | { if: Condition; then: Effect[]; else?: Effect[] }
  | { spawnCourtier: { traits?: string[]; skill?: SkillKey; flag?: string }; as?: 'target' | 'other' }
  | { banish: true; who?: ScopeRef }
  | { recruitMaa: { unit: UnitType; men: number } }
  | { addVassalOpinion: number; reason: string; months?: number }
  | { none: true };

/** Sélecteur de cible d'un événement. */
export type TargetPool =
  | 'spouse'
  | 'heir'
  | 'child'
  | 'adult_child'
  | 'minor_child'
  | 'sibling'
  | 'parent'
  | 'liege'
  | 'vassal'
  | 'councillor'
  | 'courtier'
  | 'rival'
  | 'friend'
  | 'lover'
  | 'neighbor_ruler'
  | 'enemy_ruler'
  | 'ally'
  | 'prisoner'
  | 'schemer_against'
  | 'relative';

export interface TargetSelector {
  pool: TargetPool;
  where?: Condition;
  /** Si aucune cible n'est trouvée, l'événement ne se déclenche pas (par défaut). */
  optional?: boolean;
}

export type EventCategory =
  | 'family'
  | 'court'
  | 'childhood'
  | 'rivalry'
  | 'romance'
  | 'health'
  | 'intrigue'
  | 'vassals'
  | 'economy'
  | 'war'
  | 'succession'
  | 'religion'
  | 'culture'
  | 'secrets'
  | 'council'
  | 'diplomacy';

export type IllustrationKey =
  | 'throne_room'
  | 'council_chamber'
  | 'bedchamber'
  | 'feast'
  | 'garden'
  | 'chapel'
  | 'library'
  | 'battlefield'
  | 'war_camp'
  | 'castle_walls'
  | 'market'
  | 'fields'
  | 'forest'
  | 'dungeon'
  | 'crypt'
  | 'nursery'
  | 'tournament'
  | 'harbor'
  | 'village'
  | 'night_alley'
  | 'mountains'
  | 'plague'
  | 'coronation'
  | 'wedding';

export interface EventChoiceDef {
  id: string;
  /** Texte du choix (fr) — la clé de localisation est dérivée. */
  label: string;
  /** Description courte affichée au survol (facultatif, fr). */
  tooltip?: string;
  conditions?: Condition;
  /** Coûts vérifiés avant exécution (et prélevés). */
  cost?: { gold?: number; prestige?: number; fervor?: number; authority?: number };
  effects: Effect[];
  /** Tags influant le stress selon les traits. */
  tags?: StressTag[];
  /** Pondération IA : base + bonus par trait + bonus par axe de personnalité. */
  ai?: { base: number; traits?: Record<string, number>; personality?: Partial<AiPersonality> };
  /** Conséquences partiellement cachées (affiche « ??? »). */
  hiddenEffects?: boolean;
}

export interface EventDef {
  id: string;
  category: EventCategory;
  title: string;
  /** Texte narratif (fr) avec variables {root.name}, {target.name}… */
  text: string;
  illustration: IllustrationKey;
  /**
   * Déclenchement : 'pulse' = tirage aléatoire périodique, 'chain' = déclenché
   * par un autre événement ou un système (triggerEvent / on_action).
   */
  trigger: 'pulse' | 'chain' | `on:${OnAction}`;
  weight?: number;
  /** Délai minimal avant qu'un même personnage revive cet événement. */
  cooldownDays?: number;
  /** Une seule fois par personnage. */
  once?: boolean;
  /** Réservé aux dirigeants (titrés). Par défaut vrai. */
  rulerOnly?: boolean;
  conditions?: Condition;
  target?: TargetSelector;
  other?: TargetSelector;
  /** Portraits affichés. */
  portraits?: ScopeRef[];
  choices: EventChoiceDef[];
  /** Jours avant résolution automatique par l'IA si le joueur ne répond pas. */
  timeoutDays?: number;
  /** Met la partie en pause en solo lorsque l'événement apparaît. */
  major?: boolean;
}

export type OnAction =
  | 'birth'
  | 'death_of_liege'
  | 'marriage'
  | 'war_declared'
  | 'battle_won'
  | 'battle_lost'
  | 'war_won'
  | 'war_lost'
  | 'coming_of_age'
  | 'scheme_discovered'
  | 'succession'
  | 'stress_crisis'
  | 'title_gained'
  | 'building_complete';

export type RelationType = 'friend' | 'best_friend' | 'rival' | 'nemesis' | 'lover' | 'soulmate' | 'mentor' | 'ward';

export type SecretType = 'forbidden_love' | 'corruption' | 'murder_plot' | 'bastard' | 'debt' | 'political_crime' | 'heresy';

export type SchemeType = 'murder' | 'discover_secrets' | 'fabricate_hook' | 'seduce' | 'befriend' | 'sway' | 'claim';

export type DeathCause =
  | 'natural'
  | 'illness'
  | 'battle'
  | 'murder'
  | 'execution'
  | 'accident'
  | 'childbirth'
  | 'duel'
  | 'stress';

export interface ContentDefs {
  traits: TraitDef[];
  buildings: BuildingDef[];
  cultures: CultureDef[];
  faiths: FaithDef[];
  units: UnitDef[];
  events: EventDef[];
}
