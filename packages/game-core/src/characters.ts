import {
  ageAt,
  SKILL_KEYS,
  type AiPersonality,
  type Character,
  type GameView,
  type ModifierKey,
  type SkillKey,
  type Skills,
} from '@ttc/shared';
import { BALANCE } from './balance';
import { CULTURE_BY_ID, FAITH_BY_ID, PROVINCE_GEO, TRAIT_BY_ID, BUILDING_BY_ID } from './content';

export type ReadState = Pick<GameView, 'characters' | 'date'> & Partial<GameView>;

export function getChar(state: Pick<GameView, 'characters'>, id: string | null | undefined): Character | undefined {
  return id ? state.characters[id] : undefined;
}

export function mustChar(state: Pick<GameView, 'characters'>, id: string): Character {
  const c = state.characters[id];
  if (!c) throw new Error(`Personnage inconnu : ${id}`);
  return c;
}

export function isAlive(c: Character | undefined): c is Character {
  return !!c && c.death === null;
}

export function ageOf(c: Character, date: number): number {
  return ageAt(c.birth, c.death ?? date);
}

export function isAdult(c: Character, date: number): boolean {
  return ageOf(c, date) >= BALANCE.age.adult;
}

export function hasTrait(c: Character, traitId: string): boolean {
  return c.traits.includes(traitId);
}

export function isLanded(c: Character): boolean {
  return c.titleIds.length > 0;
}

export function fullName(state: Pick<GameView, 'houses'>, c: Character): string {
  const house = c.houseId ? state.houses[c.houseId] : undefined;
  return house ? `${c.firstName} de ${house.name}` : c.firstName;
}

/**
 * Somme d'un modificateur pour un personnage : traits, modificateurs actifs,
 * culture, confession et bâtiments du domaine (clés de détenteur).
 */
export function characterModifier(state: ReadState, c: Character, key: ModifierKey): number {
  let total = 0;
  for (const t of c.traits) total += TRAIT_BY_ID[t]?.modifiers?.[key] ?? 0;
  for (const m of c.modifiers) if (m.expires === null || m.expires > state.date) total += m.values[key] ?? 0;
  total += CULTURE_BY_ID[c.cultureId]?.modifiers[key] ?? 0;
  total += FAITH_BY_ID[c.faithId]?.modifiers[key] ?? 0;
  if (HOLDER_BUILDING_KEYS.has(key) && state.provinces && c.titleIds.length) {
    for (const pid of domainProvinceIds(c)) {
      const p = state.provinces[pid];
      if (!p) continue;
      for (const [bid, lvl] of Object.entries(p.buildings)) {
        total += (BUILDING_BY_ID[bid]?.perLevel[key] ?? 0) * lvl;
      }
    }
  }
  return total;
}

/** Clés de bâtiments appliquées au détenteur (et non à la province). */
export const HOLDER_BUILDING_KEYS = new Set<ModifierKey>([
  'monthly_prestige',
  'monthly_fervor',
  'monthly_authority',
  'maa_upkeep_mult',
]);

/** Provinces du domaine direct (comtés détenus). */
export function domainProvinceIds(c: Character): string[] {
  const out: string[] = [];
  for (const tid of c.titleIds) {
    const pid = COUNTY_TO_PROVINCE[tid];
    if (pid) out.push(pid);
  }
  return out;
}

const COUNTY_TO_PROVINCE: Record<string, string> = Object.fromEntries(
  Object.values(PROVINCE_GEO).map((p) => [p.countyTitleId, p.id]),
);

/** Compétence effective (base + traits + modificateurs + âge). */
export function skill(state: ReadState, c: Character, key: SkillKey): number {
  let v = c.skills[key];
  for (const t of c.traits) v += TRAIT_BY_ID[t]?.skills?.[key] ?? 0;
  v += characterModifier(state, c, key);
  const age = ageOf(c, state.date);
  if (age < BALANCE.age.adult) v = v * Math.max(0.25, age / BALANCE.age.adult);
  if (age >= 65) v -= key === 'martial' ? 3 : 1;
  return Math.max(0, Math.round(v));
}

