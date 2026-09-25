/**
 * État de partie. Toutes les collections sont normalisées (Record par id)
 * afin de produire des patches compacts et de sérialiser simplement.
 *
 * GameState = vérité serveur. GameView = ce qu'un joueur reçoit (sans RNG,
 * avec secrets/complots/événements filtrés selon ce que son personnage sait).
 */
import type {
  AiPersonality,
  DeathCause,
  ModifierMap,
  RelationType,
  SchemeType,
  SecretType,
  Skills,
  SkillKey,
  SuccessionLaw,
  UnitType,
} from './content-schema';

export const SAVE_SCHEMA_VERSION = 2;

export type Sex = 'M' | 'F';

export interface Modifier {
  id: string;
  values: ModifierMap;
  /** Jour d'expiration (null = permanent). */
  expires: number | null;
  /** Clé de localisation de la source (affichée dans les tooltips). */
  source: string;
}

export interface OpinionEntry {
  /** Identifiant de raison (clé de localisation « opinion.reason.X »). */
  reason: string;
  value: number;
  expires: number | null;
}

export type CouncilRole = 'chancellor' | 'marshal' | 'steward' | 'spymaster' | 'scholar';
export const COUNCIL_ROLES: readonly CouncilRole[] = ['chancellor', 'marshal', 'steward', 'spymaster', 'scholar'];

export type CouncilTask =
  | 'chancellor_relations'
  | 'chancellor_prestige'
  | 'marshal_train'
  | 'marshal_control'
  | 'steward_taxes'
  | 'steward_develop'
  | 'spymaster_secrets'
  | 'spymaster_disrupt'
  | 'scholar_fervor'
  | 'scholar_develop';

export interface CouncilSeat {
  characterId: string | null;
  task: CouncilTask;
  /** Province ciblée par certaines tâches (développement/contrôle). */
  provinceId?: string | null;
  /** Accumulateur de progression de la tâche. */
  progress: number;
}

export interface Education {
  focus: SkillKey;
  tutorId: string | null;
  /** 0..100, converti en trait d'éducation à 16 ans. */
  progress: number;
}

export interface Pregnancy {
  fatherId: string;
  due: number;
  /** Vrai si le père réel diffère du conjoint (secret de bâtardise). */
  illegitimate: boolean;
}

export interface Character {
  id: string;
  firstName: string;
  houseId: string | null;
  sex: Sex;
  birth: number;
  death: number | null;
  deathCause: DeathCause | null;
  killerId: string | null;
  fatherId: string | null;
  motherId: string | null;
  /** Père légal si différent du père biologique (bâtard caché). */
  realFatherId?: string | null;
  spouseId: string | null;
  formerSpouseIds: string[];
  betrothedId: string | null;
  childIds: string[];
  cultureId: string;
  faithId: string;
  /** Cour où réside le personnage (id du dirigeant), null = errant/indépendant. */
  courtId: string | null;
  liegeId: string | null;
  /** Titres détenus, triés : premier = titre principal. */
  titleIds: string[];
  skills: Skills;
  traits: string[];
  /** Santé 0..10 (5 = bonne santé). */
  health: number;
  fertility: number;
  stress: number;
  gold: number;
  prestige: number;
  fervor: number;
  authority: number;
  /** Niveau d'autorité royale 0..3 (dirigeants). */
  crownAuthority: number;
  portraitSeed: number;
  education: Education | null;
  guardianId: string | null;
  /** Opinions de ce personnage envers d'autres (stockage clairsemé). */
  opinions: Record<string, OpinionEntry[]>;
  modifiers: Modifier[];
  flags: Record<string, number>;
  /** Cooldowns d'événements / interactions : clé → jour de fin. */
  cooldowns: Record<string, number>;
  pregnancy: Pregnancy | null;
  prisonerOf: string | null;
  /** Conseil (dirigeants seulement). */
  council: Record<CouncilRole, CouncilSeat> | null;
  /** Hommes d'armes permanents (hommes par type). */
  maa: Partial<Record<UnitType, number>>;
  /** Titre désigné pour héritier électif, etc. */
  nominatedHeirId: string | null;
  /** Personnalité IA dérivée (mise en cache, recalculée lors de changement de traits). */
  personality: AiPersonality;
  /** Jour de dernière évaluation IA (planificateur). */
  aiNextThink: number;
  /** Un joueur contrôle ce personnage. */
  isPlayer: boolean;
  /** Forme de gouvernement du domaine (dirigeants). */
  government?: string;
  /** Légitimité du dirigeant 0..100. */
  legitimacy?: number;
}

