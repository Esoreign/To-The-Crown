/**
 * Interactions disponibles avec un personnage (fiche personnage et menu
 * contextuel). Chaque entrée indique pourquoi elle est indisponible et, pour
 * les propositions à l'IA, la décomposition de l'acceptation.
 */
import {
  BALANCE,
  SCHEME_DEFS,
  alliesOf,
  areAllied,
  availableCasusBelli,
  canGrantTitle,
  canImprison,
  canTargetForWar,
  evaluateAlliance,
  evaluateCallToArms,
  evaluateInvite,
  evaluateVassalization,
  isAdult,
  isInRealmOf,
  isJustified,
  knownSecretsOf,
  rankOf,
  ransomPrice,
  sameDynasty,
  schemeValidity,
  sideOf,
  usableHook,
  warsOf,
  type Acceptance,
} from '@ttc/game-core';
import type { Character, GameView, SchemeType } from '@ttc/shared';
import { fmt, t, tOr } from '../lib/i18n';
import { useUi } from '../state/ui';
import { useGame } from '../state/game';
import { act, propose } from './hooks';

export type InteractionGroup = 'diplomacy' | 'family' | 'realm' | 'intrigue' | 'prison' | 'war' | 'dev';

export interface Interaction {
  id: string;
  group: InteractionGroup;
  label: string;
  icon: string;
  /** Raison d'indisponibilité (null = disponible). */
  disabled: string | null;
  acceptance?: Acceptance;
  /** Proposition à un autre joueur (pas de prévision d'acceptation). */
  toPlayer?: boolean;
  cost?: string;
  danger?: boolean;
  run(): void | Promise<unknown>;
}

export const GROUP_LABEL: Record<InteractionGroup, string> = {
  diplomacy: 'Diplomatie',
  family: 'Famille',
  realm: 'Royaume',
  intrigue: 'Intrigue',
  prison: 'Justice',
  war: 'Guerre',
  dev: 'Développement',
};

const reason = (code: string | null | undefined) => (code ? tOr(`reason.${code}`, code) : null);

function confirm(targetId: string, title: string, text: string, run: () => Promise<unknown> | void, danger = true) {
  useUi.getState().openDialog({ kind: 'confirm', targetId, confirm: { title, text, run, danger } });
}

