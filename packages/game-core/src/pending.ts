/**
 * Garde-fou des propositions adressées à un joueur : une même proposition
 * (même nature, même expéditeur, même destinataire, mêmes sujets) n'est
 * jamais envoyée deux fois tant que la première attend une réponse.
 */
import type { GameState, Proposal } from '@ttc/shared';

export function hasPendingProposal(s: Pick<GameState, 'proposals'>, kind: Proposal['kind'], fromId: string, toId: string, subjects: readonly string[] = []): boolean {
  for (const p of Object.values(s.proposals)) {
    if (p.kind !== kind || p.fromId !== fromId || p.toId !== toId || p.subjects.length !== subjects.length) continue;
    if (p.subjects.every((x, i) => x === subjects[i])) return true;
  }
  return false;
}
