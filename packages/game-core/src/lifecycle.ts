/**
 * Cycle de vie : santé, maladies, mortalité, grossesses, naissances,
 * éducation et majorité.
 */
import { ageAt, SKILL_KEYS, type Character, type GameState } from '@ttc/shared';
import { BALANCE } from './balance';
import { addTrait, ageOf, fertilityValue, healthValue, isAlive, removeTrait, skill } from './characters';
import { chronicle, log, newId, notify, type Ctx } from './context';
import { CONTENT, TRAIT_BY_ID } from './content';
import { killCharacter } from './death';
import { fireOnAction } from './events/engine';
import { createCharacter, educationTraitFor, pickName, randomPersonality } from './factory';
import { PERMANENT, setFlag } from './flags';
import { hasRelation, relationsOf } from './opinion';
import { rankOf } from './realm';
import { planSuccession } from './succession';
import { bumpStructure } from './index-cache';

const DISEASES = CONTENT.traits.filter((t) => t.disease);

/** Probabilité mensuelle de décès naturel. */
export function monthlyDeathChance(state: GameState, c: Character): number {
  const age = ageOf(c, state.date);
  const h = healthValue(state, c);
  let annual = BALANCE.health.gompertzA * Math.exp(BALANCE.health.gompertzB * age);
  if (age < 5) annual += BALANCE.health.childMortalityMonthly * 12;
  annual *= Math.exp(Math.max(0, 5 - h) * BALANCE.health.healthMortalityFactor);
  if (h <= 0.5) annual += 0.5;
  return Math.min(0.9, annual / 12);
}

export function monthlyHealth(ctx: Ctx, c: Character): void {
  const s = ctx.s;
  // Évolution des maladies.
  for (const t of [...c.traits]) {
    const d = TRAIT_BY_ID[t]?.disease;
    if (!d) continue;
    if (ctx.rng.chance(d.recoveryChance)) {
      removeTrait(c, t);
      notify(ctx, [c.id, c.liegeId], { level: 'info', kind: 'recovered', vars: { name: c.firstName, trait: t }, focus: { type: 'character', id: c.id } });
      continue;
    }
    if (ctx.rng.chance(d.deathChance)) {
      killCharacter(ctx, c.id, 'illness');
      return;
    }
  }
  // Nouvelles maladies.
  if (!c.traits.some((t) => TRAIT_BY_ID[t]?.disease)) {
    const stressFactor = 1 + c.stress / 150;
    if (ctx.rng.chance(BALANCE.health.illnessMonthlyChance * stressFactor)) {
      const disease = ctx.rng.weighted(DISEASES, (d) => (d.id === 'ill' ? 6 : d.id === 'depressed' ? (c.stress > 100 ? 3 : 0.3) : d.id === 'grey_fever' ? 0.6 : 0))!;
      if (disease && addTrait(c, disease.id)) {
        notify(ctx, [c.id, c.liegeId, c.spouseId], {
          level: c.isPlayer ? 'important' : 'info',
          kind: 'fell_ill',
          vars: { name: c.firstName, trait: disease.id },
          focus: { type: 'character', id: c.id },
        });
      }
    }
  }
  // Mortalité.
  if (ctx.rng.chance(monthlyDeathChance(s, c))) {
    killCharacter(ctx, c.id, c.traits.some((t) => TRAIT_BY_ID[t]?.disease) ? 'illness' : 'natural');
    return;
  }
  // Infirmité liée à l'âge.
  const age = ageOf(c, s.date);
  if (age >= 68 && !c.traits.includes('infirm') && ctx.rng.chance(0.004 * (age - 66))) addTrait(c, 'infirm');
}

