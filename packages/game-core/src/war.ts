/**
 * Guerres : casus belli, déclaration, alliés, score de guerre, paix.
 */
import { ErrorCodes, GameError, type CasusBelli, type GameState, type GameView, type War } from '@ttc/shared';
import { hasPendingProposal } from './pending';
import { BALANCE } from './balance';
import { allowsVassalWars, endPactsBetween, isExternalPact, pactsAsSubject } from './politics';
import { acceptance, type Acceptance, type AcceptRow } from './acceptance';
import { isAdult, isAlive } from './characters';
import { chronicle, log, newId, notify, type Ctx } from './context';
import { DEJURE_PROVINCES, FAITH_BY_ID, PROVINCE_GEO, TITLE_DEFS } from './content';
import { fireOnAction } from './events/engine';
import { militaryStrength } from './economy';
import { addOpinion, alliesOf, areAllied, atWarWith, opinion } from './opinion';
import { directVassals, holderOfProvince, isInRealmOf, neighborRulers, rankOf, realmProvinceIds, topLiegeId } from './realm';
import { fixRankConsistency, isDeJureAncestor, transferTitle } from './titles';
import { courtiers } from './realm';
import { bumpStructure, getIndex } from './index-cache';

export interface CbOption {
  cb: CasusBelli;
  titleId: string | null;
  claimantId: string | null;
  cost?: { prestige?: number; fervor?: number };
}

export function warsOf(state: Pick<GameView, 'wars' | 'characters' | 'relations' | 'alliances' | 'houses'>, charId: string): War[] {
  return (getIndex(state).warsByChar.get(charId) ?? []).filter((w) => !!state.wars[w.id]);
}

export function sideOf(war: War, charId: string): 'attacker' | 'defender' | null {
  if (war.attackers.includes(charId)) return 'attacker';
  if (war.defenders.includes(charId)) return 'defender';
  return null;
}

/** Deux personnages sont-ils ennemis dans une guerre en cours ? Renvoie la guerre. */
export function hostileWar(state: Pick<GameView, 'wars'>, a: string, b: string): War | null {
  for (const w of Object.values(state.wars)) {
    const sa = sideOf(w, a);
    const sb = sideOf(w, b);
    if (sa && sb && sa !== sb) return w;
  }
  return null;
}

function truceActive(state: GameView, a: string, b: string): boolean {
  const ca = state.characters[a]?.cooldowns[`truce_${b}`];
  return !!ca && ca > state.date;
}

/** Cible valide d'une déclaration de guerre (règles de vassalité). */
export function canTargetForWar(state: GameView, actorId: string, targetId: string): string | null {
  const actor = state.characters[actorId];
  const target = state.characters[targetId];
  if (!actor || !target || !isAlive(actor) || !isAlive(target)) return 'invalid';
  if (actorId === targetId) return 'self';
  if (!actor.titleIds.length || !target.titleIds.length) return 'unlanded';
  if (actor.isPlayer === false && !isAdult(actor, state.date)) return 'minor';
  if (actor.prisonerOf) return 'prisoner';
  if (areAllied(state, actorId, targetId)) return 'allied';
  if (atWarWith(state, actorId, targetId)) return 'already_at_war';
  if (truceActive(state, actorId, targetId)) return 'truce';
  if (actor.liegeId) {
    if (target.id === actor.liegeId) return null;
    const liege = state.characters[actor.liegeId];
    if (target.liegeId === actor.liegeId && liege && allowsVassalWars(liege)) return null;
    return 'vassal';
  }
  if (target.liegeId) return 'not_independent';
  return null;
}

/** Gouvernements qui peuvent conquérir sans revendication (prestige). */
const CONQUEST_GOVERNMENTS = new Set(['steppe_confederation', 'tributary_empire', 'iqta_realm', 'mamluk_sultanate']);

