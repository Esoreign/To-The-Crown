/**
 * Économie : revenus/dépenses mensuels détaillés (ledger), ressources
 * mensuelles (prestige, ferveur, autorité), levées disponibles.
 */
import type { Character, GameView, UnitType } from '@ttc/shared';
import { BALANCE } from './balance';
import { governmentLevyFactor, governmentTaxFactor, pactsAsOverlord, pactsAsSubject, tributeOf, vassalContractFactor } from './politics';
import { characterModifier, domainProvinceIds, skill } from './characters';
import { UNIT_BY_ID } from './content';
import { opinionOf } from './opinion';
import { isOccupied, provinceMaxLevies, provinceTax } from './provinces';
import { directVassals, domainLimit, rankOf } from './realm';
import { seatSkill } from './council';

export interface LedgerRow {
  /** Clé de localisation « ledger.<key> ». */
  key: string;
  value: number;
  vars?: Record<string, string | number>;
}

export interface Ledger {
  income: LedgerRow[];
  expenses: LedgerRow[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
}

/** Part d'impôt reversée par un vassal (selon autorité royale et opinion). */
export function vassalTaxShare(state: GameView, liege: Character, vassal: Character): number {
  const byAuth = BALANCE.economy.vassalTaxByAuthority[liege.crownAuthority] ?? 0.2;
  const op = opinionOf(state, vassal.id, liege.id).total;
  const opFactor = Math.max(0.5, Math.min(1.25, 1 + op / 200));
  return byAuth * opFactor * governmentTaxFactor(liege);
}

export function vassalLevyShare(state: GameView, liege: Character, vassal: Character): number {
  const byAuth = BALANCE.economy.vassalLevyByAuthority[liege.crownAuthority] ?? 0.3;
  const op = opinionOf(state, vassal.id, liege.id).total;
  const opFactor = Math.max(0.25, Math.min(1.25, 1 + op / 100));
  return byAuth * opFactor * governmentLevyFactor(liege);
}

/** Pénalité de domaine (0..1) quand le personnage détient trop de comtés. */
export function domainPenalty(state: GameView, c: Character): number {
  const over = Math.max(0, domainProvinceIds(c).length - domainLimit(state, c));
  return Math.min(0.75, over * BALANCE.economy.overDomainPenalty);
}

/** Revenu brut de domaine (avant partage avec le suzerain). */
export function domainIncome(state: GameView, c: Character): number {
  let total = 0;
  for (const pid of domainProvinceIds(c)) total += provinceTax(state, pid);
  return total * (1 - domainPenalty(state, c));
}

export function armyUpkeep(state: GameView, c: Character): { levies: number; maa: number } {
  let levyMen = 0;
  for (const a of Object.values(state.armies)) {
    if (a.ownerId !== c.id) continue;
    levyMen += a.units.levy ?? 0;
  }
  let maa = 0;
  for (const [u, men] of Object.entries(c.maa) as [UnitType, number][]) maa += ((men ?? 0) / 100) * (UNIT_BY_ID[u]?.upkeep ?? 0);
  const maaMult = Math.max(0.3, 1 + characterModifier(state, c, 'maa_upkeep_mult'));
  return { levies: (levyMen / 100) * UNIT_BY_ID.levy.upkeep, maa: maa * maaMult };
}

export function ledgerOf(state: GameView, c: Character): Ledger {
  const income: LedgerRow[] = [];
  const expenses: LedgerRow[] = [];
  const domain = domainIncome(state, c);
  if (domain > 0) income.push({ key: 'domain', value: domain });
  const penalty = domainPenalty(state, c);
  if (penalty > 0) income.push({ key: 'domain_penalty', value: 0, vars: { pct: Math.round(penalty * 100) } });

  let vassalTaxes = 0;
  for (const v of directVassals(state, c.id)) vassalTaxes += domainIncome(state, v) * vassalTaxShare(state, c, v) * vassalContractFactor(state, v.id, c.id);
  if (vassalTaxes > 0) income.push({ key: 'vassal_taxes', value: vassalTaxes });
  let tributes = 0;
  for (const p of pactsAsOverlord(state, c.id)) tributes += tributeOf(state, p, (x) => domainIncome(state, x));
  if (tributes > 0) income.push({ key: 'tribute_received', value: tributes });

  // Intendant : collecte des impôts.
  if (c.council?.steward.task === 'steward_taxes') {
    const s = seatSkill(state, c, 'steward');
    const v = (domain + vassalTaxes) * s * BALANCE.council.taxPerSkill;
    if (v > 0) income.push({ key: 'steward_taxes', value: v });
  }
  const stew = skill(state, c, 'stewardship');
  const stewBonus = (domain + vassalTaxes) * Math.max(0, stew - 10) * BALANCE.economy.stewardshipIncomePerPoint;
  if (stewBonus > 0) income.push({ key: 'stewardship', value: stewBonus });
  const traitMult = characterModifier(state, c, 'monthly_income_mult');
  if (traitMult) income.push({ key: 'traits', value: (domain + vassalTaxes) * traitMult });

  // Dépenses.
  if (c.liegeId) {
    const liege = state.characters[c.liegeId];
    if (liege) {
      const paid = domain * vassalTaxShare(state, liege, c) * vassalContractFactor(state, c.id, liege.id);
      if (paid > 0) expenses.push({ key: 'liege_tax', value: paid });
    }
  }
  let tributePaid = 0;
  for (const p of pactsAsSubject(state, c.id)) tributePaid += tributeOf(state, p, (x) => domainIncome(state, x));
  if (tributePaid > 0) expenses.push({ key: 'tribute_paid', value: tributePaid });
  const rank = rankOf(c);
  if (rank > 0) expenses.push({ key: 'court', value: BALANCE.economy.courtUpkeep[rank - 1] ?? 0 });
  const upkeep = armyUpkeep(state, c);
  if (upkeep.levies > 0) expenses.push({ key: 'levies', value: upkeep.levies });
  if (upkeep.maa > 0) expenses.push({ key: 'maa', value: upkeep.maa });
  if (c.gold < 0) expenses.push({ key: 'debt_interest', value: Math.min(5, Math.abs(c.gold) * 0.01) });

  const totalIncome = income.reduce((s, r) => s + r.value, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.value, 0);
  return { income, expenses, totalIncome, totalExpenses, net: totalIncome - totalExpenses };
}

export interface ResourceRow {
  key: string;
  value: number;
}

export function monthlyPrestige(state: GameView, c: Character): ResourceRow[] {
  const rows: ResourceRow[] = [];
  const rank = rankOf(c);
  if (rank > 0) rows.push({ key: 'rank', value: BALANCE.prestige.monthlyByRank[rank - 1] ?? 0 });
  const dip = skill(state, c, 'diplomacy') * BALANCE.prestige.monthlyFromDiplomacy;
  if (dip) rows.push({ key: 'diplomacy', value: dip });
  const mod = characterModifier(state, c, 'monthly_prestige');
  if (mod) rows.push({ key: 'modifiers', value: mod });
  if (c.council?.chancellor.task === 'chancellor_prestige') {
    const v = seatSkill(state, c, 'chancellor') * BALANCE.council.prestigePerSkill;
    if (v) rows.push({ key: 'chancellor', value: v });
  }
  if (c.gold < 0) rows.push({ key: 'debt', value: -1 });
  return rows;
}

export function monthlyFervor(state: GameView, c: Character): ResourceRow[] {
  const rows: ResourceRow[] = [{ key: 'base', value: BALANCE.fervor.monthlyBase }];
  const learn = skill(state, c, 'learning') * BALANCE.fervor.monthlyFromLearning;
  if (learn) rows.push({ key: 'learning', value: learn });
  const mod = characterModifier(state, c, 'monthly_fervor');
  if (mod) rows.push({ key: 'modifiers', value: mod });
  if (c.council?.scholar.task === 'scholar_fervor') {
    const v = seatSkill(state, c, 'scholar') * BALANCE.council.fervorPerSkill;
    if (v) rows.push({ key: 'scholar', value: v });
  }
  return rows;
}

export function monthlyAuthority(state: GameView, c: Character): ResourceRow[] {
  const rank = rankOf(c);
  if (rank === 0) return [];
  const rows: ResourceRow[] = [{ key: 'rank', value: BALANCE.authority.monthlyByRank[rank - 1] ?? 0 }];
  rows.push({ key: 'stewardship', value: skill(state, c, 'stewardship') * BALANCE.authority.monthlyFromStewardship });
  const mod = characterModifier(state, c, 'monthly_authority');
  if (mod) rows.push({ key: 'modifiers', value: mod });
  return rows;
}

export const sumRows = (rows: { value: number }[]) => rows.reduce((s, r) => s + r.value, 0);

/** Levées disponibles : domaine + part des vassaux directs. */
export function availableLevies(state: GameView, c: Character): { domain: number; vassals: number; total: number } {
  let domain = 0;
  for (const pid of domainProvinceIds(c)) {
    if (isOccupied(state, pid)) continue;
    domain += state.provinces[pid]?.levies ?? 0;
  }
  domain *= 1 - domainPenalty(state, c);
  let vassals = 0;
  for (const v of directVassals(state, c.id)) {
    let vl = 0;
    for (const pid of domainProvinceIds(v)) vl += state.provinces[pid]?.levies ?? 0;
    vassals += vl * vassalLevyShare(state, c, v);
  }
  const mult = 1 + characterModifier(state, c, 'levy_size_mult');
  return { domain: Math.round(domain * mult), vassals: Math.round(vassals * mult), total: Math.round((domain + vassals) * mult) };
}

export function maxLeviesOfDomain(state: GameView, c: Character): number {
  return domainProvinceIds(c).reduce((s, pid) => s + provinceMaxLevies(state, pid), 0);
}

/** Force militaire estimée d'un dirigeant (levées + hommes d'armes + armées levées). */
export function militaryStrength(state: GameView, c: Character): number {
  let raised = 0;
  for (const a of Object.values(state.armies)) {
    if (a.ownerId !== c.id) continue;
    for (const [u, men] of Object.entries(a.units) as [UnitType, number][]) raised += (men ?? 0) * unitPower(u);
  }
  let maaStock = 0;
  for (const [u, men] of Object.entries(c.maa) as [UnitType, number][]) maaStock += (men ?? 0) * unitPower(u);
  const levies = availableLevies(state, c).total;
  // Les hommes d'armes déjà levés sont comptés dans les armées : on évite le double compte.
  const maaRaised = Object.values(state.armies)
    .filter((a) => a.ownerId === c.id)
    .reduce((s, a) => s + Object.entries(a.units).reduce((t, [u, m]) => t + (u === 'levy' ? 0 : (m ?? 0) * unitPower(u as UnitType)), 0), 0);
  return raised + Math.max(0, maaStock - maaRaised) + levies;
}

export function unitPower(u: UnitType): number {
  const d = UNIT_BY_ID[u];
  return d ? (d.damage + d.toughness) / 20 : 1;
}
