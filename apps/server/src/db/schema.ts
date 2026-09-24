/**
 * Schéma PostgreSQL (Drizzle).
 *
 * - Plateforme : utilisateurs, sessions, parties, joueurs, invitations, chat.
 * - Persistance de partie : snapshots versionnés (JSONB), journal des
 *   commandes (idempotence), journal d'événements (chroniques/audit),
 *   notifications.
 * - Projection relationnelle de l'état de jeu (personnages, titres,
 *   guerres…) réécrite à chaque sauvegarde automatique : requêtable en SQL,
 *   isolée par game_id. La vérité active reste l'état en mémoire de la salle,
 *   le snapshot étant la source de restauration.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------------------
// Plateforme
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    lastLoginAt: ts('last_login_at'),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email), uniqueIndex('users_username_uq').on(sql`lower(${t.username})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    userAgent: text('user_agent'),
  },
  (t) => [uniqueIndex('sessions_token_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    mode: text('mode').notNull(),
    status: text('status').notNull().default('lobby'),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    maxPlayers: integer('max_players').notNull().default(8),
    visibility: text('visibility').notNull().default('private'),
    settings: jsonb('settings').notNull(),
    scenarioId: text('scenario_id').notNull(),
    seed: integer('seed').notNull(),
    gameDate: integer('game_date'),
    version: integer('version').notNull().default(0),
    speed: integer('speed').notNull().default(0),
    playedSeconds: integer('played_seconds').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    startedAt: ts('started_at'),
    lastSavedAt: ts('last_saved_at'),
  },
  (t) => [
    index('games_status_idx').on(t.status),
    index('games_host_idx').on(t.hostId),
    check('games_mode_ck', sql`${t.mode} in ('solo', 'multiplayer')`),
    check('games_status_ck', sql`${t.status} in ('lobby', 'running', 'finished')`),
    check('games_max_players_ck', sql`${t.maxPlayers} between 1 and 8`),
  ],
);

export const gamePlayers = pgTable(
  'game_players',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: text('character_id'),
    ready: boolean('ready').notNull().default(false),
    isHost: boolean('is_host').notNull().default(false),
    joinedAt: ts('joined_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.userId] }),
    uniqueIndex('game_players_character_uq').on(t.gameId, t.characterId),
    index('game_players_user_idx').on(t.userId),
  ],
);

export const gameInvites = pgTable(
  'game_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at'),
  },
  (t) => [uniqueIndex('game_invites_code_uq').on(t.code), index('game_invites_game_idx').on(t.gameId)],
);

export const gameSnapshots = pgTable(
  'game_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    gameDate: integer('game_date').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    reason: text('reason').notNull(),
    state: jsonb('state').notNull(),
    meta: jsonb('meta').notNull().default({}),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('game_snapshots_game_idx').on(t.gameId, t.id)],
);

export const gameCommands = pgTable(
  'game_commands',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    commandId: text('command_id').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    characterId: text('character_id'),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull(),
    errorCode: text('error_code'),
    gameVersion: integer('game_version').notNull(),
    gameDate: integer('game_date').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('game_commands_uq').on(t.gameId, t.commandId), index('game_commands_game_idx').on(t.gameId, t.id)],
);

export const gameEventLog = pgTable(
  'game_event_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    dateInGame: integer('date_in_game').notNull(),
    type: text('type').notNull(),
    actorId: text('actor_id'),
    payload: jsonb('payload').notNull(),
    visibleTo: jsonb('visible_to'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('game_event_log_game_idx').on(t.gameId, t.sequence), index('game_event_log_type_idx').on(t.gameId, t.type)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('chat_messages_game_idx').on(t.gameId, t.createdAt), check('chat_len_ck', sql`char_length(${t.text}) between 1 and 500`)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: text('character_id').notNull(),
    level: text('level').notNull(),
    kind: text('kind').notNull(),
    vars: jsonb('vars').notNull(),
    focus: jsonb('focus'),
    dateInGame: integer('date_in_game').notNull(),
    read: boolean('read').notNull().default(false),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_game_idx').on(t.gameId, t.userId, t.id)],
);

// ---------------------------------------------------------------------------
// Données de référence
// ---------------------------------------------------------------------------
export const cultures = pgTable('cultures', {
  id: text('id').primaryKey(),
  region: text('region').notNull(),
  color: text('color').notNull(),
  succession: text('succession').notNull(),
});

export const faiths = pgTable('faiths', {
  id: text('id').primaryKey(),
  family: text('family').notNull(),
  color: text('color').notNull(),
  doctrines: jsonb('doctrines').notNull(),
});

// ---------------------------------------------------------------------------
// Projection relationnelle de l'état de partie (isolée par game_id)
// ---------------------------------------------------------------------------
const gameRef = () =>
  uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' });

export const dynasties = pgTable(
  'dynasties',
  { gameId: gameRef(), id: text('id').notNull(), name: text('name').notNull(), renown: doublePrecision('renown').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);

export const houses = pgTable(
  'houses',
  {
    gameId: gameRef(),
    id: text('id').notNull(),
    dynastyId: text('dynasty_id').notNull(),
    name: text('name').notNull(),
    motto: text('motto').notNull(),
    headId: text('head_id'),
    renown: doublePrecision('renown').notNull(),
    isMajor: boolean('is_major').notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.id] }), index('houses_dynasty_idx').on(t.gameId, t.dynastyId)],
);

export const characters = pgTable(
  'characters',
  {
    gameId: gameRef(),
    id: text('id').notNull(),
    firstName: text('first_name').notNull(),
    houseId: text('house_id'),
    sex: text('sex').notNull(),
    birth: integer('birth').notNull(),
    death: integer('death'),
    fatherId: text('father_id'),
    motherId: text('mother_id'),
    spouseId: text('spouse_id'),
    liegeId: text('liege_id'),
    courtId: text('court_id'),
    cultureId: text('culture_id').notNull(),
    faithId: text('faith_id').notNull(),
    primaryTitleId: text('primary_title_id'),
    gold: doublePrecision('gold').notNull(),
    prestige: doublePrecision('prestige').notNull(),
    health: doublePrecision('health').notNull(),
    stress: doublePrecision('stress').notNull(),
    isPlayer: boolean('is_player').notNull(),
    alive: boolean('alive').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.id] }),
    index('characters_house_idx').on(t.gameId, t.houseId),
    index('characters_liege_idx').on(t.gameId, t.liegeId),
    index('characters_alive_idx').on(t.gameId, t.alive),
  ],
);

export const characterTraits = pgTable(
  'character_traits',
  { gameId: gameRef(), characterId: text('character_id').notNull(), traitId: text('trait_id').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.characterId, t.traitId] })],
);

export const relationships = pgTable(
  'relationships',
  { gameId: gameRef(), id: text('id').notNull(), a: text('a').notNull(), b: text('b').notNull(), type: text('type').notNull(), since: integer('since').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] }), index('relationships_a_idx').on(t.gameId, t.a), index('relationships_b_idx').on(t.gameId, t.b)],
);

export const marriages = pgTable(
  'marriages',
  { gameId: gameRef(), husbandId: text('husband_id').notNull(), wifeId: text('wife_id').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.husbandId, t.wifeId] })],
);

export const titles = pgTable(
  'titles',
  {
    gameId: gameRef(),
    id: text('id').notNull(),
    rank: text('rank').notNull(),
    holderId: text('holder_id'),
    deJureParentId: text('de_jure_parent_id'),
    successionLaw: text('succession_law').notNull(),
    active: boolean('active').notNull(),
    occupiedBy: text('occupied_by'),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.id] }), index('titles_holder_idx').on(t.gameId, t.holderId)],
);

export const titleClaims = pgTable(
  'title_claims',
  { gameId: gameRef(), id: text('id').notNull(), characterId: text('character_id').notNull(), titleId: text('title_id').notNull(), kind: text('kind').notNull(), pressed: boolean('pressed').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] }), index('title_claims_char_idx').on(t.gameId, t.characterId)],
);

export const successionVotes = pgTable(
  'succession_votes',
  { gameId: gameRef(), titleId: text('title_id').notNull(), electorId: text('elector_id').notNull(), candidateId: text('candidate_id').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.titleId, t.electorId] })],
);

export const provinces = pgTable(
  'provinces',
  {
    gameId: gameRef(),
    id: text('id').notNull(),
    holderId: text('holder_id'),
    development: doublePrecision('development').notNull(),
    control: doublePrecision('control').notNull(),
    cultureId: text('culture_id').notNull(),
    faithId: text('faith_id').notNull(),
    levies: integer('levies').notNull(),
    garrison: integer('garrison').notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.id] }), index('provinces_holder_idx').on(t.gameId, t.holderId)],
);

/** Possessions : bâtiments construits par province. */
export const buildings = pgTable(
  'buildings',
  { gameId: gameRef(), provinceId: text('province_id').notNull(), buildingId: text('building_id').notNull(), level: integer('level').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.provinceId, t.buildingId] })],
);

