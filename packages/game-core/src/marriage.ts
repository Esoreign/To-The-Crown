/**
 * Mariages et fiançailles : éligibilité, score d'acceptation IA, exécution
 * (alliances, cour, chronique).
 */
import { ErrorCodes, GameError, type Character, type GameView } from '@ttc/shared';
import { BALANCE } from './balance';
import { acceptance, type Acceptance, type AcceptRow } from './acceptance';
import { ageOf, characterModifier, isAdult, isAlive, skill } from './characters';
import { chronicle, log, newId, notify, type Ctx } from './context';
import { FAITH_BY_ID } from './content';
import { fireOnAction } from './events/engine';
import { isCloseRelative } from './family';
import { addOpinion, areAllied, atWarWith, opinion } from './opinion';
import { rankOf, topLiegeId } from './realm';
import { consumeHook, usableHook } from './secrets';
import { planSuccession } from './succession';
import { bumpStructure } from './index-cache';

/** Personnage qui décide pour `charId` (lui-même s'il est titré, sinon le maître de sa cour). */
export function decisionMaker(state: Pick<GameView, 'characters'>, charId: string): Character | undefined {
  const c = state.characters[charId];
  if (!c) return undefined;
  if (c.titleIds.length || !c.courtId) return c;
  const court = state.characters[c.courtId];
  return court && isAlive(court) ? court : c;
}

/** Le dirigeant peut-il arranger le mariage de ce personnage ? */
export function canArrangeFor(state: GameView, actorId: string, charId: string): boolean {
  if (actorId === charId) return true;
  const c = state.characters[charId];
  if (!c || !isAlive(c) || c.isPlayer) return false;
  if (c.titleIds.length) return false;
  return c.courtId === actorId;
}

export function marriageBlocker(state: GameView, a: Character, b: Character): string | null {
  if (!isAlive(a) || !isAlive(b)) return 'dead';
  if (a.id === b.id || a.sex === b.sex) return 'invalid';
  if (a.spouseId || b.spouseId) return 'married';
  if (a.betrothedId || b.betrothedId) return 'betrothed';
  if (isCloseRelative(state, a, b)) return 'relatives';
  if (a.prisonerOf || b.prisonerOf) return 'prisoner';
  const minAge = 8;
  if (ageOf(a, state.date) < minAge || ageOf(b, state.date) < minAge) return 'too_young';
  if (a.sex === 'F' && ageOf(a, state.date) > 50 && !isAdult(b, state.date)) return 'age';
  if (b.sex === 'F' && ageOf(b, state.date) > 50 && !isAdult(a, state.date)) return 'age';
  return null;
}

/**
 * Score d'acceptation d'une proposition de mariage entre `suitor` (famille
 * de `actor`) et `candidate`, du point de vue du décideur du candidat.
 */
export function evaluateMarriage(state: GameView, actorId: string, suitorId: string, candidateId: string, useHook = false): Acceptance {
  const actor = state.characters[actorId]!;
  const suitor = state.characters[suitorId]!;
  const cand = state.characters[candidateId]!;
  const decider = decisionMaker(state, candidateId)!;
  const rows: AcceptRow[] = [{ key: 'base', value: -10 }];
  if (decider.id !== actorId) rows.push({ key: 'opinion', value: opinion(state, decider.id, actorId) * 0.5 });
  if (decider.id !== cand.id && cand.id !== decider.id) rows.push({ key: 'candidate_opinion', value: opinion(state, cand.id, suitorId) * 0.15 });
  rows.push({ key: 'rank', value: (rankOf(actor) - rankOf(decider)) * 12 });
  rows.push({ key: 'prestige', value: Math.max(-10, Math.min(20, actor.prestige / 150)) });
  const quality =
    (skill(state, suitor, 'diplomacy') + skill(state, suitor, 'martial') + skill(state, suitor, 'stewardship') + skill(state, suitor, 'intrigue') + skill(state, suitor, 'learning')) /
    5;
  rows.push({ key: 'suitor_quality', value: (quality - 6) * 1.5 + characterModifier(state, suitor, 'attraction_opinion') * 0.3 });
  const ageDiff = Math.abs(ageOf(suitor, state.date) - ageOf(cand, state.date));
  if (ageDiff > 8) rows.push({ key: 'age_gap', value: -(ageDiff - 8) * 2 });
  const woman = suitor.sex === 'F' ? suitor : cand;
  if (ageOf(woman, state.date) > 40) rows.push({ key: 'infertile', value: -25 });
  if (actor.titleIds.length && planSuccession(state, actor).primaryHeirId === suitorId) rows.push({ key: 'suitor_is_heir', value: 15 });
  if (decider.titleIds.length && planSuccession(state, decider).primaryHeirId === candidateId) rows.push({ key: 'candidate_is_heir', value: -10 });
  const claims = Object.values(state.claims).filter((c) => c.characterId === suitorId).length;
  if (claims) rows.push({ key: 'claims', value: Math.min(20, claims * 8) });
  if (suitor.faithId !== cand.faithId) {
    const sameFamily = FAITH_BY_ID[suitor.faithId]?.family === FAITH_BY_ID[cand.faithId]?.family;
    rows.push({ key: 'faith', value: sameFamily ? -8 : -25 });
  }
  if (suitor.cultureId !== cand.cultureId) rows.push({ key: 'culture', value: -5 });
  if (decider.id !== actorId && topLiegeId(state, decider.id) !== topLiegeId(state, actorId) && !areAllied(state, decider.id, actorId)) {
    rows.push({ key: 'alliance_value', value: 10 });
  }
  if (atWarWith(state, decider.id, actorId)) rows.push({ key: 'at_war', value: -200 });
  if (decider.personality.ambition > 30) rows.push({ key: 'ambition', value: (rankOf(actor) - rankOf(decider)) * 5 });
  if (useHook) {
    const hook = usableHook(state, actorId, decider.id);
    if (hook) rows.push({ key: hook.strong ? 'strong_hook' : 'weak_hook', value: hook.strong ? 100 : 40 });
  }
  const block = marriageBlocker(state, suitor, cand);
  if (block) rows.push({ key: `blocked_${block}`, value: -1000 });
  return acceptance(rows);
}

