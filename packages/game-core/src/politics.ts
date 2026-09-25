/**
 * Institutions : formes de gouvernement, légitimité des dirigeants et
 * contrats de sujétion (vassaux autonomes, tributaires, clients, unions).
 *
 * - Les contrats relient des TITRES (ils survivent aux successions).
 * - Un tributaire ou un client reste un royaume distinct : il verse chaque
 *   mois une part de ses revenus à son suzerain (lignes de trésorerie).
 * - Un vassal dans le royaume paie l'impôt habituel, modulé par son type de
 *   contrat (un vassal autonome ou un confédéré paie moins).
 * - La légitimité (0..100) tend vers une cible calculée selon les sources
 *   que valorise le gouvernement ; elle pèse sur l'opinion des vassaux.
 */
import { GOVERNMENT_BY_ID, type GovernmentDef, type GovernmentId } from '@ttc/content';
import { ErrorCodes, GameError, type Character, type GameState, type GameView, type Pact, type SubjectType } from '@ttc/shared';
import { BALANCE } from './balance';
import { ageOf, isAlive } from './characters';
import { addOpinion } from './opinion';
import { notify, type Ctx } from './context';
import { bumpStructure, getIndex } from './index-cache';

type View = Pick<GameView, 'pacts' | 'titles' | 'characters' | 'relations' | 'alliances' | 'wars' | 'houses'>;

function pactsByTitles(state: View, titleIds: readonly string[], by: 'pactsBySubjectTitle' | 'pactsByOverlordTitle'): Pact[] {
  const map = getIndex(state)[by];
  const out: Pact[] = [];
  for (const t of titleIds) {
    const ids = map.get(t);
    if (!ids) continue;
    for (const id of ids) {
      const p = state.pacts[id];
      if (p) out.push(p);
    }
  }
  return out;
}

export function governmentOf(c: Pick<Character, 'government'> | undefined): GovernmentDef | undefined {
  return c?.government ? GOVERNMENT_BY_ID[c.government as GovernmentId] : undefined;
}

/** Multiplicateur d'impôt prélevé sur les vassaux selon le gouvernement du suzerain. */
export function governmentTaxFactor(liege: Pick<Character, 'government'>): number {
  const g = governmentOf(liege);
  return g ? g.subjectTax / BALANCE.politics.subjectTaxReference : 1;
}

/** Multiplicateur de levées exigées des vassaux selon le gouvernement du suzerain. */
export function governmentLevyFactor(liege: Pick<Character, 'government'>): number {
  const g = governmentOf(liege);
  return g ? g.subjectLevy / BALANCE.politics.subjectLevyReference : 1;
}

/** Niveau d'autorité centrale le plus élevé permis par le gouvernement. */
export function maxCrownAuthority(c: Pick<Character, 'government'>): number {
  const g = governmentOf(c);
  return Math.min(BALANCE.politics.maxAuthorityLevel, g?.maxAuthority ?? BALANCE.politics.maxAuthorityLevel);
}

/** Coût en autorité pour atteindre un niveau d'autorité centrale. */
export function crownAuthorityCost(c: Pick<Character, 'government'>, level: number): number {
  const base = BALANCE.authority.crownAuthorityCost[level] ?? 999;
  return Math.round(base * (governmentOf(c)?.authorityCost ?? 1));
}

/** Les vassaux d'un suzerain peuvent-ils se faire la guerre entre eux ? */
export function allowsVassalWars(liege: Pick<Character, 'government' | 'crownAuthority'>): boolean {
  return liege.crownAuthority <= 1 && governmentOf(liege)?.vassalWars !== false;
}

/** Types de sujétion qui placent le sujet à l'intérieur du royaume du suzerain. */
export const IN_REALM_SUBJECTS = new Set<SubjectType>(['direct_vassal', 'autonomous_vassal', 'personal_union', 'confederate_member']);

/** Contrats dont le personnage est le sujet (par ses titres). */
export function pactsAsSubject(state: View, charId: string): Pact[] {
  const c = state.characters[charId];
  if (!c) return [];
  return pactsByTitles(state, c.titleIds, 'pactsBySubjectTitle');
}

