/**
 * Vérifie le contenu des événements : pour chaque définition, cherche des
 * personnages éligibles dans le scénario, résout chaque choix sur une copie
 * de l'état et contrôle l'absence d'erreur et d'incohérence.
 *
 * Usage : pnpm --filter @ttc/game-core check:events [filtre]
 */
import { CONTENT, getScenario, validateContent } from '@ttc/content';
import type { GameState } from '@ttc/shared';
import { createCtx } from '../src/context';
import { prepareEvent, resolveChoice, availableChoices } from '../src/events/engine';
import { simulateDaysMutable } from '../src/engine';
import { checkInvariants } from '../src/simulate';
import { createGameState } from '../src/state';

const filter = process.argv[2];
const ALLOWED_VARS = new Set(['name', 'fullname', 'title', 'il', 'le', 'e', 'fils', 'seigneur', 'rel', 'house', 'age', 'culture', 'faith', 'realm']);
const SCOPES = new Set(['root', 'target', 'other', 'actor', 'province']);

const contentErrors = validateContent(CONTENT);
const base = createGameState(getScenario('couronne_brisee'), { gameId: 'chk', seed: 7, players: [] });
// Quelques années de simulation pour diversifier les situations (enfants, guerres…).
simulateDaysMutable(base, 365 * 3);

let errors = [...contentErrors];
const warnings: string[] = [];
let tested = 0;
for (const def of CONTENT.events) {
  if (filter && !def.id.includes(filter)) continue;
  // Variables de texte.
  const texts = [def.title, def.text, ...def.choices.map((c) => c.label), ...def.choices.map((c) => c.tooltip ?? '')];
  for (const t of texts) {
    for (const m of t.matchAll(/\{([a-z]+)\.([a-z]+)\}/g)) {
      if (!SCOPES.has(m[1]!) || (m[1] !== 'province' && !ALLOWED_VARS.has(m[2]!)) || (m[1] === 'province' && m[2] !== 'name')) {
        errors.push(`${def.id} : variable inconnue {${m[1]}.${m[2]}}`);
      }
    }
    if (/\{(?![a-z]+\.[a-z]+\})/.test(t)) errors.push(`${def.id} : accolade mal formée dans « ${t.slice(0, 40)}… »`);
  }
  const roots = Object.values(base.characters).filter((c) => c.death === null && (def.rulerOnly === false || c.titleIds.length > 0));
  const probe = createCtx(structuredClone(base));
  const eligible: { root: string; scope: NonNullable<ReturnType<typeof prepareEvent>> }[] = [];
  for (const r of roots) {
    const scope = prepareEvent(probe, def, r.id);
    if (scope) eligible.push({ root: r.id, scope });
  }
  if (!eligible.length) {
    warnings.push(`${def.id} : aucun personnage éligible dans l'échantillon (${def.trigger})`);
    continue;
  }
  for (const { scope } of eligible.slice(0, 3)) {
    const choices = availableChoices(probe, def, scope);
    if (!choices.length) errors.push(`${def.id} : aucun choix disponible pour ${scope.root}`);
    for (const choice of choices) {
      const s: GameState = structuredClone(base);
      const ctx = createCtx(s);
      try {
        resolveChoice(ctx, def, choice, { ...scope });
        tested++;
      } catch (err) {
        errors.push(`${def.id}/${choice.id} : exception ${(err as Error).message}`);
        continue;
      }
      const inv = checkInvariants(s);
      if (inv.length) errors.push(`${def.id}/${choice.id} : ${inv.slice(0, 3).join(' ; ')}`);
      for (const l of ctx.out.log) if (l.type === 'error') errors.push(`${def.id}/${choice.id} : ${JSON.stringify(l.payload)}`);
    }
  }
}
errors = [...new Set(errors)];
console.log(`${CONTENT.events.length} événements, ${tested} résolutions de choix testées.`);
if (warnings.length) {
  console.log(`${warnings.length} avertissement(s) :`);
  for (const w of warnings) console.log(' ~ ' + w);
}
if (errors.length) {
  console.error(`${errors.length} erreur(s) :`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('OK');
