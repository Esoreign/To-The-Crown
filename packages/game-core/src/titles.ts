/**
 * Transfert, création et règles de titres.
 */
import { GameError, ErrorCodes, RANK_ORDER, type Character, type GameState, type GameView, type TitleHistoryEntry } from '@ttc/shared';
import { isAlive } from './characters';
import { DEJURE_PROVINCES, PROVINCE_GEO, TITLE_DEFS } from './content';
import { allVassals, directVassals, rankOf, realmProvinceIds, sortTitleIds, topLiegeId } from './realm';
import { bumpStructure } from './index-cache';
import { chronicle, notifyAll, type Ctx } from './context';

const HISTORY_CAP = 24;

/** Est-ce que `ancestorId` est un parent de jure (à n'importe quel niveau) de `titleId` ? */
export function isDeJureAncestor(ancestorId: string, titleId: string): boolean {
  let cur = TITLE_DEFS[titleId]?.deJureParentId ?? null;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = TITLE_DEFS[cur]?.deJureParentId ?? null;
  }
  return false;
}

/**
 * Transfère un titre. Met à jour les listes de titres, la cour et la
 * vassalité, puis répare les incohérences de rang.
 */
export function transferTitle(
  state: GameState,
  titleId: string,
  toId: string | null,
  how: TitleHistoryEntry['how'],
  opts: { liegeId?: string | null } = {},
): void {
  const title = state.titles[titleId];
  if (!title) throw new Error(`Titre inconnu : ${titleId}`);
  const prevId = title.holderId;
  if (prevId === toId) return;
  if (prevId) {
    const prev = state.characters[prevId];
    if (prev) {
      prev.titleIds = prev.titleIds.filter((t) => t !== titleId);
      if (prev.titleIds.length === 0 && prev.death === null) {
        // Devenu sans terre : rejoint la cour de son suzerain ou du nouveau détenteur.
        prev.courtId = prev.liegeId ?? toId;
        bumpStructure();
        prev.liegeId = null;
        bumpStructure();
        prev.council = null;
        // Ses vassaux restants passent au nouveau détenteur.
        for (const v of directVassals(state, prevId)) v.liegeId = toId;
        bumpStructure();
      }
    }
  }
  title.holderId = toId;
  title.active = toId !== null || title.active;
  title.history.push({ date: state.date, holderId: toId, how });
  if (title.history.length > HISTORY_CAP) title.history.splice(0, title.history.length - HISTORY_CAP);
  if (toId) {
    const next = state.characters[toId];
    if (!next) throw new Error(`Personnage inconnu : ${toId}`);
    const wasLanded = next.titleIds.length > 0;
    next.titleIds = sortTitleIds([...next.titleIds, titleId], next.titleIds[0] ?? null);
    if (!wasLanded) {
      next.courtId = next.id;
      bumpStructure();
      next.liegeId = opts.liegeId !== undefined ? opts.liegeId : (prevId ? state.characters[prevId]?.liegeId ?? null : null);
      bumpStructure();
      if (next.liegeId === next.id) next.liegeId = null;
      bumpStructure();
    } else if (opts.liegeId !== undefined) {
      next.liegeId = opts.liegeId;
      bumpStructure();
    }
    if (!next.council) next.council = defaultCouncil();
    fixRankConsistency(state, toId);
  }
  if (prevId) {
    const prev = state.characters[prevId];
    if (prev && prev.death === null && prev.titleIds.length) fixRankConsistency(state, prevId);
  }
}

export function defaultCouncil(): NonNullable<Character['council']> {
  return {
    chancellor: { characterId: null, task: 'chancellor_relations', progress: 0 },
    marshal: { characterId: null, task: 'marshal_train', progress: 0 },
    steward: { characterId: null, task: 'steward_taxes', progress: 0 },
    spymaster: { characterId: null, task: 'spymaster_disrupt', progress: 0 },
    scholar: { characterId: null, task: 'scholar_fervor', progress: 0 },
  };
}

/**
 * Garantit : un vassal a un rang strictement inférieur à son suzerain, pas
 * de cycle, pas de suzerain mort ou sans terre.
 */
export function fixRankConsistency(state: GameState, charId: string): void {
  const c = state.characters[charId];
  if (!c || c.death !== null) return;
  let guard = 0;
  while (c.liegeId && guard++ < 10) {
    const liege = state.characters[c.liegeId];
    if (!liege || !isAlive(liege) || liege.titleIds.length === 0 || liege.id === c.id) {
      c.liegeId = liege?.liegeId ?? null;
      bumpStructure();
      continue;
    }
    if (rankOf(c) >= rankOf(liege)) {
      c.liegeId = liege.liegeId;
      bumpStructure();
      continue;
    }
    if (topLiegeId(state, liege.id) === c.id) {
      // Cycle : le personnage devient indépendant.
      c.liegeId = null;
      bumpStructure();
      continue;
    }
    break;
  }
  if (c.liegeId === c.id) c.liegeId = null;
  bumpStructure();
  for (const v of directVassals(state, charId)) {
    if (rankOf(v) >= rankOf(c)) v.liegeId = c.liegeId;
    bumpStructure();
  }
}

