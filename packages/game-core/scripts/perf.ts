/**
 * Mesure du coût d'un jour de simulation sur le scénario Monde 1400.
 * Usage : pnpm --filter @ttc/game-core perf
 */
import { getScenario } from '@ttc/content';
import { createGameState, stepDay } from '../src/index';
const sc = getScenario('monde_1400');
let t = performance.now();
let state = createGameState(sc, { gameId: 'g', seed: 7, players: [] });
console.log('create ms', (performance.now() - t).toFixed(0), 'state MB', (JSON.stringify(state).length / 1e6).toFixed(2));
const times: number[] = [];
for (let d = 0; d < 60; d++) {
  t = performance.now();
  const r = stepDay(state);
  state = r.state;
  times.push(performance.now() - t);
  const errs = r.output.log.filter((l) => l.type === 'error');
  if (errs.length) console.log('errors day', d, errs.slice(0, 3).map((e) => JSON.stringify(e.payload).slice(0, 300)));
}
times.sort((a, b) => a - b);
console.log('stepDay median', times[30]!.toFixed(1), 'p95', times[57]!.toFixed(1), 'max', times[59]!.toFixed(1));
console.log('wars', Object.keys(state.wars).length, 'armies', Object.keys(state.armies).length, 'alive', Object.values(state.characters).filter((c) => c.death === null).length);
