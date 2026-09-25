/**
 * Façade transactionnelle : chaque étape (jour ou commande) est une
 * transaction Immer. En cas d'erreur, l'état n'est pas modifié ; en cas de
 * succès, on obtient le nouvel état et la liste des patches.
 */
import { enablePatches, produceWithPatches, setAutoFreeze, type Patch } from 'immer';
import type { GameCommand, GameState, StepOutput } from '@ttc/shared';
import { applyCommand, type CommandResult } from './commands';
import { createCtx } from './context';
import { advanceDay } from './tick';

enablePatches();
// L'état est traité comme immuable par convention ; le gel profond coûte cher
// sur un état de ~1 Mo produit plusieurs fois par seconde.
setAutoFreeze(false);

export interface StepResult {
  state: GameState;
  patches: Patch[];
  output: StepOutput;
}

export interface CommandStepResult extends StepResult {
  result: CommandResult;
}

export function stepDay(state: GameState, opts: { dev?: boolean } = {}): StepResult {
  let output: StepOutput | null = null;
  const [next, patches] = produceWithPatches(state, (draft) => {
    const ctx = createCtx(draft as GameState, opts.dev);
    advanceDay(ctx);
    ctx.flush();
    draft.version += 1;
    output = ctx.out;
  });
  return { state: next, patches, output: output! };
}

export function runCommand(state: GameState, actorCharacterId: string, cmd: GameCommand, opts: { dev?: boolean } = {}): CommandStepResult {
  let output: StepOutput | null = null;
  let result: CommandResult = {};
  const [next, patches] = produceWithPatches(state, (draft) => {
    const ctx = createCtx(draft as GameState, opts.dev);
    result = applyCommand(ctx, actorCharacterId, cmd);
    ctx.flush();
    draft.version += 1;
    output = ctx.out;
  });
  return { state: next, patches, output: output!, result };
}

/** Avance plusieurs jours en mode mutable (simulation headless, tests). */
export function simulateDaysMutable(state: GameState, days: number, dev = false): StepOutput[] {
  const outs: StepOutput[] = [];
  for (let i = 0; i < days; i++) {
    const ctx = createCtx(state, dev);
    advanceDay(ctx);
    state.version += 1;
    outs.push(ctx.out);
  }
  return outs;
}
