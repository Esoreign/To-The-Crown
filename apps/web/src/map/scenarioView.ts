import type { GameView, ScenarioData } from '@ttc/shared';

/** Vue de jeu minimale construite depuis un scénario (écrans hors partie). */
export function scenarioView(s: ScenarioData): GameView {
  return {
    schemaVersion: 1,
    gameId: 'preview',
    scenarioId: s.id,
    seed: 0,
    date: s.startDate,
    startDate: s.startDate,
    version: 0,
    nextId: s.nextId,
    settings: { maxSpeed: 3, autosave: false, aiDifficulty: 'normal', eventFrequency: 'normal' },
    players: {},
    characters: s.characters,
    houses: s.houses,
    dynasties: s.dynasties,
    titles: s.titles,
    provinces: s.provinces,
    relations: s.relations,
    claims: s.claims,
    alliances: s.alliances,
    wars: s.wars,
    armies: {},
    battles: {},
    sieges: {},
    schemes: {},
    secrets: {},
    hooks: {},
    factions: s.factions,
    activeEvents: {},
    scheduledEvents: {},
    proposals: {},
    chronicle: [],
    flags: {},
  };
}
