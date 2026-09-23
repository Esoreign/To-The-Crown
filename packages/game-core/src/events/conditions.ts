/**
 * Évaluation des conditions d'événements (lecture seule).
 */
import { RANK_ORDER, type Character, type Comparison, type Condition, type GameView, type ScopeRef } from '@ttc/shared';
import { ageOf, healthValue, isAdult, skill } from '../characters';
import { TRAIT_BY_ID } from '../content';
import { isCloseRelative, isParentOf } from '../family';
import { hasFlag } from '../flags';
import { domainProvinceIds } from '../characters';
import { atWarWith, hasRelation, opinion } from '../opinion';
import { isIndependent, rankOf, realmSize } from '../realm';
import { planSuccession } from '../succession';

export interface EventScope {
  root: string;
  target?: string | null;
  other?: string | null;
  actor?: string | null;
  provinceId?: string | null;
}

export function resolveScope(state: Pick<GameView, 'characters'>, scope: EventScope, ref: ScopeRef | undefined): Character | undefined {
  const id = scope[ref ?? 'root'];
  return id ? state.characters[id] : undefined;
}

function cmp(v: number, c: Comparison): boolean {
  if (c.min !== undefined && v < c.min) return false;
  if (c.max !== undefined && v > c.max) return false;
  return true;
}

function isAtWar(state: GameView, id: string): boolean {
  return Object.values(state.wars).some((w) => w.attackers.includes(id) || w.defenders.includes(id));
}

export function evalCondition(state: GameView, cond: Condition | undefined, scope: EventScope): boolean {
  if (!cond) return true;
  const who = (ref?: ScopeRef) => resolveScope(state, scope, ref);
  if ('all' in cond) return cond.all.every((c) => evalCondition(state, c, scope));
  if ('any' in cond) return cond.any.some((c) => evalCondition(state, c, scope));
  if ('not' in cond) return !evalCondition(state, cond.not, scope);
  if ('exists' in cond) return !!who(cond.exists);
  if ('hasBuildingSlot' in cond) {
    const r = who('root');
    return !!r && domainProvinceIds(r).length > 0;
  }
  if ('domainDevelopment' in cond || 'domainControl' in cond) {
    const r = who('root');
    if (!r) return false;
    const provs = domainProvinceIds(r).map((p) => state.provinces[p]!).filter(Boolean);
    if (!provs.length) return false;
    const key = 'domainDevelopment' in cond ? 'development' : 'control';
    const avg = provs.reduce((s, p) => s + p[key], 0) / provs.length;
    return cmp(avg, 'domainDevelopment' in cond ? cond.domainDevelopment : cond.domainControl);
  }
  if ('opinion' in cond) {
    const of = who(cond.of ?? 'root');
    const towards = who(cond.towards);
    if (!of || !towards) return false;
    return cmp(opinion(state, of.id, towards.id), cond.opinion);
  }
  const c = who('who' in cond ? cond.who : undefined);
  if (!c) return false;
  if ('hasTrait' in cond) return c.traits.includes(cond.hasTrait);
  if ('hasTraitCategory' in cond) return c.traits.some((t) => TRAIT_BY_ID[t]?.category === cond.hasTraitCategory);
  if ('isAdult' in cond) return isAdult(c, state.date) === cond.isAdult;
  if ('isRuler' in cond) return c.titleIds.length > 0 === cond.isRuler;
  if ('isIndependent' in cond) return isIndependent(c) === cond.isIndependent;
  if ('isMarried' in cond) return !!c.spouseId === cond.isMarried;
  if ('hasHeir' in cond) {
    const has = c.titleIds.length > 0 && !!planSuccession(state, c).primaryHeirId;
    return has === cond.hasHeir;
  }
  if ('atWar' in cond) return isAtWar(state, c.id) === cond.atWar;
  if ('isPlayer' in cond) return c.isPlayer === cond.isPlayer;
  if ('isFemale' in cond) return (c.sex === 'F') === cond.isFemale;
  if ('hasChildren' in cond) return c.childIds.some((id) => state.characters[id]?.death === null) === cond.hasChildren;
  if ('hasCouncil' in cond) return !!c.council === cond.hasCouncil;
  if ('age' in cond) return cmp(ageOf(c, state.date), cond.age);
  if ('skill' in cond) return cmp(skill(state, c, cond.skill), cond.value);
  if ('gold' in cond) return cmp(c.gold, cond.gold);
  if ('prestige' in cond) return cmp(c.prestige, cond.prestige);
  if ('fervor' in cond) return cmp(c.fervor, cond.fervor);
  if ('authority' in cond) return cmp(c.authority, cond.authority);
  if ('stress' in cond) return cmp(c.stress, cond.stress);
  if ('health' in cond) return cmp(healthValue(state, c), cond.health);
  if ('rank' in cond) return cmp(rankOf(c), cond.rank);
  if ('realmSize' in cond) return cmp(realmSize(state, c.id), cond.realmSize);
  if ('hasFlag' in cond) return hasFlag(c, cond.hasFlag, state.date);
  if ('hasRelation' in cond) {
    const o = who(cond.with);
    return !!o && hasRelation(state, c.id, o.id, cond.hasRelation);
  }
  if ('sameFaith' in cond) {
    const o = who(cond.sameFaith);
    return !!o && o.faithId === c.faithId;
  }
  if ('sameCulture' in cond) {
    const o = who(cond.sameCulture);
    return !!o && o.cultureId === c.cultureId;
  }
  if ('isRelative' in cond) {
    const o = who(cond.isRelative);
    return !!o && isCloseRelative(state, c, o);
  }
  if ('isSpouseOf' in cond) {
    const o = who(cond.isSpouseOf);
    return !!o && c.spouseId === o.id;
  }
  if ('isChildOf' in cond) {
    const o = who(cond.isChildOf);
    return !!o && isParentOf(o, c);
  }
  if ('isVassalOf' in cond) {
    const o = who(cond.isVassalOf);
    return !!o && c.liegeId === o.id;
  }
  if ('isCouncillorOf' in cond) {
    const o = who(cond.isCouncillorOf);
    if (!o?.council) return false;
    return Object.values(o.council).some((seat) => seat.characterId === c.id);
  }
  if ('hasSecret' in cond) {
    return Object.values(state.secrets).some((s) => s.ownerId === c.id && !s.exposed && (cond.hasSecret === true || s.type === cond.hasSecret));
  }
  if ('knowsSecretOf' in cond) {
    const o = who(cond.knowsSecretOf);
    return !!o && Object.values(state.secrets).some((s) => s.ownerId === o.id && !s.exposed && s.knownBy.includes(c.id));
  }
  if ('hasHookOn' in cond) {
    const o = who(cond.hasHookOn);
    return !!o && Object.values(state.hooks).some((h) => h.ownerId === c.id && h.targetId === o.id);
  }
  if ('hasClaims' in cond) {
    return Object.values(state.claims).some((cl) => cl.characterId === c.id) === cond.hasClaims;
  }
  return true;
}

export { RANK_ORDER, atWarWith };
