/**
 * Propositions en attente destinées à un joueur humain (mariage, alliance,
 * vassalisation, appel aux armes, paix blanche, ultimatum de faction).
 */
import { ErrorCodes, GameError, type Proposal } from '@ttc/shared';
import { notify, type Ctx } from './context';
import { createAlliance, vassalize } from './diplomacy';
import { acceptFactionDemand, startFactionWar } from './factions';
import { marry } from './marriage';
import { addOpinion } from './opinion';
import { consumeHook } from './secrets';
import { endWar, joinWar, sideOf } from './war';
import { bumpStructure } from './index-cache';

export function respondProposal(ctx: Ctx, actorId: string, proposalId: string, accept: boolean): void {
  const s = ctx.s;
  const p = s.proposals[proposalId];
  if (!p) throw new GameError(ErrorCodes.INVALID_TARGET, 'Proposition introuvable');
  if (p.toId !== actorId) throw new GameError(ErrorCodes.FORBIDDEN, 'Cette proposition ne vous est pas adressée');
  delete s.proposals[proposalId];
  resolve(ctx, p, accept);
}

function resolve(ctx: Ctx, p: Proposal, accept: boolean): void {
  const s = ctx.s;
  const from = s.characters[p.fromId];
  const to = s.characters[p.toId];
  if (!from || !to) return;
  switch (p.kind) {
    case 'marriage': {
      if (accept) {
        if (p.hookId) consumeHook(ctx, p.hookId);
        marry(ctx, p.subjects[0]!, p.subjects[1]!, [p.fromId, p.toId]);
      }
      break;
    }
    case 'alliance':
      if (accept) createAlliance(ctx, p.fromId, p.toId, 'pact');
      break;
    case 'vassalize':
      if (accept) vassalize(ctx, p.fromId, p.toId);
      break;
    case 'war_call': {
      const war = s.wars[p.subjects[0]!];
      if (!war) break;
      const side = sideOf(war, p.fromId);
      if (accept && side && !sideOf(war, p.toId)) joinWar(ctx, war, side, p.toId);
      else if (!accept) {
        const entry = Object.entries(s.alliances).find(([, al]) => (al.a === p.fromId && al.b === p.toId) || (al.a === p.toId && al.b === p.fromId));
        if (entry) delete s.alliances[entry[0]];
        bumpStructure();
        to.prestige -= 100;
        addOpinion(s, p.fromId, p.toId, -40, 'opinion.reason.refused_call', 120);
      }
      break;
    }
    case 'white_peace':
      if (accept && s.wars[p.subjects[0]!]) endWar(ctx, p.subjects[0]!, 'white');
      break;
    case 'faction_demand':
      if (!s.factions[p.subjects[0]!]) break;
      if (accept) acceptFactionDemand(ctx, p.subjects[0]!);
      else startFactionWar(ctx, p.subjects[0]!);
      break;
  }
  notify(ctx, [p.fromId], {
    level: 'important',
    kind: accept ? 'proposal_accepted' : 'proposal_rejected',
    vars: { name: to.firstName, kind: p.kind },
    focus: { type: 'character', id: p.toId },
    sound: accept ? 'confirm' : 'error',
  });
}

/** Expiration des propositions (tick journalier) : refus implicite. */
export function expireProposals(ctx: Ctx): void {
  for (const [id, p] of Object.entries(ctx.s.proposals)) {
    if (p.expiresAt > ctx.s.date) continue;
    delete ctx.s.proposals[id];
    resolve(ctx, p, false);
  }
}