/** Célèbre un mariage (ou des fiançailles si un des deux est mineur). */
export function marry(ctx: Ctx, aId: string, bId: string, arrangers: [string, string]): void {
  const s = ctx.s;
  const a = s.characters[aId]!;
  const b = s.characters[bId]!;
  const block = marriageBlocker(s, a, b);
  if (block) throw new GameError(ErrorCodes.INVALID_TARGET, `Mariage impossible : ${block}`);
  const minors = !isAdult(a, s.date) || !isAdult(b, s.date);
  if (minors) {
    a.betrothedId = b.id;
    b.betrothedId = a.id;
  } else {
    a.spouseId = b.id;
    b.spouseId = a.id;
    // L'épouse rejoint la cour du mari, sauf si elle est dirigeante de rang supérieur.
    const husband = a.sex === 'M' ? a : b;
    const wife = a.sex === 'F' ? a : b;
    if (!wife.titleIds.length) wife.courtId = husband.titleIds.length ? husband.id : husband.courtId;
    else if (!husband.titleIds.length && rankOf(wife) > 0) husband.courtId = wife.id;
    bumpStructure();
  }
  log(ctx, minors ? 'betrothal' : 'marriage', a.id, { a: a.id, b: b.id });
  addOpinion(s, a.id, b.id, 10, 'opinion.reason.married', 120);
  addOpinion(s, b.id, a.id, 10, 'opinion.reason.married', 120);
  // Alliance entre les deux familles régnantes.
  const [r1, r2] = arrangers;
  const rr1 = s.characters[r1];
  const rr2 = s.characters[r2];
  if (rr1 && rr2 && r1 !== r2 && rr1.titleIds.length && rr2.titleIds.length && !areAllied(s, r1, r2)) {
    const aid = newId(s, 'al');
    s.alliances[aid] = { id: aid, a: r1, b: r2, reason: 'marriage', createdAt: s.date, viaMarriage: [a.id, b.id] };
    bumpStructure();
    notify(ctx, [r1, r2], { level: 'important', kind: 'alliance_formed', vars: { a: rr1.firstName, b: rr2.firstName }, focus: { type: 'character', id: r2 } });
  }
  addOpinion(s, r1, r2, 15, 'opinion.reason.marriage_ties', 120);
  addOpinion(s, r2, r1, 15, 'opinion.reason.marriage_ties', 120);
  notify(ctx, [a.id, b.id, r1, r2], {
    level: 'important',
    kind: minors ? 'betrothal' : 'marriage',
    vars: { a: a.firstName, b: b.firstName },
    focus: { type: 'character', id: a.id },
    sound: 'fanfare',
  });
  if (!minors && (rankOf(a) >= 3 || rankOf(b) >= 3 || rankOf(s.characters[r1]!) >= 3 || rankOf(s.characters[r2]!) >= 3)) {
    chronicle(ctx, 'royal_marriage', { a: a.id, b: b.id }, [a.id, b.id]);
  }
  if (!minors) fireOnAction(ctx, 'marriage', r1, { target: a.id === r1 ? b.id : a.id });
}

/**
 * Proposition de mariage : acceptation immédiate par l'IA ou proposition en
 * attente si le décideur est un joueur humain.
 */
