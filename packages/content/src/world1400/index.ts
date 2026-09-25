/**
 * Scénario Monde 1400 : données historiques (entités politiques, cultures,
 * confessions, gouvernements, zones de peuplement, toponymes).
 */
import { POLITIES_AFRICA } from './polities-africa';
import { POLITIES_AMERICAS } from './polities-americas';
import { POLITIES_EAST_ASIA } from './polities-east-asia';
import { POLITIES_EUROPE } from './polities-europe';
import { POLITIES_SOUTH_ASIA } from './polities-south-asia';
import { POLITIES_WEST_ASIA } from './polities-west-asia';
import type { PolitySpec } from './polity-types';

export const POLITIES_1400: PolitySpec[] = [
  ...POLITIES_EUROPE,
  ...POLITIES_WEST_ASIA,
  ...POLITIES_SOUTH_ASIA,
  ...POLITIES_EAST_ASIA,
  ...POLITIES_AFRICA,
  ...POLITIES_AMERICAS,
];

export * from './polity-types';
export * from './governments';
export * from './cultures';
export * from './faiths';
export * from './zones';
export * from './places';
