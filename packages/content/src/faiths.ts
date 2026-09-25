import type { FaithDef } from '@ttc/shared';
import { FAITHS_1400 } from './world1400/faiths';

/** Confessions du scénario Monde 1400 (voir world1400/faiths.ts). */
export const FAITHS: FaithDef[] = FAITHS_1400;

export const FAITH_BY_ID: Record<string, FaithDef> = Object.fromEntries(FAITHS.map((f) => [f.id, f]));