/** Tentative de conception mensuelle. */
export function monthlyFertility(ctx: Ctx, c: Character): void {
  const s = ctx.s;
  if (c.sex !== 'F' || c.pregnancy || c.prisonerOf) return;
  const fw = fertilityValue(s, c);
  if (fw <= 0) return;
  const living = c.childIds.filter((id) => s.characters[id]?.death === null).length;
  const childPenalty = living >= BALANCE.fertility.maxChildren ? 0.05 : 1 - living * 0.08;
  // Conjoint.
  const husband = c.spouseId ? s.characters[c.spouseId] : undefined;
  if (husband && isAlive(husband) && !husband.prisonerOf) {
    const fh = fertilityValue(s, husband);
    const p = BALANCE.fertility.monthlyConception * fw * fh * 2.2 * childPenalty;
    if (ctx.rng.chance(p)) {
      c.pregnancy = { fatherId: husband.id, due: s.date + BALANCE.fertility.pregnancyDays, illegitimate: false };
      return;
    }
  }
  // Amant(e).
  for (const loverId of relationsOf(s, c.id, 'lover')) {
    const lover = s.characters[loverId];
    if (!lover || lover.sex !== 'M' || !isAlive(lover)) continue;
    const p = BALANCE.fertility.monthlyConception * fw * fertilityValue(s, lover) * 0.5;
    if (ctx.rng.chance(p)) {
      c.pregnancy = { fatherId: lover.id, due: s.date + BALANCE.fertility.pregnancyDays, illegitimate: c.spouseId !== lover.id };
      return;
    }
  }
}

function inheritTraits(ctx: Ctx, father: Character | undefined, mother: Character): string[] {
  const out: string[] = [];
  for (const parent of [father, mother]) {
    if (!parent) continue;
    for (const t of parent.traits) {
      const def = TRAIT_BY_ID[t];
      if (!def?.inherit || def.category !== 'congenital') continue;
      if (out.includes(t) || out.some((o) => def.opposites?.includes(o))) continue;
      if (ctx.rng.chance(def.inherit)) out.push(t);
    }
  }
  return out;
}

/** Naissances arrivées à terme (vérifiées chaque jour). */
export function processBirth(ctx: Ctx, mother: Character): void {
  const s = ctx.s;
  const preg = mother.pregnancy;
  if (!preg || preg.due > s.date) return;
  mother.pregnancy = null;
  const realFather = s.characters[preg.fatherId];
  const legalFather = preg.illegitimate && mother.spouseId ? s.characters[mother.spouseId] : realFather;
  const n = ctx.rng.chance(BALANCE.fertility.twinChance) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const sex = ctx.rng.chance(0.51) ? 'M' : 'F';
    const motherHigher = legalFather ? rankOf(mother) > rankOf(legalFather) : true;
    const houseId = motherHigher ? mother.houseId : legalFather?.houseId ?? mother.houseId;
    const culture = motherHigher ? mother.cultureId : legalFather?.cultureId ?? mother.cultureId;
    const faith = motherHigher ? mother.faithId : legalFather?.faithId ?? mother.faithId;
    const court = mother.courtId ?? mother.id;
    const kid = createCharacter(s, ctx.rng, {
      id: newId(s, 'ch'),
      sex,
      birth: s.date,
      cultureId: culture,
      faithId: faith,
      houseId,
      firstName: pickName(ctx.rng, culture, sex, [mother.firstName, legalFather?.firstName ?? '']),
      fatherId: legalFather?.id ?? null,
      motherId: mother.id,
      courtId: court,
      traits: inheritTraits(ctx, realFather, mother),
      education: false,
      now: s.date,
    });
    kid.traits = kid.traits.filter((t) => TRAIT_BY_ID[t]?.category === 'congenital');
    if (preg.illegitimate && realFather) {
      kid.realFatherId = realFather.id;
      const sid = newId(s, 'se');
      s.secrets[sid] = { id: sid, type: 'bastard', ownerId: mother.id, aboutId: kid.id, knownBy: [mother.id, realFather.id], createdAt: s.date, exposed: false };
    }
    log(ctx, 'birth', mother.id, { childId: kid.id }, null);
    const parents = [mother.id, legalFather?.id ?? null];
    notify(ctx, [...parents, mother.courtId], {
      level: 'important',
      kind: 'birth',
      vars: { name: kid.firstName, mother: mother.firstName, sex },
      focus: { type: 'character', id: kid.id },
      sound: 'birth',
    });
    fireOnAction(ctx, 'birth', legalFather?.titleIds.length ? legalFather.id : mother.id, { target: kid.id });
    // Naissance d'un héritier principal d'un grand dirigeant.
    for (const p of [legalFather, mother]) {
      if (p && p.titleIds.length && (rankOf(p) >= 2 || p.isPlayer)) {
        const plan = planSuccession(s, p);
        if (plan.primaryHeirId === kid.id) {
          chronicle(ctx, 'heir_born', { name: kid.id, parent: p.id }, [kid.id, p.id]);
          break;
        }
      }
    }
  }
  if (ctx.rng.chance(BALANCE.fertility.childbirthDeathChance * (ageAt(mother.birth, s.date) > 38 ? 2 : 1))) {
    killCharacter(ctx, mother.id, 'childbirth');
  }
}

