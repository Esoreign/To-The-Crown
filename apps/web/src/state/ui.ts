/**
 * État d'interface local (jamais synchronisé) : sélection, écrans ouverts,
 * mode de carte, toasts, menus contextuels.
 */
import { create } from 'zustand';

export type SelectionKind = 'character' | 'province' | 'title' | 'army' | 'war' | 'battle';
export interface Selection {
  kind: SelectionKind;
  id: string;
}

export type ScreenId =
  | 'council'
  | 'realm'
  | 'dynasty'
  | 'intrigue'
  | 'military'
  | 'chronicle'
  | 'marriage'
  | 'decisions'
  | 'diplomacy'
  | 'settings'
  | 'search'
  | 'ledger'
  | null;

export type MapMode =
  | 'political'
  | 'terrain'
  | 'culture'
  | 'faith'
  | 'economy'
  | 'development'
  | 'control'
  | 'diplomacy'
  | 'government'
  | 'subjects';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

export type DialogKind = 'gift' | 'war' | 'scheme' | 'grant' | 'revoke' | 'guardian' | 'confirm';

export interface DialogState {
  kind: DialogKind;
  targetId: string;
  /** Confirmation générique. */
  confirm?: { title: string; text: string; danger?: boolean; run(): Promise<unknown> | void };
}

export interface ContextMenuState {
  x: number;
  y: number;
  characterId: string;
}

interface UiState {
  selection: Selection | null;
  history: Selection[];
  screen: ScreenId;
  screenArg: string | null;
  mapMode: MapMode;
  hoverProvince: string | null;
  toasts: Toast[];
  contextMenu: ContextMenuState | null;
  openEventId: string | null;
  chatOpen: boolean;
  dialog: DialogState | null;
  focusRequest: { provinceId: string; at: number; realmOf?: string } | null;
  select(sel: Selection | null): void;
  back(): void;
  openScreen(screen: ScreenId, arg?: string | null): void;
  setMapMode(m: MapMode): void;
  focusProvince(provinceId: string): void;
  /** Cadre la carte sur le royaume entier d'un souverain (repli : sa capitale). */
  focusRealm(characterId: string, capitalProvinceId: string): void;
  openDialog(d: DialogState): void;
}

export const useUi = create<UiState>((set, get) => ({
  selection: null,
  history: [],
  screen: null,
  screenArg: null,
  mapMode: 'political',
  hoverProvince: null,
  toasts: [],
  contextMenu: null,
  openEventId: null,
  chatOpen: false,
  dialog: null,
  focusRequest: null,
  select(sel) {
    const cur = get().selection;
    if (sel && cur && cur.kind === sel.kind && cur.id === sel.id) return;
    set({
      selection: sel,
      history: cur ? [...get().history, cur].slice(-20) : get().history,
      contextMenu: null,
    });
  },
  back() {
    const h = [...get().history];
    const prev = h.pop() ?? null;
    set({ selection: prev, history: h });
  },
  openScreen(screen, arg = null) {
    set({ screen, screenArg: arg, contextMenu: null });
  },
  setMapMode(m) {
    set({ mapMode: m });
  },
  focusProvince(provinceId) {
    set({ focusRequest: { provinceId, at: Date.now() } });
  },
  focusRealm(characterId, capitalProvinceId) {
    set({ focusRequest: { provinceId: capitalProvinceId, at: Date.now(), realmOf: characterId } });
  },
  openDialog(d) {
    set({ dialog: d, contextMenu: null });
  },
}));

let toastId = 0;
export function pushToast(t: Omit<Toast, 'id'>): void {
  const id = ++toastId;
  useUi.setState({ toasts: [...useUi.getState().toasts, { ...t, id }].slice(-5) });
  setTimeout(
    () => useUi.setState({ toasts: useUi.getState().toasts.filter((x) => x.id !== id) }),
    t.kind === 'error' ? 5000 : 3500,
  );
}
