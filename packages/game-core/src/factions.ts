/**
 * Factions vassales : adhésion, mécontentement, ultimatum, guerre.
 */
import { ErrorCodes, GameError, type Faction, type FactionType, type GameState, type GameView, type War } from '@ttc/shared';
import { BALANCE } from './balance';
import { isAlive } from './characters';
import { newId, notify, type Ctx } from './context';
import { militaryStrength } from './economy';
import { addOpinion, opinion } from './opinion';
import { directVassals, rankOf } from './realm';
import { endWar } from './war';
import { bumpStructure } from './index-cache';

export function factionPower(state: GameView, f: Faction): number {
  return f.members.reduce((s, m) => {
    const c = state.characters[m];
    return c && isAlive(c) ? s + militaryStrength(state, c) : s;
  }, 0);
}

export function factionRatio(state: GameView, f: Faction): number {
  const liege = state.characters[f.targetId];
  if (!liege) return 0;
  return factionPower(state, f) / Math.max(1, militaryStrength(state, liege));
}

/** Score d'envie de rejoindre une faction pour un vassal IA. */
export function joinScore(state: GameView, vassalId: string, f: Faction | { type: FactionType; targetId: string }): number {
  const v = state.characters[vassalId]!;
  const op = opinion(state, vassalId, f.targetId);
  let score = -op - 20;
  score += v.personality.ambition * 0.2 - v.personality.loyalty * 0.3 - v.personality.caution * 0.1;
  if (f.type === 'independence' && rankOf(v) < 2) score -= 20;
  if (f.type === 'lower_authority') score += (state.characters[f.targetId]?.crownAuthority ?? 1) * 10 - 10;
  const inCouncil = Object.values(state.characters[f.targetId]?.council ?? {}).some((s) => s.characterId === vassalId);
  if (inCouncil) score -= 15;
  return score;
}

export function monthlyFactions(ctx: Ctx): void {
  const s = ctx.s;
  // Nettoyage.
  for (const [id, f] of Object.entries(s.factions)) {
    const target = s.characters[f.targetId];
    f.members = f.members.filter((m) => {
      const c = s.characters[m];
      return c && isAlive(c) && c.liegeId === f.targetId;
    });
    if (!target || !isAlive(target) || !f.members.length) {
      delete s.factions[id];
      continue;
    }
    if (!f.members.includes(f.leaderId)) f.leaderId = f.members[0]!;
  }
  // Adhésions IA et création.
  const lieges = new Set(Object.values(s.characters).filter((c) => c.liegeId && isAlive(c)).map((c) => c.liegeId!));
  for (const liegeId of lieges) {
    const vassals = directVassals(s, liegeId).filter((v) => !v.isPlayer);
    for (const v of vassals) {
      if (!ctx.rng.chance(0.25)) continue;
      const inFaction = Object.values(s.factions).some((f) => f.members.includes(v.id));
      if (inFaction) {
        const f = Object.values(s.factions).find((x) => x.members.includes(v.id))!;
        if (joinScore(s, v.id, f) < -25) f.members = f.members.filter((m) => m !== v.id);
        continue;
      }
      const existing = Object.values(s.factions).filter((f) => f.targetId === liegeId);
      const best = existing.map((f) => ({ f, sc: joinScore(s, v.id, f) })).sort((a, b) => b.sc - a.sc)[0];
      if (best && best.sc > 0) {
        best.f.members.push(v.id);
        continue;
      }
      if (joinScore(s, v.id, { type: 'independence', targetId: liegeId }) > 25 && existing.length < 2) {
        const type: FactionType = rankOf(v) >= 2 && v.personality.ambition > 0 ? 'independence' : 'lower_authority';
        const id = newId(s, 'fa');
        s.factions[id] = { id, type, targetId: liegeId, leaderId: v.id, members: [v.id], claimantId: null, discontent: 0, createdAt: s.date, ultimatumSent: false };
        notify(ctx, [liegeId], { level: 'important', kind: 'faction_formed', vars: { leader: v.firstName, type }, focus: { type: 'character', id: v.id } });
      }
    }
  }
  // Mécontentement et ultimatums.
  for (const f of Object.values(s.factions)) {
    const ratio = factionRatio(s, f);
    if (ratio >= BALANCE.factions.powerThreshold) f.discontent = Math.min(100, f.discontent + BALANCE.factions.discontentMonthly * (1 + ratio - 0.8));
    else f.discontent = Math.max(0, f.discontent - 2);
    if (f.discontent >= 100 && !f.ultimatumSent) sendUltimatum(ctx, f);
  }
}

