/**
 * IA militaire : levée, choix des cibles (armées faibles, objectifs de guerre,
 * libération), retraite face à une force supérieure, négociation de paix.
 */
import type { Army, Character, GameState, War } from '@ttc/shared';
import { armyMen, findPath, mergeArmies, orderMove, raiseArmy, disbandArmy } from '../armies';
import { isAlive } from '../characters';
import { safeRun, type Ctx } from '../context';
import { PROVINCE_GEO } from '../content';
import { availableLevies } from '../economy';
import { capitalProvinceOf, holderOfProvince, realmProvinceIds, topLiegeId } from '../realm';
import { canEnforce, offerPeace, sideOf, warGoalProvinces, warsOf } from '../war';

function dist(a: string, b: string): number {
  const ga = PROVINCE_GEO[a]!;
  const gb = PROVINCE_GEO[b]!;
  return Math.hypot(ga.centroid[0] - gb.centroid[0], ga.centroid[1] - gb.centroid[1]);
}

function enemiesOf(state: GameState, charId: string): Set<string> {
  const out = new Set<string>();
  for (const w of warsOf(state, charId)) {
    const side = sideOf(w, charId);
    for (const e of side === 'attacker' ? w.defenders : w.attackers) out.add(e);
  }
  return out;
}

function peaceLogic(ctx: Ctx, c: Character, war: War): void {
  const s = ctx.s;
  const side = sideOf(war, c.id);
  const leader = side === 'attacker' ? war.attackerId : war.defenderId;
  if (leader !== c.id) return;
  const cd = c.cooldowns[`peace_${war.id}`];
  if (cd && cd > s.date) return;
  const myScore = side === 'attacker' ? war.warScore : -war.warScore;
  const years = (s.date - war.startedAt) / 365;
  if (canEnforce(war, c.id)) {
    offerPeace(ctx, c.id, war.id, 'enforce');
    return;
  }
  if (myScore <= -90 && years > 0.4) {
    offerPeace(ctx, c.id, war.id, 'surrender');
    return;
  }
  if ((years > 2 && myScore < -25) || (years > 3.5 && myScore < 40)) {
    offerPeace(ctx, c.id, war.id, 'white');
  }
}

export function aiWarTick(ctx: Ctx, charId: string): void {
  const s = ctx.s;
  const c = s.characters[charId];
  if (!c || !isAlive(c) || c.isPlayer || !c.titleIds.length) return;
  const wars = warsOf(s, charId);
  const myArmies = Object.values(s.armies).filter((a) => a.ownerId === charId);
  if (!wars.length) {
    // Paix : démobiliser.
    for (const a of myArmies) if (a.status !== 'battle') disbandArmy(ctx, charId, a.id);
    return;
  }
  for (const w of wars) {
    safeRun(ctx, `ai.peace:${w.id}`, () => peaceLogic(ctx, c, w));
  }
  if (!warsOf(s, charId).length) return;
  // Lever les troupes.
  if (!myArmies.length || availableLevies(s, c).total > 600) {
    try {
      raiseArmy(ctx, charId);
    } catch {
      /* aucune troupe disponible */
    }
  }
  // Fusionner les armées colocalisées.
  const armies = Object.values(s.armies).filter((a) => a.ownerId === charId);
  for (const a of armies) {
    const other = armies.find((b) => b.id !== a.id && b.location === a.location && s.armies[b.id] && s.armies[a.id] && b.status !== 'battle' && a.status !== 'battle');
    if (other) mergeArmies(ctx, charId, a.id, other.id);
  }
  for (const a of Object.values(s.armies)) {
    if (a.ownerId !== charId) continue;
    safeRun(ctx, `ai.steer:${a.id}`, () => steerArmy(ctx, c, a));
  }
}

function steerArmy(ctx: Ctx, c: Character, a: Army): void {
  const s = ctx.s;
  if (a.status === 'battle' || a.status === 'retreating' || a.shattered > 0) return;
  if (a.status === 'moving' && a.path.length > 0 && ctx.rng.chance(0.7)) return;
  const enemies = enemiesOf(s, c.id);
  const men = armyMen(a);
  const enemyArmies = Object.values(s.armies).filter((e) => enemies.has(e.ownerId) && e.shattered <= 0);
  // Menace supérieure proche : retraite vers la capitale.
  const threat = enemyArmies
    .filter((e) => armyMen(e) > men * 1.35 && dist(e.location, a.location) < 700)
    .sort((x, y) => dist(x.location, a.location) - dist(y.location, a.location))[0];
  const home = capitalProvinceOf(c);
  if (threat && home && a.location !== home) {
    orderMove(ctx, c.id, a.id, home);
    return;
  }
  // Cible faible à portée : interception.
  const prey = enemyArmies
    .filter((e) => armyMen(e) < men * 0.9 && dist(e.location, a.location) < 900)
    .sort((x, y) => dist(x.location, a.location) - dist(y.location, a.location))[0];
  if (prey) {
    if (prey.location !== a.location) orderMove(ctx, c.id, a.id, prey.location);
    return;
  }
  if (a.status === 'sieging') return;
  // Libérer nos provinces occupées.
  const mine = realmProvinceIds(s, topLiegeId(s, c.id));
  const occupied = mine.filter((p) => {
    const occ = s.titles[PROVINCE_GEO[p]!.countyTitleId]?.occupiedBy;
    return occ && enemies.has(occ);
  });
  // Objectifs de guerre / provinces ennemies.
  const targets: string[] = [...occupied];
  for (const w of warsOf(s, c.id)) {
    const side = sideOf(w, c.id);
    if (side === 'attacker') targets.push(...warGoalProvinces(s, w));
    const enemyLeaders = side === 'attacker' ? w.defenders : w.attackers;
    for (const e of enemyLeaders) targets.push(...realmProvinceIds(s, e).slice(0, 12));
  }
  const candidates = [...new Set(targets)].filter((p) => {
    const occ = s.titles[PROVINCE_GEO[p]!.countyTitleId]?.occupiedBy;
    if (occ && !enemies.has(occ) && occupied.indexOf(p) < 0) return false;
    const holder = holderOfProvince(s, p);
    if (!holder) return false;
    // Pas de doublon : une autre armée alliée assiège déjà.
    return !Object.values(s.sieges).some((sg) => sg.provinceId === p && !enemies.has(sg.besiegerId));
  });
  candidates.sort((x, y) => dist(x, a.location) - dist(y, a.location));
  const goal = candidates[0];
  if (goal && goal !== a.location && findPath(a.location, goal)) orderMove(ctx, c.id, a.id, goal);
}
