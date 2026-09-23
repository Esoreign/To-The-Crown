/**
 * Stress : agir contre sa personnalité coûte ; les paliers déclenchent des
 * crises (événements on:stress_crisis).
 */
import type { Character, StressTag } from '@ttc/shared';
import { BALANCE } from './balance';
import { characterModifier, stressLevel } from './characters';
import { TRAIT_BY_ID } from './content';
import type { Ctx } from './context';
import { fireOnAction } from './events/engine';

/** Stress impliqué par une action portant ces tags (positif = stress). */
export function stressForTags(c: Character, tags: StressTag[] | undefined): number {
  if (!tags?.length) return 0;
  let total = 0;
  for (const t of c.traits) {
    const map = TRAIT_BY_ID[t]?.stressTags;
    if (!map) continue;
    for (const tag of tags) total += map[tag] ?? 0;
  }
  return total;
}

export function addStress(ctx: Ctx, c: Character, amount: number): void {
  if (!amount) return;
  const before = stressLevel(c);
  let delta = amount;
  if (amount > 0) delta *= Math.max(0.2, 1 + characterModifier(ctx.s, c, 'stress_gain_mult'));
  c.stress = Math.max(0, Math.min(BALANCE.stress.max, c.stress + delta));
  const after = stressLevel(c);
  if (after > before) {
    c.flags.stress_crisis_level = after;
    fireOnAction(ctx, 'stress_crisis', c.id, {});
  }
}