export interface House {
  id: string;
  name: string;
  motto: string;
  dynastyId: string;
  founderId: string | null;
  headId: string | null;
  coaSeed: number;
  /** Couleur de maison (hex). */
  color: string;
  renown: number;
  history: string;
  isMajor: boolean;
  cultureId: string;
}

export interface Dynasty {
  id: string;
  name: string;
  houseIds: string[];
  renown: number;
}

export interface TitleHistoryEntry {
  date: number;
  holderId: string | null;
  how: 'start' | 'inheritance' | 'conquest' | 'granted' | 'revoked' | 'usurped' | 'created' | 'election' | 'independence' | 'destroyed';
}

export interface Title {
  id: string;
  /** Titre existant (créé). Les empires/royaumes peuvent être « non créés ». */
  active: boolean;
  holderId: string | null;
  successionLaw: SuccessionLaw;
  history: TitleHistoryEntry[];
  /** Votes électoraux : électeur → candidat. */
  electionVotes: Record<string, string>;
  /** Contrôleur actuel pour les comtés (occupation militaire). */
  occupiedBy: string | null;
}

export interface Construction {
  buildingId: string;
  level: number;
  startedAt: number;
  completeAt: number;
  cost: number;
}

export interface ProvinceState {
  id: string;
  development: number;
  control: number;
  cultureId: string;
  faithId: string;
  /** Niveaux de bâtiments construits. */
  buildings: Record<string, number>;
  construction: Construction | null;
  /** Levées disponibles actuellement (se régénèrent). */
  levies: number;
  /** Garnison actuelle. */
  garrison: number;
  modifiers: Modifier[];
}

/** Type de sujétion d'une entité envers une autre. */
export type SubjectType = 'direct_vassal' | 'autonomous_vassal' | 'tributary' | 'personal_union' | 'client_state' | 'confederate_member';

/**
 * Contrat de sujétion entre deux titres principaux (il survit aux successions).
 * Les vassaux (direct, autonome, confédéré, union) sont dans le royaume de leur
 * suzerain ; les tributaires et clients restent des royaumes distincts qui
 * versent un tribut et doivent soutenir leur suzerain.
 */
export interface Pact {
  id: string;
  subjectTitleId: string;
  overlordTitleId: string;
  type: SubjectType;
  since: number;
  /** Part du revenu mensuel versée au suzerain (0..1). */
  tribute: number;
  /** Part des levées dues en guerre (0..1). */
  levies: number;
}

export interface Relation {
  id: string;
  a: string;
  b: string;
  type: RelationType;
  since: number;
}

export type ClaimKind = 'strong' | 'weak' | 'inherited' | 'fabricated';

export interface Claim {
  id: string;
  characterId: string;
  titleId: string;
  kind: ClaimKind;
  pressed: boolean;
  createdAt: number;
  expires: number | null;
  origin: string;
}

export interface Alliance {
  id: string;
  a: string;
  b: string;
  reason: 'marriage' | 'pact' | 'family';
  createdAt: number;
  /** Mariage lié à l'alliance (a ↔ b via ces deux personnages). */
  viaMarriage?: [string, string];
}

export type CasusBelli = 'county_claim' | 'duchy_claim' | 'kingdom_claim' | 'independence' | 'claimant' | 'holy_war' | 'conquest' | 'faction';

export interface War {
  id: string;
  cb: CasusBelli;
  attackerId: string;
  defenderId: string;
  attackers: string[];
  defenders: string[];
  targetTitleId: string | null;
  /** Prétendant installé en cas de victoire (guerre de prétendant). */
  claimantId: string | null;
  /** Score de guerre du point de vue de l'attaquant : -100..100. */
  warScore: number;
  /** Composantes du score de guerre. */
  battleScore: number;
  occupationScore: number;
  ticking: number;
  startedAt: number;
  battles: string[];
  /** Pertes cumulées [attaquants, défenseurs]. */
  casualties: [number, number];
  factionId: string | null;
  /** Jour après lequel la guerre est considérée enlisée et forcée à la paix blanche. */
  maxEnd: number;
}

export interface ArmyUnits {
  [unit: string]: number;
}

