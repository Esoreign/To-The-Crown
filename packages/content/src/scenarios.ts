import type { ScenarioData } from '@ttc/shared';
import scenario1087 from '../data/scenario-1087.json';

export const SCENARIOS: Record<string, ScenarioData> = {
  couronne_brisee: scenario1087 as unknown as ScenarioData,
};

export function getScenario(id: string): ScenarioData {
  const s = SCENARIOS[id];
  if (!s) throw new Error(`Scénario inconnu : ${id}`);
  return s;
}
