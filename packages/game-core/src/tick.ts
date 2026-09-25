/**
 * Boucle de simulation : un appel = un jour. Les traitements mensuels et
 * annuels sont déclenchés au premier jour du mois / de l'année. L'IA est
 * étalée dans le temps (aiNextThink) pour éviter les pics de calcul.
 */
import { fromDay, isFirstOfMonth, isFirstOfYear, type GameState } from '@ttc/shared';
import { aiThink } from './ai/think';
import { aiWarTick } from './ai/war';
import { dailyArmies, dailyBattles, dailySieges, monthlyLevies } from './armies';
import { BALANCE } from './balance';
import { processConstructions } from './buildings';
import { isAlive } from './characters';
import { safeRun, type Ctx } from './context';
import { PROVINCE_GEO } from './content';
import { monthlyCouncil } from './council-tick';
import { ledgerOf, monthlyAuthority, monthlyFervor, monthlyPrestige, sumRows } from './economy';
import { processEventQueue, pulseEvents } from './events/engine';
import { pruneFlags } from './flags';
import { monthlyEducation, monthlyFertility, monthlyHealth, processBirth } from './lifecycle';
import { monthlyBetrothals } from './marriage';
import { monthlyFactions } from './factions';
import { pruneOpinions } from './opinion';
import { expireProposals } from './proposals';
import { developmentGrowth, provinceModifier } from './provinces';
import { rankOf } from './realm';
import { monthlySchemes } from './schemes';
import { legitimacyTarget, monthlyLegitimacy } from './politics';
import { updatePlayerStats } from './stats';
import { dailyWarChecks, warsOf } from './war';
import { bumpStructure } from './index-cache';

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function advanceDay(ctx: Ctx): void {
  const s = ctx.s;
  s.date += 1;
  bumpStructure();
  safeRun(ctx, 'events', () => processEventQueue(ctx));
  for (const b of Object.values(ctx.r.characters)) {
    if (!b.pregnancy || b.death !== null || b.pregnancy.due > s.date) continue;
    const c = s.characters[b.id];
    if (c?.pregnancy && c.death === null && c.pregnancy.due <= s.date) safeRun(ctx, `birth:${c.id}`, () => processBirth(ctx, c));
  }
  safeRun(ctx, 'armies', () => dailyArmies(ctx));
  safeRun(ctx, 'battles', () => dailyBattles(ctx));
  safeRun(ctx, 'sieges', () => dailySieges(ctx));
  safeRun(ctx, 'wars', () => dailyWarChecks(ctx));
  safeRun(ctx, 'constructions', () => processConstructions(ctx));
  safeRun(ctx, 'proposals', () => expireProposals(ctx));
  dailyAi(ctx);
  dailyCharacterCycle(ctx);
  if (isFirstOfMonth(s.date)) monthly(ctx);
  if (isFirstOfYear(s.date)) yearly(ctx);
}

function dailyAi(ctx: Ctx): void {
  const s = ctx.s;
  const atWar = new Set<string>();
  for (const w of Object.values(s.wars)) for (const p of [...w.attackers, ...w.defenders]) atWar.add(p);
  for (const a of Object.values(s.armies)) atWar.add(a.ownerId);
  for (const id of atWar) {
    const c = s.characters[id];
    if (!c || c.isPlayer || !isAlive(c)) continue;
    if ((hash(id) + s.date) % 3 === 0) safeRun(ctx, `aiWar:${id}`, () => aiWarTick(ctx, id));
  }
  for (const b of Object.values(ctx.r.characters)) {
    if (b.isPlayer || b.death !== null || !b.titleIds.length || b.aiNextThink > s.date) continue;
    const c = s.characters[b.id];
    if (!c || c.isPlayer || c.death !== null || !c.titleIds.length || c.aiNextThink > s.date) continue;
    // Les petits seigneurs réfléchissent moins souvent que les souverains (et
    // plus souvent en guerre) : le coût de l'IA reste borné à l'échelle du monde.
    const interval = atWar.has(c.id) ? BALANCE.ai.thinkIntervalDays : (BALANCE.ai.thinkIntervalByRank[rankOf(c) - 1] ?? BALANCE.ai.thinkIntervalDays);
    c.aiNextThink = s.date + interval + ctx.rng.int(-BALANCE.ai.thinkJitter / 2, BALANCE.ai.thinkJitter);
    safeRun(ctx, `aiThink:${c.id}`, () => aiThink(ctx, c.id));
  }
}

/**
 * Cycle mensuel des personnages étalé sur le mois : chacun est traité une
 * fois par mois, le jour fixé par son identifiant (1..28). À l'échelle du
 * monde, cela évite un pic de calcul (et de patches réseau) le 1er du mois.
 */
