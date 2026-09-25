/**
 * Vue en lecture seule d'un brouillon Immer, sans coût de proxy par élément.
 *
 * Lire un brouillon Immer crée un proxy pour chaque objet traversé (personnage,
 * tableau de titres…), ce qui domine le temps de simulation à l'échelle du
 * monde. Cette vue renvoie, pour chaque entité d'une collection :
 *  - l'objet d'origine si l'entité n'a pas été modifiée pendant l'étape ;
 *  - le brouillon courant si elle a été modifiée (lecture exacte).
 * Elle reste donc toujours à jour, mais NE DOIT JAMAIS servir à muter : les
 * objets d'origine appartiennent à l'état précédent (partagé, immuable).
 */
import { isDraft } from 'immer';
import type { GameState } from '@ttc/shared';

const DRAFT_STATE = Symbol.for('immer-state');
/** Accès au brouillon sous-jacent d'une collection vue (pour les caches). */
export const VIEW_TARGET = Symbol('ttc-view-target');

interface DraftState {
  base_: Record<string | symbol, unknown>;
  copy_: Record<string | symbol, unknown> | null | undefined;
  modified_: boolean;
}

function stateOf(draft: unknown): DraftState {
  return (draft as Record<symbol, DraftState>)[DRAFT_STATE]!;
}

function resolve(v: unknown): unknown {
  if (isDraft(v)) {
    const st = stateOf(v);
    return st.modified_ ? v : st.base_;
  }
  return v;
}

const READ_ONLY = (): boolean => {
  throw new Error('Vue de lecture : mutation interdite (utiliser ctx.s)');
};

function collectionView(coll: object): object {
  const st = stateOf(coll);
  const src = () => (st.copy_ ?? st.base_) as Record<string | symbol, unknown>;
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (key === VIEW_TARGET) return coll;
        return resolve(src()[key]);
      },
      has(_t, key) {
        return key in src();
      },
      ownKeys() {
        return Reflect.ownKeys(src());
      },
      getOwnPropertyDescriptor(_t, key) {
        const s = src();
        if (!Object.prototype.hasOwnProperty.call(s, key)) return undefined;
        return { value: resolve(s[key]), writable: false, enumerable: true, configurable: true };
      },
      set: READ_ONLY,
      deleteProperty: READ_ONLY,
      defineProperty: READ_ONLY,
    },
  );
}

/** Collections volumineuses servies par la vue (les autres champs passent tels quels). */
const COLLECTIONS = new Set<string | symbol>([
  'characters', 'houses', 'dynasties', 'titles', 'provinces', 'relations', 'claims', 'alliances', 'wars', 'armies', 'battles', 'sieges',
  'schemes', 'secrets', 'hooks', 'factions', 'pacts', 'activeEvents', 'scheduledEvents', 'proposals',
]);

export function readView(s: GameState): GameState {
  if (!isDraft(s)) return s;
  const views = new Map<string | symbol, object>();
  const read = (key: string | symbol): unknown => {
    const raw = (s as unknown as Record<string | symbol, unknown>)[key];
    if (!COLLECTIONS.has(key) || !isDraft(raw)) return raw;
    let v = views.get(key);
    if (!v) {
      v = collectionView(raw as object);
      views.set(key, v);
    }
    return v;
  };
  return new Proxy({} as GameState, {
    get(_t, key) {
      return read(key);
    },
    has(_t, key) {
      return key in s;
    },
    ownKeys() {
      return Reflect.ownKeys(s);
    },
    getOwnPropertyDescriptor(_t, key) {
      if (!(key in s)) return undefined;
      return { value: read(key), writable: false, enumerable: true, configurable: true };
    },
    set: READ_ONLY,
    deleteProperty: READ_ONLY,
    defineProperty: READ_ONLY,
  });
}

/** Collection réelle derrière une vue (identité stable pour les caches). */
export function unwrapCollection<T extends object>(coll: T): T {
  return ((coll as Record<symbol, unknown>)[VIEW_TARGET] as T | undefined) ?? coll;
}
