/**
 * Index structurels mis en cache (vassaux, cours, relations, alliances,
 * dynasties, guerres). Invalidation :
 *  - automatiquement quand l'identité d'une collection change (nouvel état
 *    Immer, nouvelle vue client) ;
 *  - explicitement via bumpStructure() après toute mutation de structure
 *    (suzerain, cour, décès, naissance, alliance, relation, maison, guerre).
 * Chaque jour de simulation commence par un bumpStructure().
 */
import type { Character, GameView, Relation, RelationType, War } from '@ttc/shared';

export interface StructureIndex {
  vassalsByLiege: Map<string, Character[]>;
  courtiersByCourt: Map<string, Character[]>;
  relationsByChar: Map<string, Relation[]>;
  alliesByChar: Map<string, string[]>;
  membersByDynasty: Map<string, Character[]>;
  membersByHouse: Map<string, Character[]>;
  warsByChar: Map<string, War[]>;
  memo: Map<string, unknown>;
}

type Keyed = Pick<GameView, 'characters' | 'relations' | 'alliances' | 'wars' | 'houses'>;

let epoch = 0;
let cached: { epoch: number; keys: unknown[]; idx: StructureIndex } | null = null;

export function bumpStructure(): void {
  epoch++;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

export function getIndex(state: Keyed): StructureIndex {
  const keys = [state.characters, state.relations, state.alliances, state.wars, state.houses];
  if (cached && cached.epoch === epoch && cached.keys.every((k, i) => k === keys[i])) return cached.idx;
  const idx: StructureIndex = {
    vassalsByLiege: new Map(),
    courtiersByCourt: new Map(),
    relationsByChar: new Map(),
    alliesByChar: new Map(),
    membersByDynasty: new Map(),
    membersByHouse: new Map(),
    warsByChar: new Map(),
    memo: new Map(),
  };
  for (const c of Object.values(state.characters)) {
    if (c.death !== null) continue;
    if (c.liegeId) push(idx.vassalsByLiege, c.liegeId, c);
    if (c.courtId && c.courtId !== c.id && c.titleIds.length === 0) push(idx.courtiersByCourt, c.courtId, c);
    if (c.houseId) {
      push(idx.membersByHouse, c.houseId, c);
      const dyn = state.houses[c.houseId]?.dynastyId;
      if (dyn) push(idx.membersByDynasty, dyn, c);
    }
  }
  for (const r of Object.values(state.relations)) {
    push(idx.relationsByChar, r.a, r);
    push(idx.relationsByChar, r.b, r);
  }
  for (const al of Object.values(state.alliances)) {
    push(idx.alliesByChar, al.a, al.b);
    push(idx.alliesByChar, al.b, al.a);
  }
  for (const w of Object.values(state.wars)) {
    for (const p of [...w.attackers, ...w.defenders]) push(idx.warsByChar, p, w);
  }
  cached = { epoch, keys, idx };
  return idx;
}

/** Mémoïsation liée à l'index courant (invalidée avec lui). */
export function memo<T>(state: Keyed, key: string, compute: () => T): T {
  const idx = getIndex(state);
  if (idx.memo.has(key)) return idx.memo.get(key) as T;
  const v = compute();
  idx.memo.set(key, v);
  return v;
}

export function relationTypesBetween(state: Keyed, a: string, b: string): RelationType[] {
  const list = getIndex(state).relationsByChar.get(a);
  if (!list) return [];
  const out: RelationType[] = [];
  for (const r of list) if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) out.push(r.type);
  return out;
}
