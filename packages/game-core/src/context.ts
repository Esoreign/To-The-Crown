/**
 * Contexte d'une étape de simulation : état (draft Immer), PRNG et sorties
 * (notifications, journal) non persistées dans l'état.
 */
import type {
  ChronicleEntry,
  GameLogEntry,
  GameNotification,
  GameState,
  NotificationLevel,
  SoundKey,
  StepOutput,
} from '@ttc/shared';
import { isDraft, original } from 'immer';
import { gameRng, type Rng } from './rng';
import { readView } from './view';

export interface Ctx {
  s: GameState;
  /**
   * État au début de l'étape (hors brouillon Immer) : à utiliser pour les
   * parcours en lecture seule de grandes collections (repérage des
   * personnages à traiter), puis agir sur `s`. Il ne reflète pas les
   * mutations de l'étape en cours.
   */
  base: GameState;
  /** Vue de lecture à jour et économe (voir view.ts) : jamais pour muter. */
  r: GameState;
  rng: Rng;
  out: StepOutput;
  /** Autorise les commandes de développement. */
  dev?: boolean;
  /** Recopie l'état du PRNG dans le brouillon (fin d'étape). */
  flush: () => void;
}

export function createCtx(s: GameState, dev = false): Ctx {
  const draft = isDraft(s);
  const base = draft ? (original(s) as GameState) : s;
  const rng = gameRng(s, draft);
  return { s, base, r: readView(s), rng, out: emptyOutput(), dev, flush: rng.flush };
}

export function emptyOutput(): StepOutput {
  return { notifications: [], log: [], pauseRequested: false };
}

export function newId(s: GameState, prefix: string): string {
  const id = `${prefix}${s.nextId}`;
  s.nextId++;
  return id;
}

export interface NotifyOpts {
  level: NotificationLevel;
  kind: string;
  vars?: Record<string, string | number>;
  focus?: GameNotification['focus'];
  sound?: SoundKey;
}

/** Notifie les joueurs parmi `to` (les personnages IA sont ignorés). */
export function notify(ctx: Ctx, to: (string | null | undefined)[], o: NotifyOpts): void {
  const players = [...new Set(to.filter((id): id is string => !!id && !!ctx.s.characters[id]?.isPlayer))];
  if (!players.length) return;
  ctx.out.notifications.push({
    id: `n${ctx.s.date}_${ctx.out.notifications.length}_${ctx.s.nextId}`,
    date: ctx.s.date,
    level: o.level,
    kind: o.kind,
    vars: o.vars ?? {},
    to: players,
    focus: o.focus,
    sound: o.sound,
  });
}

/** Notifie tous les joueurs. */
export function notifyAll(ctx: Ctx, o: NotifyOpts): void {
  notify(
    ctx,
    Object.values(ctx.s.players).map((p) => p.characterId),
    o,
  );
}

export function log(
  ctx: Ctx,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown>,
  visibleTo: string[] | null = null,
): void {
  const entry: GameLogEntry = { date: ctx.s.date, type, actorId, payload, visibleTo };
  ctx.out.log.push(entry);
}

const CHRONICLE_CAP = 400;

export function chronicle(
  ctx: Ctx,
  kind: ChronicleEntry['kind'],
  vars: Record<string, string | number>,
  characterIds: string[],
): void {
  const houseIds = [
    ...new Set(characterIds.map((id) => ctx.s.characters[id]?.houseId).filter((h): h is string => !!h)),
  ];
  ctx.s.chronicle.push({ id: newId(ctx.s, 'chr'), date: ctx.s.date, kind, vars, characterIds, houseIds });
  if (ctx.s.chronicle.length > CHRONICLE_CAP) ctx.s.chronicle.splice(0, ctx.s.chronicle.length - CHRONICLE_CAP);
}

/** Demande une pause (événement majeur pour un joueur en solo). */
export function requestPause(ctx: Ctx): void {
  ctx.out.pauseRequested = true;
}

/**
 * Exécute un traitement système en isolant les erreurs : une anomalie sur
 * une entité ne doit pas bloquer la simulation. L'erreur est journalisée
 * (type « error ») et comptée comme violation par les tests.
 */
export function safeRun(ctx: Ctx, label: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    log(ctx, 'error', null, { label, message: err instanceof Error ? err.message : String(err) }, []);
  }
}