export function skills(state: ReadState, c: Character): Skills {
  const out = {} as Skills;
  for (const k of SKILL_KEYS) out[k] = skill(state, c, k);
  return out;
}

/** Décomposition d'une compétence pour les tooltips. */
export function skillBreakdown(state: ReadState, c: Character, key: SkillKey): { source: string; value: number }[] {
  const rows: { source: string; value: number }[] = [{ source: 'base', value: c.skills[key] }];
  for (const t of c.traits) {
    const v = TRAIT_BY_ID[t]?.skills?.[key];
    if (v) rows.push({ source: `trait.${t}`, value: v });
  }
  const mod = characterModifier(state, c, key);
  if (mod) rows.push({ source: 'modifiers', value: mod });
  return rows;
}

const EMPTY_PERSONALITY: AiPersonality = {
  ambition: 0,
  honor: 0,
  aggression: 0,
  greed: 0,
  sociability: 0,
  caution: 0,
  intrigue: 0,
  loyalty: 0,
  compassion: 0,
  zeal: 0,
};

export function computePersonality(traits: string[]): AiPersonality {
  const p = { ...EMPTY_PERSONALITY };
  for (const t of traits) {
    const ai = TRAIT_BY_ID[t]?.ai;
    if (!ai) continue;
    for (const [k, v] of Object.entries(ai) as [keyof AiPersonality, number][]) p[k] += v;
  }
  for (const k of Object.keys(p) as (keyof AiPersonality)[]) p[k] = Math.max(-100, Math.min(100, p[k]));
  return p;
}

/** Ajoute un trait en retirant ses opposés ; recalcule la personnalité. */
export function addTrait(c: Character, traitId: string): boolean {
  const def = TRAIT_BY_ID[traitId];
  if (!def || c.traits.includes(traitId)) return false;
  if (def.opposites) c.traits = c.traits.filter((t) => !def.opposites!.includes(t));
  c.traits.push(traitId);
  c.personality = computePersonality(c.traits);
  return true;
}

export function removeTrait(c: Character, traitId: string): boolean {
  if (!c.traits.includes(traitId)) return false;
  c.traits = c.traits.filter((t) => t !== traitId);
  c.personality = computePersonality(c.traits);
  return true;
}

export function healthValue(state: ReadState, c: Character): number {
  let h = c.health + characterModifier(state, c, 'health');
  const age = ageOf(c, state.date);
  if (age > 50) h -= (age - 50) * 0.06;
  if (c.stress >= BALANCE.stress.levels[1]) h -= 1;
  if (c.prisonerOf) h -= 0.5;
  return Math.max(0, h);
}

export function fertilityValue(state: ReadState, c: Character): number {
  const age = ageOf(c, state.date);
  let f = c.fertility + characterModifier(state, c, 'fertility');
  if (c.sex === 'F') {
    if (age > 35) f *= Math.max(0, 1 - (age - 35) / 12);
    if (age >= BALANCE.age.fertileFemaleMax) f = 0;
  } else {
    if (age > 55) f *= 0.6;
    if (age >= BALANCE.age.fertileMaleMax) f = 0;
  }
  if (age < BALANCE.age.adult) f = 0;
  return Math.max(0, f);
}

export function stressLevel(c: Character): 0 | 1 | 2 | 3 {
  const [a, b, d] = BALANCE.stress.levels;
  if (c.stress >= d) return 3;
  if (c.stress >= b) return 2;
  if (c.stress >= a) return 1;
  return 0;
}

export type HealthLabel = 'dying' | 'poor' | 'fair' | 'good' | 'excellent';
export function healthLabel(h: number): HealthLabel {
  if (h < 1) return 'dying';
  if (h < 3) return 'poor';
  if (h < 5) return 'fair';
  if (h < 7) return 'good';
  return 'excellent';
}
