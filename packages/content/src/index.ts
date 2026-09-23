import type { ContentDefs, WorldData } from '@ttc/shared';
import worldJson from '../data/world.json';
import { BUILDINGS } from './buildings';
import { CULTURES } from './cultures';
import { EVENTS } from './events';
import { FAITHS } from './faiths';
import { TRAITS } from './traits';
import { UNITS } from './units';

export const WORLD = worldJson as unknown as WorldData;

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
export * from './realm-defs';
export * from './validate';
export { EVENTS } from './events';
export { LOCALE_FR } from './locales/fr';
export { SCENARIOS, getScenario } from './scenarios';
