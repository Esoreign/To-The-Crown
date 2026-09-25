/**
 * Simulation headless pluriannuelle.
 * Usage : pnpm simulate [années] [graine]
 */
import { getScenario } from '@ttc/content';
import { simulateGame } from '../src/simulate';

const years = Number(process.argv[2] ?? 30);
const seed = Number(process.argv[3] ?? 42);
const { report } = simulateGame(getScenario('monde_1400'), { years, seed, checkEveryMonths: 12 });
const { invariantErrors, ...rest } = report;
console.log(JSON.stringify(rest, null, 2));
if (invariantErrors.length) {
  console.error(`${invariantErrors.length} violation(s) d'invariants :`);
  for (const e of invariantErrors.slice(0, 60)) console.error(' - ' + e);
  process.exit(1);
}
console.log('Invariants respectés.');
