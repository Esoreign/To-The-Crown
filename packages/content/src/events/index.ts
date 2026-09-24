import type { EventDef } from '@ttc/shared';
import { EVENTS_COURT, LOC_COURT } from './court';
import { EVENTS_FAMILY, LOC_FAMILY } from './family';
import { EVENTS_INTRIGUE, LOC_INTRIGUE } from './intrigue';

/** Tous les événements du jeu (validés au démarrage par validateContent). */
export const EVENTS: EventDef[] = [...EVENTS_FAMILY, ...EVENTS_COURT, ...EVENTS_INTRIGUE];

/** Libellés des raisons d'opinion et modificateurs introduits par les événements. */
export const EVENTS_LOC: Record<string, string> = { ...LOC_FAMILY, ...LOC_COURT, ...LOC_INTRIGUE };
