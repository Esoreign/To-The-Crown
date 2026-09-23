import { getScenario } from '@ttc/content';
import type { GameState } from '@ttc/shared';
import { createCtx } from '../src/context';
import { createGameState } from '../src/state';

export const scenario = getScenario('couronne_brisee');

export function newState(seed = 1, players: { userId: string; displayName: string; characterId: string }[] = []): GameState {
  return createGameState(scenario, { gameId: 'test', seed, players });
}

export function ctxFor(state: GameState, dev = false) {
  return createCtx(state, dev);
}

export const rec = (key: string) => scenario.recommended.find((r) => r.tagline && r.characterId && r.description.includes(key))?.characterId;

export function rulerId(nameFragment: string): string {
  const r = scenario.recommended.find((x) => scenario.characters[x.characterId]!.firstName.includes(nameFragment));
  if (!r) throw new Error(`Souverain recommandé introuvable : ${nameFragment}`);
  return r.characterId;
}
