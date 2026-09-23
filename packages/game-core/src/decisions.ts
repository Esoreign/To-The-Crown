/**
 * Décisions personnelles : festin, pèlerinage, chasse, tournoi, retraite.
 * Principales soupapes de stress et sources de prestige/ferveur.
 */
import { ErrorCodes, GameError, type DecisionId, type GameView } from '@ttc/shared';
import { addTrait, isAlive } from './characters';
import { log, notify, type Ctx } from './context';
import { addOpinion } from './opinion';
import { directVassals, rankOf } from './realm';
import { addStress, stressForTags } from './stress';

export interface DecisionDef {
  id: DecisionId;
  cost: { gold?: number; prestige?: number; fervor?: number };
  cooldownDays: number;
  minRank: number;
}

export const DECISIONS: Record<DecisionId, DecisionDef> = {
  feast: { id: 'feast', cost: { gold: 80 }, cooldownDays: 730, minRank: 1 },
  pilgrimage: { id: 'pilgrimage', cost: { gold: 60 }, cooldownDays: 1825, minRank: 0 },
  hunt: { id: 'hunt', cost: { gold: 25 }, cooldownDays: 365, minRank: 0 },
  tournament: { id: 'tournament', cost: { gold: 150 }, cooldownDays: 1460, minRank: 2 },
  seclusion: { id: 'seclusion', cost: { prestige: 50 }, cooldownDays: 730, minRank: 0 },
};

export function decisionCost(state: GameView, charId: string, id: DecisionId): DecisionDef['cost'] {
  const c = state.characters[charId];
  const def = DECISIONS[id];
  const r = c ? rankOf(c) : 1;
  const scale = id === 'feast' || id === 'tournament' ? Math.max(1, r) : 1;
  return { gold: def.cost.gold ? def.cost.gold * scale : undefined, prestige: def.cost.prestige, fervor: def.cost.fervor };
}

export function decisionBlocker(state: GameView, charId: string, id: DecisionId): string | null {
  const c = state.characters[charId];
  if (!c || !isAlive(c)) return 'dead';
  const def = DECISIONS[id];
  if (rankOf(c) < def.minRank) return 'rank';
  if (c.prisonerOf) return 'prisoner';
  const cd = c.cooldowns[`decision_${id}`];
  if (cd && cd > state.date) return 'cooldown';
  const cost = decisionCost(state, charId, id);
  if ((cost.gold ?? 0) > c.gold) return 'gold';
  if ((cost.prestige ?? 0) > c.prestige) return 'prestige';
  return null;
}

export function takeDecision(ctx: Ctx, charId: string, id: DecisionId): void {
  const s = ctx.s;
  const why = decisionBlocker(s, charId, id);
  if (why) {
    const code = why === 'gold' ? ErrorCodes.INSUFFICIENT_GOLD : why === 'cooldown' ? ErrorCodes.ON_COOLDOWN : ErrorCodes.REQUIREMENTS_NOT_MET;
    throw new GameError(code, `Décision impossible : ${why}`, { reason: why });
  }
  const c = s.characters[charId]!;
  const cost = decisionCost(s, charId, id);
  c.gold -= cost.gold ?? 0;
  c.prestige -= cost.prestige ?? 0;
  c.cooldowns[`decision_${id}`] = s.date + DECISIONS[id].cooldownDays;
  switch (id) {
    case 'feast':
      c.prestige += 60 + rankOf(c) * 25;
      for (const v of directVassals(s, charId)) addOpinion(s, v.id, charId, 12, 'opinion.reason.feast', 36);
      addStress(ctx, c, -30 + stressForTags(c, ['social']));
      break;
    case 'pilgrimage':
      c.fervor += 150;
      c.prestige += 20;
      addStress(ctx, c, -45 + stressForTags(c, ['pious']));
      break;
    case 'hunt':
      c.prestige += 15;
      addStress(ctx, c, -25 + stressForTags(c, ['brave']));
      if (ctx.rng.chance(0.04)) {
        addTrait(c, 'wounded');
        notify(ctx, [charId], { level: 'important', kind: 'hunt_accident', vars: {}, sound: 'error' });
      }
      break;
    case 'tournament':
      c.prestige += 150 + rankOf(c) * 30;
      for (const v of directVassals(s, charId)) addOpinion(s, v.id, charId, 8, 'opinion.reason.tournament', 36);
      addStress(ctx, c, -20 + stressForTags(c, ['social']));
      break;
    case 'seclusion':
      addStress(ctx, c, -60 + stressForTags(c, ['reclusive']));
      break;
  }
  notify(ctx, [charId], { level: 'info', kind: `decision_${id}`, vars: {}, sound: 'confirm' });
  log(ctx, 'decision', charId, { decision: id });
}