export const constructionQueues = pgTable(
  'construction_queues',
  {
    gameId: gameRef(),
    provinceId: text('province_id').notNull(),
    buildingId: text('building_id').notNull(),
    level: integer('level').notNull(),
    startedAt: integer('started_at').notNull(),
    completeAt: integer('complete_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.provinceId] })],
);

export const vassalContracts = pgTable(
  'vassal_contracts',
  { gameId: gameRef(), vassalId: text('vassal_id').notNull(), liegeId: text('liege_id').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.vassalId] }), index('vassal_contracts_liege_idx').on(t.gameId, t.liegeId)],
);

export const alliances = pgTable(
  'alliances',
  { gameId: gameRef(), id: text('id').notNull(), a: text('a').notNull(), b: text('b').notNull(), reason: text('reason').notNull(), createdAt: integer('created_at').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);

export const wars = pgTable(
  'wars',
  {
    gameId: gameRef(),
    id: text('id').notNull(),
    cb: text('cb').notNull(),
    attackerId: text('attacker_id').notNull(),
    defenderId: text('defender_id').notNull(),
    targetTitleId: text('target_title_id'),
    warScore: integer('war_score').notNull(),
    startedAt: integer('started_at').notNull(),
    status: text('status').notNull().default('active'),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.id] }), index('wars_status_idx').on(t.gameId, t.status)],
);

