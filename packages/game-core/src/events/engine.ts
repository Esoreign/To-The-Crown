/**
 * Moteur d'événements : tirages périodiques, on_actions, chaînes, choix
 * joueur et IA, délais d'expiration.
 */
import {
  ErrorCodes,
  GameError,
  type Character,
  type EventChoiceDef,
  type EventDef,
  type OnAction,
  type TargetSelector,
} from '@ttc/shared';
import { BALANCE } from '../balance';
import { isAlive } from '../characters';
import { log, newId, notify, requestPause, type Ctx } from '../context';
import { CONTENT, EVENT_BY_ID } from '../content';
import { addStress, stressForTags } from '../stress';
import { evalCondition, type EventScope } from './conditions';
import { applyEffects } from './effects';
import { targetPool } from './targets';

const PULSE_EVENTS = CONTENT.events.filter((e) => e.trigger === 'pulse');
const ON_ACTION_EVENTS: Record<string, EventDef[]> = {};
for (const e of CONTENT.events) {
  if (e.trigger.startsWith('on:')) (ON_ACTION_EVENTS[e.trigger.slice(3)] ??= []).push(e);
}

function onCooldown(ctx: Ctx, c: Character, def: EventDef): boolean {
  const key = `ev_${def.id}`;
  const until = c.cooldowns[key];
  if (def.once && until !== undefined) return true;
  return until !== undefined && until > ctx.s.date;
}

function pickTarget(ctx: Ctx, root: Character, sel: TargetSelector | undefined, scope: EventScope, slot: 'target' | 'other'): boolean {
  if (!sel) return true;
  if (scope[slot]) return true;
  const candidates = targetPool(ctx.s, root, sel.pool).filter(
    (c) => c.id !== scope.target && evalCondition(ctx.s, sel.where, { ...scope, [slot]: c.id }),
  );
  if (!candidates.length) return !!sel.optional;
  scope[slot] = ctx.rng.pick(candidates).id;
  return true;
}

/** Prépare la portée d'un événement ; renvoie null si inéligible. */
export function prepareEvent(ctx: Ctx, def: EventDef, charId: string, base: Partial<EventScope> = {}): EventScope | null {
  const root = ctx.s.characters[charId];
  if (!root || !isAlive(root)) return null;
  if (def.rulerOnly !== false && root.titleIds.length === 0) return null;
  if (onCooldown(ctx, root, def)) return null;
  const scope: EventScope = { root: charId, ...base };
  if (!pickTarget(ctx, root, def.target, scope, 'target')) return null;
  if (!pickTarget(ctx, root, def.other, scope, 'other')) return null;
  if (!evalCondition(ctx.s, def.conditions, scope)) return null;
  return scope;
}

export function availableChoices(ctx: Pick<Ctx, 's'>, def: EventDef, scope: EventScope): EventChoiceDef[] {
  return def.choices.filter((ch) => evalCondition(ctx.s, ch.conditions, scope));
}

/** Déclenche un événement pour un personnage (joueur : fenêtre ; IA : choix immédiat). */
export function fireEvent(ctx: Ctx, def: EventDef, scope: EventScope): void {
  const root = ctx.s.characters[scope.root]!;
  root.cooldowns[`ev_${def.id}`] = def.once ? Number.MAX_SAFE_INTEGER : ctx.s.date + (def.cooldownDays ?? 1825);
  const choices = availableChoices(ctx, def, scope);
  if (!choices.length) return;
  if (root.isPlayer) {
    const id = newId(ctx.s, 'ae');
    ctx.s.activeEvents[id] = {
      id,
      eventId: def.id,
      characterId: root.id,
      scope: { root: scope.root, target: scope.target ?? null, other: scope.other ?? null, actor: scope.actor ?? null, provinceId: scope.provinceId ?? null },
      createdAt: ctx.s.date,
      expiresAt: ctx.s.date + (def.timeoutDays ?? BALANCE.events.defaultTimeoutDays),
      available: choices.map((c) => c.id),
    };
    notify(ctx, [root.id], { level: 'urgent', kind: 'event', vars: { eventId: def.id }, focus: { type: 'event', id }, sound: 'event' });
    if (def.major) requestPause(ctx);
    log(ctx, 'event.fired', root.id, { eventId: def.id, activeEventId: id }, [root.id]);
    return;
  }
  const choice = aiChoose(ctx, root, choices);
  resolveChoice(ctx, def, choice, scope);
}

