/**
 * Constructions : prérequis, coûts, durée réelle, achèvement.
 */
import { ErrorCodes, GameError, type BuildingDef, type GameView } from '@ttc/shared';
import { characterModifier } from './characters';
import { log, notify, type Ctx } from './context';
import { BUILDING_BY_ID, CONTENT, PROVINCE_GEO } from './content';
import { fireOnAction } from './events/engine';
import { holderOfProvince } from './realm';

export interface BuildOption {
  def: BuildingDef;
  level: number;
  cost: number;
  days: number;
  available: boolean;
  reason: string | null;
}

export function buildingCost(state: GameView, holderId: string, def: BuildingDef, level: number): number {
  const holder = state.characters[holderId];
  const mult = holder ? Math.max(0.5, 1 + characterModifier(state, holder, 'build_cost_mult')) : 1;
  return Math.round((def.cost[level - 1] ?? 0) * mult);
}

export function buildOptions(state: GameView, provinceId: string, holderId: string): BuildOption[] {
  const geo = PROVINCE_GEO[provinceId];
  const p = state.provinces[provinceId];
  const holder = state.characters[holderId];
  if (!geo || !p || !holder) return [];
  const used = Object.keys(p.buildings).length;
  return CONTENT.buildings.map((def) => {
    const current = p.buildings[def.id] ?? 0;
    const level = current + 1;
    const cost = buildingCost(state, holderId, def, level);
    const days = def.days[level - 1] ?? 0;
    let reason: string | null = null;
    if (holderOfProvince(state, provinceId) !== holderId) reason = 'not_owner';
    else if (p.construction) reason = 'in_progress';
    else if (current >= def.maxLevel) reason = 'max_level';
    else if (current === 0 && used >= geo.buildingSlots) reason = 'no_slot';
    else if (def.requires?.coastal && !geo.coastal) reason = 'coastal';
    else if (def.requires?.terrain && !def.requires.terrain.includes(geo.terrain)) reason = 'terrain';
    else if (def.requires?.notTerrain?.includes(geo.terrain)) reason = 'terrain';
    else if (def.requires?.minDevelopment && p.development < def.requires.minDevelopment) reason = 'development';
    else if (def.requires?.building && (p.buildings[def.requires.building.id] ?? 0) < def.requires.building.level) reason = 'prerequisite';
    else if (holder.gold < cost) reason = 'gold';
    return { def, level, cost, days, available: reason === null, reason };
  });
}

export function startConstruction(ctx: Ctx, actorId: string, provinceId: string, buildingId: string): void {
  const s = ctx.s;
  const def = BUILDING_BY_ID[buildingId];
  if (!def) throw new GameError(ErrorCodes.INVALID_TARGET, 'Bâtiment inconnu');
  const opt = buildOptions(s, provinceId, actorId).find((o) => o.def.id === buildingId);
  if (!opt) throw new GameError(ErrorCodes.INVALID_TARGET, 'Province inconnue');
  if (!opt.available) {
    const code =
      opt.reason === 'not_owner'
        ? ErrorCodes.PROVINCE_NOT_OWNED
        : opt.reason === 'gold'
          ? ErrorCodes.INSUFFICIENT_GOLD
          : opt.reason === 'in_progress'
            ? ErrorCodes.CONSTRUCTION_IN_PROGRESS
            : ErrorCodes.BUILDING_UNAVAILABLE;
    throw new GameError(code, `Construction impossible : ${opt.reason}`, { reason: opt.reason });
  }
  const holder = s.characters[actorId]!;
  holder.gold -= opt.cost;
  s.provinces[provinceId]!.construction = {
    buildingId,
    level: opt.level,
    startedAt: s.date,
    completeAt: s.date + opt.days,
    cost: opt.cost,
  };
  log(ctx, 'building.start', actorId, { provinceId, buildingId, level: opt.level, cost: opt.cost });
}

/** Achèvement des constructions (tick journalier). */
export function processConstructions(ctx: Ctx): void {
  const s = ctx.s;
  for (const p of Object.values(s.provinces)) {
    const c = p.construction;
    if (!c || c.completeAt > s.date) continue;
    p.buildings[c.buildingId] = c.level;
    p.construction = null;
    const holder = holderOfProvince(s, p.id);
    notify(ctx, [holder], {
      level: 'info',
      kind: 'building_complete',
      vars: { building: c.buildingId, level: c.level, province: p.id },
      focus: { type: 'province', id: p.id },
      sound: 'build',
    });
    if (holder) fireOnAction(ctx, 'building_complete', holder, { provinceId: p.id });
  }
}

/** Termine immédiatement une construction (outil dev). */
export function completeConstructionNow(ctx: Ctx, provinceId: string): void {
  const p = ctx.s.provinces[provinceId];
  if (!p?.construction) throw new GameError(ErrorCodes.INVALID_TARGET, 'Aucune construction');
  p.construction.completeAt = ctx.s.date;
  processConstructions(ctx);
}
