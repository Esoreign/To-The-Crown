/**
 * Complots : progression mensuelle, agents, découverte, résolution.
 */
import { ErrorCodes, GameError, type Character, type GameView, type Scheme, type SchemeType, type SkillKey } from '@ttc/shared';
import { BALANCE } from './balance';
import { ageOf, characterModifier, isAdult, isAlive, skill } from './characters';
import { log, newId, notify, type Ctx } from './context';
import { TITLE_DEFS } from './content';
import { killCharacter } from './death';
import { fireOnAction } from './events/engine';
import { isCloseRelative } from './family';
import { addOpinion, hasRelation, opinion } from './opinion';
import { courtiers } from './realm';
import { hookFromSecret } from './secrets';
import { seatSkill } from './council';
import { addTrait } from './characters';
import { addStress } from './stress';
import { bumpStructure } from './index-cache';

export interface SchemeDef {
  type: SchemeType;
  skill: SkillKey;
  hostile: boolean;
  maxAgents: number;
}

export const SCHEME_DEFS: Record<SchemeType, SchemeDef> = {
  murder: { type: 'murder', skill: 'intrigue', hostile: true, maxAgents: 4 },
  discover_secrets: { type: 'discover_secrets', skill: 'intrigue', hostile: true, maxAgents: 2 },
  fabricate_hook: { type: 'fabricate_hook', skill: 'intrigue', hostile: true, maxAgents: 2 },
  claim: { type: 'claim', skill: 'learning', hostile: true, maxAgents: 0 },
  seduce: { type: 'seduce', skill: 'intrigue', hostile: false, maxAgents: 0 },
  befriend: { type: 'befriend', skill: 'diplomacy', hostile: false, maxAgents: 0 },
  sway: { type: 'sway', skill: 'diplomacy', hostile: false, maxAgents: 0 },
};

export function schemeValidity(state: GameView, owner: Character, target: Character, type: SchemeType): string | null {
  if (!isAlive(owner) || !isAlive(target)) return 'dead';
  if (owner.id === target.id) return 'self';
  if (!isAdult(owner, state.date)) return 'owner_minor';
  if (owner.prisonerOf) return 'prisoner';
  const active = Object.values(state.schemes).filter((s) => s.ownerId === owner.id && s.status === 'active');
  if (active.some((s) => s.targetId === target.id && s.type === type)) return 'duplicate';
  const def = SCHEME_DEFS[type];
  if (active.filter((s) => SCHEME_DEFS[s.type].hostile === def.hostile).length >= 1) return 'limit';
  switch (type) {
    case 'seduce':
      if (owner.sex === target.sex || !isAdult(target, state.date) || isCloseRelative(state, owner, target)) return 'invalid_target';
      if (hasRelation(state, owner.id, target.id, 'lover')) return 'already';
      break;
    case 'befriend':
      if (hasRelation(state, owner.id, target.id, 'friend') || hasRelation(state, owner.id, target.id, 'best_friend')) return 'already';
      break;
    case 'claim':
      if (!target.titleIds.length) return 'invalid_target';
      if (Object.values(state.claims).some((c) => c.characterId === owner.id && c.titleId === target.titleIds[0])) return 'already';
      break;
    default:
      break;
  }
  return null;
}

export function startScheme(ctx: Ctx, ownerId: string, type: SchemeType, targetId: string, silent = false): Scheme {
  const owner = ctx.s.characters[ownerId];
  const target = ctx.s.characters[targetId];
  if (!owner || !target) throw new GameError(ErrorCodes.INVALID_TARGET, 'Cible invalide');
  const why = schemeValidity(ctx.s, owner, target, type);
  if (why) throw new GameError(ErrorCodes.INVALID_TARGET, `Complot impossible : ${why}`, { reason: why });
  const id = newId(ctx.s, 'sc');
  const sch: Scheme = {
    id,
    type,
    ownerId,
    targetId,
    agents: [],
    progress: 0,
    power: 0,
    resistance: 0,
    secrecy: 80,
    status: 'active',
    startedAt: ctx.s.date,
    discoveredBy: [],
  };
  ctx.s.schemes[id] = sch;
  updateSchemeNumbers(ctx.s, sch);
  if (!silent) log(ctx, 'scheme.start', ownerId, { schemeId: id, type, targetId }, [ownerId]);
  if (type === 'murder' && isCloseRelative(ctx.s, owner, target)) addStress(ctx, owner, owner.traits.includes('compassionate') ? 30 : 5);
  return sch;
}