export const warParticipants = pgTable(
  'war_participants',
  { gameId: gameRef(), warId: text('war_id').notNull(), characterId: text('character_id').notNull(), side: text('side').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.warId, t.characterId] })],
);

export const armies = pgTable(
  'armies',
  { gameId: gameRef(), id: text('id').notNull(), ownerId: text('owner_id').notNull(), location: text('location').notNull(), men: integer('men').notNull(), status: text('status').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] }), index('armies_owner_idx').on(t.gameId, t.ownerId)],
);

export const armyRegiments = pgTable(
  'army_regiments',
  { gameId: gameRef(), armyId: text('army_id').notNull(), unit: text('unit').notNull(), men: integer('men').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.armyId, t.unit] })],
);

export const battles = pgTable(
  'battles',
  {
    gameId: gameRef(),
    id: text('id').notNull(),
    warId: text('war_id').notNull(),
    provinceId: text('province_id').notNull(),
    winner: text('winner'),
    attackerMen: integer('attacker_men').notNull(),
    defenderMen: integer('defender_men').notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);

export const sieges = pgTable(
  'sieges',
  { gameId: gameRef(), id: text('id').notNull(), provinceId: text('province_id').notNull(), besiegerId: text('besieger_id').notNull(), progress: doublePrecision('progress').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);

export const schemes = pgTable(
  'schemes',
  {
    gameId: gameRef(),
    id: text('id').notNull(),
    type: text('type').notNull(),
    ownerId: text('owner_id').notNull(),
    targetId: text('target_id').notNull(),
    progress: doublePrecision('progress').notNull(),
    status: text('status').notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);

export const schemeAgents = pgTable(
  'scheme_agents',
  { gameId: gameRef(), schemeId: text('scheme_id').notNull(), characterId: text('character_id').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.schemeId, t.characterId] })],
);

export const secrets = pgTable(
  'secrets',
  { gameId: gameRef(), id: text('id').notNull(), type: text('type').notNull(), ownerId: text('owner_id').notNull(), exposed: boolean('exposed').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);

export const hooks = pgTable(
  'hooks',
  { gameId: gameRef(), id: text('id').notNull(), ownerId: text('owner_id').notNull(), targetId: text('target_id').notNull(), strong: boolean('strong').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);

export const councilPositions = pgTable(
  'council_positions',
  { gameId: gameRef(), rulerId: text('ruler_id').notNull(), role: text('role').notNull(), characterId: text('character_id'), task: text('task').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.rulerId, t.role] })],
);

export const activeEvents = pgTable(
  'active_events',
  { gameId: gameRef(), id: text('id').notNull(), eventId: text('event_id').notNull(), characterId: text('character_id').notNull(), expiresAt: integer('expires_at').notNull() },
  (t) => [primaryKey({ columns: [t.gameId, t.id] })],
);
