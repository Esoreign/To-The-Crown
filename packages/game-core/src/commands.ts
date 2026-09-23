/**
 * Application autoritaire des commandes joueur. Chaque branche valide ses
 * préconditions (GameError sinon) avant de muter l'état.
 */
import { ErrorCodes, GameError, isDevCommand, type GameCommand } from '@ttc/shared';
import { mergeArmies, orderMove, raiseArmy, recruitMaa, disbandArmy, setCommander } from './armies';
import { startConstruction, completeConstructionNow } from './buildings';
import { isAlive } from './characters';
import { log, type Ctx } from './context';
import { PROVINCE_TASKS, ROLE_TASKS, assignCouncil } from './council';
import { killCharacter } from './death';
import { takeDecision } from './decisions';
import {
  assignGuardian,
  breakAlliance,
  canImprison,
  changeCrownAuthority,
  changeSuccessionLaw,
  designateHeir,
  executePrisoner,
  grantIndependence,
  grantTitle,
  imprison,
  inviteToCourt,
  proposeAlliance,
  proposeVassalization,
  ransomPrisoner,
  releasePrisoner,
  revokeTitle,
  sendGift,
} from './diplomacy';
import { chooseEventOption, triggerEventById } from './events/engine';
import { joinFaction, leaveFaction } from './factions';
import { proposeMarriage } from './marriage';
import { respondProposal } from './proposals';
import { cancelScheme, startScheme } from './schemes';
import { exposeSecret } from './secrets';
import { electionCandidates, electors } from './succession';
import { createTitle, transferTitle } from './titles';
import { callAlly, declareWar, offerPeace } from './war';
import { domainProvinceIds } from './characters';

export type CommandResult = Record<string, unknown>;