export function schemePower(state: GameView, sch: Scheme): number {
  const owner = state.characters[sch.ownerId];
  if (!owner) return 0;
  const def = SCHEME_DEFS[sch.type];
  let p = skill(state, owner, def.skill) * BALANCE.schemes.powerPerSkill * 2 + characterModifier(state, owner, 'scheme_power') / 5;
  for (const a of sch.agents) {
    const ag = state.characters[a];
    if (ag && isAlive(ag)) p += 1 + skill(state, ag, 'intrigue') / 6;
  }
  if (sch.type === 'seduce') {
    const target = state.characters[sch.targetId];
    if (target) p += characterModifier(state, owner, 'attraction_opinion') / 5 + opinion(state, target.id, owner.id) / 20;
  }
  if (sch.type === 'befriend' || sch.type === 'sway') {
    const target = state.characters[sch.targetId];
    if (target) p += opinion(state, target.id, owner.id) / 15;
  }
  return Math.max(0, p);
}

export function schemeResistance(state: GameView, sch: Scheme): number {
  const target = state.characters[sch.targetId];
  if (!target) return 0;
  const def = SCHEME_DEFS[sch.type];
  let r = skill(state, target, def.hostile ? 'intrigue' : def.skill) * BALANCE.schemes.resistancePerSkill * 2;
  r += characterModifier(state, target, 'scheme_resistance') / 5;
  if (def.hostile) {
    // Maître-espion protecteur : le sien ou celui de son suzerain.
    const protector = target.titleIds.length ? target : target.courtId ? state.characters[target.courtId] : undefined;
    if (protector?.council) {
      const spy = seatSkill(state, protector, 'spymaster');
      r += spy * (protector.council.spymaster.task === 'spymaster_disrupt' ? BALANCE.council.disruptPerSkill : 0.1);
    }
  }
  return Math.max(0, r);
}

function updateSchemeNumbers(state: GameView, sch: Scheme): void {
  sch.power = Math.round(schemePower(state, sch) * 10) / 10;
  sch.resistance = Math.round(schemeResistance(state, sch) * 10) / 10;
}

/** Chance mensuelle de réussite finale (affichée dans l'UI). */
export function schemeSuccessChance(sch: Scheme): number {
  const base = sch.type === 'murder' ? BALANCE.schemes.murderSuccessBase : BALANCE.schemes.successBase;
  return Math.max(0.1, Math.min(0.95, base + (sch.power - sch.resistance) * 0.015));
}

export function schemeDiscoveryChance(sch: Scheme): number {
  if (!SCHEME_DEFS[sch.type].hostile) return 0;
  return Math.max(0.005, Math.min(0.4, BALANCE.schemes.discoveryBase + (sch.resistance - sch.power) * 0.004 + sch.agents.length * 0.006));
}

function recruitAgents(ctx: Ctx, sch: Scheme): void {
  const def = SCHEME_DEFS[sch.type];
  if (sch.agents.length >= def.maxAgents) return;
  const target = ctx.s.characters[sch.targetId];
  if (!target) return;
  const court = target.titleIds.length ? target.id : target.courtId;
  if (!court) return;
  const pool = courtiers(ctx.s, court).filter(
    (c) =>
      !sch.agents.includes(c.id) &&
      c.id !== sch.ownerId &&
      !c.isPlayer &&
      isAdult(c, ctx.s.date) &&
      opinion(ctx.s, c.id, target.id) < -5 &&
      opinion(ctx.s, c.id, sch.ownerId) > -20 &&
      !isCloseRelative(ctx.s, c, target),
  );
  if (pool.length && ctx.rng.chance(0.35)) sch.agents.push(ctx.rng.pick(pool).id);
}

export function monthlySchemes(ctx: Ctx): void {
  const s = ctx.s;
  for (const sch of Object.values(s.schemes)) {
    if (sch.status !== 'active') {
      delete s.schemes[sch.id];
      continue;
    }
    const owner = s.characters[sch.ownerId];
    const target = s.characters[sch.targetId];
    if (!owner || !target || !isAlive(owner) || !isAlive(target)) {
      delete s.schemes[sch.id];
      continue;
    }
    recruitAgents(ctx, sch);
    updateSchemeNumbers(s, sch);
    const gain = Math.max(0.8, BALANCE.schemes.baseMonthlyProgress + (sch.power - sch.resistance) * 0.35);
    sch.progress = Math.min(100, sch.progress + gain);
    // Découverte.
    if (!sch.discoveredBy.includes(target.id) && ctx.rng.chance(schemeDiscoveryChance(sch))) {
      discoverScheme(ctx, sch, target.id);
      if (sch.status !== 'active') continue;
    }
    if (sch.progress >= 100) resolveScheme(ctx, sch);
  }
}

