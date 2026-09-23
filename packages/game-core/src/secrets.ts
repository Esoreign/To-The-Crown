/**
 * Secrets et leviers (hooks).
 */
import { ErrorCodes, GameError, type Hook, type Secret } from '@ttc/shared';
import { addTrait } from './characters';
import { chronicle, newId, notify, type Ctx } from './context';
import { setFlag } from './flags';
import { addOpinion } from './opinion';

/** Secrets permettant de créer un levier sur leur propriétaire. */
export const HOOKABLE: ReadonlySet<Secret['type']> = new Set(['forbidden_love', 'corruption', 'murder_plot', 'bastard', 'debt', 'political_crime', 'heresy']);

export function knownSecretsOf(state: { secrets: Record<string, Secret> }, knowerId: string): Secret[] {
  return Object.values(state.secrets).filter((s) => s.knownBy.includes(knowerId) && !s.exposed);
}

/** Crée un levier à partir d'un secret connu (s'il n'en existe pas déjà). */
export function hookFromSecret(ctx: Ctx, secretId: string, ownerId: string): Hook | null {
  const sec = ctx.s.secrets[secretId];
  if (!sec || sec.exposed || !HOOKABLE.has(sec.type) || sec.ownerId === ownerId) return null;
  const existing = Object.values(ctx.s.hooks).find((h) => h.ownerId === ownerId && h.targetId === sec.ownerId);
  if (existing) return existing;
  const id = newId(ctx.s, 'hk');
  const hook: Hook = {
    id,
    ownerId,
    targetId: sec.ownerId,
    strong: sec.type === 'murder_plot' || sec.type === 'political_crime',
    secretId,
    createdAt: ctx.s.date,
    expires: null,
    cooldownUntil: ctx.s.date,
  };
  ctx.s.hooks[id] = hook;
  return hook;
}

/** Consomme un levier (faible : supprimé ; fort : recharge de 5 ans). */
export function consumeHook(ctx: Ctx, hookId: string): void {
  const h = ctx.s.hooks[hookId];
  if (!h) return;
  if (h.strong) h.cooldownUntil = ctx.s.date + 5 * 365;
  else delete ctx.s.hooks[hookId];
}

export function usableHook(state: { hooks: Record<string, Hook>; date: number }, ownerId: string, targetId: string): Hook | undefined {
  return Object.values(state.hooks).find((h) => h.ownerId === ownerId && h.targetId === targetId && h.cooldownUntil <= state.date);
}

/** Révèle publiquement un secret. */
export function exposeSecret(ctx: Ctx, secretId: string, exposerId: string | null): void {
  const s = ctx.s;
  const sec = s.secrets[secretId];
  if (!sec || sec.exposed) throw new GameError(ErrorCodes.INVALID_TARGET, 'Secret inconnu');
  if (exposerId && !sec.knownBy.includes(exposerId)) throw new GameError(ErrorCodes.FORBIDDEN, 'Secret non connu');
  const owner = s.characters[sec.ownerId];
  sec.exposed = true;
  for (const [id, h] of Object.entries(s.hooks)) if (h.secretId === secretId) delete s.hooks[id];
  if (!owner) return;
  owner.prestige -= 100;
  switch (sec.type) {
    case 'murder_plot':
      addTrait(owner, 'murderer');
      chronicle(ctx, 'murder_discovered', { name: owner.id }, [owner.id]);
      break;
    case 'forbidden_love':
      addTrait(owner, 'adulterer');
      break;
    case 'bastard': {
      const child = sec.aboutId ? s.characters[sec.aboutId] : undefined;
      if (child) {
        setFlag(child, 'bastard', s.date);
        setFlag(child, 'no_inherit', s.date);
      }
      addTrait(owner, 'adulterer');
      break;
    }
    case 'corruption':
      owner.gold -= 50;
      for (const r of Object.values(s.characters)) {
        if (r.council) for (const seat of Object.values(r.council)) if (seat.characterId === owner.id) seat.characterId = null;
      }
      break;
    case 'political_crime':
      setFlag(owner, 'criminal', s.date, 120);
      break;
    case 'heresy':
      addTrait(owner, 'heretic');
      break;
    case 'debt':
      owner.prestige -= 50;
      break;
  }
  if (exposerId) {
    addOpinion(s, owner.id, exposerId, -40, 'opinion.reason.exposed_secret', 120);
    const exposer = s.characters[exposerId];
    if (exposer) exposer.prestige += 25;
  }
  if (owner.liegeId) addOpinion(s, owner.liegeId, owner.id, -20, 'opinion.reason.scandal', 60);
  notify(ctx, [owner.id, owner.liegeId, owner.spouseId, exposerId, ...Object.values(s.players).map((p) => p.characterId)], {
    level: 'important',
    kind: 'secret_exposed',
    vars: { owner: owner.firstName, type: sec.type },
    focus: { type: 'character', id: owner.id },
  });
}
