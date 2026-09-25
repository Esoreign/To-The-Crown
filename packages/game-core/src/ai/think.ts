/**
 * IA heuristique des dirigeants non joueurs. Évaluée périodiquement (≈30
 * jours, étalée) : conseil, éducation, constructions, mariages, titres,
 * diplomatie, complots et déclaration de guerre.
 */
import { COUNCIL_ROLES, SKILL_KEYS, type Character, type CouncilTask, type UnitType } from '@ttc/shared';
import { BALANCE } from '../balance';
import { buildOptions, startConstruction } from '../buildings';
import { ageOf, domainProvinceIds, isAdult, isAlive, skill } from '../characters';
import { safeRun, type Ctx } from '../context';
import { CULTURE_BY_ID, DEJURE_CHILDREN, TITLE_DEFS } from '../content';
import { autoFillCouncil, ROLE_SKILL } from '../council';
import { assignGuardian, canGrantTitle, proposeAlliance, proposeVassalization, evaluateVassalization, grantTitle, sendGift, evaluateAlliance } from '../diplomacy';
import { availableLevies, ledgerOf, militaryStrength } from '../economy';
import { childrenOf, siblingsOf } from '../family';
import { marriageCandidates, proposeMarriage } from '../marriage';
import { alliesOf, opinion, relationsOf } from '../opinion';
import { courtiers, directVassals, domainLimit, isIndependent, neighborRulers, rankOf } from '../realm';
import { SCHEME_DEFS, schemeValidity, startScheme } from '../schemes';
import { canCreateTitle, createTitleWithChronicle, transferTitle } from '../titles';
import { availableCasusBelli, declareWar, warsOf, type CbOption } from '../war';
import { recruitMaa } from '../armies';
import { takeDecision, decisionBlocker } from '../decisions';
import { planSuccession } from '../succession';

function isAiRuler(c: Character | undefined): c is Character {
  return !!c && isAlive(c) && !c.isPlayer && c.titleIds.length > 0 && !c.prisonerOf;
}

export function aiThink(ctx: Ctx, charId: string): void {
  const c = ctx.s.characters[charId];
  if (!isAiRuler(c)) return;
  const steps: ((ctx: Ctx, c: Character) => void)[] = [
    manageCouncil,
    manageEducation,
    manageEconomy,
    manageMarriages,
    manageTitles,
    manageDiplomacy,
    manageSchemes,
    manageStress,
    considerWar,
  ];
  for (const step of steps) {
    // Une décision IA invalide ne doit jamais bloquer la simulation.
    safeRun(ctx, `ai.${step.name}:${charId}`, () => step(ctx, c));
    if (!isAlive(ctx.s.characters[charId])) return;
  }
}

function manageCouncil(ctx: Ctx, c: Character): void {
  autoFillCouncil(ctx.s, c.id);
  const council = c.council;
  if (!council) return;
  const domain = domainProvinceIds(c);
  const lowControl = domain.some((p) => (ctx.r.provinces[p]?.control ?? 100) < 70);
  const vassals = directVassals(ctx.r, c.id);
  const avgOp = vassals.length ? vassals.reduce((acc, v) => acc + opinion(ctx.r, v.id, c.id), 0) / vassals.length : 20;
  const tasks: Record<string, CouncilTask> = {
    chancellor: avgOp < 5 ? 'chancellor_relations' : 'chancellor_prestige',
    marshal: lowControl ? 'marshal_control' : 'marshal_train',
    steward: c.gold < 150 ? 'steward_taxes' : 'steward_develop',
    spymaster: c.personality.intrigue > 20 ? 'spymaster_secrets' : 'spymaster_disrupt',
    scholar: c.personality.zeal > 20 || c.fervor < 50 ? 'scholar_fervor' : 'scholar_develop',
  };
  for (const r of COUNCIL_ROLES) {
    if (council[r].task !== tasks[r]) {
      council[r].task = tasks[r]!;
      council[r].progress = 0;
      council[r].provinceId = null;
    }
  }
  void ROLE_SKILL;
}

function manageEducation(ctx: Ctx, c: Character): void {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  const kids = courtiers(s, c.id).filter((k) => !isAdult(k, s.date) && ageOf(k, s.date) >= 6 && k.education && !k.education.tutorId);
  if (!kids.length) return;
  const tutors = [c, ...courtiers(s, c.id)].filter((t) => isAdult(t, s.date) && !t.isPlayer && !t.prisonerOf);
  for (const kid of kids) {
    const focus = kid.education!.focus;
    const best = [...tutors].sort((a, b) => skill(s, b, focus) + skill(s, b, 'learning') * 0.5 - (skill(s, a, focus) + skill(s, a, 'learning') * 0.5))[0];
    if (best) assignGuardian(ctx, c.id, kid.id, best.id, focus);
  }
  void SKILL_KEYS;
}

