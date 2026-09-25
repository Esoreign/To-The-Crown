/**
 * Index structurels mis en cache (vassaux, cours, relations, alliances,
 * dynasties, guerres). Invalidation :
 *  - automatiquement quand l'identité d'une collection change (nouvel état
 *    Immer, nouvelle vue client) ;
 *  - explicitement via bumpStructure() après toute mutation de structure
 *    (suzerain, cour, décès, naissance, alliance, relation, maison, guerre).
 * Chaque jour de simulation commence par un bumpStructure().
 */
import { isDraft } from 'immer';
import type { Character, GameView, Relation, RelationType, War } from '@ttc/shared';
import { unwrapCollection } from './view';

/** Identifiants (et non objets) : l'appelant relit l'état courant, brouillon compris. */
export interface StructureIndex {
  vassalsByLiege: Map<string, string[]>;
  courtiersByCourt: Map<string, string[]>;
  relationsByChar: Map<string, Relation[]>;
  alliesByChar: Map<string, string[]>;
  membersByDynasty: Map<string, string[]>;
  membersByHouse: Map<string, string[]>;
  warsByChar: Map<string, War[]>;
  /** Contrats de sujétion (identifiants) par titre sujet / titre suzerain. */
  pactsBySubjectTitle: Map<string, string[]>;
  pactsByOverlordTitle: Map<string, string[]>;
  memo: Map<string, unknown>;
}

type Keyed = Pick<GameView, 'characters' | 'relations' | 'alliances' | 'wars' | 'houses'> & Partial<Pick<GameView, 'pacts'>>;

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

const DRAFT_STATE = Symbol.for('immer-state');
interface DraftState {
  base_: Record<string, unknown>;
  copy_: Record<string, unknown> | null | undefined;
  modified_: boolean;
}

/**
 * Parcourt les valeurs d'une collection en lecture seule sans créer de
 * brouillon Immer pour chaque élément : les éléments non modifiés sont lus
 * dans l'état d'origine, les éléments modifiés via leur brouillon.
 * Ne JAMAIS muter les objets fournis (ils peuvent appartenir à l'état figé).
 */
export function forEachValue<T>(input: Record<string, T>, fn: (value: T) => void): void {
  const collection = unwrapCollection(input);
  if (!isDraft(collection)) {
    for (const key in collection) fn(collection[key]!);
    return;
  }
  const st = (collection as unknown as Record<symbol, DraftState>)[DRAFT_STATE]!;
  const src = (st.copy_ ?? st.base_) as Record<string, unknown>;
  for (const key in src) {
    const v = src[key];
    if (isDraft(v)) {
      const cs = (v as Record<symbol, DraftState>)[DRAFT_STATE]!;
      fn((cs.modified_ ? v : cs.base_) as T);
    } else fn(v as T);
  }
}

export function getIndex(state: Keyed): StructureIndex {
  const keys = [state.characters, state.relations, state.alliances, state.wars, state.houses, state.pacts ?? null].map((k) => (k ? unwrapCollection(k as object) : null));
  if (cached && cached.epoch === epoch && cached.keys.every((k, i) => k === keys[i])) return cached.idx;
  const idx: StructureIndex = {
    vassalsByLiege: new Map(),
    courtiersByCourt: new Map(),
    relationsByChar: new Map(),
    alliesByChar: new Map(),
    membersByDynasty: new Map(),
    membersByHouse: new Map(),
    warsByChar: new Map(),
    pactsBySubjectTitle: new Map(),
    pactsByOverlordTitle: new Map(),
    memo: new Map(),
  };
  const houseDyn = new Map<string, string>();
  forEachValue(state.houses, (h) => houseDyn.set(h.id, h.dynastyId));
  forEachValue(state.characters, (c: Character) => {
    if (c.death !== null) return;
    if (c.liegeId) push(idx.vassalsByLiege, c.liegeId, c.id);
    if (c.courtId && c.courtId !== c.id && c.titleIds.length === 0) push(idx.courtiersByCourt, c.courtId, c.id);
    if (c.houseId) {
      push(idx.membersByHouse, c.houseId, c.id);
      const dyn = houseDyn.get(c.houseId);
      if (dyn) push(idx.membersByDynasty, dyn, c.id);
    }
  });
  for (const r of Object.values(unwrapCollection(state.relations))) {
    push(idx.relationsByChar, r.a, r);
    push(idx.relationsByChar, r.b, r);
  }
  for (const al of Object.values(unwrapCollection(state.alliances))) {
    push(idx.alliesByChar, al.a, al.b);
    push(idx.alliesByChar, al.b, al.a);
  }
  // Objets de guerre issus du brouillon : les appelants de warsOf peuvent les muter.
  for (const w of Object.values(unwrapCollection(state.wars))) {
    for (const p of [...w.attackers, ...w.defenders]) push(idx.warsByChar, p, w);
  }
  if (state.pacts)
    forEachValue(state.pacts, (p) => {
      push(idx.pactsBySubjectTitle, p.subjectTitleId, p.id);
      push(idx.pactsByOverlordTitle, p.overlordTitleId, p.id);
    });
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
