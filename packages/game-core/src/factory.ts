/**
 * Création de personnages (scénario, naissances, courtisans générés).
 */
import { SKILL_KEYS, yearsToDays, type Character, type GameState, type Sex, type SkillKey, type Skills } from '@ttc/shared';
import { BALANCE } from './balance';
import { computePersonality } from './characters';
import { CONTENT, CULTURE_BY_ID, TRAIT_BY_ID } from './content';
import type { Rng } from './rng';
import { bumpStructure } from './index-cache';

export interface NewCharacterOpts {
  id: string;
  sex: Sex;
  birth: number;
  cultureId: string;
  faithId: string;
  houseId: string | null;
  firstName?: string;
  fatherId?: string | null;
  motherId?: string | null;
  courtId?: string | null;
  traits?: string[];
  skills?: Partial<Skills>;
  /** Nombre de traits de personnalité aléatoires (défaut 3). */
  personalityCount?: number;
  /** Ajoute un trait d'éducation aléatoire (adultes). */
  education?: boolean | { skill: SkillKey; level: number };
  now: number;
}

const PERSONALITY = CONTENT.traits.filter((t) => t.category === 'personality');
const CONGENITAL = CONTENT.traits.filter((t) => t.category === 'congenital');

export function randomPersonality(rng: Rng, count: number, existing: string[] = []): string[] {
  const out = [...existing];
  let guard = 0;
  while (out.filter((t) => TRAIT_BY_ID[t]?.category === 'personality').length < count && guard++ < 50) {
    const t = rng.pick(PERSONALITY);
    if (out.includes(t.id)) continue;
    if (out.some((o) => t.opposites?.includes(o))) continue;
    out.push(t.id);
  }
  return out;
}

export function pickName(rng: Rng, cultureId: string, sex: Sex, avoid: string[] = []): string {
  const culture = CULTURE_BY_ID[cultureId] ?? CONTENT.cultures[0]!;
  const pool = sex === 'M' ? culture.maleNames : culture.femaleNames;
  for (let i = 0; i < 6; i++) {
    const n = rng.pick(pool);
    if (!avoid.includes(n)) return n;
  }
  return rng.pick(pool);
}

export function randomSkills(rng: Rng, bias?: Partial<Skills>): Skills {
  const s = {} as Skills;
  for (const k of SKILL_KEYS) {
    s[k] = Math.max(0, Math.min(14, Math.round(rng.normal(5, 2.2) + (bias?.[k] ?? 0))));
  }
  return s;
}

export function educationTraitFor(skill: SkillKey, level: number): string {
  return `education_${skill}_${Math.max(1, Math.min(3, level))}`;
}

export function createCharacter(state: Pick<GameState, 'characters'>, rng: Rng, o: NewCharacterOpts): Character {
  const age = Math.floor((o.now - o.birth) / 365);
  let traits = [...(o.traits ?? [])];
  const adult = age >= BALANCE.age.adult;
  if (adult) traits = randomPersonality(rng, o.personalityCount ?? 3, traits);
  else if (age >= 6) traits = randomPersonality(rng, 1, traits);
  if (rng.chance(0.12)) {
    const cg = rng.pick(CONGENITAL);
    if (!traits.some((t) => cg.opposites?.includes(t)) && !traits.includes(cg.id)) traits.push(cg.id);
  }
  const skills = randomSkills(rng);
  if (o.skills) for (const [k, v] of Object.entries(o.skills) as [SkillKey, number][]) skills[k] = v;
  if (adult && o.education !== false && !traits.some((t) => TRAIT_BY_ID[t]?.category === 'education')) {
    if (typeof o.education === 'object') {
      traits.push(educationTraitFor(o.education.skill, o.education.level));
    } else {
      const best = [...SKILL_KEYS].sort((a, b) => skills[b] - skills[a])[0]!;
      const lvl = rng.weighted([1, 2, 3], (l) => (l === 1 ? 5 : l === 2 ? 4 : 1.5)) ?? 1;
      traits.push(educationTraitFor(best, lvl));
    }
  }
  const c: Character = {
    id: o.id,
    firstName: o.firstName ?? pickName(rng, o.cultureId, o.sex),
    houseId: o.houseId,
    sex: o.sex,
    birth: o.birth,
    death: null,
    deathCause: null,
    killerId: null,
    fatherId: o.fatherId ?? null,
    motherId: o.motherId ?? null,
    spouseId: null,
    formerSpouseIds: [],
    betrothedId: null,
    childIds: [],
    cultureId: o.cultureId,
    faithId: o.faithId,
    courtId: o.courtId ?? null,
    liegeId: null,
    titleIds: [],
    skills,
    traits,
    health: Math.round(rng.normal(BALANCE.health.base, 0.6) * 10) / 10,
    fertility: Math.round(Math.max(0.2, Math.min(0.95, rng.normal(BALANCE.fertility.base, 0.12))) * 100) / 100,
    stress: 0,
    gold: 0,
    prestige: adult ? rng.int(20, 120) : 0,
    fervor: adult ? rng.int(20, 100) : 0,
    authority: 0,
    crownAuthority: 1,
    portraitSeed: rng.int(1, 2 ** 30),
    education: !adult && age >= 6 ? { focus: rng.pick(SKILL_KEYS), tutorId: null, progress: 0 } : null,
    guardianId: null,
    opinions: {},
    modifiers: [],
    flags: {},
    cooldowns: {},
    pregnancy: null,
    prisonerOf: null,
    council: null,
    maa: {},
    nominatedHeirId: null,
    personality: computePersonality(traits),
    aiNextThink: o.now + rng.int(1, 30),
    isPlayer: false,
  };
  state.characters[c.id] = c;
  bumpStructure();
  if (c.fatherId) state.characters[c.fatherId]?.childIds.push(c.id);
  if (c.motherId) state.characters[c.motherId]?.childIds.push(c.id);
  return c;
}

export function birthForAge(now: number, age: number, rng: Rng): number {
  return now - yearsToDays(age) - rng.int(0, 364);
}