/** Contrats dont le personnage est le suzerain. */
export function pactsAsOverlord(state: View, charId: string): Pact[] {
  const c = state.characters[charId];
  if (!c) return [];
  return pactsByTitles(state, c.titleIds, 'pactsByOverlordTitle').filter((p) => state.titles[p.subjectTitleId]?.holderId !== charId);
}

/** Tributaires et clients : royaumes distincts versant un tribut. */
export function isExternalPact(p: Pact): boolean {
  return !IN_REALM_SUBJECTS.has(p.type);
}

/** Facteur d'impôt d'un vassal selon son contrat. */
export function vassalContractFactor(state: View, vassalId: string, liegeId: string): number {
  const liege = state.characters[liegeId];
  if (!liege) return 1;
  const held = new Set(liege.titleIds);
  const pact = pactsAsSubject(state, vassalId).find((p) => held.has(p.overlordTitleId));
  return pact ? (BALANCE.politics.vassalTaxFactor[pact.type] ?? 1) : 1;
}

/** Tribut mensuel dû au titre d'un contrat externe (part du revenu du domaine). */
export function tributeOf(state: GameView, pact: Pact, domainIncome: (c: Character) => number): number {
  if (!isExternalPact(pact)) return 0;
  const subjectId = state.titles[pact.subjectTitleId]?.holderId;
  const overlordId = state.titles[pact.overlordTitleId]?.holderId;
  if (!subjectId || !overlordId || subjectId === overlordId) return 0;
  const subject = state.characters[subjectId];
  if (!subject || !isAlive(subject)) return 0;
  return Math.max(0, domainIncome(subject) * pact.tribute);
}

// ---------------------------------------------------------------------------
// Légitimité
// ---------------------------------------------------------------------------

export interface LegitimacyRow {
  key: string;
  value: number;
}

/** Cible de légitimité et sa décomposition (affichée dans l'interface). */
export function legitimacyTarget(state: GameView, c: Character): { total: number; rows: LegitimacyRow[] } {
  const L = BALANCE.politics.legitimacy;
  const rows: LegitimacyRow[] = [{ key: 'base', value: L.base }];
  const gov = governmentOf(c);
  const from = new Set(gov?.legitimacyFrom ?? ['dynasty']);
  const house = c.houseId ? state.houses[c.houseId] : undefined;
  const renown = house ? state.dynasties[house.dynastyId]?.renown ?? house.renown : 0;
  const dyn = Math.min(L.dynastyMax, renown / L.renownPerPoint) * (from.has('dynasty') ? 1.5 : 1);
  if (dyn >= 1) rows.push({ key: 'dynasty', value: Math.round(dyn) });
  const prestige = Math.min(L.prestigeMax, Math.max(-10, c.prestige / L.prestigePerPoint)) * (from.has('victory') ? 1.5 : 1);
  if (Math.abs(prestige) >= 1) rows.push({ key: 'prestige', value: Math.round(prestige) });
  if (from.has('religion')) {
    const f = Math.min(L.fervorMax, c.fervor / L.fervorPerPoint);
    if (f >= 1) rows.push({ key: 'religion', value: Math.round(f) });
  }
  if (from.has('wealth')) {
    const w = Math.min(L.wealthMax, Math.max(0, c.gold) / L.goldPerPoint);
    if (w >= 1) rows.push({ key: 'wealth', value: Math.round(w) });
  }
  if (from.has('election')) rows.push({ key: 'election', value: L.election });
  if (from.has('mandate')) rows.push({ key: 'mandate', value: c.crownAuthority * L.mandatePerAuthority });
  const age = ageOf(c, state.date);
  if (age < 16) rows.push({ key: 'minor', value: L.minor });
  else if (from.has('age') && age >= 40) rows.push({ key: 'age', value: L.elder });
  if (c.traits.includes('lunatic')) rows.push({ key: 'madness', value: L.madness });
  if (c.traits.includes('kinslayer') || c.traits.includes('murderer')) rows.push({ key: 'crimes', value: L.crimes });
  const total = Math.max(0, Math.min(100, rows.reduce((s, r) => s + r.value, 0)));
  return { total, rows };
}