function dailyCharacterCycle(ctx: Ctx): void {
  const s = ctx.s;
  const dom = fromDay(s.date).day;
  if (dom > CYCLE_DAYS) return;
  for (const b of Object.values(ctx.r.characters)) {
    if (b.death !== null || (hash(b.id) % CYCLE_DAYS) + 1 !== dom) continue;
    const c = s.characters[b.id];
    if (!c || c.death !== null) continue;
    safeRun(ctx, `monthly:${c.id}`, () => monthlyCharacter(ctx, c));
  }
}
const CYCLE_DAYS = 28;

export function monthly(ctx: Ctx): void {
  const s = ctx.s;
  safeRun(ctx, 'schemes', () => monthlySchemes(ctx));
  safeRun(ctx, 'factions', () => monthlyFactions(ctx));
  monthlyLevies(ctx);
  for (const b of Object.values(ctx.r.provinces)) {
    if (!b.modifiers.some((m) => m.expires !== null && m.expires <= s.date)) continue;
    const p = s.provinces[b.id]!;
    p.modifiers = p.modifiers.filter((m) => m.expires === null || m.expires > s.date);
  }
  updatePlayerStats(s);
}

function monthlyCharacter(ctx: Ctx, c: GameState['characters'][string]): void {
  const s = ctx.s;
  pruneOpinions(c, s.date);
  pruneFlags(c, s.date);
  if (c.modifiers.some((m) => m.expires !== null && m.expires <= s.date)) c.modifiers = c.modifiers.filter((m) => m.expires === null || m.expires > s.date);
  if (c.titleIds.length) {
    // Calculs en lecture sur la vue économe, puis écriture sur le brouillon.
    const r = ctx.r;
    const rc = r.characters[c.id]!;
    const ledger = ledgerOf(r, rc);
    const prestige = sumRows(monthlyPrestige(r, rc));
    const fervor = sumRows(monthlyFervor(r, rc));
    const authority = sumRows(monthlyAuthority(r, rc));
    c.gold = Math.round((c.gold + ledger.net) * 100) / 100;
    c.prestige = Math.round((c.prestige + prestige) * 100) / 100;
    c.fervor = Math.max(0, Math.round((c.fervor + fervor) * 100) / 100);
    c.authority = Math.min(1000, Math.round((c.authority + authority) * 100) / 100);
    monthlyCouncil(ctx, c);
    if (!c.liegeId) monthlyLegitimacy(ctx, c, legitimacyTarget(r, c).total);
    pulseEvents(ctx, c.id);
  }
  if (c.death !== null) return;
  c.stress = Math.max(0, c.stress - BALANCE.stress.monthlyDecay);
  monthlyHealth(ctx, c);
  if (c.death !== null) return;
  monthlyFertility(ctx, c);
  monthlyEducation(ctx, c);
  monthlyBetrothals(ctx, c);
}

function yearly(ctx: Ctx): void {
  const s = ctx.s;
  // Croissance annuelle des provinces (équivalent de douze mois).
  for (const p of Object.values(s.provinces)) {
    const occupied = !!s.titles[PROVINCE_GEO[p.id]!.countyTitleId]?.occupiedBy;
    const dev = Math.min(BALANCE.economy.developmentMax, p.development + developmentGrowth(ctx.r, p.id) * 12);
    if (Math.abs(dev - p.development) >= 0.005) p.development = Math.round(dev * 100) / 100;
    if (!occupied && p.control < 100) p.control = Math.min(100, Math.round((p.control + BALANCE.economy.controlGrowth * 12 * (1 + provinceModifier(ctx.r, p.id, 'control_growth') * 4)) * 100) / 100);
  }
  // Renommée dynastique : les grands dirigeants font briller leur maison.
  for (const b of Object.values(ctx.r.characters)) {
    if (b.death !== null || !b.titleIds.length || !b.houseId) continue;
    const house = s.houses[b.houseId];
    if (!house) continue;
    const gain = rankOf(b) * 0.15 * 12;
    house.renown = Math.round((house.renown + gain) * 10) / 10;
    const dyn = s.dynasties[house.dynastyId];
    if (dyn) dyn.renown = Math.round((dyn.renown + gain) * 10) / 10;
  }
  for (const [id, cl] of Object.entries(s.claims)) {
    const c = s.characters[cl.characterId];
    if (!c || c.death !== null || (cl.expires !== null && cl.expires <= s.date)) delete s.claims[id];
    else if (s.titles[cl.titleId]?.holderId === cl.characterId) delete s.claims[id];
  }
  // Nettoyage : secrets de personnages morts depuis longtemps.
  for (const [id, sec] of Object.entries(s.secrets)) {
    const owner = s.characters[sec.ownerId];
    if (!owner || (owner.death !== null && s.date - owner.death > 365 * 5)) delete s.secrets[id];
  }
  void warsOf;
}

/** Utilitaire pour la simulation headless (état mutable, sans Immer). */
export function advanceDays(ctx: Ctx, days: number): void {
  for (let i = 0; i < days; i++) advanceDay(ctx);
}

export type { GameState };
