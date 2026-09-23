/**
 * Index du contenu statique (monde, traits, bâtiments…) calculés une seule
 * fois au chargement du module.
 */
import {
  BUILDING_BY_ID,
  CONTENT,
  CULTURE_BY_ID,
  FAITH_BY_ID,
  TRAIT_BY_ID,
  UNIT_BY_ID,
  WORLD,
} from '@ttc/content';
import type { EventDef, ProvinceGeo, TitleDef, TitleRank } from '@ttc/shared';

export { BUILDING_BY_ID, CULTURE_BY_ID, FAITH_BY_ID, TRAIT_BY_ID, UNIT_BY_ID, WORLD, CONTENT };

export const PROVINCE_GEO: Record<string, ProvinceGeo> = Object.fromEntries(WORLD.provinces.map((p) => [p.id, p]));
export const TITLE_DEFS: Record<string, TitleDef> = Object.fromEntries(WORLD.titles.map((t) => [t.id, t]));
export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(CONTENT.events.map((e) => [e.id, e]));

/** Enfants de jure directs d'un titre. */
export const DEJURE_CHILDREN: Record<string, string[]> = {};
for (const t of WORLD.titles) {
  if (!t.deJureParentId) continue;
  (DEJURE_CHILDREN[t.deJureParentId] ??= []).push(t.id);
}

/** Provinces de jure d'un titre (tous rangs). */
export const DEJURE_PROVINCES: Record<string, string[]> = {};
for (const p of WORLD.provinces) {
  for (const t of [p.countyTitleId, p.duchyTitleId, p.kingdomTitleId, p.empireTitleId]) {
    (DEJURE_PROVINCES[t] ??= []).push(p.id);
  }
}

export function titleRank(titleId: string): TitleRank {
  const def = TITLE_DEFS[titleId];
  if (!def) throw new Error(`Titre inconnu : ${titleId}`);
  return def.rank;
}

export function countyOfProvince(provinceId: string): string {
  const geo = PROVINCE_GEO[provinceId];
  if (!geo) throw new Error(`Province inconnue : ${provinceId}`);
  return geo.countyTitleId;
}

export function provinceOfCounty(countyId: string): string {
  const def = TITLE_DEFS[countyId];
  if (!def?.provinceId) throw new Error(`Comté inconnu : ${countyId}`);
  return def.provinceId;
}

export function neighborsOf(provinceId: string): string[] {
  const g = PROVINCE_GEO[provinceId];
  return g ? [...g.neighbors, ...g.straits] : [];
}

export const PERSONALITY_TRAIT_IDS = CONTENT.traits.filter((t) => t.category === 'personality').map((t) => t.id);
