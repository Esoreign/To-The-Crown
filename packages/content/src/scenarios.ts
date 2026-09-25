import type { ScenarioData } from '@ttc/shared';
import { scenario1400 } from './world1400/scenario';

/** Scénarios disponibles (construits à la demande). */
export const SCENARIO_IDS = ['monde_1400'] as const;
export const DEFAULT_SCENARIO_ID = 'monde_1400';

export function getScenario(id: string): ScenarioData {
  if (id === 'monde_1400') return scenario1400();
  throw new Error(`Scénario inconnu : ${id}`);
}