const BUILD_PRIORITY: Record<string, number> = {
  farms: 10, market: 9, workshops: 8, mines: 9, port: 9, mills: 7, pastures: 6, lumber_camp: 6, roads: 5,
  barracks: 6, walls: 5, temple: 4, chancery: 5, watchtowers: 3, college: 4, great_hall: 3, stables: 4,
  training_grounds: 3, fortress: 2,
};

function manageEconomy(ctx: Ctx, c: Character): void {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  const ledger = ledgerOf(s, c);
  const reserve = Math.max(BALANCE.ai.constructionReserve, ledger.net * BALANCE.economy.aiEmergencyMonths);
  const atWar = warsOf(s, c.id).length > 0;
  if (c.gold > reserve && !atWar) {
    const options = domainProvinceIds(c)
      .flatMap((pid) => buildOptions(s, pid, c.id).map((o) => ({ pid, o })))
      .filter((x) => x.o.available && c.gold - x.o.cost >= reserve)
      .map((x) => ({ ...x, score: (BUILD_PRIORITY[x.o.def.id] ?? 3) * 10 - x.o.cost / 20 + (c.personality.greed > 30 && x.o.def.category === 'economy' ? 10 : 0) }))
      .sort((a, b) => b.score - a.score);
    const pick = options[0];
    if (pick) startConstruction(ctx, c.id, pick.pid, pick.o.def.id);
  }
  // Hommes d'armes.
  const maaTotal = Object.values(c.maa).reduce((a, b) => a + (b ?? 0), 0);
  const target = rankOf(c) * 250 + (c.personality.aggression > 30 ? 200 : 0);
  if (c.gold > 250 + reserve && maaTotal < target && ledger.net > 1) {
    const culture = CULTURE_BY_ID[c.cultureId];
    const unit: UnitType = culture?.favoredUnit ?? 'footmen';
    recruitMaa(ctx, c.id, unit, 200);
  }
}

function familyToMarry(ctx: Ctx, c: Character): Character[] {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  const pool = [...childrenOf(s, c), ...siblingsOf(s, c)];
  if (!c.spouseId && ageOf(c, s.date) < 55) pool.unshift(c);
  return pool.filter((x) => {
    if (!isAlive(x) || x.spouseId || x.betrothedId || x.isPlayer) return false;
    if (x.id !== c.id && (x.courtId !== c.id || x.titleIds.length)) return false;
    const age = ageOf(x, s.date);
    return age >= 16 ? age < 50 : age >= 11 && ctx.rng.chance(0.2);
  });
}

function manageMarriages(ctx: Ctx, c: Character): void {
  if (!ctx.rng.chance(0.5)) return;
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  const pool = familyToMarry(ctx, c);
  const suitor = pool[0];
  if (!suitor) return;
  const candidates = marriageCandidates(s, c.id, suitor.id, 10, BALANCE.ai.marriageEvaluate).filter((x) => x.acceptance.accept);
  if (!candidates.length) return;
  // Valeur pour nous : rang du décideur, alliance potentielle.
  const scored = candidates
    .map((x) => {
      const cand = s.characters[x.id]!;
      const court = cand.titleIds.length ? cand : s.characters[cand.courtId ?? ''];
      const value = (court ? rankOf(court) * 12 : 0) + x.acceptance.score * 0.3 + (cand.traits.includes('comely') ? 5 : 0) - Math.abs(ageOf(cand, s.date) - ageOf(suitor, s.date));
      return { id: x.id, value };
    })
    .sort((a, b) => b.value - a.value);
  const best = scored[0];
  if (best && best.value > BALANCE.ai.marriageMinScore - 30) proposeMarriage(ctx, c.id, suitor.id, best.id);
}

