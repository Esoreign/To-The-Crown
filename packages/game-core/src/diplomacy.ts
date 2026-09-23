/**
 * Interactions diplomatiques et de cour : cadeaux, alliances, vassalisation,
 * indépendance, prisonniers, invitations, tutelle.
 */
import { ErrorCodes, GameError, RANK_ORDER, type Character, type GameView, type SkillKey } from '@ttc/shared';
import { BALANCE } from './balance';
import { acceptance, type Acceptance, type AcceptRow } from './acceptance';
import { addTrait, isAdult, isAlive } from './characters';
import { newId, notify, type Ctx } from './context';
import { TITLE_DEFS } from './content';
import { killCharacter } from './death';
import { isCloseRelative, sameDynasty } from './family';
import { hasFlag } from './flags';
import { addOpinion, alliesOf, areAllied, atWarWith, opinion } from './opinion';
import { directVassals, isIndependent, isInRealmOf, neighborRulers, rankOf, topLiegeId } from './realm';
import { consumeHook, usableHook } from './secrets';
import { addStress, stressForTags } from './stress';
import { militaryStrength } from './economy';
import { isDeJureAncestor, fixRankConsistency } from './titles';
import { bumpStructure } from './index-cache';

function must(state: GameView, id: string): Character {
  const c = state.characters[id];
  if (!c || !isAlive(c)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Personnage invalide');
  return c;
}

// ---------------------------------------------------------------------------
// Cadeaux
// ---------------------------------------------------------------------------
export function giftOpinionValue(amount: number): number {
  return Math.min(BALANCE.opinion.giftMax, Math.round((amount / 10) * BALANCE.opinion.giftPer10Gold));
}

export function sendGift(ctx: Ctx, actorId: string, targetId: string, amount: number): number {
  const actor = must(ctx.s, actorId);
  const target = must(ctx.s, targetId);
  if (actor.id === target.id) throw new GameError(ErrorCodes.INVALID_TARGET, 'Cible invalide');
  if (actor.gold < amount) throw new GameError(ErrorCodes.INSUFFICIENT_GOLD, 'Or insuffisant');
  const cd = actor.cooldowns[`gift_${targetId}`];
  if (cd && cd > ctx.s.date) throw new GameError(ErrorCodes.ON_COOLDOWN, 'Cadeau récent', { until: cd });
  actor.gold -= amount;
  target.gold += amount;
  const value = giftOpinionValue(amount) * (target.personality.greed > 30 ? 1.3 : 1);
  addOpinion(ctx.s, target.id, actor.id, Math.round(value), 'opinion.reason.gift', 60);
  actor.cooldowns[`gift_${targetId}`] = ctx.s.date + 365;
  addStress(ctx, actor, stressForTags(actor, ['generous']));
  notify(ctx, [target.id], { level: 'info', kind: 'gift_received', vars: { from: actor.firstName, amount }, focus: { type: 'character', id: actor.id }, sound: 'coin' });
  return value;
}

// ---------------------------------------------------------------------------
// Alliances
// ---------------------------------------------------------------------------
export function evaluateAlliance(state: GameView, actorId: string, targetId: string, useHook = false): Acceptance {
  const actor = state.characters[actorId]!;
  const target = state.characters[targetId]!;
  const rows: AcceptRow[] = [{ key: 'base', value: -25 }];
  rows.push({ key: 'opinion', value: opinion(state, targetId, actorId) * 0.6 });
  const family = isCloseRelative(state, actor, target) || state.characters[actor.spouseId ?? '']?.fatherId === targetId;
  const inLaws = Object.values(state.characters).some(
    (c) => c.death === null && c.spouseId && ((c.courtId === actorId || c.id === actorId) && isCloseRelative(state, state.characters[c.spouseId]!, target)),
  );
  if (family) rows.push({ key: 'family', value: 30 });
  else if (inLaws) rows.push({ key: 'in_laws', value: 25 });
  else rows.push({ key: 'no_family', value: -15 });
  const ratio = militaryStrength(state, actor) / Math.max(1, militaryStrength(state, target));
  rows.push({ key: 'strength', value: Math.max(-20, Math.min(20, (ratio - 1) * 15)) });
  if (actor.faithId !== target.faithId) rows.push({ key: 'faith', value: -15 });
  if (sameDynasty(state, actor, target)) rows.push({ key: 'dynasty', value: 10 });
  rows.push({ key: 'sociability', value: target.personality.sociability * 0.1 });
  if (alliesOf(state, targetId).length >= 3) rows.push({ key: 'many_allies', value: -20 });
  if (atWarWith(state, actorId, targetId)) rows.push({ key: 'at_war', value: -500 });
  if (areAllied(state, actorId, targetId)) rows.push({ key: 'already_allied', value: -1000 });
  if (!target.titleIds.length || !actor.titleIds.length) rows.push({ key: 'not_ruler', value: -1000 });
  if (useHook) {
    const hook = usableHook(state, actorId, targetId);
    if (hook) rows.push({ key: hook.strong ? 'strong_hook' : 'weak_hook', value: hook.strong ? 100 : 40 });
  }
  return acceptance(rows);
}

export function createAlliance(ctx: Ctx, a: string, b: string, reason: 'pact' | 'marriage' | 'family'): void {
  if (areAllied(ctx.s, a, b)) return;
  const id = newId(ctx.s, 'al');
  ctx.s.alliances[id] = { id, a, b, reason, createdAt: ctx.s.date };
  bumpStructure();
  notify(ctx, [a, b], {
    level: 'important',
    kind: 'alliance_formed',
    vars: { a: ctx.s.characters[a]!.firstName, b: ctx.s.characters[b]!.firstName },
    focus: { type: 'character', id: b },
    sound: 'fanfare',
  });
}

export function proposeAlliance(ctx: Ctx, actorId: string, targetId: string, useHook = false): { accepted: boolean; pending: boolean; acceptance: Acceptance } {
  const s = ctx.s;
  must(s, actorId);
  const target = must(s, targetId);
  const acc = evaluateAlliance(s, actorId, targetId, useHook);
  if (acc.score <= -500) throw new GameError(ErrorCodes.INVALID_TARGET, 'Alliance impossible');
  if (target.isPlayer) {
    const pid = newId(s, 'pr');
    s.proposals[pid] = { id: pid, kind: 'alliance', fromId: actorId, toId: targetId, subjects: [], createdAt: s.date, expiresAt: s.date + 30, hookId: null };
    notify(ctx, [targetId], { level: 'urgent', kind: 'proposal_alliance', vars: { from: s.characters[actorId]!.firstName }, focus: { type: 'character', id: actorId }, sound: 'notify' });
    return { accepted: false, pending: true, acceptance: acc };
  }
  if (!acc.accept) {
    s.characters[actorId]!.cooldowns[`alliance_${targetId}`] = s.date + 365;
    return { accepted: false, pending: false, acceptance: acc };
  }
  if (useHook) {
    const hook = usableHook(s, actorId, targetId);
    if (hook) consumeHook(ctx, hook.id);
  }
  createAlliance(ctx, actorId, targetId, 'pact');
  return { accepted: true, pending: false, acceptance: acc };
}

export function breakAlliance(ctx: Ctx, actorId: string, targetId: string): void {
  const s = ctx.s;
  const entry = Object.entries(s.alliances).find(([, al]) => (al.a === actorId && al.b === targetId) || (al.a === targetId && al.b === actorId));
  if (!entry) throw new GameError(ErrorCodes.INVALID_TARGET, 'Aucune alliance');
  delete s.alliances[entry[0]];
  bumpStructure();
  const actor = s.characters[actorId]!;
  actor.prestige -= 100;
  addOpinion(s, targetId, actorId, -40, 'opinion.reason.broke_alliance', 120);
  notify(ctx, [targetId], { level: 'important', kind: 'alliance_broken', vars: { from: actor.firstName }, focus: { type: 'character', id: actorId } });
}

// ---------------------------------------------------------------------------
// Vassalisation et indépendance
// ---------------------------------------------------------------------------
export function evaluateVassalization(state: GameView, actorId: string, targetId: string, useHook = false): Acceptance {
  const actor = state.characters[actorId]!;
  const target = state.characters[targetId]!;
  const rows: AcceptRow[] = [{ key: 'base', value: -40 }];
  rows.push({ key: 'opinion', value: opinion(state, targetId, actorId) * 0.8 });
  const ratio = militaryStrength(state, actor) / Math.max(1, militaryStrength(state, target));
  rows.push({ key: 'strength', value: Math.max(-30, Math.min(45, (ratio - 2) * 12)) });
  const dejure = target.titleIds.some((t) => actor.titleIds.some((a) => isDeJureAncestor(a, t)));
  if (dejure) rows.push({ key: 'de_jure', value: 20 });
  if (actor.faithId !== target.faithId) rows.push({ key: 'faith', value: -20 });
  if (actor.cultureId === target.cultureId) rows.push({ key: 'culture', value: 5 });
  rows.push({ key: 'ambition', value: -target.personality.ambition * 0.25 });
  if (sameDynasty(state, actor, target)) rows.push({ key: 'dynasty', value: 15 });
  if (rankOf(target) >= rankOf(actor)) rows.push({ key: 'rank', value: -1000 });
  if (!isIndependent(target)) rows.push({ key: 'not_independent', value: -1000 });
  if (atWarWith(state, actorId, targetId)) rows.push({ key: 'at_war', value: -1000 });
  if (!neighborRulers(state, actorId).includes(targetId) && !isInRealmOf(state, targetId, actorId)) rows.push({ key: 'distance', value: -20 });
  if (useHook) {
    const hook = usableHook(state, actorId, targetId);
    if (hook) rows.push({ key: hook.strong ? 'strong_hook' : 'weak_hook', value: hook.strong ? 100 : 40 });
  }
  return acceptance(rows);
}

export function vassalize(ctx: Ctx, actorId: string, targetId: string): void {
  const target = ctx.s.characters[targetId]!;
  target.liegeId = actorId;
  bumpStructure();
  fixRankConsistency(ctx.s, targetId);
  addOpinion(ctx.s, targetId, actorId, 10, 'opinion.reason.accepted_vassalage', 60);
  notify(ctx, [actorId, targetId], { level: 'important', kind: 'vassalized', vars: { vassal: target.firstName }, focus: { type: 'character', id: targetId }, sound: 'fanfare' });
}

export function proposeVassalization(ctx: Ctx, actorId: string, targetId: string, useHook = false): { accepted: boolean; pending: boolean; acceptance: Acceptance } {
  const s = ctx.s;
  must(s, actorId);
  const target = must(s, targetId);
  const acc = evaluateVassalization(s, actorId, targetId, useHook);
  if (acc.score <= -500) throw new GameError(ErrorCodes.INVALID_TARGET, 'Vassalisation impossible');
  if (target.isPlayer) {
    const pid = newId(s, 'pr');
    s.proposals[pid] = { id: pid, kind: 'vassalize', fromId: actorId, toId: targetId, subjects: [], createdAt: s.date, expiresAt: s.date + 30, hookId: null };
    notify(ctx, [targetId], { level: 'urgent', kind: 'proposal_vassalize', vars: { from: s.characters[actorId]!.firstName }, focus: { type: 'character', id: actorId }, sound: 'notify' });
    return { accepted: false, pending: true, acceptance: acc };
  }
  s.characters[actorId]!.cooldowns[`vassalize_${targetId}`] = s.date + 365 * 2;
  if (!acc.accept) return { accepted: false, pending: false, acceptance: acc };
  if (useHook) {
    const hook = usableHook(s, actorId, targetId);
    if (hook) consumeHook(ctx, hook.id);
  }
  vassalize(ctx, actorId, targetId);
  return { accepted: true, pending: false, acceptance: acc };
}

export function grantIndependence(ctx: Ctx, actorId: string, vassalId: string): void {
  const v = must(ctx.s, vassalId);
  if (v.liegeId !== actorId) throw new GameError(ErrorCodes.INVALID_TARGET, 'Pas votre vassal direct');
  v.liegeId = null;
  bumpStructure();
  addOpinion(ctx.s, vassalId, actorId, 40, 'opinion.reason.granted_independence', 240);
  const actor = ctx.s.characters[actorId]!;
  actor.prestige -= 50 * rankOf(v);
  notify(ctx, [actorId, vassalId], { level: 'important', kind: 'independence_granted', vars: { name: v.firstName }, focus: { type: 'character', id: vassalId } });
}

// ---------------------------------------------------------------------------
// Prisonniers
// ---------------------------------------------------------------------------
/** Emprisonnement « justifié » : crime connu ou complot découvert. */
export function isJustified(state: GameView, actorId: string, targetId: string): boolean {
  const t = state.characters[targetId];
  if (!t) return false;
  if (hasFlag(t, 'criminal', state.date)) return true;
  if (Object.values(state.schemes).some((s) => s.ownerId === targetId && s.targetId === actorId && s.discoveredBy.includes(actorId))) return true;
  return Object.values(state.secrets).some(
    (s) => s.ownerId === targetId && (s.type === 'murder_plot' || s.type === 'political_crime') && (s.exposed || s.knownBy.includes(actorId)),
  );
}

export function canImprison(state: GameView, actorId: string, targetId: string): boolean {
  const t = state.characters[targetId];
  if (!t || !isAlive(t) || t.prisonerOf || t.id === actorId) return false;
  if (t.courtId === actorId && !t.titleIds.length) return true;
  return t.liegeId === actorId;
}

export function imprison(ctx: Ctx, actorId: string, targetId: string, fromEvent = false): void {
  const s = ctx.s;
  const actor = must(s, actorId);
  const target = must(s, targetId);
  if (!fromEvent && !canImprison(s, actorId, targetId)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Emprisonnement impossible');
  const justified = isJustified(s, actorId, targetId);
  if (!fromEvent && !justified) {
    if (actor.authority < BALANCE.authority.imprisonCost) throw new GameError(ErrorCodes.INSUFFICIENT_AUTHORITY, 'Autorité insuffisante');
    actor.authority -= BALANCE.authority.imprisonCost;
    for (const v of directVassals(s, actorId)) if (v.id !== targetId) addOpinion(s, v.id, actorId, -8, 'opinion.reason.tyranny', 60);
  }
  target.prisonerOf = actorId;
  addOpinion(s, targetId, actorId, -50, 'opinion.reason.imprisoned', 120);
  for (const r of Object.values(s.characters)) {
    if (r.council) for (const seat of Object.values(r.council)) if (seat.characterId === targetId) seat.characterId = null;
  }
  notify(ctx, [targetId, target.liegeId, target.spouseId, actorId], {
    level: 'important',
    kind: 'imprisoned',
    vars: { name: target.firstName, by: actor.firstName },
    focus: { type: 'character', id: targetId },
  });
}

export function releasePrisoner(ctx: Ctx, targetId: string): void {
  const t = ctx.s.characters[targetId];
  if (!t || !t.prisonerOf) return;
  const captor = t.prisonerOf;
  t.prisonerOf = null;
  addOpinion(ctx.s, targetId, captor, 15, 'opinion.reason.released', 60);
  notify(ctx, [targetId, captor], { level: 'info', kind: 'released', vars: { name: t.firstName }, focus: { type: 'character', id: targetId } });
}

export function executePrisoner(ctx: Ctx, actorId: string, targetId: string): void {
  const s = ctx.s;
  const actor = must(s, actorId);
  const t = must(s, targetId);
  if (t.prisonerOf !== actorId) throw new GameError(ErrorCodes.INVALID_TARGET, 'Ce personnage n’est pas votre prisonnier');
  const justified = isJustified(s, actorId, targetId);
  if (!justified) {
    if (actor.authority < BALANCE.authority.executeCost) throw new GameError(ErrorCodes.INSUFFICIENT_AUTHORITY, 'Autorité insuffisante');
    actor.authority -= BALANCE.authority.executeCost;
    for (const v of directVassals(s, actorId)) addOpinion(s, v.id, actorId, -15, 'opinion.reason.tyranny', 120);
  }
  if (isCloseRelative(s, actor, t)) addTrait(actor, 'kinslayer');
  addStress(ctx, actor, stressForTags(actor, ['cruel']));
  for (const rel of [t.spouseId, ...t.childIds, t.fatherId, t.motherId]) {
    if (rel) addOpinion(s, rel, actorId, -60, 'opinion.reason.executed_relative', 240);
  }
  killCharacter(ctx, targetId, 'execution', actorId);
}

export function ransomPrice(state: GameView, prisoner: Character): number {
  return 40 + rankOf(prisoner) * 90 + (prisoner.titleIds.length ? 60 : 0) + Math.round(Math.max(0, prisoner.gold) * 0.1);
}

/** Rançon : le geôlier libère contre paiement de la famille/du suzerain. */
export function ransomPrisoner(ctx: Ctx, actorId: string, prisonerId: string): { paid: number; accepted: boolean } {
  const s = ctx.s;
  const p = must(s, prisonerId);
  if (!p.prisonerOf) throw new GameError(ErrorCodes.INVALID_TARGET, 'Pas prisonnier');
  const price = ransomPrice(s, p);
  if (p.prisonerOf === actorId) {
    // Demander une rançon au suzerain / à la famille.
    const payerId = p.titleIds.length ? p.id : p.courtId ?? p.liegeId;
    const payer = payerId ? s.characters[payerId] : undefined;
    if (!payer || !isAlive(payer)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Personne pour payer');
    const willing = payer.gold >= price && (opinion(s, payer.id, p.id) > -20 || payer.id === p.id);
    if (!willing) return { paid: 0, accepted: false };
    payer.gold -= price;
    s.characters[actorId]!.gold += price;
    releasePrisoner(ctx, prisonerId);
    return { paid: price, accepted: true };
  }
  // Payer le geôlier pour libérer un proche.
  const actor = must(s, actorId);
  if (!isCloseRelative(s, actor, p) && p.courtId !== actorId && p.liegeId !== actorId) {
    throw new GameError(ErrorCodes.INVALID_TARGET, 'Ce prisonnier ne vous concerne pas');
  }
  if (actor.gold < price) throw new GameError(ErrorCodes.INSUFFICIENT_GOLD, 'Or insuffisant');
  const captor = s.characters[p.prisonerOf]!;
  if (captor.isPlayer) throw new GameError(ErrorCodes.INVALID_TARGET, 'Le geôlier doit accepter lui-même');
  actor.gold -= price;
  captor.gold += price;
  releasePrisoner(ctx, prisonerId);
  return { paid: price, accepted: true };
}

// ---------------------------------------------------------------------------
// Cour
// ---------------------------------------------------------------------------
export function evaluateInvite(state: GameView, actorId: string, targetId: string): Acceptance {
  const actor = state.characters[actorId]!;
  const t = state.characters[targetId]!;
  const rows: AcceptRow[] = [{ key: 'base', value: 0 }];
  rows.push({ key: 'opinion', value: opinion(state, targetId, actorId) * 0.5 });
  const current = t.courtId ? state.characters[t.courtId] : undefined;
  if (current) {
    rows.push({ key: 'current_court', value: -opinion(state, targetId, current.id) * 0.4 });
    rows.push({ key: 'rank', value: (rankOf(actor) - rankOf(current)) * 10 });
    if (isCloseRelative(state, t, current)) rows.push({ key: 'family_there', value: -40 });
  } else rows.push({ key: 'wanderer', value: 25 });
  if (t.spouseId) rows.push({ key: 'married', value: -1000 });
  if (t.titleIds.length || t.isPlayer) rows.push({ key: 'landed', value: -1000 });
  if (t.prisonerOf) rows.push({ key: 'prisoner', value: -1000 });
  return acceptance(rows);
}

export function inviteToCourt(ctx: Ctx, actorId: string, targetId: string): Acceptance {
  const acc = evaluateInvite(ctx.s, actorId, targetId);
  const actor = ctx.s.characters[actorId]!;
  if (actor.cooldowns[`invite_${targetId}`] && actor.cooldowns[`invite_${targetId}`]! > ctx.s.date) {
    throw new GameError(ErrorCodes.ON_COOLDOWN, 'Invitation récente');
  }
  actor.cooldowns[`invite_${targetId}`] = ctx.s.date + 365;
  if (acc.accept) {
    const t = ctx.s.characters[targetId]!;
    for (const r of Object.values(ctx.s.characters)) {
      if (r.council) for (const seat of Object.values(r.council)) if (seat.characterId === targetId) seat.characterId = null;
    }
    t.courtId = actorId;
    bumpStructure();
    notify(ctx, [actorId], { level: 'info', kind: 'joined_court', vars: { name: t.firstName }, focus: { type: 'character', id: targetId } });
  }
  return acc;
}

export function assignGuardian(ctx: Ctx, actorId: string, childId: string, tutorId: string | null, focus: SkillKey): void {
  const s = ctx.s;
  const child = must(s, childId);
  if (isAdult(child, s.date)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Ce personnage est adulte');
  const allowed = child.courtId === actorId || child.fatherId === actorId || child.motherId === actorId;
  if (!allowed) throw new GameError(ErrorCodes.FORBIDDEN, 'Cet enfant n’est pas sous votre autorité');
  if (tutorId) {
    const tutor = must(s, tutorId);
    const ok = isAdult(tutor, s.date) && (tutor.courtId === actorId || tutor.id === actorId || tutor.liegeId === actorId) && !tutor.prisonerOf;
    if (!ok) throw new GameError(ErrorCodes.INVALID_TARGET, 'Tuteur non éligible');
  }
  child.education ??= { focus, tutorId: null, progress: 0 };
  child.education.focus = focus;
  child.education.tutorId = tutorId;
  child.guardianId = tutorId;
}

export function designateHeir(ctx: Ctx, actorId: string, heirId: string | null): void {
  const actor = must(ctx.s, actorId);
  if (heirId) {
    const h = must(ctx.s, heirId);
    if (!sameDynasty(ctx.s, actor, h) && h.liegeId !== actorId) throw new GameError(ErrorCodes.INVALID_TARGET, 'Héritier non éligible');
  }
  actor.nominatedHeirId = heirId;
}

// ---------------------------------------------------------------------------
// Titres : attribution et révocation
// ---------------------------------------------------------------------------
export function canGrantTitle(state: GameView, actorId: string, titleId: string, toId: string): string | null {
  const actor = state.characters[actorId];
  const to = state.characters[toId];
  if (!actor || !to || !isAlive(to)) return 'invalid';
  if (!actor.titleIds.includes(titleId)) return 'not_held';
  if (actor.titleIds[0] === titleId) return 'primary';
  if (to.id === actorId || to.isPlayer) return 'invalid';
  if (!isAdult(to, state.date)) return 'minor';
  if (to.prisonerOf) return 'prisoner';
  const inRealm = to.courtId === actorId || to.liegeId === actorId || (to.titleIds.length === 0 && to.courtId && topLiegeId(state, to.courtId) === topLiegeId(state, actorId));
  if (!inRealm) return 'not_in_realm';
  const newRank = Math.max(rankOf(to), RANK_ORDER[TITLE_DEFS[titleId]!.rank]);
  if (newRank >= rankOf(actor)) return 'rank';
  return null;
}

export function grantTitle(ctx: Ctx, actorId: string, titleId: string, toId: string, transfer: (t: string, to: string, liegeId: string) => void): void {
  const why = canGrantTitle(ctx.s, actorId, titleId, toId);
  if (why) throw new GameError(ErrorCodes.INVALID_TARGET, `Attribution impossible : ${why}`, { reason: why });
  transfer(titleId, toId, actorId);
  const to = ctx.s.characters[toId]!;
  if (to.liegeId !== actorId && to.titleIds.length === 1) to.liegeId = actorId;
  bumpStructure();
  addOpinion(ctx.s, toId, actorId, 25, 'opinion.reason.granted_title', 240);
  const actor = ctx.s.characters[actorId]!;
  addStress(ctx, actor, stressForTags(actor, ['generous']));
  notify(ctx, [toId, actorId], { level: 'important', kind: 'title_granted', vars: { name: to.firstName, title: titleId }, focus: { type: 'title', id: titleId }, sound: 'fanfare' });
}

export function revokeCost(state: GameView, actorId: string, holderId: string): number {
  return isJustified(state, actorId, holderId) ? 0 : BALANCE.authority.revokeCost;
}

export function revokeTitle(ctx: Ctx, actorId: string, titleId: string, transfer: (t: string, to: string) => void): void {
  const s = ctx.s;
  const actor = must(s, actorId);
  const title = s.titles[titleId];
  const holderId = title?.holderId;
  const holder = holderId ? s.characters[holderId] : undefined;
  if (!title || !holder || holder.liegeId !== actorId) throw new GameError(ErrorCodes.INVALID_TARGET, 'Titre non révocable');
  if (actor.crownAuthority < 1) throw new GameError(ErrorCodes.REQUIREMENTS_NOT_MET, 'Autorité royale insuffisante');
  const cost = revokeCost(s, actorId, holder.id);
  if (actor.authority < cost) throw new GameError(ErrorCodes.INSUFFICIENT_AUTHORITY, 'Autorité insuffisante', { cost });
  actor.authority -= cost;
  transfer(titleId, actorId);
  addOpinion(s, holder.id, actorId, -60, 'opinion.reason.revoked_title', 240);
  if (cost > 0) {
    for (const v of directVassals(s, actorId)) addOpinion(s, v.id, actorId, BALANCE.authority.revokeTyrannyOpinion / 2, 'opinion.reason.tyranny', 120);
  }
  notify(ctx, [holder.id, actorId], { level: 'important', kind: 'title_revoked', vars: { name: holder.firstName, title: titleId }, focus: { type: 'title', id: titleId } });
}

export function changeCrownAuthority(ctx: Ctx, actorId: string, level: number): void {
  const actor = must(ctx.s, actorId);
  if (!isIndependent(actor) || rankOf(actor) < 2) throw new GameError(ErrorCodes.REQUIREMENTS_NOT_MET, 'Réservé aux dirigeants indépendants');
  if (Math.abs(level - actor.crownAuthority) !== 1) throw new GameError(ErrorCodes.INVALID_COMMAND, 'Un niveau à la fois');
  const cd = actor.cooldowns.crown_authority;
  if (cd && cd > ctx.s.date) throw new GameError(ErrorCodes.ON_COOLDOWN, 'Changement récent', { until: cd });
  if (level > actor.crownAuthority) {
    const cost = BALANCE.authority.crownAuthorityCost[level] ?? 999;
    if (actor.authority < cost) throw new GameError(ErrorCodes.INSUFFICIENT_AUTHORITY, 'Autorité insuffisante', { cost });
    actor.authority -= cost;
    for (const v of directVassals(ctx.s, actorId)) addOpinion(ctx.s, v.id, actorId, -10, 'opinion.reason.raised_authority', 60);
  } else {
    for (const v of directVassals(ctx.s, actorId)) addOpinion(ctx.s, v.id, actorId, 10, 'opinion.reason.lowered_authority', 60);
  }
  actor.crownAuthority = level;
  actor.cooldowns.crown_authority = ctx.s.date + BALANCE.authority.crownAuthorityCooldownDays;
}

export function changeSuccessionLaw(ctx: Ctx, actorId: string, titleId: string, law: 'partition' | 'primogeniture' | 'elective' | 'seniority'): void {
  const actor = must(ctx.s, actorId);
  if (actor.titleIds[0] !== titleId) throw new GameError(ErrorCodes.TITLE_NOT_HELD, 'Titre principal requis');
  const t = ctx.s.titles[titleId]!;
  if (t.successionLaw === law) return;
  const cd = actor.cooldowns.succession_law;
  if (cd && cd > ctx.s.date) throw new GameError(ErrorCodes.ON_COOLDOWN, 'Changement récent', { until: cd });
  const cost = law === 'primogeniture' ? 400 : 200;
  if (law === 'primogeniture' && actor.crownAuthority < 2) throw new GameError(ErrorCodes.REQUIREMENTS_NOT_MET, 'Autorité royale 2 requise');
  if (actor.authority < cost) throw new GameError(ErrorCodes.INSUFFICIENT_AUTHORITY, 'Autorité insuffisante', { cost });
  actor.authority -= cost;
  t.successionLaw = law;
  actor.cooldowns.succession_law = ctx.s.date + 3650;
  for (const v of directVassals(ctx.s, actorId)) addOpinion(ctx.s, v.id, actorId, -10, 'opinion.reason.changed_succession', 60);
}

export { militaryStrength };