export function discoverScheme(ctx: Ctx, sch: Scheme, byId: string): void {
  const s = ctx.s;
  if (sch.discoveredBy.includes(byId)) return;
  sch.discoveredBy.push(byId);
  sch.secrecy = Math.max(0, sch.secrecy - 40);
  const owner = s.characters[sch.ownerId]!;
  const target = s.characters[sch.targetId]!;
  if (byId === target.id || s.characters[byId]?.id === target.liegeId) {
    addOpinion(s, target.id, owner.id, sch.type === 'murder' ? -60 : -30, 'opinion.reason.plotted_against', 120);
  }
  if (sch.type === 'murder') {
    const sid = newId(s, 'se');
    s.secrets[sid] = { id: sid, type: 'murder_plot', ownerId: owner.id, aboutId: target.id, knownBy: [byId, owner.id], createdAt: s.date, exposed: false };
  }
  notify(ctx, [byId], { level: 'urgent', kind: 'scheme_discovered', vars: { owner: owner.firstName, type: sch.type }, focus: { type: 'character', id: owner.id }, sound: 'notify' });
  notify(ctx, [owner.id], { level: 'urgent', kind: 'own_scheme_discovered', vars: { target: target.firstName, type: sch.type }, focus: { type: 'scheme', id: sch.id } });
  fireOnAction(ctx, 'scheme_discovered', byId, { target: owner.id });
}

function resolveScheme(ctx: Ctx, sch: Scheme): void {
  const s = ctx.s;
  const owner = s.characters[sch.ownerId]!;
  const target = s.characters[sch.targetId]!;
  const success = ctx.rng.chance(schemeSuccessChance(sch));
  sch.status = success ? 'succeeded' : 'failed';
  const vars = { target: target.firstName, type: sch.type };
  if (success) {
    switch (sch.type) {
      case 'murder': {
        const sid = newId(s, 'se');
        s.secrets[sid] = { id: sid, type: 'murder_plot', ownerId: owner.id, aboutId: target.id, knownBy: [owner.id, ...sch.agents], createdAt: s.date, exposed: false };
        if (isCloseRelative(s, owner, target)) addTrait(owner, 'kinslayer');
        killCharacter(ctx, target.id, 'murder', owner.id);
        break;
      }
      case 'discover_secrets': {
        const secrets = Object.values(s.secrets).filter((x) => x.ownerId === target.id && !x.exposed);
        for (const sec of secrets) {
          if (!sec.knownBy.includes(owner.id)) sec.knownBy.push(owner.id);
          hookFromSecret(ctx, sec.id, owner.id);
        }
        if (!secrets.length) sch.status = 'failed';
        break;
      }
      case 'fabricate_hook': {
        const hid = newId(s, 'hk');
        s.hooks[hid] = { id: hid, ownerId: owner.id, targetId: target.id, strong: false, secretId: null, createdAt: s.date, expires: s.date + 10 * 365, cooldownUntil: s.date };
        break;
      }
      case 'claim': {
        const titleId = target.titleIds.find((t) => TITLE_DEFS[t]?.rank === 'county') ?? target.titleIds[0]!;
        const cid = newId(s, 'cl');
        s.claims[cid] = { id: cid, characterId: owner.id, titleId, kind: 'fabricated', pressed: true, createdAt: s.date, expires: null, origin: 'claim.origin.fabricated' };
        break;
      }
      case 'seduce': {
        const rid = newId(s, 'rel');
        s.relations[rid] = { id: rid, a: owner.id, b: target.id, type: 'lover', since: s.date };
        bumpStructure();
        for (const c of [owner, target]) {
          if (c.spouseId) {
            const sid = newId(s, 'se');
            s.secrets[sid] = { id: sid, type: 'forbidden_love', ownerId: c.id, aboutId: c.id === owner.id ? target.id : owner.id, knownBy: [owner.id, target.id], createdAt: s.date, exposed: false };
          }
        }
        break;
      }
      case 'befriend': {
        const rid = newId(s, 'rel');
        s.relations[rid] = { id: rid, a: owner.id, b: target.id, type: 'friend', since: s.date };
        bumpStructure();
        break;
      }
      case 'sway':
        addOpinion(s, target.id, owner.id, 30, 'opinion.reason.swayed', 120);
        break;
    }
  } else if (SCHEME_DEFS[sch.type].hostile && ctx.rng.chance(0.4)) {
    discoverScheme(ctx, sch, target.id);
  } else if (sch.type === 'befriend' || sch.type === 'seduce') {
    addOpinion(s, target.id, owner.id, -10, 'opinion.reason.rebuffed', 36);
  }
  notify(ctx, [owner.id], {
    level: 'important',
    kind: success ? 'scheme_success' : 'scheme_failure',
    vars,
    focus: { type: 'character', id: target.id },
    sound: success ? 'confirm' : 'error',
  });
  log(ctx, 'scheme.end', owner.id, { schemeId: sch.id, type: sch.type, success }, [owner.id]);
  void ageOf;
}

export function cancelScheme(ctx: Ctx, ownerId: string, schemeId: string): void {
  const sch = ctx.s.schemes[schemeId];
  if (!sch || sch.ownerId !== ownerId) throw new GameError(ErrorCodes.FORBIDDEN, 'Complot introuvable');
  delete ctx.s.schemes[schemeId];
}