export function interactionsFor(view: GameView, me: Character, target: Character): Interaction[] {
  const out: Interaction[] = [];
  if (target.id === me.id || target.death !== null) return out;
  const dialog = (kind: 'gift' | 'war' | 'scheme' | 'grant' | 'revoke' | 'guardian') => () => useUi.getState().openDialog({ kind, targetId: target.id });
  const landed = target.titleIds.length > 0;
  const hook = usableHook(view, me.id, target.id);
  const labels = { accepted: `${target.firstName} accepte`, rejected: `${target.firstName} refuse`, pending: `Proposition envoyée à ${target.firstName}` };
  const myPrisoner = target.prisonerOf === me.id;
  const devTools = useGame.getState().devTools;

  // ------------------------------------------------------------ Diplomatie
  out.push({
    id: 'gift',
    group: 'diplomacy',
    label: 'Envoyer un cadeau',
    icon: '⛁',
    disabled: me.gold < 10 ? reason('gold') : (me.cooldowns[`gift_${target.id}`] ?? 0) > view.date ? reason('cooldown') : null,
    run: dialog('gift'),
  });
  if (landed && !target.liegeId && !me.liegeId) {
    const allied = areAllied(view, me.id, target.id);
    if (allied) {
      out.push({
        id: 'break_alliance',
        group: 'diplomacy',
        label: 'Rompre l’alliance',
        icon: '✂',
        disabled: null,
        danger: true,
        run: () => confirm(target.id, 'Rompre l’alliance', `Rompre votre alliance avec ${target.firstName} vous coûtera du prestige et son amitié.`, () => act({ type: 'diplomacy.breakAlliance', payload: { targetId: target.id } }, 'Alliance rompue')),
      });
    } else {
      out.push({
        id: 'alliance',
        group: 'diplomacy',
        label: 'Proposer une alliance',
        icon: '⚭',
        disabled: alliesOf(view, me.id).includes(target.id) ? reason('already') : null,
        acceptance: target.isPlayer ? undefined : evaluateAlliance(view, me.id, target.id, !!hook),
        toPlayer: target.isPlayer,
        run: () => propose({ type: 'diplomacy.alliance', payload: { targetId: target.id, useHook: !!hook } }, labels),
      });
    }
  }
  if (landed && !target.liegeId && rankOf(target) < rankOf(me) && !me.liegeId) {
    out.push({
      id: 'vassalize',
      group: 'diplomacy',
      label: 'Exiger un serment de vassalité',
      icon: '♔',
      disabled: null,
      acceptance: target.isPlayer ? undefined : evaluateVassalization(view, me.id, target.id, !!hook),
      toPlayer: target.isPlayer,
      run: () => propose({ type: 'diplomacy.vassalize', payload: { targetId: target.id, useHook: !!hook } }, labels),
    });
  }
  if (!landed && target.courtId !== me.id && !target.isPlayer) {
    const acc = evaluateInvite(view, me.id, target.id);
    out.push({
      id: 'invite',
      group: 'diplomacy',
      label: 'Inviter à la cour',
      icon: '✉',
      disabled: (me.cooldowns[`invite_${target.id}`] ?? 0) > view.date ? reason('cooldown') : null,
      acceptance: acc,
      run: () => propose({ type: 'character.invite', payload: { targetId: target.id } }, { accepted: `${target.firstName} rejoint votre cour`, rejected: `${target.firstName} décline l’invitation` }),
    });
  }
  // Appel aux armes pour les alliés.
  if (areAllied(view, me.id, target.id)) {
    for (const w of warsOf(view, me.id)) {
      if (sideOf(w, target.id)) continue;
      out.push({
        id: `call_${w.id}`,
        group: 'war',
        label: `Appeler aux armes (${t(`cb.${w.cb}`)})`,
        icon: '⚔',
        disabled: null,
        acceptance: target.isPlayer ? undefined : evaluateCallToArms(view, w, me.id, target.id),
        toPlayer: target.isPlayer,
        run: () => propose({ type: 'war.callAlly', payload: { warId: w.id, allyId: target.id } }, { accepted: `${target.firstName} rejoint la guerre`, rejected: `${target.firstName} refuse l’appel`, pending: 'Appel envoyé' }),
      });
    }
  }

  // ------------------------------------------------------------ Famille
  if (!target.spouseId && !target.betrothedId && !target.prisonerOf) {
    out.push({
      id: 'marriage',
      group: 'family',
      label: 'Arranger un mariage',
      icon: '❤',
      disabled: null,
      run: () => useUi.getState().openScreen('marriage', `target:${target.id}`),
    });
  }
  if (sameDynasty(view, me, target) || target.liegeId === me.id) {
    out.push({
      id: 'heir',
      group: 'family',
      label: me.nominatedHeirId === target.id ? 'Retirer la désignation d’héritier' : 'Désigner comme héritier',
      icon: '♛',
      disabled: null,
      run: () =>
        act({ type: 'character.designateHeir', payload: { heirId: me.nominatedHeirId === target.id ? null : target.id } }, me.nominatedHeirId === target.id ? 'Désignation retirée' : `${target.firstName} est désigné héritier`),
    });
  }
  if (!isAdult(target, view.date) && (target.courtId === me.id || target.fatherId === me.id || target.motherId === me.id)) {
    out.push({ id: 'guardian', group: 'family', label: 'Choisir un précepteur', icon: '✎', disabled: null, run: dialog('guardian') });
  }

  // ------------------------------------------------------------ Royaume
  const grantable = me.titleIds.some((tid) => canGrantTitle(view, me.id, tid, target.id) === null);
  if (!target.isPlayer && (target.courtId === me.id || target.liegeId === me.id)) {
    out.push({ id: 'grant', group: 'realm', label: 'Accorder un titre', icon: '⚜', disabled: grantable ? null : reason(canGrantTitle(view, me.id, me.titleIds[me.titleIds.length - 1] ?? '', target.id) ?? 'invalid'), run: dialog('grant') });
  }
  if (target.liegeId === me.id && landed) {
    out.push({
      id: 'revoke',
      group: 'realm',
      label: 'Révoquer un titre',
      icon: '✂',
      danger: true,
      disabled: me.crownAuthority < 1 ? 'Autorité royale insuffisante' : null,
      run: dialog('revoke'),
    });
    out.push({
      id: 'independence',
      group: 'realm',
      label: 'Accorder l’indépendance',
      icon: '⚐',
      danger: true,
      disabled: null,
      run: () => confirm(target.id, 'Accorder l’indépendance', `${target.firstName} et toutes ses terres quitteront votre royaume.`, () => act({ type: 'diplomacy.independence', payload: { vassalId: target.id } }, `${target.firstName} est désormais indépendant`)),
    });
  }

  // ------------------------------------------------------------ Justice
  if (canImprison(view, me.id, target.id)) {
    const just = isJustified(view, me.id, target.id);
    out.push({
      id: 'imprison',
      group: 'prison',
      label: 'Emprisonner',
      icon: '⛓',
      danger: true,
      cost: just ? 'Justifié' : `${BALANCE.authority.imprisonCost} autorité, tyrannie`,
      disabled: !just && me.authority < BALANCE.authority.imprisonCost ? reason('authority') : null,
      run: () =>
        confirm(
          target.id,
          'Emprisonner',
          just ? `${target.firstName} a commis un crime : son emprisonnement est justifié.` : `Sans motif, cet emprisonnement sera vu comme de la tyrannie (${BALANCE.authority.imprisonCost} autorité, opinion des vassaux en baisse).`,
          () => act({ type: 'character.imprison', payload: { targetId: target.id } }, `${target.firstName} est jeté au cachot`),
        ),
    });
  }
  if (myPrisoner) {
    const just = isJustified(view, me.id, target.id);
    out.push({ id: 'release', group: 'prison', label: 'Libérer', icon: '🗝', disabled: null, run: () => act({ type: 'character.release', payload: { targetId: target.id } }, `${target.firstName} est libéré`) });
    out.push({
      id: 'ransom',
      group: 'prison',
      label: `Exiger une rançon (${fmt(ransomPrice(view, target))} or)`,
      icon: '⛁',
      disabled: null,
      run: () => propose({ type: 'prisoner.ransom', payload: { prisonerId: target.id } }, { accepted: 'Rançon payée', rejected: 'Personne ne paie la rançon' }),
    });
    out.push({
      id: 'execute',
      group: 'prison',
      label: 'Exécuter',
      icon: '☠',
      danger: true,
      cost: just ? 'Justifié' : `${BALANCE.authority.executeCost} autorité`,
      disabled: !just && me.authority < BALANCE.authority.executeCost ? reason('authority') : null,
      run: () => confirm(target.id, 'Exécution', `${target.firstName} sera mis à mort. Sa famille ne l’oubliera jamais.`, () => act({ type: 'character.execute', payload: { targetId: target.id } }, `${target.firstName} a été exécuté`, 'war')),
    });
  }
  if (target.prisonerOf && target.prisonerOf !== me.id && (sameDynasty(view, me, target) || target.courtId === me.id)) {
    out.push({
      id: 'pay_ransom',
      group: 'prison',
      label: `Payer la rançon (${fmt(ransomPrice(view, target))} or)`,
      icon: '⛁',
      disabled: me.gold < ransomPrice(view, target) ? reason('gold') : null,
      run: () => propose({ type: 'prisoner.ransom', payload: { prisonerId: target.id } }, { accepted: `${target.firstName} est libéré`, rejected: 'Rançon refusée' }),
    });
  }

  // ------------------------------------------------------------ Intrigue
  const anyScheme = (Object.keys(SCHEME_DEFS) as SchemeType[]).some((ty) => schemeValidity(view, me, target, ty) === null);
  out.push({ id: 'schemes', group: 'intrigue', label: 'Comploter…', icon: '☾', disabled: anyScheme ? null : 'Aucun complot possible', run: dialog('scheme') });
  for (const s of knownSecretsOf(view, me.id).filter((s) => s.ownerId === target.id && !s.exposed)) {
    out.push({
      id: `expose_${s.id}`,
      group: 'intrigue',
      label: `Révéler : ${t(`secret.${s.type}`)}`,
      icon: '☀',
      danger: true,
      disabled: null,
      run: () => confirm(target.id, 'Révéler un secret', `Le secret de ${target.firstName} sera connu de tous. Vous perdrez tout levier lié.`, () => act({ type: 'secret.expose', payload: { secretId: s.id } }, 'Le scandale éclate')),
    });
  }

  // ------------------------------------------------------------ Guerre
  if (landed && !isInRealmOf(view, target.id, me.id)) {
    const why = canTargetForWar(view, me.id, target.id);
    const cbs = why ? [] : availableCasusBelli(view, me.id, target.id);
    out.push({
      id: 'war',
      group: 'war',
      label: 'Déclarer la guerre…',
      icon: '⚔',
      danger: true,
      disabled: why ? reason(why) : cbs.length === 0 ? reason('no_cb') : null,
      run: dialog('war'),
    });
  }

  // ------------------------------------------------------------ Dev
  if (devTools) {
    out.push({ id: 'dev_kill', group: 'dev', label: 'Tuer (dev)', icon: '☠', disabled: null, run: () => act({ type: 'dev.killCharacter', payload: { characterId: target.id } }) });
    if (landed) out.push({ id: 'dev_switch', group: 'dev', label: 'Incarner (dev)', icon: '⇄', disabled: null, run: () => act({ type: 'dev.switchCharacter', payload: { characterId: target.id } }) });
  }
  return out;
}

export function acceptanceSummary(a: Acceptance | undefined): { text: string; tone: 'pos' | 'neg' } | null {
  if (!a) return null;
  return a.accept ? { text: `Acceptera (${a.score > 0 ? '+' : ''}${a.score})`, tone: 'pos' } : { text: `Refusera (${a.score})`, tone: 'neg' };
}