/** Éducation mensuelle des enfants et passage à l'âge adulte. */
export function monthlyEducation(ctx: Ctx, c: Character): void {
  const s = ctx.s;
  const age = ageOf(c, s.date);
  if (age < 6) return;
  if (age >= BALANCE.age.educationEnd) {
    if (c.education) comeOfAge(ctx, c);
    return;
  }
  if (!c.education) c.education = { focus: ctx.rng.pick(SKILL_KEYS), tutorId: null, progress: 0 };
  const edu = c.education;
  const tutor = edu.tutorId ? s.characters[edu.tutorId] : undefined;
  const tutorSkill = tutor && isAlive(tutor) ? skill(s, tutor, edu.focus) : 0;
  const tutorLearning = tutor && isAlive(tutor) ? skill(s, tutor, 'learning') : 0;
  edu.progress = Math.min(100, edu.progress + 0.55 + tutorSkill * 0.04 + tutorLearning * 0.015 + (c.traits.includes('sharp') ? 0.2 : 0));
  // Le tuteur améliore lentement la compétence de base.
  if (tutorSkill > 0 && ctx.rng.chance(0.04 + tutorSkill * 0.004)) c.skills[edu.focus] = Math.min(20, c.skills[edu.focus] + 1);
  // Traits de personnalité acquis pendant l'enfance.
  const personalities = c.traits.filter((t) => TRAIT_BY_ID[t]?.category === 'personality').length;
  if ((age >= 6 && personalities < 1) || (age >= 11 && personalities < 2)) {
    if (tutor && ctx.rng.chance(0.25)) {
      const fromTutor = tutor.traits.filter((t) => TRAIT_BY_ID[t]?.category === 'personality');
      const pick = fromTutor.length ? ctx.rng.pick(fromTutor) : null;
      if (pick && !c.traits.some((t) => TRAIT_BY_ID[pick]?.opposites?.includes(t))) addTrait(c, pick);
    } else {
      c.traits = randomPersonality(ctx.rng, personalities + 1, c.traits);
    }
  }
  if (tutor && ctx.rng.chance(0.03) && !hasRelation(s, c.id, tutor.id, 'mentor')) {
    const rid = newId(s, 'rel');
    s.relations[rid] = { id: rid, a: tutor.id, b: c.id, type: 'mentor', since: s.date };
    bumpStructure();
  }
}

export function comeOfAge(ctx: Ctx, c: Character): void {
  const edu = c.education;
  c.education = null;
  if (edu) {
    let level = edu.progress < 40 ? 1 : edu.progress < 75 ? 2 : 3;
    if (ctx.rng.chance(0.15)) level = Math.max(1, Math.min(3, level + (ctx.rng.chance(0.5) ? 1 : -1)));
    addTrait(c, educationTraitFor(edu.focus, level));
    c.skills[edu.focus] += level;
  }
  const personalities = c.traits.filter((t) => TRAIT_BY_ID[t]?.category === 'personality').length;
  if (personalities < 3) c.traits = randomPersonality(ctx.rng, 3, c.traits);
  c.guardianId = null;
  c.prestige += 10;
  setFlag(c, 'came_of_age', ctx.s.date, 12);
  c.flags.adult = PERMANENT;
  notify(ctx, [c.id, c.fatherId, c.motherId, c.courtId], {
    level: 'info',
    kind: 'coming_of_age',
    vars: { name: c.firstName },
    focus: { type: 'character', id: c.id },
  });
  fireOnAction(ctx, 'coming_of_age', c.id, {});
}
