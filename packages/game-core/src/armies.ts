/**
 * Armées : levée, dissolution, déplacement (A*), batailles et sièges.
 */
import {
  ErrorCodes,
  GameError,
  type Army,
  type Battle,
  type BattleSide,
  type Character,
  type GameState,
  type GameView,
  type Terrain,
  type UnitType,
} from '@ttc/shared';
import { BALANCE } from './balance';
import { addTrait, characterModifier, domainProvinceIds, isAdult, isAlive, skill } from './characters';
import { chronicle, log, newId, notify, type Ctx } from './context';
import { CULTURE_BY_ID, PROVINCE_GEO, TRAIT_BY_ID, UNIT_BY_ID, kmBetween } from './content';
import { killCharacter } from './death';
import { fireOnAction } from './events/engine';
import { vassalLevyShare, domainPenalty } from './economy';
import { fortLevel, maxGarrison, provinceMaxLevies, provinceModifier, supplyLimit } from './provinces';
import { capitalProvinceOf, courtiers, directVassals, holderOfProvince, topLiegeId } from './realm';
import { hostileWar, sideOf, warsOf } from './war';

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
export function armyMen(a: Pick<Army, 'units'>): number {
  let n = 0;
  for (const v of Object.values(a.units)) n += v ?? 0;
  return Math.round(n);
}

export function moveDays(from: string, to: string): number {
  const g = PROVINCE_GEO[to];
  const gf = PROVINCE_GEO[from];
  if (!g || !gf) return 99;
  const strait = gf.straits.includes(to);
  const km = kmBetween(gf.centroid, g.centroid);
  const days = (km / BALANCE.army.kmPerDay) * (BALANCE.army.terrainMoveMult[g.terrain] ?? 1) + (strait ? BALANCE.army.straitExtraDays : 0);
  return Math.max(BALANCE.army.minMoveDays, Math.round(days));
}

/** A* sur le graphe des provinces (coût = jours de marche). */
export function findPath(from: string, to: string): string[] | null {
  if (from === to) return [];
  if (!PROVINCE_GEO[from] || !PROVINCE_GEO[to]) return null;
  const goal = PROVINCE_GEO[to]!;
  const h = (id: string) => {
    const g = PROVINCE_GEO[id]!;
    return (kmBetween(g.centroid, goal.centroid) / BALANCE.army.kmPerDay) * 0.9;
  };
  const open = new Map<string, number>([[from, h(from)]]);
  const gScore = new Map<string, number>([[from, 0]]);
  const came = new Map<string, string>();
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const [id, f] of open) {
      if (f < best) {
        best = f;
        cur = id;
      }
    }
    if (cur === to) {
      const path = [to];
      let x = to;
      while (came.has(x) && came.get(x) !== from) {
        x = came.get(x)!;
        path.unshift(x);
      }
      return path;
    }
    open.delete(cur);
    const geo = PROVINCE_GEO[cur]!;
    for (const n of [...geo.neighbors, ...geo.straits]) {
      const tentative = gScore.get(cur)! + moveDays(cur, n);
      if (tentative < (gScore.get(n) ?? Infinity)) {
        came.set(n, cur);
        gScore.set(n, tentative);
        open.set(n, tentative + h(n));
      }
    }
  }
  return null;
}

export function pathDays(from: string, path: string[]): number {
  let total = 0;
  let cur = from;
  for (const p of path) {
    total += moveDays(cur, p);
    cur = p;
  }
  return total;
}