function manageTitles(ctx: Ctx, c: Character): void {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  // Créer des titres supérieurs.
  const candidates = new Set<string>();
  for (const t of c.titleIds) {
    const parent = TITLE_DEFS[t]?.deJureParentId;
    if (parent) candidates.add(parent);
  }
  for (const t of candidates) {
    if (canCreateTitle(s, c.id, t).ok) {
      createTitleWithChronicle(ctx, c.id, t);
      return;
    }
  }
  // Domaine trop grand : concéder un comté à un membre de la famille ou un courtisan.
  const over = domainProvinceIds(c).length - domainLimit(s, c);
  if (over <= 0) return;
  const heir = planSuccession(s, c).primaryHeirId;
  const recipients = courtiers(s, c.id)
    .filter((x) => isAdult(x, s.date) && !x.isPlayer && x.id !== heir && !x.prisonerOf)
    .sort((a, b) => opinion(s, b.id, c.id) + skill(s, b, 'stewardship') - (opinion(s, a.id, c.id) + skill(s, a, 'stewardship')));
  const to = recipients[0];
  if (!to) return;
  const primaryCap = TITLE_DEFS[c.titleIds[0]!]?.capitalProvinceId;
  const county = c.titleIds.filter((t) => TITLE_DEFS[t]!.rank === 'county' && TITLE_DEFS[t]!.provinceId !== primaryCap).pop();
  if (county && !canGrantTitle(s, c.id, county, to.id)) grantTitle(ctx, c.id, county, to.id, (t, toId, liege) => transferTitle(ctx.s, t, toId, 'granted', { liegeId: liege }));
  void DEJURE_CHILDREN;
}

function manageDiplomacy(ctx: Ctx, c: Character): void {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  const neighbors = neighborRulers(s, c.id);
  if (isIndependent(c) && alliesOf(s, c.id).length < 2 && ctx.rng.chance(0.3)) {
    const options = neighbors
      .filter((n) => !(c.cooldowns[`alliance_${n}`] && c.cooldowns[`alliance_${n}`]! > s.date))
      .slice(0, BALANCE.ai.allianceEvaluate)
      .map((n) => ({ n, acc: evaluateAlliance(s, c.id, n) }))
      .filter((x) => x.acc.accept && !s.characters[x.n]!.isPlayer)
      .sort((a, b) => b.acc.score - a.acc.score);
    if (options[0]) proposeAlliance(ctx, c.id, options[0].n);
  }
  if (isIndependent(c) && c.personality.ambition > 10 && ctx.rng.chance(0.15)) {
    const small = neighbors
      .filter((n) => {
        const t = s.characters[n]!;
        return !t.isPlayer && rankOf(t) < rankOf(c) && !(c.cooldowns[`vassalize_${n}`] && c.cooldowns[`vassalize_${n}`]! > s.date);
      })
      .map((n) => ({ n, acc: evaluateVassalization(s, c.id, n) }))
      .filter((x) => x.acc.accept)
      .sort((a, b) => b.acc.score - a.acc.score);
    if (small[0]) proposeVassalization(ctx, c.id, small[0].n);
  }
  // Cadeau au suzerain ou à un vassal hostile.
  if (c.gold > 300 && c.personality.greed < 20 && ctx.rng.chance(0.2)) {
    const hostile = directVassals(s, c.id)
      .map((v) => ({ v, op: opinion(s, v.id, c.id) }))
      .filter((x) => x.op < -10 && !(c.cooldowns[`gift_${x.v.id}`] && c.cooldowns[`gift_${x.v.id}`]! > s.date))
      .sort((a, b) => a.op - b.op)[0];
    if (hostile) sendGift(ctx, c.id, hostile.v.id, Math.min(150, Math.round(c.gold * 0.15)));
    else if (c.liegeId && opinion(s, c.liegeId, c.id) < 0 && !(c.cooldowns[`gift_${c.liegeId}`] && c.cooldowns[`gift_${c.liegeId}`]! > s.date)) {
      sendGift(ctx, c.id, c.liegeId, Math.min(100, Math.round(c.gold * 0.1)));
    }
  }
}

