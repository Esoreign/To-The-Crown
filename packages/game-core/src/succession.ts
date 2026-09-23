/**
 * Succession : calcul des héritiers selon la loi du titre principal
 * (partage, primogéniture, élection, ancienneté) et répartition des titres.
 */
import { RANK_ORDER, type Character, type GameState, type GameView, type SuccessionLaw } from '@ttc/shared';
import { ageOf, isAdult, isAlive, skill } from './characters';
import { FAITH_BY_ID, TITLE_DEFS } from './content';
import { childrenOf, dynastyMembers, siblingsOf } from './family';
import { opinion } from './opinion';
import { directVassals, rankOf } from './realm';
import { isDeJureAncestor } from './titles';
import { memo } from './index-cache';

export interface SuccessionPlan {
  law: SuccessionLaw;
  primaryHeirId: string | null;
  /** titre → héritier (null = pas d'héritier). */
  titles: Record<string, string | null>;
  heirs: string[];
  /** Candidats et votes (élection). */
  election?: { candidateId: string; votes: number }[];
}

function sexAllowed(deceased: Character): 'equal' | 'allowed' | 'disallowed' {
  return FAITH_BY_ID[deceased.faithId]?.doctrines.femaleRulers ?? 'allowed';
}

function orderChildren(state: GameView, c: Character, mode: 'equal' | 'allowed' | 'disallowed'): Character[] {
  const kids = childrenOf(state, c, false).filter((k) => !k.flags.bastard);
  const sorted = [...kids].sort((a, b) => a.birth - b.birth);
  if (mode === 'equal') return sorted;
  const men = sorted.filter((k) => k.sex === 'M');
  const women = sorted.filter((k) => k.sex === 'F');
  return mode === 'disallowed' ? men : [...men, ...women];
}

/** Ordre de primogéniture (lignée descendante, puis fratrie, puis dynastie). */
export function primogenitureLine(state: GameView, c: Character, limit = 12): Character[] {
  const mode = sexAllowed(c);
  const out: Character[] = [];
  const seen = new Set<string>([c.id]);
  const visit = (p: Character) => {
    for (const k of orderChildren(state, p, mode)) {
      if (out.length >= limit) return;
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      if (isAlive(k)) out.push(k);
      visit(k);
    }
  };
  visit(c);
  if (out.length < limit) {
    for (const sib of siblingsOf(state, c, false).sort((a, b) => a.birth - b.birth)) {
      if (mode === 'disallowed' && sib.sex === 'F') continue;
      if (seen.has(sib.id)) continue;
      seen.add(sib.id);
      if (isAlive(sib)) out.push(sib);
      visit(sib);
    }
  }
  if (out.length === 0) {
    const house = c.houseId ? state.houses[c.houseId] : undefined;
    if (house) {
      const members = dynastyMembers(state, house.dynastyId)
        .filter((m) => m.id !== c.id && (mode !== 'disallowed' || m.sex === 'M'))
        .sort((a, b) => a.birth - b.birth);
      out.push(...members.slice(0, limit));
    }
  }
  return out.filter((x) => !x.flags.no_inherit);
}

function seniorityHeir(state: GameView, c: Character): Character | null {
  const mode = sexAllowed(c);
  const house = c.houseId ? state.houses[c.houseId] : undefined;
  if (!house) return primogenitureLine(state, c, 1)[0] ?? null;
  const members = dynastyMembers(state, house.dynastyId).filter((m) => m.id !== c.id && isAlive(m));
  const eligible = members.filter((m) => mode !== 'disallowed' || m.sex === 'M');
  const adults = eligible.filter((m) => isAdult(m, state.date));
  const pool = (adults.length ? adults : eligible).sort((a, b) => {
    if (mode === 'allowed' && a.sex !== b.sex) return a.sex === 'M' ? -1 : 1;
    return a.birth - b.birth;
  });
  return pool[0] ?? null;
}

export function electors(state: GameView, c: Character): Character[] {
  const vassals = directVassals(state, c.id).filter((v) => rankOf(v) >= 2);
  const out = vassals.length ? vassals : directVassals(state, c.id);
  return [c, ...out].filter(isAlive);
}

export function electionCandidates(state: GameView, c: Character): Character[] {
  const set = new Map<string, Character>();
  for (const k of primogenitureLine(state, c, 4)) if (isAdult(k, state.date)) set.set(k.id, k);
  for (const v of directVassals(state, c.id)) if (rankOf(v) >= 2 && isAdult(v, state.date)) set.set(v.id, v);
  if (c.nominatedHeirId) {
    const n = state.characters[c.nominatedHeirId];
    if (n && isAlive(n)) set.set(n.id, n);
  }
  if (set.size === 0) for (const k of primogenitureLine(state, c, 2)) set.set(k.id, k);
  return [...set.values()];
}

/** Score IA d'un candidat du point de vue d'un électeur. */
export function candidateScore(state: GameView, elector: Character, cand: Character): number {
  let s = opinion(state, elector.id, cand.id) * 0.6;
  s += (skill(state, cand, 'diplomacy') + skill(state, cand, 'martial') + skill(state, cand, 'stewardship')) * 0.8;
  s += Math.min(20, ageOf(cand, state.date) - 16) * 0.5;
  if (elector.id === cand.id) s += 60;
  if (cand.houseId && cand.houseId === elector.houseId) s += 25;
  s += rankOf(cand) * 5;
  return s;
}