export function legitimacyOf(c: Character): number {
  return c.legitimacy ?? BALANCE.politics.legitimacy.base;
}

/** Évolution mensuelle de la légitimité d'un dirigeant (vers sa cible). */
export function monthlyLegitimacy(ctx: Ctx, c: Character, target: number): void {
  const cur = legitimacyOf(c);
  const drift = governmentOf(c)?.legitimacyDrift ?? 0;
  const next = Math.max(0, Math.min(100, cur + (target - cur) * BALANCE.politics.legitimacy.convergence + drift));
  const rounded = Math.round(next * 10) / 10;
  if (rounded !== c.legitimacy) c.legitimacy = rounded;
  void ctx;
}

/** Opinion d'un vassal envers un suzerain due à la légitimité de celui-ci. */
export function legitimacyOpinion(liege: Character): number {
  return Math.round((legitimacyOf(liege) - 50) / BALANCE.politics.legitimacy.opinionDivisor);
}

// ---------------------------------------------------------------------------
// Commandes : fixer le tribut, affranchir un sujet
// ---------------------------------------------------------------------------

export type TributeLevel = 'light' | 'normal' | 'heavy';

function ownPact(state: GameState, actorId: string, pactId: string): Pact {
  const pact = state.pacts[pactId];
  const actor = state.characters[actorId];
  if (!pact || !actor || !actor.titleIds.includes(pact.overlordTitleId))
    throw new GameError(ErrorCodes.INVALID_TARGET, 'Vous n’êtes pas le suzerain de ce contrat');
  return pact;
}

export function setTribute(ctx: Ctx, actorId: string, pactId: string, level: TributeLevel): void {
  const s = ctx.s;
  const pact = ownPact(s, actorId, pactId);
  if (!isExternalPact(pact)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Seuls les tributaires et clients versent un tribut');
  const rate = BALANCE.politics.tributeLevels[level];
  if (rate === pact.tribute) return;
  const heavier = rate > pact.tribute;
  pact.tribute = rate;
  const subject = s.titles[pact.subjectTitleId]?.holderId;
  if (subject) {
    addOpinion(s, subject, actorId, heavier ? BALANCE.politics.tributeOpinion.heavier : BALANCE.politics.tributeOpinion.lighter, heavier ? 'opinion.reason.tribute_raised' : 'opinion.reason.tribute_lowered', 720);
    notify(ctx, [subject, actorId], { level: 'important', kind: 'tribute_changed', vars: { title: pact.subjectTitleId, pct: Math.round(rate * 100) }, focus: { type: 'title', id: pact.subjectTitleId } });
  }
}

export function releaseSubject(ctx: Ctx, actorId: string, pactId: string): void {
  const s = ctx.s;
  const pact = ownPact(s, actorId, pactId);
  const subject = s.titles[pact.subjectTitleId]?.holderId;
  delete s.pacts[pactId];
  bumpStructure();
  if (subject) {
    const c = s.characters[subject];
    if (c && c.liegeId === actorId && IN_REALM_SUBJECTS.has(pact.type)) c.liegeId = null;
    addOpinion(s, subject, actorId, BALANCE.politics.releaseOpinion, 'opinion.reason.released', 3650);
    notify(ctx, [subject, actorId], { level: 'important', kind: 'subject_released', vars: { title: pact.subjectTitleId }, focus: { type: 'title', id: pact.subjectTitleId } });
  }
  const actor = s.characters[actorId];
  if (actor) actor.prestige += BALANCE.politics.releasePrestige;
}

/** Supprime les contrats d'un sujet envers un suzerain (indépendance gagnée). */
export function endPactsBetween(state: GameState, subjectId: string, overlordId: string): void {
  const sub = state.characters[subjectId];
  const ov = state.characters[overlordId];
  if (!sub || !ov) return;
  const st = new Set(sub.titleIds);
  const ot = new Set(ov.titleIds);
  let changed = false;
  for (const [id, p] of Object.entries(state.pacts))
    if (st.has(p.subjectTitleId) && ot.has(p.overlordTitleId)) {
      delete state.pacts[id];
      changed = true;
    }
  if (changed) bumpStructure();
}
