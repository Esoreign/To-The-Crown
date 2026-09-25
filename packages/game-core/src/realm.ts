/**
 * Hiérarchie féodale : suzerains, vassaux, domaine, royaume.
 */
import { RANK_ORDER, type Character, type GameView, type TitleRank } from '@ttc/shared';
import { BALANCE } from './balance';
import { characterModifier, domainProvinceIds, isAlive, skill, type ReadState } from './characters';
import { PROVINCE_GEO, TITLE_DEFS } from './content';
import { getIndex, memo } from './index-cache';

export type RealmState = Pick<GameView, 'characters' | 'titles' | 'date'> & Partial<GameView>;

export function primaryTitleId(c: Character): string | null {
  return c.titleIds[0] ?? null;
}

/** Rang numérique : 0 = sans titre, 1 comte … 4 empereur. */
export function rankOf(c: Character): number {
  const t = c.titleIds[0];
  if (!t) return 0;
  return RANK_ORDER[TITLE_DEFS[t]!.rank];
}

export function rankName(c: Character): TitleRank | null {
  const t = c.titleIds[0];
  return t ? TITLE_DEFS[t]!.rank : null;
}

/** Trie les titres : rang décroissant, puis titre principal actuel en tête. */
export function sortTitleIds(ids: string[], currentPrimary: string | null): string[] {
  return [...ids].sort((a, b) => {
    const ra = RANK_ORDER[TITLE_DEFS[a]!.rank];
    const rb = RANK_ORDER[TITLE_DEFS[b]!.rank];
    if (ra !== rb) return rb - ra;
    if (a === currentPrimary) return -1;
    if (b === currentPrimary) return 1;
    return a.localeCompare(b);
  });
}

export function topLiegeId(state: Pick<GameView, 'characters'>, charId: string): string {
  let cur = charId;
  const seen = new Set<string>();
  for (;;) {
    const c = state.characters[cur];
    if (!c || !c.liegeId || seen.has(cur)) return cur;
    seen.add(cur);
    cur = c.liegeId;
  }
}

export function isIndependent(c: Character): boolean {
  return c.titleIds.length > 0 && !c.liegeId;
}

type Indexed = Pick<GameView, 'characters' | 'relations' | 'alliances' | 'wars' | 'houses'>;

/** Vassaux directs vivants. */
export function directVassals(state: Indexed, liegeId: string): Character[] {
  return (getIndex(state).vassalsByLiege.get(liegeId) ?? []).map((id) => state.characters[id]!);
}

/** Tous les vassaux (récursif). */
export function allVassals(state: Indexed, liegeId: string): Character[] {
  const byLiege = getIndex(state).vassalsByLiege;
  const out: Character[] = [];
  const stack = [liegeId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const v of byLiege.get(id) ?? []) {
      out.push(state.characters[v]!);
      stack.push(v);
    }
  }
  return out;
}

/** Vrai si `vassalId` est dans la hiérarchie sous `liegeId`. */
export function isInRealmOf(state: Pick<GameView, 'characters'>, vassalId: string, liegeId: string): boolean {
  let cur = state.characters[vassalId]?.liegeId ?? null;
  let guard = 0;
  while (cur && guard++ < 20) {
    if (cur === liegeId) return true;
    cur = state.characters[cur]?.liegeId ?? null;
  }
  return false;
}

/** Provinces du royaume (domaine + vassaux). */
export function realmProvinceIds(state: Indexed, rulerId: string): string[] {
  return memo(state, `realm:${rulerId}`, () => {
    const ruler = state.characters[rulerId];
    if (!ruler) return [] as string[];
    const out = domainProvinceIds(ruler);
    for (const v of allVassals(state, rulerId)) out.push(...domainProvinceIds(v));
    return out;
  }).slice();
}

export function holderOfProvince(state: Pick<GameView, 'titles'>, provinceId: string): string | null {
  const geo = PROVINCE_GEO[provinceId];
  if (!geo) return null;
  return state.titles[geo.countyTitleId]?.holderId ?? null;
}

/** Dirigeant indépendant contrôlant une province (de facto). */
export function topLiegeOfProvince(state: Pick<GameView, 'titles' | 'characters'>, provinceId: string): string | null {
  const holder = holderOfProvince(state, provinceId);
  return holder ? topLiegeId(state, holder) : null;
}

export function domainLimit(state: ReadState, c: Character): number {
  const d = BALANCE.domain;
  const rank = rankOf(c);
  const base = d.base + Math.floor(skill(state, c, 'stewardship') / d.perStewardship) + (d.byRank[rank - 1] ?? 0) + (d.byGovernment[c.government ?? ''] ?? 0);
  return base + Math.round(characterModifier(state, c, 'domain_limit'));
}

export function overDomainLimit(state: ReadState, c: Character): number {
  return Math.max(0, domainProvinceIds(c).length - domainLimit(state, c));
}

/** Capitale du dirigeant : capitale du titre principal si détenue, sinon premier comté. */
export function capitalProvinceOf(c: Character): string | null {
  const domain = domainProvinceIds(c);
  if (!domain.length) return null;
  const primary = c.titleIds[0];
  const cap = primary ? TITLE_DEFS[primary]?.capitalProvinceId : undefined;
  if (cap && domain.includes(cap)) return cap;
  return domain[0]!;
}

/** Province où se trouve un personnage (cour de son suzerain / sa capitale). */
export function locationOf(state: Pick<GameView, 'characters'>, c: Character): string | null {
  const own = capitalProvinceOf(c);
  if (own) return own;
  const court = c.courtId ? state.characters[c.courtId] : undefined;
  return court ? capitalProvinceOf(court) : null;
}

/** Courtisans vivants d'un dirigeant (non titrés, résidant à sa cour). */
export function courtiers(state: Indexed, rulerId: string): Character[] {
  return (getIndex(state).courtiersByCourt.get(rulerId) ?? []).map((id) => state.characters[id]!).filter((c) => isAlive(c));
}

/** Nombre de comtés contrôlés (royaume complet). */
export function realmSize(state: Indexed, rulerId: string): number {
  return realmProvinceIds(state, rulerId).length;
}

/** Liste des dirigeants indépendants vivants. */
export function independentRulers(state: Pick<GameView, 'characters'>): Character[] {
  return Object.values(state.characters).filter((c) => c.death === null && c.titleIds.length > 0 && !c.liegeId);
}

/** Dirigeants voisins (royaumes indépendants partageant une frontière). */
export function neighborRulers(state: Indexed & Pick<GameView, 'titles'>, rulerId: string): string[] {
  return memo(state, `neighbors:${rulerId}`, () => neighborRulersRaw(state, rulerId)).slice();
}

function neighborRulersRaw(state: Indexed & Pick<GameView, 'titles'>, rulerId: string): string[] {
  const top = topLiegeId(state, rulerId);
  const provinces = realmProvinceIds(state, top);
  const set = new Set<string>();
  for (const pid of provinces) {
    const geo = PROVINCE_GEO[pid]!;
    for (const n of [...geo.neighbors, ...geo.straits]) {
      const other = topLiegeOfProvince(state, n);
      if (other && other !== top) set.add(other);
    }
  }
  return [...set];
}
