/**
 * Création d'une partie à partir d'un scénario.
 */
import {
  ErrorCodes,
  GameError,
  SAVE_SCHEMA_VERSION,
  type GameSettings,
  type GameState,
  type ScenarioData,
} from '@ttc/shared';
import { computePersonality, isAlive } from './characters';
import { seedRng } from './rng';
import { emptyStats } from './stats';

export interface NewPlayer {
  userId: string;
  displayName: string;
  characterId: string;
}

export const DEFAULT_SETTINGS: GameSettings = { maxSpeed: 3, autosave: true, aiDifficulty: 'normal', eventFrequency: 'normal' };

export function isPlayableCharacter(scenario: Pick<ScenarioData, 'characters'>, id: string): boolean {
  const c = scenario.characters[id];
  return !!c && isAlive(c) && c.titleIds.length > 0 && c.birth <= Number.MAX_SAFE_INTEGER;
}

export function createGameState(
  scenario: ScenarioData,
  opts: { gameId: string; seed: number; settings?: Partial<GameSettings>; players: NewPlayer[] },
): GameState {
  const data = structuredClone(scenario);
  const state: GameState = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameId: opts.gameId,
    scenarioId: scenario.id,
    seed: opts.seed,
    rng: seedRng(opts.seed),
    date: scenario.startDate,
    startDate: scenario.startDate,
    version: 0,
    nextId: data.nextId,
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
    players: {},
    characters: data.characters,
    houses: data.houses,
    dynasties: data.dynasties,
    titles: data.titles,
    provinces: data.provinces,
    relations: data.relations,
    claims: data.claims,
    alliances: data.alliances,
    wars: data.wars,
    armies: {},
    battles: {},
    sieges: {},
    schemes: {},
    secrets: data.secrets,
    hooks: data.hooks,
    factions: data.factions,
    activeEvents: {},
    scheduledEvents: {},
    proposals: {},
    chronicle: [],
    flags: {},
  };
  for (const c of Object.values(state.characters)) {
    c.personality = computePersonality(c.traits);
    c.isPlayer = false;
  }
  const taken = new Set<string>();
  for (const p of opts.players) {
    if (!isPlayableCharacter(state, p.characterId)) throw new GameError(ErrorCodes.CHARACTER_NOT_PLAYABLE, 'Personnage non jouable');
    if (taken.has(p.characterId)) throw new GameError(ErrorCodes.CHARACTER_TAKEN, 'Personnage déjà choisi');
    taken.add(p.characterId);
    const c = state.characters[p.characterId]!;
    c.isPlayer = true;
    c.aiNextThink = Number.MAX_SAFE_INTEGER;
    state.players[p.userId] = {
      userId: p.userId,
      displayName: p.displayName,
      characterId: p.characterId,
      houseId: c.houseId ?? '',
      joinedAt: state.date,
      rulers: [p.characterId],
      gameOver: false,
      stats: emptyStats(),
    };
  }
  // Guerres de départ : les participants IA réfléchissent immédiatement.
  for (const w of Object.values(state.wars)) {
    for (const id of [...w.attackers, ...w.defenders]) {
      const c = state.characters[id];
      if (c && !c.isPlayer) c.aiNextThink = state.date + 1;
    }
  }
  state.chronicle.push({
    id: 'chr_start',
    date: state.date,
    kind: 'game_start',
    vars: { scenario: scenario.id },
    characterIds: opts.players.map((p) => p.characterId),
    houseIds: opts.players.map((p) => state.characters[p.characterId]!.houseId ?? '').filter(Boolean),
  });
  return state;
}