function manageSchemes(ctx: Ctx, c: Character): void {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  if (!ctx.rng.chance(0.25)) return;
  const active = Object.values(s.schemes).filter((x) => x.ownerId === c.id && x.status === 'active');
  const hasHostile = active.some((x) => SCHEME_DEFS[x.type].hostile);
  const hasPersonal = active.some((x) => !SCHEME_DEFS[x.type].hostile);
  const p = c.personality;
  if (!hasHostile && (p.intrigue > 25 || p.ambition > 40)) {
    const rivals = [...relationsOf(s, c.id, 'rival'), ...relationsOf(s, c.id, 'nemesis')].map((id) => s.characters[id]!).filter(isAlive);
    const target = rivals[0];
    if (target && p.compassion < 0 && p.honor < 20 && ctx.rng.chance(0.4) && !schemeValidity(s, c, target, 'murder')) {
      startScheme(ctx, c.id, 'murder', target.id);
      return;
    }
    const liege = c.liegeId ? s.characters[c.liegeId] : undefined;
    const hookTarget = liege ?? s.characters[neighborRulers(s, c.id)[0] ?? ''];
    if (hookTarget && !schemeValidity(s, c, hookTarget, 'fabricate_hook')) {
      startScheme(ctx, c.id, 'fabricate_hook', hookTarget.id);
      return;
    }
  }
  if (!hasPersonal) {
    const liege = c.liegeId ? s.characters[c.liegeId] : undefined;
    if (liege && opinion(s, liege.id, c.id) < 20 && !schemeValidity(s, c, liege, 'sway')) {
      startScheme(ctx, c.id, 'sway', liege.id);
      return;
    }
    if (p.sociability > 0) {
      const pool = [...directVassals(s, c.id), ...courtiers(s, c.id)].filter((x) => isAdult(x, s.date) && !x.isPlayer);
      const target = pool.length ? ctx.rng.pick(pool) : undefined;
      if (target && !schemeValidity(s, c, target, 'befriend')) startScheme(ctx, c.id, 'befriend', target.id);
    }
  }
}

function manageStress(ctx: Ctx, c: Character): void {
  if (c.stress < 80) return;
  for (const d of ['feast', 'hunt', 'pilgrimage', 'seclusion'] as const) {
    if (!decisionBlocker(ctx.s, c.id, d)) {
      takeDecision(ctx, c.id, d);
      return;
    }
  }
}

const CB_VALUE: Record<string, number> = {
  county_claim: 1,
  holy_war: 1.2,
  conquest: 1,
  duchy_claim: 3,
  kingdom_claim: 6,
  claimant: 3,
  independence: 4,
};

function sideStrength(ctx: Ctx, leaderId: string): number {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  const leader = s.characters[leaderId]!;
  let total = militaryStrength(s, leader);
  for (const a of alliesOf(s, leaderId)) total += militaryStrength(s, s.characters[a]!) * 0.5;
  return total;
}

function considerWar(ctx: Ctx, c: Character): void {
  // Lectures via la vue économe ; toute mutation passe par ctx (ctx.s).
  const s = ctx.r;
  if (warsOf(s, c.id).length) return;
  if (!isAdult(c, s.date)) return;
  const p = c.personality;
  const aggression = p.aggression + p.ambition * 0.5 - p.caution * 0.5;
  const gracePeriod = s.date - s.startDate < 365;
  if (aggression < -40 || !ctx.rng.chance(0.35 + aggression / 300)) return;
  const ledger = ledgerOf(s, c);
  if (c.gold < Math.max(60, ledger.net * BALANCE.ai.warMinGoldMonths)) return;
  const targets = new Set(neighborRulers(s, c.id));
  if (c.liegeId) targets.add(c.liegeId);
  let best: { target: string; opt: CbOption; score: number } | null = null;
  const myStrength = sideStrength(ctx, c.id);
  const difficultyBias = s.settings.aiDifficulty === 'easy' ? 0.3 : s.settings.aiDifficulty === 'hard' ? -0.15 : 0;
  for (const t of targets) {
    const target = s.characters[t];
    if (!target || !isAlive(target)) continue;
    const options = availableCasusBelli(s, c.id, t);
    if (!options.length) continue;
    const theirStrength = sideStrength(ctx, t) + (target.isPlayer ? availableLevies(s, target).total * 0.2 : 0);
    const ratio = myStrength / Math.max(1, theirStrength);
    const required = BALANCE.ai.warPowerRatio - aggression / 250 + difficultyBias + (target.isPlayer && gracePeriod ? 0.4 : 0);
    if (ratio < required) continue;
    for (const opt of options) {
      if (opt.cost?.prestige && c.prestige < opt.cost.prestige) continue;
      if (opt.cost?.fervor && c.fervor < opt.cost.fervor) continue;
      if (opt.cb === 'independence' && p.ambition < 20) continue;
      const score = (CB_VALUE[opt.cb] ?? 1) * 10 + (ratio - required) * 10 + aggression / 10;
      if (!best || score > best.score) best = { target: t, opt, score };
    }
  }
  if (best) declareWar(ctx, c.id, best.target, best.opt.cb, best.opt.titleId, best.opt.claimantId);
}

export { isAiRuler };
