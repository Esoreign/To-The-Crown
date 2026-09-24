/**
 * Catalogue d'effets data-driven. Chaque effet est validé (cibles existantes,
 * bornes) avant d'être appliqué.
 */
import type { Effect, GameState, ScopeRef } from '@ttc/shared';
import { addTrait, ageOf, isAlive, removeTrait } from '../characters';
import { chronicle, newId, notify, type Ctx } from '../context';
import { PROVINCE_GEO, TITLE_DEFS } from '../content';
import { killCharacter } from '../death';
import { createCharacter, birthForAge } from '../factory';
import { clearFlag, setFlag } from '../flags';
import { addOpinion } from '../opinion';
import { capitalProvinceOf, directVassals } from '../realm';
import { startScheme } from '../schemes';
import { addStress } from '../stress';
import { exposeSecret } from '../secrets';
import { imprison, releasePrisoner } from '../diplomacy';
import { evalCondition, resolveScope, type EventScope } from './conditions';
import { scheduleEvent } from './engine';
import { bumpStructure } from '../index-cache';

function scopeProvince(ctx: Ctx, scope: EventScope): string | null {
  if (scope.provinceId) return scope.provinceId;
  const root = ctx.s.characters[scope.root];
  return root ? capitalProvinceOf(root) : null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function applyEffects(ctx: Ctx, effects: Effect[], scope: EventScope): void {
  for (const e of effects) applyEffect(ctx, e, scope);
}

export function applyEffect(ctx: Ctx, e: Effect, scope: EventScope): void {
  const s = ctx.s;
  const who = (ref?: ScopeRef) => {
    const c = resolveScope(s, scope, ref);
    return c && isAlive(c) ? c : undefined;
  };
  if ('none' in e) return;
  if ('chance' in e) {
    if (ctx.rng.chance(e.chance / 100)) applyEffects(ctx, e.then, scope);
    else if (e.else) applyEffects(ctx, e.else, scope);
    return;
  }
  if ('if' in e) {
    if (evalCondition(s, e.if, scope)) applyEffects(ctx, e.then, scope);
    else if (e.else) applyEffects(ctx, e.else, scope);
    return;
  }
  if ('triggerEvent' in e) {
    const target = who(e.triggerEvent.who ?? 'root');
    if (target) scheduleEvent(ctx, e.triggerEvent.id, target.id, { ...scope, root: target.id }, e.triggerEvent.days ?? 0);
    return;
  }
  if ('chronicle' in e) {
    chronicle(ctx, 'event', { text: e.chronicle, root: scope.root, target: scope.target ?? '' }, [scope.root, scope.target ?? ''].filter(Boolean));
    return;
  }
  if ('changeControl' in e || 'changeDevelopment' in e || 'changeLevies' in e) {
    const pid = scopeProvince(ctx, scope);
    const p = pid ? s.provinces[pid] : undefined;
    if (!p) return;
    if ('changeControl' in e) p.control = clamp(p.control + e.changeControl, 0, 100);
    if ('changeDevelopment' in e) p.development = clamp(p.development + e.changeDevelopment, 0, 100);
    if ('changeLevies' in e) p.levies = Math.max(0, p.levies + e.changeLevies);
    return;
  }
  if ('addVassalOpinion' in e) {
    const root = who('root');
    if (!root) return;
    for (const v of directVassals(s, root.id)) addOpinion(s, v.id, root.id, e.addVassalOpinion, e.reason, e.months ?? 60);
    return;
  }
  if ('recruitMaa' in e) {
    const root = who('root');
    if (root) root.maa[e.recruitMaa.unit] = (root.maa[e.recruitMaa.unit] ?? 0) + e.recruitMaa.men;
    return;
  }
  if ('spawnCourtier' in e) {
    const root = who('root');
    if (!root) return;
    const court = root.titleIds.length ? root.id : root.courtId;
    const id = newId(s, 'ch');
    const c = createCharacter(s as GameState, ctx.rng, {
      id,
      sex: ctx.rng.chance(0.6) ? 'M' : 'F',
      birth: birthForAge(s.date, ctx.rng.int(18, 40), ctx.rng),
      cultureId: root.cultureId,
      faithId: root.faithId,
      houseId: null,
      courtId: court,
      traits: e.spawnCourtier.traits ?? [],
      now: s.date,
      skills: e.spawnCourtier.skill ? { [e.spawnCourtier.skill]: ctx.rng.int(10, 15) } : undefined,
    });
    if (e.spawnCourtier.flag) setFlag(c, e.spawnCourtier.flag, s.date);
    if (e.as) scope[e.as] = c.id;
    return;
  }
  if ('exposeSecret' in e) {
    const o = who(e.exposeSecret.of);
    if (!o) return;
    // Priorité à un secret que le destinataire connaît ; sinon la rumeur éclate sans auteur.
    const hidden = Object.values(s.secrets).filter((x) => x.ownerId === o.id && !x.exposed);
    const known = hidden.find((x) => x.knownBy.includes(scope.root));
    if (known) exposeSecret(ctx, known.id, scope.root);
    else if (hidden[0]) exposeSecret(ctx, hidden[0].id, null);
    return;
  }

  const c = who('who' in e ? e.who : undefined);
  if (!c) return;
  if ('addGold' in e) c.gold += e.addGold;
  else if ('addPrestige' in e) c.prestige += e.addPrestige;
  else if ('addAuthority' in e) c.authority = Math.max(0, c.authority + e.addAuthority);
  else if ('addFervor' in e) c.fervor = Math.max(0, c.fervor + e.addFervor);
  else if ('addRenown' in e) {
    const house = c.houseId ? s.houses[c.houseId] : undefined;
    if (house) {
      house.renown += e.addRenown;
      const dyn = s.dynasties[house.dynastyId];
      if (dyn) dyn.renown += e.addRenown;
    }
  } else if ('addStress' in e) addStress(ctx, c, e.addStress);
  else if ('addHealth' in e) c.health = clamp(c.health + e.addHealth, 0, 8);
  else if ('addOpinion' in e) {
    const t = who(e.addOpinion.towards);
    if (t) addOpinion(s, c.id, t.id, e.addOpinion.value, e.addOpinion.reason, e.addOpinion.months ?? 60);
  } else if ('addMutualOpinion' in e) {
    const t = who(e.addMutualOpinion.with);
    if (t) {
      addOpinion(s, c.id, t.id, e.addMutualOpinion.value, e.addMutualOpinion.reason, e.addMutualOpinion.months ?? 60);
      addOpinion(s, t.id, c.id, e.addMutualOpinion.value, e.addMutualOpinion.reason, e.addMutualOpinion.months ?? 60);
    }
  } else if ('addTrait' in e) addTrait(c, e.addTrait);
  else if ('removeTrait' in e) removeTrait(c, e.removeTrait);
  else if ('addSkill' in e) c.skills[e.addSkill.skill] = clamp(c.skills[e.addSkill.skill] + e.addSkill.value, 0, 30);
  else if ('addModifier' in e) {
    c.modifiers = c.modifiers.filter((m) => m.id !== e.addModifier.id);
    c.modifiers.push({
      id: e.addModifier.id,
      values: e.addModifier.values,
      expires: e.addModifier.months ? s.date + Math.round(e.addModifier.months * 30.4) : null,
      source: `modifier.${e.addModifier.id}`,
    });
  } else if ('removeModifier' in e) c.modifiers = c.modifiers.filter((m) => m.id !== e.removeModifier);
  else if ('setFlag' in e) setFlag(c, e.setFlag, s.date, e.months);
  else if ('clearFlag' in e) clearFlag(c, e.clearFlag);
  else if ('createSecret' in e) {
    const about = e.createSecret.about ? who(e.createSecret.about) : undefined;
    const knownBy = (e.createSecret.knownBy ?? []).map((r) => who(r)?.id).filter((x): x is string => !!x);
    const sid = newId(s, 'se');
    s.secrets[sid] = { id: sid, type: e.createSecret.type, ownerId: c.id, aboutId: about?.id ?? null, knownBy: [...new Set([c.id, ...knownBy])], createdAt: s.date, exposed: false };
  } else if ('discoverSecret' in e) {
    const o = who(e.discoverSecret.of);
    if (!o) return;
    const sec = Object.values(s.secrets).find((x) => x.ownerId === o.id && !x.exposed && !x.knownBy.includes(c.id));
    if (sec) {
      sec.knownBy.push(c.id);
      notify(ctx, [c.id], { level: 'important', kind: 'secret_discovered', vars: { owner: o.firstName, type: sec.type }, focus: { type: 'character', id: o.id } });
    }
  } else if ('createHook' in e) {
    const t = who(e.createHook.on);
    if (!t) return;
    const hid = newId(s, 'hk');
    s.hooks[hid] = {
      id: hid,
      ownerId: c.id,
      targetId: t.id,
      strong: !!e.createHook.strong,
      secretId: null,
      createdAt: s.date,
      expires: e.createHook.years ? s.date + e.createHook.years * 365 : null,
      cooldownUntil: s.date,
    };
  } else if ('addClaim' in e) {
    const target = who('target');
    if (!target) return;
    const titleId = e.addClaim.title === 'targetPrimary' ? target.titleIds[0] : target.titleIds.find((t) => TITLE_DEFS[t]?.rank === 'county');
    if (!titleId) return;
    if (Object.values(s.claims).some((cl) => cl.characterId === c.id && cl.titleId === titleId)) return;
    const cid = newId(s, 'cl');
    s.claims[cid] = { id: cid, characterId: c.id, titleId, kind: 'fabricated', pressed: !!e.addClaim.pressed, createdAt: s.date, expires: null, origin: 'claim.origin.event' };
  } else if ('startScheme' in e) {
    const t = who(e.startScheme.target);
    if (t) {
      try {
        startScheme(ctx, c.id, e.startScheme.type, t.id, true);
      } catch {
        // Complot impossible (cible invalide) : sans effet.
      }
    }
  } else if ('killCharacter' in e) {
    killCharacter(ctx, c.id, e.killCharacter.cause, scope.root !== c.id ? scope.root : null);
  } else if ('woundCharacter' in e) {
    addTrait(c, 'wounded');
  } else if ('imprison' in e) {
    const by = who(e.imprison.by);
    if (by) imprison(ctx, by.id, c.id, true);
  } else if ('release' in e) {
    releasePrisoner(ctx, c.id);
  } else if ('createRelationship' in e) {
    const t = who(e.createRelationship.with);
    if (!t || t.id === c.id) return;
    const exists = Object.values(s.relations).some(
      (r) => r.type === e.createRelationship.type && ((r.a === c.id && r.b === t.id) || (r.a === t.id && r.b === c.id)),
    );
    if (exists) return;
    // Relations exclusives : amitié et rivalité s'annulent.
    const opposite: Record<string, string[]> = { friend: ['rival', 'nemesis'], rival: ['friend', 'best_friend'], best_friend: ['friend', 'rival', 'nemesis'], nemesis: ['rival', 'friend', 'best_friend'], soulmate: ['lover'] };
    for (const [id, r] of Object.entries(s.relations)) {
      if (((r.a === c.id && r.b === t.id) || (r.a === t.id && r.b === c.id)) && opposite[e.createRelationship.type]?.includes(r.type)) {
        delete s.relations[id];
        bumpStructure();
      }
    }
    const rid = newId(s, 'rel');
    s.relations[rid] = { id: rid, a: c.id, b: t.id, type: e.createRelationship.type, since: s.date };
    bumpStructure();
    notify(ctx, [c.id, t.id], {
      level: 'info',
      kind: `relation_${e.createRelationship.type}`,
      vars: { a: c.firstName, b: t.firstName },
      focus: { type: 'character', id: c.isPlayer ? t.id : c.id },
    });
  } else if ('breakRelationship' in e) {
    const t = who(e.breakRelationship.with);
    if (!t) return;
    for (const [id, r] of Object.entries(s.relations)) {
      if (r.type === e.breakRelationship.type && ((r.a === c.id && r.b === t.id) || (r.a === t.id && r.b === c.id))) delete s.relations[id];
      bumpStructure();
    }
  } else if ('banish' in e) {
    if (c.titleIds.length) return;
    c.courtId = null;
    bumpStructure();
    for (const r of Object.values(s.characters)) {
      if (r.council) for (const seat of Object.values(r.council)) if (seat.characterId === c.id) seat.characterId = null;
    }
  }
  void ageOf;
  void PROVINCE_GEO;
}
