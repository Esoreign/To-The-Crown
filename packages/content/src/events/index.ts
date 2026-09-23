import type { EventDef } from '@ttc/shared';
import { EVENTS_COURT } from './court';
import { EVENTS_FAMILY } from './family';
import { EVENTS_INTRIGUE } from './intrigue';

/** Tous les événements du jeu (validés au démarrage par validateContent). */
export const EVENTS: EventDef[] = [...EVENTS_FAMILY, ...EVENTS_COURT, ...EVENTS_INTRIGUE];
