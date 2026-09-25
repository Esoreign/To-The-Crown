import type { ContentDefs, WorldData } from '@ttc/shared';
import { BUILDINGS } from './buildings';
import { CULTURES } from './cultures';
import { EVENTS } from './events';
import { FAITHS } from './faiths';
import { TRAITS } from './traits';
import { UNITS } from './units';
import { WORLD_1400 } from './world1400/world';

export const WORLD: WorldData = WORLD_1400;

export const CONTENT: ContentDefs = {
  traits: TRAITS,
  buildings: BUILDINGS,
  cultures: CULTURES,
  faiths: FAITHS,
  units: UNITS,
  events: EVENTS,
};

export * from './buildings';
export * from './cultures';
export * from './faiths';
export * from './traits';
export * from './units';
export * from './validate';
export { EVENTS } from './events';
export { LOCALE_FR } from './locales/fr';
export { SCENARIO_IDS, DEFAULT_SCENARIO_ID, getScenario } from './scenarios';
export { START_1400 } from './world1400/scenario';
export { GOVERNMENTS, GOVERNMENT_BY_ID, type GovernmentDef, type GovernmentId } from './world1400/governments';
export type { HistoricalConfidence, SubjectType as PolitySubjectType } from './world1400/polity-types';