export type ArmyStatus = 'idle' | 'moving' | 'battle' | 'sieging' | 'retreating';

export interface Army {
  id: string;
  ownerId: string;
  commanderId: string | null;
  location: string;
  /** Chemin restant (provinces suivantes). */
  path: string[];
  /** Jours écoulés vers la prochaine province. */
  moveProgress: number;
  /** Jours nécessaires pour atteindre la prochaine province. */
  moveTotal: number;
  units: Partial<Record<UnitType, number>>;
  morale: number;
  status: ArmyStatus;
  /** Origine des levées : province → hommes (restitués à la dissolution). */
  leviesFrom: Record<string, number>;
  raisedAt: number;
  /** Jours de repos restants après retraite (ne peut pas combattre). */
  shattered: number;
}

export type BattlePhase = 'skirmish' | 'melee' | 'pursuit' | 'ended';

export interface BattleSide {
  armyIds: string[];
  ownerId: string;
  commanderId: string | null;
  startMen: number;
  men: number;
  morale: number;
  casualties: number;
  advantage: number;
}

export interface Battle {
  id: string;
  warId: string;
  provinceId: string;
  startedAt: number;
  day: number;
  phase: BattlePhase;
  attacker: BattleSide;
  defender: BattleSide;
  terrain: string;
  winner: 'attacker' | 'defender' | null;
  endedAt: number | null;
  /** Nom de la bataille (lieu). */
  name: string;
  warScoreDelta: number;
}

export interface Siege {
  id: string;
  warId: string;
  provinceId: string;
  besiegerId: string;
  armyIds: string[];
  progress: number;
  startedAt: number;
  fortLevel: number;
  garrison: number;
}

export type SchemeStatus = 'active' | 'succeeded' | 'failed' | 'cancelled' | 'exposed';

export interface Scheme {
  id: string;
  type: SchemeType;
  ownerId: string;
  targetId: string;
  agents: string[];
  progress: number;
  /** Puissance (progression mensuelle) et résistance calculées à chaque mois. */
  power: number;
  resistance: number;
  /** Secret 0..100 : chance de découverte mensuelle inverse. */
  secrecy: number;
  status: SchemeStatus;
  startedAt: number;
  /** Personnages ayant découvert le complot. */
  discoveredBy: string[];
}

export interface Secret {
  id: string;
  type: SecretType;
  /** Personnage à qui appartient le secret (qui serait compromis). */
  ownerId: string;
  /** Personnage impliqué (amant, victime…). */
  aboutId: string | null;
  knownBy: string[];
  createdAt: number;
  exposed: boolean;
}

export interface Hook {
  id: string;
  ownerId: string;
  targetId: string;
  strong: boolean;
  secretId: string | null;
  createdAt: number;
  expires: number | null;
  /** Utilisable à partir de ce jour. */
  cooldownUntil: number;
}

export type FactionType = 'independence' | 'lower_authority' | 'claimant' | 'autonomy';

export interface Faction {
  id: string;
  type: FactionType;
  targetId: string;
  leaderId: string;
  members: string[];
  claimantId: string | null;
  /** Mécontentement 0..100 : à 100, ultimatum. */
  discontent: number;
  createdAt: number;
  ultimatumSent: boolean;
}

export interface ActiveEvent {
  id: string;
  eventId: string;
  characterId: string;
  scope: { root: string; target?: string | null; other?: string | null; actor?: string | null; provinceId?: string | null };
  createdAt: number;
  expiresAt: number;
  /** Choix disponibles (ids) évalués à la création. */
  available: string[];
}

export interface ScheduledEvent {
  id: string;
  eventId: string;
  characterId: string;
  scope: ActiveEvent['scope'];
  at: number;
}

export type ProposalKind = 'marriage' | 'alliance' | 'vassalize' | 'war_call' | 'white_peace' | 'faction_demand';

/** Proposition entre deux joueurs humains, en attente de réponse. */
export interface Proposal {
  id: string;
  kind: ProposalKind;
  fromId: string;
  toId: string;
  /** Personnages concernés (mariage : [prétendant, candidat]) ou [guerre] / [faction]. */
  subjects: string[];
  /** Levier consommé si la proposition est acceptée. */
  hookId?: string | null;
  createdAt: number;
  expiresAt: number;
}