export function applyCommand(ctx: Ctx, actorId: string, cmd: GameCommand): CommandResult {
  const s = ctx.s;
  const actor = s.characters[actorId];
  if (!actor || !isAlive(actor)) throw new GameError(ErrorCodes.CHARACTER_DEAD, 'Votre personnage est mort');
  if (isDevCommand(cmd) && !ctx.dev) throw new GameError(ErrorCodes.FORBIDDEN, 'Outils de développement désactivés');
  const prisonerAllowed = new Set(['event.choose', 'proposal.respond', 'scheme.cancel', 'council.task', 'council.assign']);
  if (actor.prisonerOf && !prisonerAllowed.has(cmd.type) && !isDevCommand(cmd)) {
    throw new GameError(ErrorCodes.FORBIDDEN, 'Vous êtes prisonnier');
  }
  let result: CommandResult = {};
  switch (cmd.type) {
    case 'marriage.propose': {
      const r = proposeMarriage(ctx, actorId, cmd.payload.characterId, cmd.payload.targetId, cmd.payload.useHook);
      result = { accepted: r.accepted, pending: r.pending, acceptance: r.acceptance };
      break;
    }
    case 'proposal.respond':
      respondProposal(ctx, actorId, cmd.payload.proposalId, cmd.payload.accept);
      break;
    case 'title.grant':
      grantTitle(ctx, actorId, cmd.payload.titleId, cmd.payload.toCharacterId, (t, to, liege) => transferTitle(s, t, to, 'granted', { liegeId: liege }));
      break;
    case 'title.revoke':
      revokeTitle(ctx, actorId, cmd.payload.titleId, (t, to) => transferTitle(s, t, to, 'revoked'));
      break;
    case 'title.create':
      createTitle(s, actorId, cmd.payload.titleId);
      break;
    case 'council.assign':
      if (!actor.council) throw new GameError(ErrorCodes.INVALID_TARGET, 'Aucun conseil');
      assignCouncil(s, actorId, cmd.payload.role, cmd.payload.characterId);
      break;
    case 'council.task': {
      if (!actor.council) throw new GameError(ErrorCodes.INVALID_TARGET, 'Aucun conseil');
      const { role, task, provinceId } = cmd.payload;
      if (!ROLE_TASKS[role].includes(task)) throw new GameError(ErrorCodes.INVALID_COMMAND, 'Tâche incompatible avec la fonction');
      if (provinceId && (!PROVINCE_TASKS.has(task) || !domainProvinceIds(actor).includes(provinceId))) {
        throw new GameError(ErrorCodes.PROVINCE_NOT_OWNED, 'Province invalide pour cette tâche');
      }
      actor.council[role].task = task;
      actor.council[role].provinceId = provinceId ?? null;
      actor.council[role].progress = 0;
      break;
    }
    case 'building.construct':
      startConstruction(ctx, actorId, cmd.payload.provinceId, cmd.payload.buildingId);
      break;
    case 'scheme.start': {
      const sch = startScheme(ctx, actorId, cmd.payload.schemeType, cmd.payload.targetId);
      result = { schemeId: sch.id };
      break;
    }
    case 'scheme.cancel':
      cancelScheme(ctx, actorId, cmd.payload.schemeId);
      break;
    case 'war.declare': {
      const war = declareWar(ctx, actorId, cmd.payload.targetId, cmd.payload.cb, cmd.payload.titleId ?? null, cmd.payload.claimantId ?? null);
      result = { warId: war.id };
      break;
    }
    case 'war.callAlly':
      result = callAlly(ctx, cmd.payload.warId, actorId, cmd.payload.allyId);
      break;
    case 'war.offerPeace': {
      const r = offerPeace(ctx, actorId, cmd.payload.warId, cmd.payload.kind);
      result = { accepted: r.accepted, pending: r.pending, acceptance: r.acceptance };
      break;
    }
    case 'army.raise': {
      const a = raiseArmy(ctx, actorId, cmd.payload.provinceId);
      result = { armyId: a.id };
      break;
    }
    case 'army.disband':
      disbandArmy(ctx, actorId, cmd.payload.armyId);
      break;
    case 'army.move':
      result = { path: orderMove(ctx, actorId, cmd.payload.armyId, cmd.payload.to) };
      break;
    case 'army.merge':
      mergeArmies(ctx, actorId, cmd.payload.armyId, cmd.payload.intoId);
      break;
    case 'army.commander':
      setCommander(ctx, actorId, cmd.payload.armyId, cmd.payload.commanderId);
      break;
    case 'army.recruit':
      recruitMaa(ctx, actorId, cmd.payload.unit, cmd.payload.men);
      break;
    case 'event.choose':
      chooseEventOption(ctx, actorId, cmd.payload.activeEventId, cmd.payload.choiceId);
      break;
    case 'diplomacy.gift':
      result = { opinion: sendGift(ctx, actorId, cmd.payload.targetId, cmd.payload.amount) };
      break;
    case 'diplomacy.alliance': {
      const r = proposeAlliance(ctx, actorId, cmd.payload.targetId, cmd.payload.useHook);
      result = { accepted: r.accepted, pending: r.pending, acceptance: r.acceptance };
      break;
    }
    case 'diplomacy.breakAlliance':
      breakAlliance(ctx, actorId, cmd.payload.targetId);
      break;
    case 'diplomacy.vassalize': {
      const r = proposeVassalization(ctx, actorId, cmd.payload.targetId, cmd.payload.useHook);
      result = { accepted: r.accepted, pending: r.pending, acceptance: r.acceptance };
      break;
    }
    case 'diplomacy.independence':
      grantIndependence(ctx, actorId, cmd.payload.vassalId);
      break;
    case 'character.imprison':
      if (!canImprison(s, actorId, cmd.payload.targetId)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Emprisonnement impossible');
      imprison(ctx, actorId, cmd.payload.targetId);
      break;
    case 'character.release': {
      const t = s.characters[cmd.payload.targetId];
      if (!t || t.prisonerOf !== actorId) throw new GameError(ErrorCodes.INVALID_TARGET, 'Pas votre prisonnier');
      releasePrisoner(ctx, cmd.payload.targetId);
      break;
    }
    case 'character.execute':
      executePrisoner(ctx, actorId, cmd.payload.targetId);
      break;
    case 'character.invite': {
      const acc = inviteToCourt(ctx, actorId, cmd.payload.targetId);
      result = { accepted: acc.accept, acceptance: acc };
      break;
    }
    case 'character.guardian':
      assignGuardian(ctx, actorId, cmd.payload.childId, cmd.payload.tutorId, cmd.payload.focus);
      break;
    case 'character.designateHeir':
      designateHeir(ctx, actorId, cmd.payload.heirId);
      break;
    case 'prisoner.ransom':
      result = ransomPrisoner(ctx, actorId, cmd.payload.prisonerId);
      break;
    case 'succession.vote': {
      const title = s.titles[cmd.payload.titleId];
      const holder = title?.holderId ? s.characters[title.holderId] : undefined;
      if (!title || !holder || title.successionLaw !== 'elective') throw new GameError(ErrorCodes.INVALID_TARGET, 'Titre non électif');
      if (!electors(s, holder).some((e) => e.id === actorId)) throw new GameError(ErrorCodes.FORBIDDEN, 'Vous n’êtes pas électeur');
      if (!electionCandidates(s, holder).some((c) => c.id === cmd.payload.candidateId)) throw new GameError(ErrorCodes.INVALID_TARGET, 'Candidat non éligible');
      title.electionVotes[actorId] = cmd.payload.candidateId;
      break;
    }
    case 'secret.expose':
      exposeSecret(ctx, cmd.payload.secretId, actorId);
      break;
    case 'faction.join':
      joinFaction(s, actorId, cmd.payload.factionId);
      break;
    case 'faction.leave':
      leaveFaction(s, actorId, cmd.payload.factionId);
      break;
    case 'realm.crownAuthority':
      changeCrownAuthority(ctx, actorId, cmd.payload.level);
      break;
    case 'realm.successionLaw':
      changeSuccessionLaw(ctx, actorId, cmd.payload.titleId, cmd.payload.law);
      break;
    case 'decision.take':
      takeDecision(ctx, actorId, cmd.payload.decision);
      break;
    // --- Développement ---
    case 'dev.addResources':
      actor.gold += cmd.payload.gold ?? 0;
      actor.prestige += cmd.payload.prestige ?? 0;
      break;
    case 'dev.killCharacter':
      killCharacter(ctx, cmd.payload.characterId, 'natural');
      break;
    case 'dev.triggerEvent':
      result = { fired: triggerEventById(ctx, cmd.payload.eventId, actorId) };
      break;
    case 'dev.completeConstruction':
      completeConstructionNow(ctx, cmd.payload.provinceId);
      break;
    case 'dev.switchCharacter': {
      const target = s.characters[cmd.payload.characterId];
      if (!target || !isAlive(target) || !target.titleIds.length || target.isPlayer) throw new GameError(ErrorCodes.INVALID_TARGET, 'Personnage non jouable');
      const slot = Object.values(s.players).find((p) => p.characterId === actorId);
      if (!slot) throw new GameError(ErrorCodes.NOT_GAME_MEMBER, 'Aucun joueur');
      actor.isPlayer = false;
      actor.aiNextThink = s.date + 1;
      target.isPlayer = true;
      slot.characterId = target.id;
      slot.houseId = target.houseId ?? slot.houseId;
      slot.rulers.push(target.id);
      break;
    }
    default: {
      const never: never = cmd;
      throw new GameError(ErrorCodes.INVALID_COMMAND, `Commande inconnue ${(never as { type: string }).type}`);
    }
  }
  log(ctx, 'command', actorId, { type: cmd.type }, [actorId]);
  return result;
}
