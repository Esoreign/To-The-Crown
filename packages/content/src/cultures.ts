import type { CultureDef } from '@ttc/shared';
import { CULTURES_1400 } from './world1400/cultures';

/** Cultures du scénario Monde 1400 (voir world1400/cultures.ts). */
export const CULTURES: CultureDef[] = CULTURES_1400;

export const CULTURE_BY_ID: Record<string, CultureDef> = Object.fromEntries(CULTURES.map((c) => [c.id, c]));
