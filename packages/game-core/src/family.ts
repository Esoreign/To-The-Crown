import type { Character, GameView } from '@ttc/shared';
import { isAlive } from './characters';
import { getIndex } from './index-cache';

type S = Pick<GameView, 'characters'>;

export function childrenOf(state: S, c: Character, aliveOnly = true): Character[] {
  return c.childIds.map((id) => state.characters[id]).filter((x): x is Character => !!x && (!aliveOnly || x.death === null));
}

export function parentsOf(state: S, c: Character): Character[] {
  return [c.fatherId, c.motherId].map((id) => (id ? state.characters[id] : undefined)).filter((x): x is Character => !!x);
}

export function siblingsOf(state: S, c: Character, aliveOnly = true): Character[] {
  const set = new Map<string, Character>();
  for (const p of parentsOf(state, c)) {
    for (const ch of childrenOf(state, p, aliveOnly)) if (ch.id !== c.id) set.set(ch.id, ch);
  }
  return [...set.values()];
}

export function isParentOf(parent: Character, child: Character): boolean {
  return child.fatherId === parent.id || child.motherId === parent.id;
}

export function areSiblings(a: Character, b: Character): boolean {
  if (a.id === b.id) return false;
  return (!!a.fatherId && a.fatherId === b.fatherId) || (!!a.motherId && a.motherId === b.motherId);
}

/** Parenté proche : parents, enfants, fratrie, grands-parents, petits-enfants, oncles/neveux. */
export function isCloseRelative(state: S, a: Character, b: Character): boolean {
  if (a.id === b.id) return true;
  if (isParentOf(a, b) || isParentOf(b, a) || areSiblings(a, b)) return true;
  const aParents = parentsOf(state, a);
  const bParents = parentsOf(state, b);
  // Grands-parents / petits-enfants.
  if (aParents.some((p) => isParentOf(b, p)) || bParents.some((p) => isParentOf(a, p))) return true;
  // Oncles / tantes / neveux.
  if (aParents.some((p) => areSiblings(p, b)) || bParents.some((p) => areSiblings(p, a))) return true;
  // Cousins germains.
  return aParents.some((pa) => bParents.some((pb) => areSiblings(pa, pb)));
}

export function sameDynasty(state: Pick<GameView, 'houses'>, a: Character, b: Character): boolean {
  if (!a.houseId || !b.houseId) return false;
  if (a.houseId === b.houseId) return true;
  const ha = state.houses[a.houseId];
  const hb = state.houses[b.houseId];
  return !!ha && !!hb && ha.dynastyId === hb.dynastyId;
}

/** Descendants vivants (récursif, pour les statistiques). */
export function descendantsOf(state: S, c: Character): Character[] {
  const out: Character[] = [];
  const stack = [...c.childIds];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const ch = state.characters[id];
    if (!ch) continue;
    if (isAlive(ch)) out.push(ch);
    stack.push(...ch.childIds);
  }
  return out;
}

type Indexed = Pick<GameView, 'characters' | 'relations' | 'alliances' | 'wars' | 'houses'>;

export function houseMembers(state: Indexed, houseId: string, aliveOnly = true): Character[] {
  if (aliveOnly) return (getIndex(state).membersByHouse.get(houseId) ?? []).map((id) => state.characters[id]!);
  return Object.values(state.characters).filter((c) => c.houseId === houseId);
}

export function dynastyMembers(state: Indexed, dynastyId: string, aliveOnly = true): Character[] {
  if (aliveOnly) return (getIndex(state).membersByDynasty.get(dynastyId) ?? []).map((id) => state.characters[id]!);
  return Object.values(state.characters).filter((c) => {
    if (!c.houseId || (aliveOnly && c.death !== null)) return false;
    return state.houses[c.houseId]?.dynastyId === dynastyId;
  });
}