export type ChronicleKind =
  | 'coronation'
  | 'royal_marriage'
  | 'heir_born'
  | 'ruler_death'
  | 'great_battle'
  | 'war_end'
  | 'war_start'
  | 'title_created'
  | 'usurpation'
  | 'murder_discovered'
  | 'dynasty_end'
  | 'game_start'
  | 'event';

export interface ChronicleEntry {
  id: string;
  date: number;
  kind: ChronicleKind;
  /** Clé de localisation « chronicle.<kind> » + variables. */
  vars: Record<string, string | number>;
  characterIds: string[];
  /** Maison concernée (pour filtrer la chronique dynastique). */
  houseIds: string[];
}

export interface PlayerSlot {
  userId: string;
  displayName: string;
  characterId: string;
  houseId: string;
  joinedAt: number;
  /** Personnages joués successivement. */
  rulers: string[];
  gameOver: boolean;
  stats: DynastyStats;
}

export interface DynastyStats {
  maxCounties: number;
  warsWon: number;
  warsLost: number;
  battlesWon: number;
  descendants: number;
  maxGold: number;
  maxPrestige: number;
  titlesCreated: number;
}

export interface GameSettings {
  maxSpeed: 1 | 2 | 3;
  autosave: boolean;
  aiDifficulty: 'easy' | 'normal' | 'hard';
  eventFrequency: 'low' | 'normal' | 'high';
}

export interface GameState {
  schemaVersion: number;
  gameId: string;
  scenarioId: string;
  seed: number;
  /** État du PRNG xoshiro128** (4 × uint32). */
  rng: [number, number, number, number];
  date: number;
  startDate: number;
  /** Incrémenté à chaque mutation d'état. */
  version: number;
  nextId: number;
  settings: GameSettings;
  players: Record<string, PlayerSlot>;
  characters: Record<string, Character>;
  houses: Record<string, House>;
  dynasties: Record<string, Dynasty>;
  titles: Record<string, Title>;
  provinces: Record<string, ProvinceState>;
  relations: Record<string, Relation>;
  claims: Record<string, Claim>;
  alliances: Record<string, Alliance>;
  wars: Record<string, War>;
  armies: Record<string, Army>;
  battles: Record<string, Battle>;
  sieges: Record<string, Siege>;
  schemes: Record<string, Scheme>;
  secrets: Record<string, Secret>;
  hooks: Record<string, Hook>;
  factions: Record<string, Faction>;
  pacts: Record<string, Pact>;
  activeEvents: Record<string, ActiveEvent>;
  scheduledEvents: Record<string, ScheduledEvent>;
  proposals: Record<string, Proposal>;
  chronicle: ChronicleEntry[];
  /** Nombre de guerres/batailles terminées gardées pour l'historique. */
  flags: Record<string, number>;
}

/** Collections dont le contenu est filtré par joueur. */
export const PRIVATE_COLLECTIONS = ['secrets', 'schemes', 'hooks', 'activeEvents', 'scheduledEvents'] as const;
export type PrivateCollection = (typeof PRIVATE_COLLECTIONS)[number];

/** Vue transmise à un client. */
export type GameView = Omit<GameState, 'rng'>;

export type PrivateView = Pick<GameState, PrivateCollection>;

// ---------------------------------------------------------------------------
// Sorties de simulation (non persistées dans l'état)
// ---------------------------------------------------------------------------

export type NotificationLevel = 'urgent' | 'important' | 'info';

export interface GameNotification {
  id: string;
  date: number;
  level: NotificationLevel;
  /** Clé « notif.<kind> » */
  kind: string;
  vars: Record<string, string | number>;
  /** Personnages destinataires (joueurs). */
  to: string[];
  /** Contexte à ouvrir au clic. */
  focus?: { type: 'character' | 'province' | 'title' | 'war' | 'army' | 'battle' | 'scheme' | 'event'; id: string };
  sound?: SoundKey;
}

export type SoundKey =
  | 'notify'
  | 'event'
  | 'war'
  | 'battle'
  | 'death'
  | 'birth'
  | 'coin'
  | 'confirm'
  | 'error'
  | 'build'
  | 'fanfare';

export interface GameLogEntry {
  date: number;
  type: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  /** null = public ; sinon liste des personnages autorisés. */
  visibleTo: string[] | null;
}

export interface StepOutput {
  notifications: GameNotification[];
  log: GameLogEntry[];
  /** Le jeu doit se mettre en pause (événement majeur pour un joueur). */
  pauseRequested: boolean;
}
