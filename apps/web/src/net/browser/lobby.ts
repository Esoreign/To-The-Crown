/**
 * Salon en mode sans serveur : sondage léger (`ttc_lobby`, toutes les 1,5 s)
 * qui rafraîchit l'état, la discussion et la présence. Chaque action du
 * joueur déclenche un sondage immédiat (`pokeLobby`).
 */
import { ErrorCodes, type ChatMessage, type LobbyState } from '@ttc/shared';
import { useGame } from '../../state/game';
import { playSound } from '../../audio/audio';
import { ApiFailure } from '../failure';
import { rpcAuth } from './supabase';

const POLL_MS = 1500;
const pollers = new Map<string, () => void>();

export function pokeLobby(gameId: string): void {
  pollers.get(gameId)?.();
}

export function mergeChat(incoming: ChatMessage[], fromSelf: string | null): void {
  const current = useGame.getState().chat;
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (!fresh.length) return;
  const merged = [...current, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-200);
  useGame.setState({ chat: merged });
  if (current.length && fresh.some((m) => m.userId !== fromSelf)) playSound('notify');
}

export function joinLobbyBrowser(
  gameId: string,
  userId: string | null,
  onUpdate: (l: LobbyState) => void,
  onStart: (id: string) => void,
  onKick: (id: string) => void,
): () => void {
  let stopped = false;
  let inflight = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const poll = async (): Promise<void> => {
    if (stopped) return;
    if (inflight) {
      again = true;
      return;
    }
    inflight = true;
    clearTimeout(timer);
    try {
      const r = await rpcAuth<{ lobby: LobbyState; chat: ChatMessage[] }>('ttc_lobby', { p_game: gameId });
      if (stopped) return;
      onUpdate(r.lobby);
      mergeChat(r.chat, userId);
      if (r.lobby.status !== 'lobby') {
        stopped = true;
        onStart(gameId);
      }
    } catch (e) {
      if (
        e instanceof ApiFailure &&
        (e.code === ErrorCodes.NOT_GAME_MEMBER || e.code === ErrorCodes.GAME_NOT_FOUND)
      ) {
        stopped = true;
        onKick(gameId);
      }
    } finally {
      inflight = false;
      if (!stopped) {
        if (again) {
          again = false;
          void poll();
        } else timer = setTimeout(() => void poll(), POLL_MS);
      }
    }
  };

  pollers.set(gameId, () => void poll());
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    pollers.delete(gameId);
  };
}
