import { create } from 'zustand';

/** Routage minimal par chemin (History API). */
export type Route =
  | { name: 'title' }
  | { name: 'new' }
  | { name: 'multiplayer' }
  | { name: 'lobby'; id: string }
  | { name: 'game'; id: string }
  | { name: 'credits' };

export function parse(path: string): Route {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'nouvelle-partie') return { name: 'new' };
  if (parts[0] === 'multijoueur') return { name: 'multiplayer' };
  if (parts[0] === 'credits') return { name: 'credits' };
  if (parts[0] === 'lobby' && parts[1]) return { name: 'lobby', id: parts[1] };
  if (parts[0] === 'partie' && parts[1]) return { name: 'game', id: parts[1] };
  return { name: 'title' };
}

export function toPath(r: Route): string {
  switch (r.name) {
    case 'new':
      return '/nouvelle-partie';
    case 'multiplayer':
      return '/multijoueur';
    case 'credits':
      return '/credits';
    case 'lobby':
      return `/lobby/${r.id}`;
    case 'game':
      return `/partie/${r.id}`;
    default:
      return '/';
  }
}

interface RouterState {
  route: Route;
  go(r: Route, replace?: boolean): void;
}

export const useRouter = create<RouterState>((set) => ({
  route: parse(window.location.pathname),
  go(r, replace = false) {
    const path = toPath(r);
    if (replace) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
    set({ route: r });
  },
}));

window.addEventListener('popstate', () => useRouter.setState({ route: parse(window.location.pathname) }));
