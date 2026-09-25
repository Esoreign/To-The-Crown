import { getScenario } from '@ttc/content';
import type { Character, GameState, Sex } from '@ttc/shared';
import { createCtx } from '../src/context';
import { createGameState } from '../src/state';
import { ageOf } from '../src/characters';

export const scenario = getScenario('monde_1400');

export function newState(seed = 1, players: { userId: string; displayName: string; characterId: string }[] = []): GameState {
  return createGameState(scenario, { gameId: 'test', seed, players });
}

export function ctxFor(state: GameState, dev = false) {
  return createCtx(state, dev);
}

/** Dirigeant d'une entité historique du scénario (ex. 'fra', 'cas', 'tim'). */
export function rulerOf(polityId: string): string {
  const info = scenario.polities?.[polityId];
  const holder = info ? scenario.titles[info.titleId]?.holderId : null;
  if (!holder) throw new Error(`Entité sans dirigeant : ${polityId}`);
  return holder;
}

const alive = (c: Character) => c.death === null;

/** Premier dirigeant (ordre stable) satisfaisant un critère. */
export function findRuler(pred: (c: Character) => boolean): string {
  const c = Object.values(scenario.characters)
    .filter((x) => alive(x) && x.titleIds.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .find(pred);
  if (!c) throw new Error('Aucun dirigeant ne correspond');
  return c.id;
}

export function unmarriedRuler(sex: Sex): string {
  return findRuler((c) => c.sex === sex && !c.spouseId && !c.betrothedId && ageOf(c, scenario.startDate) >= 18 && ageOf(c, scenario.startDate) <= 45);
}
