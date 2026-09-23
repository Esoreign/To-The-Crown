/**
 * Simulation headless et invariants de cohérence (utilisés par les tests
 * et le script `pnpm simulate`).
 */
import { RANK_ORDER, type GameState, type ScenarioData } from '@ttc/shared';
import { isAlive } from './characters';
import { TITLE_DEFS } from './content';
import { simulateDaysMutable } from './engine';
import { rankOf } from './realm';
import { createGameState, type NewPlayer } from './state';

export function checkInvariants(s: GameState): string[] {
  const errors: string[] = [];
  const finite = (v: number, what: string) => {
    if (!Number.isFinite(v)) errors.push(`${what} non fini (${v})`);
  };
  let alive = 0;
  for (const c of Object.values(s.characters)) {
    if (c.fatherId === c.id || c.motherId === c.id) errors.push(`${c.id} est son propre parent`);
    if (c.fatherId && !s.characters[c.fatherId]) errors.push(`${c.id} : père inconnu`);
    if (c.motherId && !s.characters[c.motherId]) errors.push(`${c.id} : mère inconnue`);
    if (c.death !== null) {
      if (c.titleIds.length) errors.push(`${c.id} mort mais titré`);
      if (c.isPlayer) errors.push(`${c.id} mort mais joueur`);
      continue;
    }
    alive++;
    for (const k of ['gold', 'prestige', 'fervor', 'authority', 'stress', 'health', 'fertility'] as const) finite(c[k], `${c.id}.${k}`);
    if (c.spouseId) {
      const sp = s.characters[c.spouseId];
      if (!sp || sp.spouseId !== c.id || !isAlive(sp)) errors.push(`${c.id} : mariage incohérent`);
    }
    for (const t of c.titleIds) if (s.titles[t]?.holderId !== c.id) errors.push(`${c.id} : titre ${t} non réciproque`);
    if (c.liegeId) {
      const l = s.characters[c.liegeId];
      if (!l || !isAlive(l) || !l.titleIds.length) errors.push(`${c.id} : suzerain invalide`);
      else if (rankOf(l) <= rankOf(c)) errors.push(`${c.id} : suzerain de rang inférieur ou égal`);
      let cur: string | null = c.liegeId;
      let guard = 0;
      while (cur && guard++ < 12) cur = s.characters[cur]?.liegeId ?? null;
      if (guard >= 12) errors.push(`${c.id} : cycle de vassalité`);
    }
    if (c.titleIds.length === 0 && c.liegeId) errors.push(`${c.id} : sans terre mais vassal`);
  }
  if (alive > 2500) errors.push(`Explosion démographique : ${alive} vivants`);
  if (alive < 150) errors.push(`Effondrement démographique : ${alive} vivants`);
  for (const t of Object.values(s.titles)) {
    const def = TITLE_DEFS[t.id]!;
    if (t.holderId) {
      const h = s.characters[t.holderId];
      if (!h || !isAlive(h)) errors.push(`${t.id} : détenteur mort`);
      else if (!h.titleIds.includes(t.id)) errors.push(`${t.id} : détenteur sans le titre`);
    } else if (def.rank === 'county') errors.push(`${t.id} : comté sans détenteur`);
    void RANK_ORDER;
  }
  for (const p of Object.values(s.provinces)) {
    finite(p.development, `${p.id}.development`);
    finite(p.control, `${p.id}.control`);
    if (p.levies < 0) errors.push(`${p.id} : levées négatives`);
  }
  for (const a of Object.values(s.armies)) {
    if (!isAlive(s.characters[a.ownerId])) errors.push(`${a.id} : propriétaire mort`);
    for (const [u, n] of Object.entries(a.units)) if ((n ?? 0) < 0 || !Number.isFinite(n ?? 0)) errors.push(`${a.id} : ${u} invalide`);
  }
  for (const w of Object.values(s.wars)) {
    if (s.date > w.maxEnd + 30) errors.push(`${w.id} : guerre interminable`);
    for (const p of [...w.attackers, ...w.defenders]) if (!isAlive(s.characters[p])) errors.push(`${w.id} : participant mort`);
  }
  for (const r of Object.values(s.relations)) {
    if (!s.characters[r.a] || !s.characters[r.b]) errors.push(`${r.id} : relation orpheline`);
  }
  for (const pl of Object.values(s.players)) {
    const c = s.characters[pl.characterId];
    if (!pl.gameOver && (!c || !isAlive(c) || !c.isPlayer)) errors.push(`Joueur ${pl.userId} : personnage invalide`);
  }
  return errors;
}

export interface SimulationReport {
  years: number;
  finalDate: number;
  alive: number;
  landed: number;
  wars: number;
  warsStarted: number;
  battles: number;
  deaths: number;
  births: number;
  marriages: number;
  eventsFired: number;
  independentRulers: number;
  richest: number;
  msPerMonth: number;
  invariantErrors: string[];
}

export function simulateGame(
  scenario: ScenarioData,
  opts: { years: number; seed: number; players?: NewPlayer[]; checkEveryMonths?: number },
): { state: GameState; report: SimulationReport } {
  const state = createGameState(scenario, { gameId: 'sim', seed: opts.seed, players: opts.players ?? [] });
  const days = Math.round(opts.years * 365);
  const errors: string[] = [];
  const counts = { warsStarted: 0, battles: 0, deaths: 0, births: 0, marriages: 0, eventsFired: 0 };
  const start = performance.now();
  for (let d = 0; d < days; d++) {
    const [out] = simulateDaysMutable(state, 1);
    for (const l of out!.log) {
      if (l.type === 'war.declare') counts.warsStarted++;
      if (l.type === 'battle.end') counts.battles++;
      if (l.type === 'event.resolved' || l.type === 'event.fired') counts.eventsFired++;
      if (l.type === 'birth') counts.births++;
      if (l.type === 'error') errors.push(`[jour ${state.date}] erreur système ${String(l.payload.label)} : ${String(l.payload.message)}`);
      if (l.type === 'marriage') counts.marriages++;
    }
    if ((opts.checkEveryMonths ?? 12) > 0 && d % (30 * (opts.checkEveryMonths ?? 12)) === 0) {
      const e = checkInvariants(state);
      if (e.length) errors.push(...e.slice(0, 20).map((x) => `[jour ${state.date}] ${x}`));
    }
  }
  errors.push(...checkInvariants(state));
  const elapsed = performance.now() - start;
  const living = Object.values(state.characters).filter((c) => c.death === null);
  counts.deaths = Object.values(state.characters).filter((c) => c.death !== null && c.death > state.startDate).length;
  const report: SimulationReport = {
    years: opts.years,
    finalDate: state.date,
    alive: living.length,
    landed: living.filter((c) => c.titleIds.length).length,
    wars: Object.keys(state.wars).length,
    ...counts,
    independentRulers: living.filter((c) => c.titleIds.length && !c.liegeId).length,
    richest: Math.round(Math.max(...living.map((c) => c.gold))),
    msPerMonth: Math.round((elapsed / Math.max(1, days / 30.4)) * 10) / 10,
    invariantErrors: [...new Set(errors)],
  };
  return { state, report };
}