export function availableCasusBelli(state: GameView, actorId: string, targetId: string): CbOption[] {
  if (canTargetForWar(state, actorId, targetId)) return [];
  const actor = state.characters[actorId]!;
  const target = state.characters[targetId]!;
  const out: CbOption[] = [];
  const inTargetRealm = (titleId: string) => {
    const holder = state.titles[titleId]?.holderId;
    if (!holder) return false;
    return holder === targetId || isInRealmOf(state, holder, targetId);
  };
  const cbForRank = (titleId: string): CasusBelli => {
    const r = TITLE_DEFS[titleId]!.rank;
    return r === 'county' ? 'county_claim' : r === 'duchy' ? 'duchy_claim' : 'kingdom_claim';
  };
  for (const cl of Object.values(state.claims)) {
    if (cl.kind === 'weak' && !cl.pressed) continue;
    if (!inTargetRealm(cl.titleId)) continue;
    if (cl.characterId === actorId) {
      // Un vassal ne peut revendiquer qu'un titre de son suzerain direct.
      if (actor.liegeId && state.titles[cl.titleId]?.holderId !== targetId) continue;
      out.push({ cb: cbForRank(cl.titleId), titleId: cl.titleId, claimantId: actorId });
    } else {
      const claimant = state.characters[cl.characterId];
      if (!claimant || !isAlive(claimant) || claimant.titleIds.length) continue;
      if (claimant.courtId !== actorId || !isAdult(claimant, state.date)) continue;
      if (actor.liegeId) continue;
      out.push({ cb: 'claimant', titleId: cl.titleId, claimantId: claimant.id });
    }
  }
  if (actor.liegeId === targetId) out.push({ cb: 'independence', titleId: null, claimantId: null });
  // Tributaire ou client : guerre d'affranchissement contre le suzerain.
  else if (pactsAsSubject(state, actorId).some((p) => isExternalPact(p) && target.titleIds.includes(p.overlordTitleId)))
    out.push({ cb: 'independence', titleId: null, claimantId: null });
  if (!actor.liegeId) {
    const faith = FAITH_BY_ID[actor.faithId];
    const tfaith = FAITH_BY_ID[target.faithId];
    const mine = new Set(realmProvinceIds(state, actorId));
    const border = realmProvinceIds(state, targetId).find((pid) => PROVINCE_GEO[pid]!.neighbors.some((n) => mine.has(n)));
    if (border && faith?.doctrines.holyWar && tfaith && faith.family !== tfaith.family) {
      out.push({ cb: 'holy_war', titleId: PROVINCE_GEO[border]!.countyTitleId, claimantId: actorId, cost: { fervor: 200 } });
    }
    if (border && CONQUEST_GOVERNMENTS.has(actor.government ?? '')) {
      out.push({ cb: 'conquest', titleId: PROVINCE_GEO[border]!.countyTitleId, claimantId: actorId, cost: { prestige: 250 } });
    }
  }
  // Dédoublonnage (titre + cb).
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.cb}|${o.titleId}|${o.claimantId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Provinces objectifs d'une guerre. */
export function warGoalProvinces(state: GameView, war: War): string[] {
  if (war.cb === 'independence' || war.cb === 'faction') {
    const def = state.characters[war.defenderId];
    return def ? realmProvinceIds(state, war.defenderId).filter((p) => holderOfProvince(state, p) === war.defenderId) : [];
  }
  if (!war.targetTitleId) return [];
  return (DEJURE_PROVINCES[war.targetTitleId] ?? []).filter((pid) => {
    const holder = holderOfProvince(state, pid);
    return !!holder && war.defenders.some((d) => holder === d || isInRealmOf(state, holder, d));
  });
}

export function declareWar(ctx: Ctx, actorId: string, targetId: string, cb: CasusBelli, titleId: string | null, claimantId: string | null): War {
  const s = ctx.s;
  const why = canTargetForWar(s, actorId, targetId);
  if (why) {
    throw new GameError(why === 'already_at_war' ? ErrorCodes.ALREADY_AT_WAR : ErrorCodes.INVALID_TARGET, `Guerre impossible : ${why}`, { reason: why });
  }
  const options = availableCasusBelli(s, actorId, targetId);
  const opt = options.find((o) => o.cb === cb && (o.titleId ?? null) === (titleId ?? null) && (o.claimantId ?? null) === (claimantId ?? o.claimantId ?? null));
  if (!opt) throw new GameError(ErrorCodes.NO_VALID_CLAIM, 'Aucun casus belli valide');
  const actor = s.characters[actorId]!;
  if (opt.cost?.prestige && actor.prestige < opt.cost.prestige) throw new GameError(ErrorCodes.INSUFFICIENT_PRESTIGE, 'Prestige insuffisant');
  if (opt.cost?.fervor && actor.fervor < opt.cost.fervor) throw new GameError(ErrorCodes.INSUFFICIENT_FERVOR, 'Ferveur insuffisante');
  actor.prestige -= opt.cost?.prestige ?? 0;
  actor.fervor -= opt.cost?.fervor ?? 0;
  const id = newId(s, 'wa');
  const war: War = {
    id,
    cb,
    attackerId: actorId,
    defenderId: targetId,
    attackers: [actorId],
    defenders: [targetId],
    targetTitleId: opt.titleId,
    claimantId: opt.claimantId,
    warScore: 0,
    battleScore: 0,
    occupationScore: 0,
    ticking: 0,
    startedAt: s.date,
    battles: [],
    casualties: [0, 0],
    factionId: null,
    maxEnd: s.date + BALANCE.war.maxDurationDays,
  };
  s.wars[id] = war;
  bumpStructure();
  // Rompre les alliances contradictoires et appeler automatiquement les alliés IA du défenseur.
  const target = s.characters[targetId]!;
  addOpinion(s, targetId, actorId, -30, 'opinion.reason.declared_war', 120);
  notify(ctx, [targetId, actorId, ...Object.values(s.players).map((p) => p.characterId)], {
    level: 'urgent',
    kind: 'war_declared',
    vars: { attacker: actor.firstName, defender: target.firstName, cb },
    focus: { type: 'war', id },
    sound: 'war',
  });
  if (rankOf(actor) >= 3 || rankOf(target) >= 3 || actor.isPlayer || target.isPlayer) {
    chronicle(ctx, 'war_start', { attacker: actorId, defender: targetId, cb }, [actorId, targetId]);
  }
  log(ctx, 'war.declare', actorId, { warId: id, targetId, cb, titleId: opt.titleId });
  for (const ally of alliesOf(s, targetId)) {
    if (!s.characters[ally]!.isPlayer) callAlly(ctx, war.id, targetId, ally);
    else requestAllyProposal(ctx, war, targetId, ally);
  }
  if (!actor.isPlayer) for (const ally of alliesOf(s, actorId)) callAlly(ctx, war.id, actorId, ally);
  fireOnAction(ctx, 'war_declared', targetId, { target: actorId });
  return war;
}

export function evaluateCallToArms(state: GameView, war: War, callerId: string, allyId: string): Acceptance {
  const ally = state.characters[allyId]!;
  const rows: AcceptRow[] = [{ key: 'alliance_duty', value: 30 }];
  rows.push({ key: 'opinion', value: opinion(state, allyId, callerId) * 0.5 });
  rows.push({ key: 'honor', value: ally.personality.honor * 0.15 });
  const enemies = sideOf(war, callerId) === 'attacker' ? war.defenders : war.attackers;
  const enemyStrength = enemies.reduce((sum, e) => sum + militaryStrength(state, state.characters[e]!), 0);
  const ratio = militaryStrength(state, ally) / Math.max(1, enemyStrength);
  rows.push({ key: 'strength', value: Math.max(-30, Math.min(10, (ratio - 0.5) * 20)) });
  if (warsOf(state, allyId).length) rows.push({ key: 'other_wars', value: -40 });
  if (enemies.some((e) => areAllied(state, allyId, e))) rows.push({ key: 'allied_to_enemy', value: -1000 });
  if (enemies.includes(allyId) || sideOf(war, allyId)) rows.push({ key: 'already_in_war', value: -1000 });
  if (ally.liegeId && enemies.includes(ally.liegeId)) rows.push({ key: 'enemy_liege', value: -1000 });
  if (!neighborRulers(state, allyId).some((n) => enemies.includes(n))) rows.push({ key: 'distance', value: -10 });
  rows.push({ key: 'caution', value: -ally.personality.caution * 0.1 });
  return acceptance(rows);
}

function requestAllyProposal(ctx: Ctx, war: War, callerId: string, allyId: string): void {
  if (hasPendingProposal(ctx.s, 'war_call', callerId, allyId, [war.id])) return;
  const pid = newId(ctx.s, 'pr');
  ctx.s.proposals[pid] = { id: pid, kind: 'war_call', fromId: callerId, toId: allyId, subjects: [war.id], createdAt: ctx.s.date, expiresAt: ctx.s.date + 20, hookId: null };
  notify(ctx, [allyId], { level: 'urgent', kind: 'proposal_war_call', vars: { from: ctx.s.characters[callerId]!.firstName }, focus: { type: 'war', id: war.id }, sound: 'war' });
}

/** Appel d'un allié. IA : décision immédiate ; joueur : proposition. */
export function callAlly(ctx: Ctx, warId: string, callerId: string, allyId: string): { joined: boolean; pending: boolean } {
  const s = ctx.s;
  const war = s.wars[warId];
  if (!war) throw new GameError(ErrorCodes.NOT_AT_WAR, 'Guerre inconnue');
  const side = sideOf(war, callerId);
  if (!side || (side === 'attacker' ? war.attackerId : war.defenderId) !== callerId) throw new GameError(ErrorCodes.FORBIDDEN, 'Seul le chef de guerre peut appeler');
  if (!areAllied(s, callerId, allyId)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Pas un allié');
  if (sideOf(war, allyId)) return { joined: false, pending: false };
  const ally = s.characters[allyId]!;
  if (ally.isPlayer) {
    requestAllyProposal(ctx, war, callerId, allyId);
    return { joined: false, pending: true };
  }
  const acc = evaluateCallToArms(s, war, callerId, allyId);
  if (acc.accept) {
    joinWar(ctx, war, side, allyId);
    return { joined: true, pending: false };
  }
  // Refuser l'appel rompt l'alliance.
  const entry = Object.entries(s.alliances).find(([, al]) => (al.a === callerId && al.b === allyId) || (al.a === allyId && al.b === callerId));
  if (entry && acc.score > -500) {
    delete s.alliances[entry[0]];
    bumpStructure();
    ally.prestige -= 100;
    addOpinion(s, callerId, allyId, -40, 'opinion.reason.refused_call', 120);
    notify(ctx, [callerId], { level: 'important', kind: 'ally_refused', vars: { name: ally.firstName }, focus: { type: 'character', id: allyId } });
  }
  return { joined: false, pending: false };
}

export function joinWar(ctx: Ctx, war: War, side: 'attacker' | 'defender', allyId: string): void {
  if (side === 'attacker') war.attackers.push(allyId);
  else war.defenders.push(allyId);
  const leader = side === 'attacker' ? war.attackerId : war.defenderId;
  addOpinion(ctx.s, leader, allyId, 20, 'opinion.reason.answered_call', 120);
  notify(ctx, [leader, allyId, ...war.attackers, ...war.defenders], {
    level: 'important',
    kind: 'ally_joined',
    vars: { name: ctx.s.characters[allyId]!.firstName },
    focus: { type: 'war', id: war.id },
  });
}

// ---------------------------------------------------------------------------
// Score de guerre
// ---------------------------------------------------------------------------
export function updateWarScore(state: GameState, war: War): void {
  const goal = warGoalProvinces(state, war);
  const occupiedBy = (pid: string) => state.titles[PROVINCE_GEO[pid]!.countyTitleId]?.occupiedBy ?? null;
  const attackerSide = new Set(war.attackers);
  const defenderSide = new Set(war.defenders);
  let goalHeld = 0;
  for (const pid of goal) if (attackerSide.has(occupiedBy(pid) ?? '')) goalHeld++;
  const defenderProvinces = war.defenders.flatMap((d) => realmProvinceIds(state, d));
  const attackerProvinces = war.attackers.flatMap((a) => realmProvinceIds(state, a));
  const otherHeld = defenderProvinces.filter((p) => !goal.includes(p) && attackerSide.has(occupiedBy(p) ?? '')).length;
  const lostHeld = attackerProvinces.filter((p) => defenderSide.has(occupiedBy(p) ?? '')).length;
  const maxOcc = BALANCE.war.occupationScoreMax;
  const goalShare = goal.length ? goalHeld / goal.length : 0;
  const attackerOcc = goalShare * maxOcc * 0.8 + Math.min(maxOcc * 0.2, (otherHeld / Math.max(1, defenderProvinces.length)) * maxOcc);
  const defenderOcc = Math.min(maxOcc, (lostHeld / Math.max(1, attackerProvinces.length)) * maxOcc * 1.5);
  war.occupationScore = Math.round(attackerOcc - defenderOcc);
  const perDay = BALANCE.war.tickingMax / BALANCE.war.tickingDaysToMax;
  if (goalShare >= 0.5) war.ticking = Math.min(BALANCE.war.tickingMax, war.ticking + perDay);
  else if (goalHeld === 0 && state.date - war.startedAt > 365) war.ticking = Math.max(-BALANCE.war.tickingMax, war.ticking - perDay);
  war.warScore = Math.max(-100, Math.min(100, Math.round(war.battleScore + war.occupationScore + war.ticking)));
}

// ---------------------------------------------------------------------------
// Paix
// ---------------------------------------------------------------------------
export function evaluatePeace(state: GameView, war: War, proposerId: string, kind: 'white' | 'surrender'): Acceptance {
  const side = sideOf(war, proposerId);
  const otherLeader = side === 'attacker' ? war.defenderId : war.attackerId;
  const rows: AcceptRow[] = [];
  if (kind === 'surrender') return acceptance([{ key: 'surrender', value: 100 }]);
  // Score du point de vue de l'autre camp.
  const theirScore = side === 'attacker' ? -war.warScore : war.warScore;
  rows.push({ key: 'war_score', value: -theirScore * 1.5 });
  const years = (state.date - war.startedAt) / 365;
  rows.push({ key: 'war_length', value: Math.min(30, years * 6) });
  rows.push({ key: 'base', value: 5 });
  const other = state.characters[otherLeader];
  if (other) rows.push({ key: 'aggression', value: -other.personality.aggression * 0.1 });
  return acceptance(rows);
}

export function canEnforce(war: War, byId: string): boolean {
  const side = sideOf(war, byId);
  if (side === 'attacker') return war.attackerId === byId && war.warScore >= BALANCE.war.enforceThreshold;
  if (side === 'defender') return war.defenderId === byId && war.warScore <= -BALANCE.war.enforceThreshold;
  return false;
}

export function offerPeace(ctx: Ctx, actorId: string, warId: string, kind: 'enforce' | 'white' | 'surrender'): { accepted: boolean; pending: boolean; acceptance?: Acceptance } {
  const s = ctx.s;
  const war = s.wars[warId];
  if (!war) throw new GameError(ErrorCodes.NOT_AT_WAR, 'Guerre inconnue');
  const side = sideOf(war, actorId);
  const leader = side === 'attacker' ? war.attackerId : war.defenderId;
  if (!side || leader !== actorId) throw new GameError(ErrorCodes.FORBIDDEN, 'Seul le chef de guerre négocie la paix');
  if (kind === 'enforce') {
    if (!canEnforce(war, actorId)) throw new GameError(ErrorCodes.REQUIREMENTS_NOT_MET, 'Score de guerre insuffisant (100 requis)');
    endWar(ctx, warId, side);
    return { accepted: true, pending: false };
  }
  if (kind === 'surrender') {
    endWar(ctx, warId, side === 'attacker' ? 'defender' : 'attacker');
    return { accepted: true, pending: false };
  }
  const otherLeader = side === 'attacker' ? war.defenderId : war.attackerId;
  const acc = evaluatePeace(s, war, actorId, 'white');
  if (s.characters[otherLeader]?.isPlayer) {
    // Pas de nouvelle offre tant que la précédente attend (ni avant la fin du délai).
    s.characters[actorId]!.cooldowns[`peace_${warId}`] = s.date + 60;
    if (hasPendingProposal(s, 'white_peace', actorId, otherLeader, [warId])) return { accepted: false, pending: true, acceptance: acc };
    const pid = newId(s, 'pr');
    s.proposals[pid] = { id: pid, kind: 'white_peace', fromId: actorId, toId: otherLeader, subjects: [warId], createdAt: s.date, expiresAt: s.date + 20, hookId: null };
    notify(ctx, [otherLeader], { level: 'urgent', kind: 'proposal_white_peace', vars: { from: s.characters[actorId]!.firstName }, focus: { type: 'war', id: warId }, sound: 'notify' });
    return { accepted: false, pending: true, acceptance: acc };
  }
  s.characters[actorId]!.cooldowns[`peace_${warId}`] = s.date + 60;
  if (acc.accept) endWar(ctx, warId, 'white');
  return { accepted: acc.accept, pending: false, acceptance: acc };
}

/** Termine une guerre et applique ses conséquences. */
export function endWar(ctx: Ctx, warId: string, result: 'attacker' | 'defender' | 'white'): void {
  const s = ctx.s;
  const war = s.wars[warId];
  if (!war) return;
  delete s.wars[warId];
  bumpStructure();
  const attacker = s.characters[war.attackerId];
  const defender = s.characters[war.defenderId];
  if (result === 'attacker' && attacker && isAlive(attacker)) applyVictory(ctx, war);
  if (result === 'defender' && attacker) {
    attacker.prestige += BALANCE.war.prestigeLoss;
    if (war.cb === 'independence' || war.cb === 'faction') {
      attacker.gold -= Math.max(0, Math.round(attacker.gold * 0.3));
      addOpinion(s, war.defenderId, war.attackerId, -30, 'opinion.reason.rebelled', 240);
    }
    // Les revendications utilisées sont affaiblies.
    for (const cl of Object.values(s.claims)) if (cl.characterId === war.claimantId && cl.titleId === war.targetTitleId) cl.pressed = false;
  }
  const winnerLeader = result === 'attacker' ? attacker : result === 'defender' ? defender : null;
  const loserLeader = result === 'attacker' ? defender : result === 'defender' ? attacker : null;
  if (winnerLeader) winnerLeader.prestige += BALANCE.war.prestigeWin;
  if (loserLeader && result === 'attacker') loserLeader.prestige += BALANCE.war.prestigeLoss;
  // Trêves.
  for (const a of war.attackers) {
    for (const d of war.defenders) {
      const ca = s.characters[a];
      const cd = s.characters[d];
      if (ca) ca.cooldowns[`truce_${d}`] = s.date + BALANCE.war.truceDays;
      if (cd) cd.cooldowns[`truce_${a}`] = s.date + BALANCE.war.truceDays;
    }
  }
  // Libération des occupations, sièges et batailles de cette guerre.
  const participants = new Set([...war.attackers, ...war.defenders]);
  for (const t of Object.values(s.titles)) {
    if (t.occupiedBy && participants.has(t.occupiedBy) && !Object.values(s.wars).some((w) => sideOf(w, t.occupiedBy!))) t.occupiedBy = null;
  }
  for (const [id, sg] of Object.entries(s.sieges)) if (sg.warId === warId) delete s.sieges[id];
  for (const [id, b] of Object.entries(s.battles)) if (b.warId === warId) delete s.battles[id];
  for (const a of Object.values(s.armies)) {
    if (participants.has(a.ownerId) && (a.status === 'sieging' || a.status === 'battle')) a.status = a.path.length ? 'moving' : 'idle';
  }
  // Statistiques joueurs.
  for (const slot of Object.values(s.players)) {
    const side = sideOf(war, slot.characterId);
    if (!side || result === 'white') continue;
    if (side === result) slot.stats.warsWon++;
    else slot.stats.warsLost++;
  }
  notify(ctx, [...war.attackers, ...war.defenders], {
    level: 'important',
    kind: `war_end_${result}`,
    vars: { attacker: attacker?.firstName ?? '', defender: defender?.firstName ?? '', cb: war.cb },
    focus: war.targetTitleId ? { type: 'title', id: war.targetTitleId } : undefined,
    sound: 'fanfare',
  });
  if ((attacker && rankOf(attacker) >= 3) || (defender && rankOf(defender) >= 3) || attacker?.isPlayer || defender?.isPlayer) {
    chronicle(ctx, 'war_end', { attacker: war.attackerId, defender: war.defenderId, result, cb: war.cb, title: war.targetTitleId ?? '' }, [war.attackerId, war.defenderId]);
  }
  log(ctx, 'war.end', null, { warId, result, cb: war.cb, titleId: war.targetTitleId });
  if (winnerLeader) fireOnAction(ctx, 'war_won', winnerLeader.id, { target: loserLeader?.id ?? null });
  if (loserLeader) fireOnAction(ctx, 'war_lost', loserLeader.id, { target: winnerLeader?.id ?? null });
}

function applyVictory(ctx: Ctx, war: War): void {
  const s = ctx.s;
  const attacker = s.characters[war.attackerId]!;
  switch (war.cb) {
    case 'independence':
    case 'faction': {
      attacker.liegeId = null;
      endPactsBetween(s, attacker.id, war.defenderId);
      bumpStructure();
      if (war.cb === 'faction' && war.factionId) {
        for (const m of war.attackers) {
          const c = s.characters[m];
          if (c && c.liegeId === war.defenderId) c.liegeId = null;
          bumpStructure();
        }
      }
      attacker.prestige += BALANCE.war.independencePrestige;
      chronicle(ctx, 'usurpation', { name: attacker.id, kind: 'independence' }, [attacker.id]);
      break;
    }
    case 'county_claim':
    case 'holy_war':
    case 'conquest':
    case 'duchy_claim':
    case 'kingdom_claim':
    case 'claimant': {
      if (!war.targetTitleId) break;
      const winner = war.claimantId && isAlive(s.characters[war.claimantId]) ? war.claimantId : war.attackerId;
      pressTitle(ctx, war.targetTitleId, winner, war.attackerId);
      break;
    }
  }
}

/** Transfère un titre conquis et réaligne les vassaux de jure. */
export function pressTitle(ctx: Ctx, titleId: string, winnerId: string, warLeaderId: string): void {
  const s = ctx.s;
  const title = s.titles[titleId]!;
  const loserId = title.holderId;
  const def = TITLE_DEFS[titleId]!;
  const winner = s.characters[winnerId]!;
  const liegeForClaimant = winnerId !== warLeaderId && winner.titleIds.length === 0 ? warLeaderId : undefined;
  transferTitle(s, titleId, winnerId, def.rank === 'county' ? 'conquest' : 'usurped', { liegeId: liegeForClaimant });
  if (def.rank !== 'county' && winner.titleIds[0] === titleId) winner.legitimacy = Math.min(winner.legitimacy ?? BALANCE.politics.legitimacy.base, BALANCE.politics.legitimacy.usurper);
  title.active = true;
  if (def.rank !== 'county' && loserId) {
    // Comtés de jure détenus par le perdant : suivent le titre.
    const loser = s.characters[loserId];
    if (loser) {
      for (const t of [...loser.titleIds]) {
        if (TITLE_DEFS[t]!.rank === 'county' && isDeJureAncestor(titleId, t) && loser.titleIds.length > 1) {
          transferTitle(s, t, winnerId, 'conquest');
        }
      }
      // Vassaux de jure du perdant rejoignent le vainqueur.
      for (const v of directVassals(s, loserId)) {
        const cap = v.titleIds[0] ? TITLE_DEFS[v.titleIds[0]]!.capitalProvinceId : null;
        if (cap && (DEJURE_PROVINCES[titleId] ?? []).includes(cap)) {
          v.liegeId = winnerId;
          bumpStructure();
          fixRankConsistency(s, v.id);
        }
      }
      // Le perdant devient vassal du vainqueur s'il est désormais de rang inférieur.
      if (loser.titleIds.length && !loser.liegeId && rankOf(loser) < rankOf(winner) && loser.titleIds.some((t) => isDeJureAncestor(titleId, t))) {
        loser.liegeId = winnerId;
        bumpStructure();
        fixRankConsistency(s, loserId);
      }
    }
    if (def.rank !== 'duchy') chronicle(ctx, 'usurpation', { name: winnerId, title: titleId }, [winnerId, ...(loserId ? [loserId] : [])]);
  }
  // Réparer la hiérarchie : un vainqueur vassal devenu plus puissant que son suzerain devient indépendant.
  fixRankConsistency(s, winnerId);
  // Le prétendant victorieux reste proche de son champion.
  if (winnerId !== warLeaderId) addOpinion(s, winnerId, warLeaderId, 40, 'opinion.reason.installed_me', 240);
  void courtiers;
  void topLiegeId;
}

/** Contrôles journaliers : guerres trop longues, participants disparus. */
export function dailyWarChecks(ctx: Ctx): void {
  const s = ctx.s;
  for (const war of Object.values(s.wars)) {
    war.attackers = war.attackers.filter((a) => isAlive(s.characters[a]));
    war.defenders = war.defenders.filter((d) => isAlive(s.characters[d]));
    if (!war.attackers.includes(war.attackerId) || !war.defenders.includes(war.defenderId)) {
      endWar(ctx, war.id, 'white');
      continue;
    }
    if (war.targetTitleId && !s.titles[war.targetTitleId]?.holderId) {
      endWar(ctx, war.id, 'white');
      continue;
    }
    updateWarScore(s, war);
    if (s.date >= war.maxEnd) endWar(ctx, war.id, 'white');
  }
}