export function electionResult(state: GameView, c: Character, titleId: string): { candidateId: string; votes: number }[] {
  const cands = electionCandidates(state, c);
  if (!cands.length) return [];
  const votes = new Map<string, number>(cands.map((k) => [k.id, 0]));
  const title = state.titles[titleId];
  for (const e of electors(state, c)) {
    const manual = title?.electionVotes[e.id];
    let choice: string | undefined = manual && votes.has(manual) ? manual : undefined;
    if (!choice) {
      if (e.id === c.id && c.nominatedHeirId && votes.has(c.nominatedHeirId)) choice = c.nominatedHeirId;
      else choice = [...cands].sort((a, b) => candidateScore(state, e, b) - candidateScore(state, e, a))[0]!.id;
    }
    votes.set(choice, (votes.get(choice) ?? 0) + (e.id === c.id ? 2 : 1));
  }
  return [...votes.entries()]
    .map(([candidateId, v]) => ({ candidateId, votes: v }))
    .sort((a, b) => b.votes - a.votes || (a.candidateId === c.nominatedHeirId ? -1 : 0));
}

/** Calcule la répartition des titres à la mort d'un personnage (mémoïsé par état). */
export function planSuccession(state: GameView, c: Character): SuccessionPlan {
  return memo(state, `succ:${c.id}`, () => planSuccessionRaw(state, c));
}

function planSuccessionRaw(state: GameView, c: Character): SuccessionPlan {
  const primary = c.titleIds[0];
  const law: SuccessionLaw = primary ? state.titles[primary]?.successionLaw ?? 'partition' : 'primogeniture';
  const titles: Record<string, string | null> = {};
  if (!primary) return { law, primaryHeirId: null, titles, heirs: [] };

  if (law === 'elective') {
    const election = electionResult(state, c, primary);
    const winner = election[0]?.candidateId ?? primogenitureLine(state, c, 1)[0]?.id ?? null;
    for (const t of c.titleIds) titles[t] = winner;
    return { law, primaryHeirId: winner, titles, heirs: winner ? [winner] : [], election };
  }
  if (law === 'seniority') {
    const heir = seniorityHeir(state, c);
    for (const t of c.titleIds) titles[t] = heir?.id ?? null;
    return { law, primaryHeirId: heir?.id ?? null, titles, heirs: heir ? [heir.id] : [] };
  }
  const line = primogenitureLine(state, c);
  const main = line[0] ?? null;
  if (law === 'primogeniture' || !main) {
    for (const t of c.titleIds) titles[t] = main?.id ?? null;
    return { law, primaryHeirId: main?.id ?? null, titles, heirs: main ? [main.id] : [] };
  }
  // Partage : héritiers = enfants vivants éligibles (ou l'héritier principal seul).
  const mode = sexAllowed(c);
  let heirs = orderChildren(state, c, mode).filter(isAlive);
  if (!heirs.length || heirs[0]!.id !== main.id) heirs = [main, ...heirs.filter((h) => h.id !== main.id)];
  titles[primary] = main.id;
  const others = c.titleIds.filter((t) => t !== primary);
  const highTitles = others.filter((t) => TITLE_DEFS[t]!.rank !== 'county').sort(
    (a, b) => RANK_ORDER[TITLE_DEFS[b]!.rank] - RANK_ORDER[TITLE_DEFS[a]!.rank],
  );
  let turn = heirs.length > 1 ? 1 : 0;
  for (const t of highTitles) {
    titles[t] = heirs[turn % heirs.length]!.id;
    turn++;
  }
  const capital = TITLE_DEFS[primary]!.capitalProvinceId;
  const counties = others.filter((t) => TITLE_DEFS[t]!.rank === 'county');
  const unassigned: string[] = [];
  for (const county of counties) {
    const prov = TITLE_DEFS[county]!.provinceId!;
    if (prov === capital) {
      titles[county] = main.id;
      continue;
    }
    // Un comté suit le titre supérieur dont il dépend de jure (hors titre principal).
    const owner = highTitles.find((ht) => isDeJureAncestor(ht, county));
    if (owner) titles[county] = titles[owner]!;
    else unassigned.push(county);
  }
  turn = 0;
  for (const county of unassigned) {
    titles[county] = heirs[turn % heirs.length]!.id;
    turn++;
  }
  // Le comté principal de chaque héritier : garantir au moins un comté par héritier titré.
  const counts = new Map<string, number>();
  for (const [t, h] of Object.entries(titles)) if (h && TITLE_DEFS[t]!.rank === 'county') counts.set(h, (counts.get(h) ?? 0) + 1);
  for (const h of heirs) {
    const hasHigh = Object.entries(titles).some(([t, x]) => x === h.id && TITLE_DEFS[t]!.rank !== 'county');
    if (hasHigh && !counts.get(h.id)) {
      const donor = Object.entries(titles).find(
        ([t, x]) => x === main.id && TITLE_DEFS[t]!.rank === 'county' && TITLE_DEFS[t]!.provinceId !== capital,
      );
      if (donor) titles[donor[0]] = h.id;
    }
  }
  return { law, primaryHeirId: main.id, titles, heirs: heirs.map((h) => h.id).filter((id) => Object.values(titles).includes(id)) };
}

export function isPrimaryHeir(state: GameView, holderId: string, candidateId: string): boolean {
  const c = state.characters[holderId];
  return !!c && planSuccession(state, c).primaryHeirId === candidateId;
}

/** Héritier « joueur » : l'héritier principal de même dynastie, sinon un autre héritier de même dynastie. */
export function playerHeir(state: GameState | GameView, c: Character, plan: SuccessionPlan): string | null {
  const dyn = c.houseId ? state.houses[c.houseId]?.dynastyId : undefined;
  const sameDyn = (id: string | null) => {
    if (!id) return false;
    const h = state.characters[id]?.houseId;
    return !!h && state.houses[h]?.dynastyId === dyn;
  };
  if (plan.primaryHeirId && sameDyn(plan.primaryHeirId)) return plan.primaryHeirId;
  for (const h of plan.heirs) if (sameDyn(h)) return h;
  return null;
}
