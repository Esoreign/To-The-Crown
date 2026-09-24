/**
 * Accès pratique à l'état de partie depuis les composants.
 * Les composants de partie ne sont montés qu'une fois la vue reçue.
 */
import type { Character, GameView } from '@ttc/shared';
import { useGame } from '../state/game';
import { useUi, type SelectionKind } from '../state/ui';
import { sendCommand } from '../net/socket';
import { playSound } from '../audio/audio';
import { pushToast } from '../state/ui';
import type { GameCommand } from '@ttc/shared';

export function useWorld(): GameView {
  return useGame((s) => s.world)!;
}

export function useMe(): Character | null {
  return useGame((s) => (s.youCharacterId && s.world ? (s.world.characters[s.youCharacterId] ?? null) : null));
}

export function useMeId(): string | null {
  return useGame((s) => s.youCharacterId);
}

export function select(kind: SelectionKind, id: string): void {
  useUi.getState().select({ kind, id });
}

export const openCharacter = (id: string) => select('character', id);
export const openProvince = (id: string) => select('province', id);
export const openTitle = (id: string) => select('title', id);
export const openWar = (id: string) => select('war', id);
export const openArmy = (id: string) => select('army', id);

/**
 * Envoie une commande ; retourne vrai si acceptée. Un message de réussite
 * facultatif est affiché et un son joué.
 */
export async function act(command: GameCommand, success?: string, sound: 'confirm' | 'coin' | 'build' | 'war' | null = 'confirm'): Promise<boolean> {
  const ack = await sendCommand(command);
  if (ack.ok) {
    if (sound) playSound(sound);
    if (success) pushToast({ kind: 'success', text: success });
  }
  return ack.ok;
}

/** Idem, mais retourne l'accusé complet (résultats d'acceptation…). */
export async function actRaw(command: GameCommand) {
  return sendCommand(command);
}

/** Proposition diplomatique : affiche l'issue (acceptée, refusée, en attente d'un joueur). */
export async function propose(command: GameCommand, labels: { accepted: string; rejected: string; pending?: string }): Promise<boolean> {
  const ack = await sendCommand(command);
  if (!ack.ok) return false;
  const r = (ack.result ?? {}) as { accepted?: boolean; pending?: boolean; joined?: boolean };
  if (r.pending) {
    pushToast({ kind: 'info', text: labels.pending ?? 'Proposition envoyée' });
    playSound('notify');
  } else if (r.accepted || r.joined) {
    pushToast({ kind: 'success', text: labels.accepted });
    playSound('fanfare');
  } else {
    pushToast({ kind: 'error', text: labels.rejected });
    playSound('error');
  }
  return true;
}