function sendUltimatum(ctx: Ctx, f: Faction): void {
  const s = ctx.s;
  f.ultimatumSent = true;
  const liege = s.characters[f.targetId]!;
  if (liege.isPlayer) {
    const pid = newId(s, 'pr');
    s.proposals[pid] = { id: pid, kind: 'faction_demand', fromId: f.leaderId, toId: liege.id, subjects: [f.id], createdAt: s.date, expiresAt: s.date + 30, hookId: null };
    notify(ctx, [liege.id], { level: 'urgent', kind: 'faction_ultimatum', vars: { leader: s.characters[f.leaderId]!.firstName, type: f.type }, focus: { type: 'character', id: f.leaderId }, sound: 'war' });
    return;
  }
  const accept = factionRatio(s, f) > 1.3 && liege.personality.caution > -20;
  if (accept) acceptFactionDemand(ctx, f.id);
  else startFactionWar(ctx, f.id);
}

export function acceptFactionDemand(ctx: Ctx, factionId: string): void {
  const s = ctx.s;
  const f = s.factions[factionId];
  if (!f) throw new GameError(ErrorCodes.INVALID_TARGET, 'Faction inconnue');
  const liege = s.characters[f.targetId]!;
  switch (f.type) {
    case 'independence':
      for (const m of f.members) {
        const c = s.characters[m];
        if (c) c.liegeId = null;
        bumpStructure();
      }
      break;
    case 'autonomy':
    case 'lower_authority':
      liege.crownAuthority = Math.max(0, liege.crownAuthority - (f.type === 'autonomy' ? 2 : 1));
      break;
    case 'claimant':
      break;
  }
  for (const m of f.members) addOpinion(s, m, liege.id, 15, 'opinion.reason.demands_met', 60);
  liege.prestige -= 150;
  notify(ctx, [liege.id, ...f.members], { level: 'important', kind: 'faction_demands_accepted', vars: { type: f.type }, focus: { type: 'character', id: f.leaderId } });
  delete s.factions[factionId];
}

export function startFactionWar(ctx: Ctx, factionId: string): War | null {
  const s = ctx.s;
  const f = s.factions[factionId];
  if (!f) return null;
  const id = newId(s, 'wa');
  const war: War = {
    id,
    cb: 'faction',
    attackerId: f.leaderId,
    defenderId: f.targetId,
    attackers: [...f.members],
    defenders: [f.targetId],
    targetTitleId: null,
    claimantId: f.claimantId,
    warScore: 0,
    battleScore: 0,
    occupationScore: 0,
    ticking: 0,
    startedAt: s.date,
    battles: [],
    casualties: [0, 0],
    factionId,
    maxEnd: s.date + BALANCE.war.maxDurationDays,
  };
  s.wars[id] = war;
  bumpStructure();
  delete s.factions[factionId];
  notify(ctx, [f.targetId, ...f.members, ...Object.values(s.players).map((p) => p.characterId)], {
    level: 'urgent',
    kind: 'faction_war',
    vars: { leader: s.characters[f.leaderId]!.firstName, liege: s.characters[f.targetId]!.firstName },
    focus: { type: 'war', id },
    sound: 'war',
  });
  return war;
}

export function joinFaction(s: GameState, charId: string, factionId: string): void {
  const f = s.factions[factionId];
  const c = s.characters[charId];
  if (!f || !c || c.liegeId !== f.targetId) throw new GameError(ErrorCodes.INVALID_TARGET, 'Faction non accessible');
  if (Object.values(s.factions).some((x) => x.members.includes(charId))) throw new GameError(ErrorCodes.INVALID_TARGET, 'Déjà membre d’une faction');
  f.members.push(charId);
}

export function leaveFaction(s: GameState, charId: string, factionId: string): void {
  const f = s.factions[factionId];
  if (!f) throw new GameError(ErrorCodes.INVALID_TARGET, 'Faction inconnue');
  f.members = f.members.filter((m) => m !== charId);
  if (!f.members.length) delete s.factions[factionId];
  else if (f.leaderId === charId) f.leaderId = f.members[0]!;
}

export { endWar };