/** Seuils de création de titre : part des provinces de jure contrôlées. */
export const CREATE_THRESHOLD: Record<string, number> = { duchy: 0.5, kingdom: 0.6, empire: 0.7 };
export const CREATE_COST: Record<string, { gold: number; prestige: number }> = {
  duchy: { gold: 150, prestige: 200 },
  kingdom: { gold: 400, prestige: 600 },
  empire: { gold: 800, prestige: 1500 },
};

export interface TitleCreationCheck {
  ok: boolean;
  share: number;
  required: number;
  cost: { gold: number; prestige: number };
  reason?: string;
}

export function canCreateTitle(state: GameView, charId: string, titleId: string): TitleCreationCheck {
  const def = TITLE_DEFS[titleId];
  const c = state.characters[charId];
  const title = state.titles[titleId];
  const empty = { ok: false, share: 0, required: 0, cost: { gold: 0, prestige: 0 } };
  if (!def || !c || !title || def.rank === 'county') return { ...empty, reason: 'invalid' };
  const required = CREATE_THRESHOLD[def.rank]!;
  const cost = CREATE_COST[def.rank]!;
  if (title.holderId) return { ...empty, required, cost, reason: 'held' };
  if (RANK_ORDER[def.rank] <= rankOf(c)) return { ...empty, required, cost, reason: 'rank' };
  if (def.rank !== 'duchy' && c.liegeId && rankOf(state.characters[c.liegeId]!) <= RANK_ORDER[def.rank]) {
    return { ...empty, required, cost, reason: 'liege_rank' };
  }
  const dj = DEJURE_PROVINCES[titleId] ?? [];
  const mine = new Set(realmProvinceIds(state, charId));
  const share = dj.length ? dj.filter((p) => mine.has(p)).length / dj.length : 0;
  const ok = share >= required && c.gold >= cost.gold && c.prestige >= cost.prestige;
  return { ok, share, required, cost, reason: ok ? undefined : share < required ? 'share' : 'resources' };
}

/** Crée un titre et l'inscrit dans la chronique (couronnement pour royaume/empire). */
export function createTitleWithChronicle(ctx: Ctx, charId: string, titleId: string): void {
  createTitle(ctx.s, charId, titleId);
  const rank = TITLE_DEFS[titleId]?.rank;
  chronicle(ctx, rank === 'kingdom' || rank === 'empire' ? 'coronation' : 'title_created', { name: charId, title: titleId }, [charId]);
  notifyAll(ctx, { level: rank === 'duchy' ? 'info' : 'important', kind: 'title_created', vars: { name: ctx.s.characters[charId]?.firstName ?? '', title: TITLE_DEFS[titleId]?.name ?? titleId }, focus: { type: 'title', id: titleId }, sound: 'fanfare' });
}

export function createTitle(state: GameState, charId: string, titleId: string): void {
  const check = canCreateTitle(state, charId, titleId);
  if (!check.ok) throw new GameError(ErrorCodes.REQUIREMENTS_NOT_MET, 'Conditions de création non remplies', { ...check });
  const c = state.characters[charId]!;
  c.gold -= check.cost.gold;
  c.prestige -= check.cost.prestige;
  transferTitle(state, titleId, charId, 'created');
  state.titles[titleId]!.active = true;
}

/** Titre détenu dont la hiérarchie de jure couvre la province, au rang le plus bas. */
export function lowestDeJureTitleHeldOver(holder: Character, provinceId: string): string | null {
  const geo = PROVINCE_GEO[provinceId];
  if (!geo) return null;
  for (const tid of [geo.duchyTitleId, geo.kingdomTitleId, geo.empireTitleId]) {
    if (holder.titleIds.includes(tid)) return tid;
  }
  return null;
}

/** Vassaux dont les terres sont de jure sous un titre (pour les transferts). */
export function vassalsUnderTitle(state: GameView, holderId: string, titleId: string): Character[] {
  const dj = new Set(DEJURE_PROVINCES[titleId] ?? []);
  return allVassals(state, holderId).filter((v) => {
    const cap = v.titleIds[0] ? TITLE_DEFS[v.titleIds[0]]?.capitalProvinceId : undefined;
    return cap ? dj.has(cap) : false;
  });
}