export function aiChoiceWeight(root: Character, choice: EventChoiceDef): number {
  const ai = choice.ai ?? { base: 10 };
  let w = ai.base;
  for (const [t, v] of Object.entries(ai.traits ?? {})) if (root.traits.includes(t)) w += v;
  for (const [axis, v] of Object.entries(ai.personality ?? {})) {
    w += (root.personality[axis as keyof typeof root.personality] ?? 0) * (v ?? 0) * 0.01;
  }
  // L'IA évite les choix très stressants.
  w -= Math.max(0, stressForTags(root, choice.tags)) * 0.3;
  return Math.max(0, w);
}

function canAfford(c: Character, choice: EventChoiceDef): boolean {
  const cost = choice.cost;
  if (!cost) return true;
  return (
    c.gold >= (cost.gold ?? 0) && c.prestige >= (cost.prestige ?? 0) && c.fervor >= (cost.fervor ?? 0) && c.authority >= (cost.authority ?? 0)
  );
}

export function aiChoose(ctx: Ctx, root: Character, choices: EventChoiceDef[]): EventChoiceDef {
  const affordable = choices.filter((c) => canAfford(root, c));
  const pool = affordable.length ? affordable : choices;
  return ctx.rng.weighted(pool, (c) => aiChoiceWeight(root, c) + 0.1) ?? pool[0]!;
}

export function resolveChoice(ctx: Ctx, def: EventDef, choice: EventChoiceDef, scope: EventScope): void {
  const root = ctx.s.characters[scope.root]!;
  if (choice.cost) {
    if (!canAfford(root, choice)) {
      if (root.isPlayer) throw new GameError(ErrorCodes.INSUFFICIENT_GOLD, 'Ressources insuffisantes pour ce choix');
    } else {
      root.gold -= choice.cost.gold ?? 0;
      root.prestige -= choice.cost.prestige ?? 0;
      root.fervor -= choice.cost.fervor ?? 0;
      root.authority -= choice.cost.authority ?? 0;
    }
  }
  const stress = stressForTags(root, choice.tags);
  if (stress) addStress(ctx, root, stress);
  applyEffects(ctx, choice.effects, scope);
  log(ctx, 'event.resolved', root.id, { eventId: def.id, choiceId: choice.id }, root.isPlayer ? [root.id] : null);
}

/** Commande joueur : choisir une option d'un événement actif. */
export function chooseEventOption(ctx: Ctx, charId: string, activeEventId: string, choiceId: string): void {
  const ae = ctx.s.activeEvents[activeEventId];
  if (!ae) throw new GameError(ErrorCodes.EVENT_NOT_FOUND, 'Événement introuvable');
  if (ae.characterId !== charId) throw new GameError(ErrorCodes.FORBIDDEN, 'Cet événement ne vous concerne pas');
  const def = EVENT_BY_ID[ae.eventId];
  if (!def) throw new GameError(ErrorCodes.EVENT_NOT_FOUND, 'Définition inconnue');
  const choice = def.choices.find((c) => c.id === choiceId);
  if (!choice || !ae.available.includes(choiceId)) throw new GameError(ErrorCodes.CHOICE_UNAVAILABLE, 'Choix indisponible');
  const root = ctx.s.characters[charId]!;
  if (!canAfford(root, choice)) throw new GameError(ErrorCodes.INSUFFICIENT_GOLD, 'Ressources insuffisantes pour ce choix');
  delete ctx.s.activeEvents[activeEventId];
  resolveChoice(ctx, def, choice, { ...ae.scope, root: ae.scope.root });
}

/** Tirage mensuel d'événements pour un dirigeant. */
export function pulseEvents(ctx: Ctx, charId: string): void {
  const c = ctx.s.characters[charId];
  if (!c || !isAlive(c) || c.titleIds.length === 0) return;
  // Un joueur n'a jamais plus de 2 événements en attente.
  if (c.isPlayer && Object.values(ctx.s.activeEvents).filter((e) => e.characterId === charId).length >= 2) return;
  const chance = BALANCE.events.monthlyChance[ctx.s.settings.eventFrequency] * (c.isPlayer ? 1.3 : 0.6);
  if (!ctx.rng.chance(chance)) return;
  const candidates: { def: EventDef; scope: EventScope }[] = [];
  const shuffled = ctx.rng.shuffle([...PULSE_EVENTS]);
  for (const def of shuffled) {
    const scope = prepareEvent(ctx, def, charId);
    if (scope) candidates.push({ def, scope });
    if (candidates.length >= 8) break;
  }
  const picked = ctx.rng.weighted(candidates, (x) => x.def.weight ?? 10);
  if (picked) fireEvent(ctx, picked.def, picked.scope);
}

