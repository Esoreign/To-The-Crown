/**
 * Boucle de simulation : un appel = un jour. Les traitements mensuels et
 * annuels sont déclenchés au premier jour du mois / de l'année. L'IA est
 * étalée dans le temps (aiNextThink) pour éviter les pics de calcul.
 */
import { isFirstOfMonth, isFirstOfYear, type GameState } from '@ttc/shared';
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
  for (const c of Object.values(s.characters)) {
    if (c.pregnancy && c.death === null && c.pregnancy.due <= s.date) safeRun(ctx, `birth:${c.id}`, () => processBirth(ctx, c));
  }
  safeRun(ctx, 'armies', () => dailyArmies(ctx));
  safeRun(ctx, 'battles', () => dailyBattles(ctx));
  safeRun(ctx, 'sieges', () => dailySieges(ctx));
  safeRun(ctx, 'wars', () => dailyWarChecks(ctx));
  safeRun(ctx, 'constructions', () => processConstructions(ctx));
  safeRun(ctx, 'proposals', () => expireProposals(ctx));
  dailyAi(ctx);
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
  for (const c of Object.values(s.characters)) {
    if (c.isPlayer || c.death !== null || !c.titleIds.length) continue;
    if (c.aiNextThink > s.date) continue;
    c.aiNextThink = s.date + BALANCE.ai.thinkIntervalDays + ctx.rng.int(-BALANCE.ai.thinkJitter / 2, BALANCE.ai.thinkJitter);
    safeRun(ctx, `aiThink:${c.id}`, () => aiThink(ctx, c.id));
  }
}

export function monthly(ctx: Ctx): void {
  const s = ctx.s;
  const ids = Object.keys(s.characters);
  for (const id of ids) {
    const c = s.characters[id];
    if (!c || c.death !== null) continue;
    safeRun(ctx, `monthly:${id}`, () => monthlyCharacter(ctx, c));
  }
  safeRun(ctx, 'schemes', () => monthlySchemes(ctx));
  safeRun(ctx, 'factions', () => monthlyFactions(ctx));
  monthlyLevies(s);
  for (const p of Object.values(s.provinces)) {
    const occupied = !!s.titles[PROVINCE_GEO[p.id]!.countyTitleId]?.occupiedBy;
    p.development = Math.min(BALANCE.economy.developmentMax, p.development + developmentGrowth(s, p.id));
    if (!occupied) p.control = Math.min(100, p.control + BALANCE.economy.controlGrowth * (1 + provinceModifier(s, p.id, 'control_growth') * 4));
    if (p.modifiers.some((m) => m.expires !== null && m.expires <= s.date)) p.modifiers = p.modifiers.filter((m) => m.expires === null || m.expires > s.date);
  }
  updatePlayerStats(s);
}

function monthlyCharacter(ctx: Ctx, c: GameState['characters'][string]): void {
  const s = ctx.s;
  pruneOpinions(c, s.date);
  pruneFlags(c, s.date);
  if (c.modifiers.some((m) => m.expires !== null && m.expires <= s.date)) c.modifiers = c.modifiers.filter((m) => m.expires === null || m.expires > s.date);
  if (c.titleIds.length) {
    const ledger = ledgerOf(s, c);
    c.gold = Math.round((c.gold + ledger.net) * 100) / 100;
    c.prestige = Math.round((c.prestige + sumRows(monthlyPrestige(s, c))) * 100) / 100;
    c.fervor = Math.max(0, Math.round((c.fervor + sumRows(monthlyFervor(s, c))) * 100) / 100);
    c.authority = Math.min(1000, Math.round((c.authority + sumRows(monthlyAuthority(s, c))) * 100) / 100);
    monthlyCouncil(ctx, c);
    pulseEvents(ctx, c.id);
    // Renommée dynastique : les grands dirigeants font briller leur maison.
    const house = c.houseId ? s.houses[c.houseId] : undefined;
    if (house) {
      const gain = rankOf(c) * 0.15;
      house.renown += gain;
      const dyn = s.dynasties[house.dynastyId];
      if (dyn) dyn.renown += gain;
    }
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