export function proposeMarriage(
  ctx: Ctx,
  actorId: string,
  suitorId: string,
  candidateId: string,
  useHook = false,
): { accepted: boolean; pending: boolean; acceptance: Acceptance } {
  const s = ctx.s;
  if (!canArrangeFor(s, actorId, suitorId)) throw new GameError(ErrorCodes.FORBIDDEN, 'Vous ne pouvez pas marier ce personnage');
  const cand = s.characters[candidateId];
  const suitor = s.characters[suitorId];
  if (!cand || !suitor) throw new GameError(ErrorCodes.INVALID_TARGET, 'Personnage inconnu');
  const block = marriageBlocker(s, suitor, cand);
  if (block) throw new GameError(block === 'married' ? ErrorCodes.ALREADY_MARRIED : ErrorCodes.INVALID_TARGET, `Mariage impossible : ${block}`);
  const decider = decisionMaker(s, candidateId)!;
  const acc = evaluateMarriage(s, actorId, suitorId, candidateId, useHook);
  if (decider.isPlayer && decider.id !== actorId) {
    const pid = newId(s, 'pr');
    s.proposals[pid] = {
      id: pid,
      kind: 'marriage',
      fromId: actorId,
      toId: decider.id,
      subjects: [suitorId, candidateId],
      createdAt: s.date,
      expiresAt: s.date + 30,
      hookId: useHook ? usableHook(s, actorId, decider.id)?.id ?? null : null,
    };
    notify(ctx, [decider.id], { level: 'urgent', kind: 'proposal_marriage', vars: { from: s.characters[actorId]!.firstName }, focus: { type: 'character', id: suitorId }, sound: 'notify' });
    return { accepted: false, pending: true, acceptance: acc };
  }
  if (!acc.accept && decider.id !== actorId) return { accepted: false, pending: false, acceptance: acc };
  if (useHook) {
    const hook = usableHook(s, actorId, decider.id);
    if (hook) consumeHook(ctx, hook.id);
  }
  marry(ctx, suitorId, candidateId, [actorId, decider.id]);
  return { accepted: true, pending: false, acceptance: acc };
}

/**
 * Candidats au mariage pour un membre de la famille (UI et IA). Un pré-tri
 * bon marché (rang de la cour, écart d'âge) limite les évaluations complètes.
 */
export function marriageCandidates(
  state: GameView,
  actorId: string,
  suitorId: string,
  limit = 40,
  maxEvaluate = 400,
): { id: string; acceptance: Acceptance }[] {
  const suitor = state.characters[suitorId];
  if (!suitor) return [];
  const sAge = ageOf(suitor, state.date);
  const pre: { c: Character; cheap: number }[] = [];
  for (const c of Object.values(state.characters)) {
    if (c.death !== null || c.sex === suitor.sex || c.spouseId || c.betrothedId || c.prisonerOf) continue;
    if (c.isPlayer && c.id !== actorId) continue;
    const age = ageOf(c, state.date);
    if (Math.abs(age - sAge) > 20 || age < 12) continue;
    if (!c.courtId && !c.titleIds.length) continue;
    const court = c.titleIds.length ? c : state.characters[c.courtId ?? ''];
    pre.push({ c, cheap: (court ? rankOf(court) * 10 : 0) - Math.abs(age - sAge) });
  }
  pre.sort((a, b) => b.cheap - a.cheap);
  const out: { id: string; acceptance: Acceptance }[] = [];
  for (const { c } of pre.slice(0, maxEvaluate)) {
    if (marriageBlocker(state, suitor, c)) continue;
    out.push({ id: c.id, acceptance: evaluateMarriage(state, actorId, suitorId, c.id) });
  }
  out.sort((a, b) => b.acceptance.score - a.acceptance.score);
  return out.slice(0, limit);
}

/** Les fiancés deviennent époux à leur majorité (tick mensuel). */
export function monthlyBetrothals(ctx: Ctx, c: Character): void {
  if (!c.betrothedId || c.sex !== 'M') return;
  const other = ctx.s.characters[c.betrothedId];
  if (!other || !isAlive(other)) {
    c.betrothedId = null;
    return;
  }
  if (isAdult(c, ctx.s.date) && isAdult(other, ctx.s.date)) {
    if (c.prisonerOf || other.prisonerOf) return;
    c.betrothedId = null;
    other.betrothedId = null;
    if (marriageBlocker(ctx.s, c, other)) return;
    const r1 = decisionMaker(ctx.s, c.id)!.id;
    const r2 = decisionMaker(ctx.s, other.id)!.id;
    marry(ctx, c.id, other.id, [r1, r2]);
  }
}

export { BALANCE };