const ALWAYS_FIRE = new Set<string>(['stress_crisis', 'succession', 'scheme_discovered']);

/** Déclenche un événement réactif à une action du jeu. */
export function fireOnAction(ctx: Ctx, action: OnAction, charId: string, base: Partial<EventScope>): void {
  const list = ON_ACTION_EVENTS[action];
  if (!list?.length) return;
  const candidates: { def: EventDef; scope: EventScope }[] = [];
  for (const def of list) {
    const scope = prepareEvent(ctx, def, charId, base);
    if (scope) candidates.push({ def, scope });
  }
  if (!candidates.length) return;
  const noneWeight = ALWAYS_FIRE.has(action) ? 0 : 30;
  const total = candidates.reduce((s, c) => s + (c.def.weight ?? 10), 0);
  if (ctx.rng.next() * (total + noneWeight) >= total) return;
  const picked = ctx.rng.weighted(candidates, (x) => x.def.weight ?? 10);
  if (picked) fireEvent(ctx, picked.def, picked.scope);
}

/** Planifie un événement (chaîne) dans `days` jours. */
export function scheduleEvent(ctx: Ctx, eventId: string, charId: string, scope: EventScope, days: number): void {
  if (!EVENT_BY_ID[eventId]) return;
  const id = newId(ctx.s, 'se_ev');
  ctx.s.scheduledEvents[id] = {
    id,
    eventId,
    characterId: charId,
    scope: { root: charId, target: scope.target ?? null, other: scope.other ?? null, actor: scope.actor ?? null, provinceId: scope.provinceId ?? null },
    at: ctx.s.date + Math.max(0, days),
  };
}

/** Traitement journalier : événements planifiés et expirations. */
export function processEventQueue(ctx: Ctx): void {
  const s = ctx.s;
  for (const [id, se] of Object.entries(s.scheduledEvents)) {
    if (se.at > s.date) continue;
    delete s.scheduledEvents[id];
    const def = EVENT_BY_ID[se.eventId];
    const root = s.characters[se.characterId];
    if (!def || !root || !isAlive(root)) continue;
    // Les événements chaînés ignorent le cooldown mais revérifient cibles et conditions.
    const scope: EventScope = {
      root: se.characterId,
      target: se.scope.target && isAlive(s.characters[se.scope.target]) ? se.scope.target : null,
      other: se.scope.other && isAlive(s.characters[se.scope.other]) ? se.scope.other : null,
      actor: se.scope.actor ?? null,
      provinceId: se.scope.provinceId ?? null,
    };
    if (def.target && !scope.target && !pickTarget(ctx, root, def.target, scope, 'target')) continue;
    if (def.other && !scope.other && !pickTarget(ctx, root, def.other, scope, 'other')) continue;
    if (!evalCondition(s, def.conditions, scope)) continue;
    fireEvent(ctx, def, scope);
  }
  for (const [id, ae] of Object.entries(s.activeEvents)) {
    if (ae.expiresAt > s.date) continue;
    const def = EVENT_BY_ID[ae.eventId];
    const root = s.characters[ae.characterId];
    delete s.activeEvents[id];
    if (!def || !root || !isAlive(root)) continue;
    const choices = def.choices.filter((c) => ae.available.includes(c.id));
    if (!choices.length) continue;
    const choice = aiChoose(ctx, root, choices);
    notify(ctx, [root.id], { level: 'info', kind: 'event_timeout', vars: { eventId: def.id, choiceId: choice.id } });
    resolveChoice(ctx, def, choice, { ...ae.scope, root: ae.scope.root });
  }
}

/** Déclenche un événement précis (outils dev / chaînes système). */
export function triggerEventById(ctx: Ctx, eventId: string, charId: string, base: Partial<EventScope> = {}): boolean {
  const def = EVENT_BY_ID[eventId];
  if (!def) throw new GameError(ErrorCodes.EVENT_NOT_FOUND, 'Événement inconnu');
  const root = ctx.s.characters[charId];
  if (!root) return false;
  delete root.cooldowns[`ev_${def.id}`];
  const scope = prepareEvent(ctx, def, charId, base);
  if (!scope) return false;
  fireEvent(ctx, def, scope);
  return true;
}