/** Meilleur commandant disponible (dirigeant, maréchal, courtisans). */
export function bestCommander(state: GameView, ownerId: string): string | null {
  const owner = state.characters[ownerId];
  if (!owner) return null;
  const busy = new Set(Object.values(state.armies).map((a) => a.commanderId).filter(Boolean));
  const pool: Character[] = [owner, ...courtiers(state, ownerId)].filter(
    (c) => isAlive(c) && isAdult(c, state.date) && !c.prisonerOf && !busy.has(c.id) && (c.id === ownerId || !c.isPlayer),
  );
  pool.sort((a, b) => skill(state, b, 'martial') - skill(state, a, 'martial'));
  return pool[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Levée / dissolution
// ---------------------------------------------------------------------------
export function raiseArmy(ctx: Ctx, ownerId: string, rallyProvinceId?: string): Army {
  const s = ctx.s;
  const owner = s.characters[ownerId];
  if (!owner || !isAlive(owner) || !owner.titleIds.length) throw new GameError(ErrorCodes.INVALID_TARGET, 'Dirigeant invalide');
  const domain = domainProvinceIds(owner);
  const rally = rallyProvinceId ?? capitalProvinceOf(owner);
  if (!rally || !domain.includes(rally)) throw new GameError(ErrorCodes.PROVINCE_NOT_OWNED, 'Point de ralliement invalide');
  const leviesFrom: Record<string, number> = {};
  let levy = 0;
  const penalty = 1 - domainPenalty(s, owner);
  const sizeMult = 1 + characterModifier(s, owner, 'levy_size_mult');
  for (const pid of domain) {
    const p = s.provinces[pid]!;
    if (s.titles[PROVINCE_GEO[pid]!.countyTitleId]?.occupiedBy) continue;
    const take = Math.floor(p.levies * penalty * sizeMult);
    if (take <= 0) continue;
    p.levies -= Math.floor(p.levies * penalty);
    leviesFrom[pid] = (leviesFrom[pid] ?? 0) + take;
    levy += take;
  }
  for (const v of directVassals(s, ownerId)) {
    const share = vassalLevyShare(s, owner, v);
    for (const pid of domainProvinceIds(v)) {
      const p = s.provinces[pid]!;
      if (s.titles[PROVINCE_GEO[pid]!.countyTitleId]?.occupiedBy) continue;
      const take = Math.floor(p.levies * share * sizeMult);
      if (take <= 0) continue;
      p.levies -= Math.floor(p.levies * share);
      leviesFrom[pid] = (leviesFrom[pid] ?? 0) + take;
      levy += take;
    }
  }
  // Hommes d'armes non encore levés.
  const raisedMaa: Partial<Record<UnitType, number>> = {};
  for (const a of Object.values(s.armies)) {
    if (a.ownerId !== ownerId) continue;
    for (const [u, men] of Object.entries(a.units) as [UnitType, number][]) if (u !== 'levy') raisedMaa[u] = (raisedMaa[u] ?? 0) + (men ?? 0);
  }
  const units: Partial<Record<UnitType, number>> = { levy };
  for (const [u, men] of Object.entries(owner.maa) as [UnitType, number][]) {
    const free = (men ?? 0) - (raisedMaa[u] ?? 0);
    if (free > 0) units[u] = free;
  }
  if (armyMen({ units }) < 50) throw new GameError(ErrorCodes.REQUIREMENTS_NOT_MET, 'Aucune troupe disponible');
  const id = newId(s, 'ar');
  const army: Army = {
    id,
    ownerId,
    commanderId: bestCommander(s, ownerId),
    location: rally,
    path: [],
    moveProgress: 0,
    moveTotal: 0,
    units,
    morale: 1,
    status: 'idle',
    leviesFrom,
    raisedAt: s.date,
    shattered: 0,
  };
  s.armies[id] = army;
  log(ctx, 'army.raise', ownerId, { armyId: id, men: armyMen(army), provinceId: rally });
  return army;
}

export function disbandArmy(ctx: Ctx, ownerId: string, armyId: string): void {
  const s = ctx.s;
  const a = s.armies[armyId];
  if (!a || a.ownerId !== ownerId) throw new GameError(ErrorCodes.ARMY_NOT_OWNED, 'Armée introuvable');
  if (a.status === 'battle') throw new GameError(ErrorCodes.ARMY_BUSY, 'Armée engagée en bataille');
  returnLevies(s, a);
  delete s.armies[armyId];
  for (const [id, sg] of Object.entries(s.sieges)) {
    sg.armyIds = sg.armyIds.filter((x) => x !== armyId);
    if (!sg.armyIds.length) delete s.sieges[id];
  }
}

function returnLevies(s: GameState, a: Army): void {
  const raised = Object.values(a.leviesFrom).reduce((x, y) => x + y, 0);
  const alive = a.units.levy ?? 0;
  const ratio = raised > 0 ? Math.min(1, alive / raised) : 0;
  for (const [pid, men] of Object.entries(a.leviesFrom)) {
    const p = s.provinces[pid];
    if (!p) continue;
    p.levies = Math.min(provinceMaxLevies(s, pid), p.levies + Math.round(men * ratio));
  }
}

export function mergeArmies(ctx: Ctx, ownerId: string, armyId: string, intoId: string): void {
  const s = ctx.s;
  const a = s.armies[armyId];
  const b = s.armies[intoId];
  if (!a || !b || a.ownerId !== ownerId || b.ownerId !== ownerId) throw new GameError(ErrorCodes.ARMY_NOT_OWNED, 'Armée introuvable');
  if (a.location !== b.location) throw new GameError(ErrorCodes.INVALID_TARGET, 'Les armées doivent être dans la même province');
  if (a.status === 'battle' || b.status === 'battle') throw new GameError(ErrorCodes.ARMY_BUSY, 'Armée engagée');
  for (const [u, men] of Object.entries(a.units) as [UnitType, number][]) b.units[u] = (b.units[u] ?? 0) + (men ?? 0);
  for (const [pid, men] of Object.entries(a.leviesFrom)) b.leviesFrom[pid] = (b.leviesFrom[pid] ?? 0) + men;
  b.morale = (b.morale + a.morale) / 2;
  if (!b.commanderId) b.commanderId = a.commanderId;
  delete s.armies[armyId];
}

export function setCommander(ctx: Ctx, ownerId: string, armyId: string, commanderId: string | null): void {
  const s = ctx.s;
  const a = s.armies[armyId];
  if (!a || a.ownerId !== ownerId) throw new GameError(ErrorCodes.ARMY_NOT_OWNED, 'Armée introuvable');
  if (commanderId) {
    const c = s.characters[commanderId];
    const ok =
      c && isAlive(c) && isAdult(c, s.date) && !c.prisonerOf && (c.id === ownerId || c.courtId === ownerId || c.liegeId === ownerId) && (!c.isPlayer || c.id === ownerId);
    if (!ok) throw new GameError(ErrorCodes.INVALID_TARGET, 'Commandant non éligible');
    for (const other of Object.values(s.armies)) if (other.commanderId === commanderId) other.commanderId = null;
  }
  a.commanderId = commanderId;
}

export function recruitMaa(ctx: Ctx, ownerId: string, unit: UnitType, men: number): void {
  const owner = ctx.s.characters[ownerId];
  if (!owner || !owner.titleIds.length) throw new GameError(ErrorCodes.INVALID_TARGET, 'Dirigeant invalide');
  const def = UNIT_BY_ID[unit];
  if (!def || unit === 'levy') throw new GameError(ErrorCodes.INVALID_TARGET, 'Unité inconnue');
  const cost = Math.round((men / 100) * def.cost);
  if (owner.gold < cost) throw new GameError(ErrorCodes.INSUFFICIENT_GOLD, 'Or insuffisant', { cost });
  owner.gold -= cost;
  owner.maa[unit] = (owner.maa[unit] ?? 0) + men;
  log(ctx, 'army.recruit', ownerId, { unit, men, cost });
}

// ---------------------------------------------------------------------------
// Déplacement
// ---------------------------------------------------------------------------
export function orderMove(ctx: Ctx, ownerId: string, armyId: string, to: string): string[] {
  const s = ctx.s;
  const a = s.armies[armyId];
  if (!a || a.ownerId !== ownerId) throw new GameError(ErrorCodes.ARMY_NOT_OWNED, 'Armée introuvable');
  if (a.status === 'battle') throw new GameError(ErrorCodes.ARMY_BUSY, 'Armée engagée en bataille');
  if (a.shattered > 0 && a.status === 'retreating') throw new GameError(ErrorCodes.ARMY_BUSY, 'Armée en déroute');
  const path = findPath(a.location, to);
  if (!path) throw new GameError(ErrorCodes.NO_PATH, 'Aucun chemin');
  // On quitte un siège.
  for (const [id, sg] of Object.entries(s.sieges)) {
    if (!sg.armyIds.includes(armyId)) continue;
    sg.armyIds = sg.armyIds.filter((x) => x !== armyId);
    if (!sg.armyIds.length) delete s.sieges[id];
  }
  a.path = path;
  a.moveProgress = 0;
  a.moveTotal = path.length ? moveDays(a.location, path[0]!) : 0;
  a.status = path.length ? 'moving' : 'idle';
  return path;
}

function hostileArmiesAt(s: GameState, provinceId: string, ownerId: string): Army[] {
  return Object.values(s.armies).filter((o) => o.location === provinceId && o.ownerId !== ownerId && hostileWar(s, o.ownerId, ownerId) && o.shattered <= 0);
}

/** Province hostile pour ce propriétaire (appartenant à un ennemi) ? Renvoie la guerre. */
function hostileProvinceWar(s: GameState, provinceId: string, ownerId: string) {
  const holder = holderOfProvince(s, provinceId);
  if (!holder) return null;
  const top = topLiegeId(s, holder);
  const occupier = s.titles[PROVINCE_GEO[provinceId]!.countyTitleId]?.occupiedBy ?? null;
  // Occupée : siège de libération si l'occupant est ennemi, rien sinon.
  if (occupier) return hostileWar(s, occupier, ownerId);
  return hostileWar(s, top, ownerId) ?? hostileWar(s, holder, ownerId);
}

export function dailyArmies(ctx: Ctx): void {
  const s = ctx.s;
  for (const a of Object.values(s.armies)) {
    if (!s.armies[a.id]) continue;
    if (a.shattered > 0) a.shattered--;
    if (a.shattered === 0 && a.status === 'retreating') a.status = a.path.length ? 'moving' : 'idle';
    if (a.morale < 1 && a.status !== 'battle') a.morale = Math.min(1, a.morale + BALANCE.army.moraleRecoveryDaily);
    // Attrition si la province ne peut nourrir l'armée.
    const men = armyMen(a);
    if (men > supplyLimit(s, a.location) && a.status !== 'battle') {
      for (const u of Object.keys(a.units) as UnitType[]) a.units[u] = Math.max(0, (a.units[u] ?? 0) * (1 - BALANCE.army.attritionOverSupply / 30));
    }
    if (a.status !== 'moving' && a.status !== 'retreating') continue;
    if (!a.path.length) {
      a.status = 'idle';
      continue;
    }
    a.moveProgress++;
    if (a.moveProgress < a.moveTotal) continue;
    a.location = a.path.shift()!;
    a.moveProgress = 0;
    a.moveTotal = a.path.length ? moveDays(a.location, a.path[0]!) : 0;
    if (!a.path.length && a.status === 'moving') a.status = 'idle';
    if (a.shattered > 0) continue;
    arrive(ctx, a);
  }
}

function arrive(ctx: Ctx, a: Army): void {
  const s = ctx.s;
  const enemies = hostileArmiesAt(s, a.location, a.ownerId);
  if (enemies.length) {
    startOrJoinBattle(ctx, a, enemies);
    return;
  }
  const war = hostileProvinceWar(s, a.location, a.ownerId);
  if (war && (a.status === 'idle' || !a.path.length)) {
    startSiege(ctx, a, war.id);
  }
}

// ---------------------------------------------------------------------------
// Batailles
// ---------------------------------------------------------------------------
function commanderAdvantage(state: GameView, commanderId: string | null, terrain: Terrain): number {
  const c = commanderId ? state.characters[commanderId] : undefined;
  if (!c) return 0;
  let adv = skill(state, c, 'martial');
  for (const t of c.traits) {
    const cmd = TRAIT_BY_ID[t]?.command;
    if (cmd && (!cmd.terrain || cmd.terrain.includes(terrain))) adv += cmd.advantage;
  }
  adv += characterModifier(state, c, 'commander_advantage');
  return adv;
}

function makeSide(state: GameView, armies: Army[], terrain: Terrain, defending: boolean, provinceId: string): BattleSide {
  const men = armies.reduce((s, a) => s + armyMen(a), 0);
  const lead = [...armies].sort((x, y) => armyMen(y) - armyMen(x))[0]!;
  let advantage = commanderAdvantage(state, lead.commanderId, terrain);
  if (defending) {
    const terrainBonus: Partial<Record<Terrain, number>> = { hills: 6, mountains: 12, forest: 5, marsh: 5, coast_cliffs: 4 };
    advantage += (terrainBonus[terrain] ?? 0) + provinceModifier(state, provinceId, 'defender_advantage');
    const owner = state.characters[lead.ownerId];
    if (owner) advantage += CULTURE_BY_ID[owner.cultureId]?.modifiers.defender_advantage ?? 0;
  }
  return {
    armyIds: armies.map((a) => a.id),
    ownerId: lead.ownerId,
    commanderId: lead.commanderId,
    startMen: men,
    men,
    morale: armies.reduce((s, a) => s + a.morale * armyMen(a), 0) / Math.max(1, men),
    casualties: 0,
    advantage,
  };
}

function startOrJoinBattle(ctx: Ctx, a: Army, enemies: Army[]): void {
  const s = ctx.s;
  const existing = Object.values(s.battles).find((b) => b.provinceId === a.location && b.phase !== 'ended');
  if (existing) {
    const side = existing.attacker.armyIds.some((id) => s.armies[id] && !hostileWar(s, s.armies[id]!.ownerId, a.ownerId)) ? existing.attacker : existing.defender;
    side.armyIds.push(a.id);
    side.men += armyMen(a);
    side.startMen += armyMen(a);
    a.status = 'battle';
    a.path = [];
    return;
  }
  const war = hostileWar(s, a.ownerId, enemies[0]!.ownerId)!;
  const geo = PROVINCE_GEO[a.location]!;
  const attackerSide = makeSide(s, [a], geo.terrain, false, a.location);
  const defenderSide = makeSide(s, enemies, geo.terrain, true, a.location);
  const id = newId(s, 'bt');
  const battle: Battle = {
    id,
    warId: war.id,
    provinceId: a.location,
    startedAt: s.date,
    day: 0,
    phase: 'skirmish',
    attacker: attackerSide,
    defender: defenderSide,
    terrain: geo.terrain,
    winner: null,
    endedAt: null,
    name: geo.name,
    warScoreDelta: 0,
  };
  s.battles[id] = battle;
  for (const x of [a, ...enemies]) {
    x.status = 'battle';
    x.path = [];
  }
  for (const [id2, sg] of Object.entries(s.sieges)) if (sg.provinceId === a.location) delete s.sieges[id2];
  war.battles.push(id);
  notify(ctx, [a.ownerId, ...enemies.map((e) => e.ownerId)], {
    level: 'important',
    kind: 'battle_started',
    vars: { province: geo.name },
    focus: { type: 'battle', id },
    sound: 'battle',
  });
}

function sidePower(s: GameState, side: BattleSide, terrain: Terrain, phase: Battle['phase'], enemyUnits: Partial<Record<UnitType, number>>): number {
  let power = 0;
  for (const id of side.armyIds) {
    const a = s.armies[id];
    if (!a) continue;
    const owner = s.characters[a.ownerId];
    const favored = owner ? CULTURE_BY_ID[owner.cultureId]?.favoredUnit : undefined;
    for (const [u, men] of Object.entries(a.units) as [UnitType, number][]) {
      const def = UNIT_BY_ID[u];
      if (!def || !men) continue;
      let dmg = def.damage;
      if (phase === 'skirmish' && u !== 'archers' && u !== 'levy' && u !== 'light_cavalry') dmg *= 0.5;
      if (def.goodTerrain?.includes(terrain)) dmg *= 1.2;
      if (def.badTerrain?.includes(terrain)) dmg *= 0.7;
      if (def.counters?.some((c) => (enemyUnits[c] ?? 0) > 0)) dmg *= 1.15;
      if (u === favored) dmg *= 1.1;
      power += (men / 100) * dmg;
    }
  }
  return power * (1 + side.advantage / 100) * (0.5 + side.morale * 0.5);
}

function unitsOf(s: GameState, side: BattleSide): Partial<Record<UnitType, number>> {
  const out: Partial<Record<UnitType, number>> = {};
  for (const id of side.armyIds) {
    const a = s.armies[id];
    if (!a) continue;
    for (const [u, men] of Object.entries(a.units) as [UnitType, number][]) out[u] = (out[u] ?? 0) + (men ?? 0);
  }
  return out;
}

function avgToughness(units: Partial<Record<UnitType, number>>): number {
  let t = 0;
  let n = 0;
  for (const [u, men] of Object.entries(units) as [UnitType, number][]) {
    t += (UNIT_BY_ID[u]?.toughness ?? 10) * (men ?? 0);
    n += men ?? 0;
  }
  return n ? t / n : 10;
}

function applyCasualties(s: GameState, side: BattleSide, losses: number): number {
  const total = side.armyIds.reduce((sum, id) => sum + (s.armies[id] ? armyMen(s.armies[id]!) : 0), 0);
  if (total <= 0) return 0;
  const ratio = Math.min(1, losses / total);
  let applied = 0;
  for (const id of side.armyIds) {
    const a = s.armies[id];
    if (!a) continue;
    const owner = s.characters[a.ownerId];
    for (const u of Object.keys(a.units) as UnitType[]) {
      const before = a.units[u] ?? 0;
      // Les levées encaissent davantage que les unités professionnelles.
      const r = Math.min(1, ratio * (u === 'levy' ? 1.15 : 0.8));
      const lost = Math.round(before * r);
      a.units[u] = before - lost;
      applied += lost;
      if (u !== 'levy' && owner && owner.maa[u]) owner.maa[u] = Math.max(0, (owner.maa[u] ?? 0) - lost);
    }
  }
  side.men = Math.max(0, side.men - applied);
  side.casualties += applied;
  return applied;
}

export function dailyBattles(ctx: Ctx): void {
  const s = ctx.s;
  for (const b of Object.values(s.battles)) {
    if (b.phase === 'ended') {
      if (b.endedAt !== null && s.date - b.endedAt > 5) delete s.battles[b.id];
      continue;
    }
    b.day++;
    const terrain = b.terrain as Terrain;
    const atkUnits = unitsOf(s, b.attacker);
    const defUnits = unitsOf(s, b.defender);
    const noise = () => 1 + (ctx.rng.next() * 2 - 1) * BALANCE.army.battleNoise;
    const atkPower = sidePower(s, b.attacker, terrain, b.phase, defUnits) * noise();
    const defPower = sidePower(s, b.defender, terrain, b.phase, atkUnits) * noise();
    const k = 0.9;
    const defLoss = (atkPower * k * 10) / avgToughness(defUnits);
    const atkLoss = (defPower * k * 10) / avgToughness(atkUnits);
    const dealtToDef = applyCasualties(s, b.defender, defLoss);
    const dealtToAtk = applyCasualties(s, b.attacker, atkLoss);
    b.defender.morale -= (dealtToDef / Math.max(1, b.defender.startMen)) * BALANCE.army.moraleLossPerCasualtyPct;
    b.attacker.morale -= (dealtToAtk / Math.max(1, b.attacker.startMen)) * BALANCE.army.moraleLossPerCasualtyPct;
    if (b.day >= 3 && b.phase === 'skirmish') b.phase = 'melee';
    const atkBroken = b.attacker.morale <= BALANCE.army.retreatMorale || b.attacker.men <= 0;
    const defBroken = b.defender.morale <= BALANCE.army.retreatMorale || b.defender.men <= 0;
    if (atkBroken || defBroken || b.day >= BALANCE.army.maxBattleDays) {
      let winner: 'attacker' | 'defender';
      if (atkBroken && !defBroken) winner = 'defender';
      else if (defBroken && !atkBroken) winner = 'attacker';
      else winner = b.attacker.morale * b.attacker.men >= b.defender.morale * b.defender.men ? 'attacker' : 'defender';
      endBattle(ctx, b, winner);
    }
  }
}

function endBattle(ctx: Ctx, b: Battle, winner: 'attacker' | 'defender'): void {
  const s = ctx.s;
  const win = winner === 'attacker' ? b.attacker : b.defender;
  const lose = winner === 'attacker' ? b.defender : b.attacker;
  // Poursuite.
  const winUnits = unitsOf(s, win);
  const loseUnits = unitsOf(s, lose);
  let pursuit = 0;
  for (const [u, men] of Object.entries(winUnits) as [UnitType, number][]) pursuit += ((men ?? 0) / 100) * (UNIT_BY_ID[u]?.pursuit ?? 0);
  let screen = 0;
  for (const [u, men] of Object.entries(loseUnits) as [UnitType, number][]) screen += ((men ?? 0) / 100) * (UNIT_BY_ID[u]?.screen ?? 0);
  applyCasualties(s, lose, Math.max(0, pursuit * 8 - screen * 4) + lose.men * 0.05);
  b.phase = 'ended';
  b.winner = winner;
  b.endedAt = s.date;
  const war = s.wars[b.warId];
  const total = b.attacker.startMen + b.defender.startMen;
  const magnitude = Math.min(1, total / 8000);
  const delta = Math.round(Math.min(25, 4 + (lose.casualties / Math.max(1, lose.startMen)) * 25 * (0.5 + magnitude)));
  b.warScoreDelta = delta;
  if (war) {
    const winnerWarSide = sideOf(war, win.ownerId);
    const signed = winnerWarSide === 'attacker' ? delta : -delta;
    war.battleScore = Math.max(-BALANCE.war.battleScoreMax, Math.min(BALANCE.war.battleScoreMax, war.battleScore + signed));
    const atkIdx = sideOf(war, b.attacker.ownerId) === 'attacker' ? 0 : 1;
    war.casualties[atkIdx] = (war.casualties[atkIdx] ?? 0) + b.attacker.casualties;
    war.casualties[1 - atkIdx] = (war.casualties[1 - atkIdx] ?? 0) + b.defender.casualties;
  }
  // Armées vaincues : retraite vers une province amie.
  for (const id of lose.armyIds) {
    const a = s.armies[id];
    if (!a) continue;
    if (armyMen(a) < 30) {
      returnLevies(s, a);
      delete s.armies[id];
      continue;
    }
    a.status = 'retreating';
    a.morale = 0.3;
    a.shattered = BALANCE.army.shatteredDays;
    const home = capitalProvinceOf(s.characters[a.ownerId]!) ?? a.location;
    a.path = findPath(a.location, home) ?? [];
    a.moveProgress = 0;
    a.moveTotal = a.path.length ? moveDays(a.location, a.path[0]!) : 0;
    if (!a.path.length) a.status = 'idle';
  }
  for (const id of win.armyIds) {
    const a = s.armies[id];
    if (!a) continue;
    a.status = 'idle';
    a.morale = Math.max(0.4, a.morale);
  }
  // Prestige, héros, blessures, captures rares.
  const winner_ = s.characters[win.ownerId];
  if (winner_) winner_.prestige += 10 + delta * 2;
  const winCmd = win.commanderId ? s.characters[win.commanderId] : undefined;
  if (winCmd && total > 6000 && ctx.rng.chance(0.15)) addTrait(winCmd, 'war_hero');
  const loseCmd = lose.commanderId ? s.characters[lose.commanderId] : undefined;
  if (loseCmd && isAlive(loseCmd)) {
    const roll = ctx.rng.next();
    if (roll < 0.03) killCharacter(ctx, loseCmd.id, 'battle', winCmd?.id ?? null);
    else if (roll < 0.05 && !loseCmd.isPlayer) {
      loseCmd.prisonerOf = win.ownerId;
      notify(ctx, [lose.ownerId, win.ownerId], { level: 'important', kind: 'captured_in_battle', vars: { name: loseCmd.firstName }, focus: { type: 'character', id: loseCmd.id } });
    } else if (roll < 0.15) addTrait(loseCmd, 'wounded');
  }
  for (const slot of Object.values(s.players)) if (slot.characterId === win.ownerId) slot.stats.battlesWon++;
  notify(ctx, [b.attacker.ownerId, b.defender.ownerId, ...(war ? [...war.attackers, ...war.defenders] : [])], {
    level: 'important',
    kind: 'battle_result',
    vars: { province: b.name, winner: winner_?.firstName ?? '', attackerLoss: b.attacker.casualties, defenderLoss: b.defender.casualties, delta },
    focus: { type: 'battle', id: b.id },
    sound: 'battle',
  });
  if (total >= 5000) chronicle(ctx, 'great_battle', { province: b.name, winner: win.ownerId, loser: lose.ownerId, men: total }, [win.ownerId, lose.ownerId]);
  fireOnAction(ctx, 'battle_won', win.ownerId, { target: lose.ownerId, provinceId: b.provinceId });
  fireOnAction(ctx, 'battle_lost', lose.ownerId, { target: win.ownerId, provinceId: b.provinceId });
  log(ctx, 'battle.end', win.ownerId, { battleId: b.id, winner, delta, attackerLoss: b.attacker.casualties, defenderLoss: b.defender.casualties });
  // Poursuite du siège éventuel par le vainqueur.
  for (const id of win.armyIds) {
    const a = s.armies[id];
    if (a && war) {
      const hw = hostileProvinceWar(s, a.location, a.ownerId);
      if (hw) startSiege(ctx, a, hw.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Sièges
// ---------------------------------------------------------------------------
function startSiege(ctx: Ctx, a: Army, warId: string): void {
  const s = ctx.s;
  const existing = Object.values(s.sieges).find((sg) => sg.provinceId === a.location);
  if (existing) {
    if (!existing.armyIds.includes(a.id)) existing.armyIds.push(a.id);
    a.status = 'sieging';
    return;
  }
  const id = newId(s, 'sg');
  const fort = fortLevel(s, a.location);
  s.sieges[id] = {
    id,
    warId,
    provinceId: a.location,
    besiegerId: a.ownerId,
    armyIds: [a.id],
    progress: 0,
    startedAt: s.date,
    fortLevel: fort,
    garrison: s.provinces[a.location]?.garrison ?? maxGarrison(s, a.location),
  };
  a.status = 'sieging';
}

export function siegeDailyProgress(s: GameView, siege: { armyIds: string[]; fortLevel: number; garrison: number }): number {
  let men = 0;
  let engines = 0;
  for (const id of siege.armyIds) {
    const a = s.armies[id];
    if (!a) continue;
    men += armyMen(a);
    engines += (a.units.siege_engines ?? 0) / 100;
  }
  if (men <= siege.garrison) return 0;
  const bonus = 1 + engines * BALANCE.siege.siegeEngineBonus + (men / 1000) * BALANCE.siege.menBonusPer1000;
  return (BALANCE.siege.baseProgressDaily * bonus) / Math.max(1, siege.fortLevel * BALANCE.siege.fortDivisor);
}

export function dailySieges(ctx: Ctx): void {
  const s = ctx.s;
  for (const sg of Object.values(s.sieges)) {
    sg.armyIds = sg.armyIds.filter((id) => s.armies[id] && s.armies[id]!.location === sg.provinceId && s.armies[id]!.status === 'sieging');
    const war = s.wars[sg.warId];
    if (!sg.armyIds.length || !war) {
      delete s.sieges[sg.id];
      continue;
    }
    sg.progress = Math.min(100, sg.progress + siegeDailyProgress(s, sg));
    sg.garrison = Math.max(0, Math.round(sg.garrison * 0.995));
    if (sg.progress < 100) continue;
    // Occupation.
    const geo = PROVINCE_GEO[sg.provinceId]!;
    const title = s.titles[geo.countyTitleId]!;
    const side = sideOf(war, sg.besiegerId);
    const leader = side === 'attacker' ? war.attackerId : war.defenderId;
    // Reprendre sa propre province libère l'occupation.
    const holderTop = topLiegeId(s, title.holderId ?? '');
    title.occupiedBy = warsOf(s, holderTop).length && sideOf(war, holderTop) === side ? null : leader;
    const p = s.provinces[sg.provinceId]!;
    p.control = Math.max(0, p.control - 25);
    p.development = Math.max(0, p.development - 1);
    p.garrison = 0;
    p.levies = Math.round(p.levies * 0.5);
    delete s.sieges[sg.id];
    for (const id of sg.armyIds) {
      const a = s.armies[id];
      if (a) a.status = 'idle';
    }
    notify(ctx, [sg.besiegerId, holderOfProvince(s, sg.provinceId), ...war.attackers, ...war.defenders], {
      level: 'important',
      kind: 'siege_won',
      vars: { province: geo.name },
      focus: { type: 'province', id: sg.provinceId },
      sound: 'fanfare',
    });
    log(ctx, 'siege.won', sg.besiegerId, { provinceId: sg.provinceId, warId: war.id });
  }
}

/** Régénération mensuelle des levées et garnisons. */
export function monthlyLevies(ctx: Ctx): void {
  const s = ctx.s;
  const r = ctx.r;
  const raised = new Map<string, number>();
  for (const a of Object.values(r.armies)) {
    for (const [pid, men] of Object.entries(a.leviesFrom)) raised.set(pid, (raised.get(pid) ?? 0) + men);
  }
  const besieged = new Set(Object.values(r.sieges).map((sg) => sg.provinceId));
  for (const p of Object.values(r.provinces)) {
    const max = Math.max(0, provinceMaxLevies(r, p.id) - (raised.get(p.id) ?? 0));
    const gmax = maxGarrison(r, p.id);
    const occupied = !!r.titles[PROVINCE_GEO[p.id]!.countyTitleId]?.occupiedBy;
    const needLevies = p.levies < max || p.levies > max;
    const needGarrison = !occupied && !besieged.has(p.id) && p.garrison < gmax;
    if (!needLevies && !needGarrison) continue;
    let regen = BALANCE.army.levyRegenMonthly;
    const holder = holderOfProvince(r, p.id);
    const holderChar = holder ? r.characters[holder] : undefined;
    const marshalOwner = holderChar ? (holderChar.liegeId && r.characters[holderChar.liegeId]) || holderChar : undefined;
    if (marshalOwner?.council?.marshal.task === 'marshal_train' && marshalOwner.council.marshal.characterId) {
      const m = r.characters[marshalOwner.council.marshal.characterId];
      if (m) regen *= 1 + skill(r, m, 'martial') * 0.03;
    }
    const levies = Math.min(max, Math.round(p.levies + max * regen));
    const garrison = needGarrison ? Math.min(gmax, Math.round(p.garrison + gmax * 0.1)) : p.garrison;
    if (levies !== p.levies || garrison !== p.garrison) {
      const d = s.provinces[p.id]!;
      d.levies = levies;
      d.garrison = garrison;
    }
  }
}
