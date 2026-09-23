/**
 * Calculs par province : modificateurs, impôt, levées, fortification.
 */
import type { Character, GameView, ModifierKey } from '@ttc/shared';
import { BALANCE } from './balance';
import { BUILDING_BY_ID, CULTURE_BY_ID, FAITH_BY_ID, PROVINCE_GEO, TRAIT_BY_ID } from './content';
import { holderOfProvince } from './realm';

type S = Pick<GameView, 'provinces' | 'titles' | 'characters' | 'date'>;

/** Modificateurs de traits et d'effets actifs du détenteur (sans culture/foi). */
function holderPersonalModifier(state: S, c: Character, key: ModifierKey): number {
  let total = 0;
  for (const t of c.traits) total += TRAIT_BY_ID[t]?.modifiers?.[key] ?? 0;
  for (const m of c.modifiers) if (m.expires === null || m.expires > state.date) total += m.values[key] ?? 0;
  return total;
}

export interface ModRow {
  source: string;
  value: number;
}

/** Détail d'un modificateur de province (tooltip). */
export function provinceModifierRows(state: S, provinceId: string, key: ModifierKey): ModRow[] {
  const p = state.provinces[provinceId];
  if (!p) return [];
  const rows: ModRow[] = [];
  for (const [bid, lvl] of Object.entries(p.buildings)) {
    const v = (BUILDING_BY_ID[bid]?.perLevel[key] ?? 0) * lvl;
    if (v) rows.push({ source: `building.${bid}`, value: v });
  }
  for (const m of p.modifiers) {
    if (m.expires !== null && m.expires <= state.date) continue;
    const v = m.values[key];
    if (v) rows.push({ source: m.source, value: v });
  }
  const cv = CULTURE_BY_ID[p.cultureId]?.modifiers[key];
  if (cv) rows.push({ source: `culture.${p.cultureId}`, value: cv });
  const fv = FAITH_BY_ID[p.faithId]?.modifiers[key];
  if (fv) rows.push({ source: `faith.${p.faithId}`, value: fv });
  const holderId = holderOfProvince(state, provinceId);
  const holder = holderId ? state.characters[holderId] : undefined;
  if (holder) {
    const hv = holderPersonalModifier(state, holder, key);
    if (hv) rows.push({ source: 'holder', value: hv });
  }
  return rows;
}

export function provinceModifier(state: S, provinceId: string, key: ModifierKey): number {
  return provinceModifierRows(state, provinceId, key).reduce((s, r) => s + r.value, 0);
}

/** Province occupée par un ennemi : pas d'impôt ni de levées pour le détenteur. */
export function isOccupied(state: S, provinceId: string): boolean {
  const geo = PROVINCE_GEO[provinceId];
  return !!geo && !!state.titles[geo.countyTitleId]?.occupiedBy;
}

/** Impôt mensuel brut d'une province (avant partage féodal). */
export function provinceTax(state: S, provinceId: string): number {
  const geo = PROVINCE_GEO[provinceId];
  const p = state.provinces[provinceId];
  if (!geo || !p) return 0;
  if (isOccupied(state, provinceId)) return 0;
  const base = geo.baseTax + p.development * BALANCE.economy.taxPerDevelopment;
  const mult = 1 + provinceModifier(state, provinceId, 'tax_mult');
  const control = p.control / 100;
  const flat = provinceModifier(state, provinceId, 'monthly_gold');
  return Math.max(0, base * mult * control + flat * control);
}

/** Levées maximales d'une province. */
export function provinceMaxLevies(state: S, provinceId: string): number {
  const geo = PROVINCE_GEO[provinceId];
  const p = state.provinces[provinceId];
  if (!geo || !p) return 0;
  let extra = 0;
  for (const [bid, lvl] of Object.entries(p.buildings)) extra += (BUILDING_BY_ID[bid]?.leviesPerLevel ?? 0) * lvl;
  const base = geo.baseLevies + extra;
  const mult = 1 + provinceModifier(state, provinceId, 'levy_mult') + p.development * BALANCE.economy.leviesPerDevelopment;
  return Math.round(base * mult * (0.4 + 0.6 * (p.control / 100)));
}

export function fortLevel(state: S, provinceId: string): number {
  const geo = PROVINCE_GEO[provinceId];
  if (!geo) return 0;
  return Math.max(0, Math.round(geo.baseFort + provinceModifier(state, provinceId, 'fort_level')));
}

export function maxGarrison(state: S, provinceId: string): number {
  const fort = fortLevel(state, provinceId);
  const mult = 1 + provinceModifier(state, provinceId, 'garrison_size');
  return Math.round(fort * BALANCE.army.garrisonPerFort * mult);
}

export function supplyLimit(state: S, provinceId: string): number {
  const p = state.provinces[provinceId];
  if (!p) return 0;
  return Math.round((4 + p.development / 5 + provinceModifier(state, provinceId, 'supply_limit')) * 1000);
}

export function developmentGrowth(state: S, provinceId: string): number {
  const p = state.provinces[provinceId];
  if (!p) return 0;
  const base = BALANCE.economy.developmentGrowth + provinceModifier(state, provinceId, 'development_growth');
  // Plus la province est développée, plus la croissance ralentit.
  return Math.max(0, base * (1 - p.development / 120));
}
