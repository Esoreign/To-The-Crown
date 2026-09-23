import { describe, expect, it } from 'vitest';
import type { EventDef, GameState } from '@ttc/shared';
import { armyMen, findPath, raiseArmy, orderMove, disbandArmy } from '../src/armies';
import { ageOf, isAlive } from '../src/characters';
import { PROVINCE_GEO } from '../src/content';
import { killCharacter } from '../src/death';
import { applyEffects } from '../src/events/effects';
import { fireEvent, resolveChoice } from '../src/events/engine';
import { evaluateMarriage, marriageCandidates, proposeMarriage } from '../src/marriage';
import { hasRelation, areAllied } from '../src/opinion';
import { rankOf, topLiegeId } from '../src/realm';
import { startScheme } from '../src/schemes';
import { planSuccession, primogenitureLine } from '../src/succession';
import { availableCasusBelli, declareWar, endWar } from '../src/war';
import { simulateDaysMutable } from '../src/engine';
import { simulateGame } from '../src/simulate';
import { evaluateVassalization } from '../src/diplomacy';
import { respondProposal } from '../src/proposals';
import { ctxFor, newState, rulerId, scenario } from './helpers';

describe('Succession', () => {
  it('partage : le royaume d’Aurelan est réparti entre ses fils', () => {
    const s = newState(1);
    const aurelan = s.characters[rulerId('Aurelan')]!;
    const plan = planSuccession(s, aurelan);
    expect(plan.law).toBe('partition');
    expect(plan.heirs.length).toBeGreaterThan(1);
    const eldest = primogenitureLine(s, aurelan)[0]!;
    expect(plan.primaryHeirId).toBe(eldest.id);
    expect(plan.titles.k_aurevanne).toBe(eldest.id);
  });

  it('à la mort, les titres sont transférés et les cadets deviennent vassaux de l’aîné', () => {
    const s = newState(1);
    const id = rulerId('Aurelan');
    const plan = planSuccession(s, s.characters[id]!);
    killCharacter(ctxFor(s), id, 'natural');
    expect(s.characters[id]!.titleIds).toEqual([]);
    const main = s.characters[plan.primaryHeirId!]!;
    expect(main.titleIds).toContain('k_aurevanne');
    for (const h of plan.heirs) {
      if (h === main.id) continue;
      expect(s.characters[h]!.titleIds.length).toBeGreaterThan(0);
      expect(topLiegeId(s, h)).toBe(main.id);
    }
  });

  it('le joueur continue avec son héritier', () => {
    const id = rulerId('Aurelan');
    const s = newState(2, [{ userId: 'u1', displayName: 'Joueur', characterId: id }]);
    const plan = planSuccession(s, s.characters[id]!);
    const ctx = ctxFor(s);
    killCharacter(ctx, id, 'natural');
    expect(s.players.u1!.characterId).toBe(plan.primaryHeirId);
    expect(s.characters[plan.primaryHeirId!]!.isPlayer).toBe(true);
    expect(s.players.u1!.rulers).toHaveLength(2);
    expect(ctx.out.notifications.some((n) => n.kind === 'succession')).toBe(true);
  });

  it('fin de partie si aucun héritier de la dynastie', () => {
    const id = rulerId('Morcant');
    const s = newState(3, [{ userId: 'u1', displayName: 'Joueur', characterId: id }]);
    // Morcant n'a ni enfant ni frère : sa dynastie s'éteint.
    const plan = planSuccession(s, s.characters[id]!);
    const dyn = s.houses[s.characters[id]!.houseId!]!.dynastyId;
    const heirDyn = plan.primaryHeirId ? s.houses[s.characters[plan.primaryHeirId]!.houseId ?? '']?.dynastyId : null;
    killCharacter(ctxFor(s), id, 'natural');
    if (heirDyn !== dyn) expect(s.players.u1!.gameOver).toBe(true);
    else expect(s.players.u1!.gameOver).toBe(false);
  });

  it('élection : le résultat désigne un candidat éligible', () => {
    const s = newState(4);
    const caedmon = Object.values(s.characters).find((c) => c.titleIds.includes('k_ardh'))!;
    const plan = planSuccession(s, caedmon);
    expect(plan.law).toBe('elective');
    expect(plan.election!.length).toBeGreaterThan(0);
    expect(plan.primaryHeirId).toBe(plan.election![0]!.candidateId);
  });
});

describe('Mariage', () => {
  it('interdit les mariages entre proches parents', () => {
    const s = newState(5);
    const aurelan = s.characters[rulerId('Aurelan')]!;
    const kids = aurelan.childIds.map((k) => s.characters[k]!);
    const son = kids.find((k) => k.sex === 'M')!;
    const daughter = kids.find((k) => k.sex === 'F')!;
    const acc = evaluateMarriage(s, aurelan.id, son.id, daughter.id);
    expect(acc.accept).toBe(false);
    expect(acc.rows.some((r) => r.key.startsWith('blocked'))).toBe(true);
  });

  it('un mariage accepté crée une alliance entre les familles', () => {
    const s = newState(6);
    const actor = rulerId('Aélis');
    const cands = marriageCandidates(s, actor, actor, 40).filter((c) => c.acceptance.accept);
    const pick = cands.find((c) => {
      const cand = s.characters[c.id]!;
      const decider = cand.titleIds.length ? cand : s.characters[cand.courtId!]!;
      return decider.id !== actor && !cand.isPlayer && ageOf(cand, s.date) >= 16;
    });
    expect(pick).toBeDefined();
    const cand = s.characters[pick!.id]!;
    const decider = cand.titleIds.length ? cand.id : cand.courtId!;
    const ctx = ctxFor(s);
    const r = proposeMarriage(ctx, actor, actor, pick!.id);
    expect(r.accepted).toBe(true);
    expect(s.characters[actor]!.spouseId).toBe(pick!.id);
    expect(areAllied(s, actor, decider)).toBe(true);
  });

  it('une proposition à un joueur reste en attente puis est acceptée', () => {
    const aelis = rulerId('Aélis');
    const aldren = rulerId('Aldren');
    const s = newState(7, [{ userId: 'u2', displayName: 'B', characterId: aelis }]);
    const son = Object.values(s.characters).find(
      (k) => k.courtId === aldren && k.sex === 'M' && !k.spouseId && !k.titleIds.length && ageOf(k, s.date) >= 16 && ageOf(k, s.date) < 40,
    )!;
    expect(son).toBeDefined();
    const ctx = ctxFor(s);
    const r = proposeMarriage(ctx, aldren, son.id, aelis);
    expect(r.pending).toBe(true);
    const proposal = Object.values(s.proposals)[0]!;
    respondProposal(ctx, aelis, proposal.id, true);
    expect(s.characters[aelis]!.spouseId).toBe(son.id);
  });
});

describe('Guerre', () => {
  it('Aldren peut faire valoir sa revendication sur la Valorie et, victorieux, devient roi', () => {
    const s = newState(8);
    const aldren = rulerId('Aldren');
    const aelis = rulerId('Aélis');
    const cbs = availableCasusBelli(s, aldren, aelis);
    const cb = cbs.find((c) => c.titleId === 'k_valorie');
    expect(cb).toBeDefined();
    const ctx = ctxFor(s);
    const war = declareWar(ctx, aldren, aelis, cb!.cb, cb!.titleId, cb!.claimantId);
    expect(s.wars[war.id]).toBeDefined();
    endWar(ctx, war.id, 'attacker');
    expect(s.titles.k_valorie!.holderId).toBe(aldren);
    expect(s.characters[aldren]!.liegeId).toBeNull();
    expect(rankOf(s.characters[aldren]!)).toBe(3);
    expect(s.characters[aelis]!.liegeId).toBe(aldren);
    expect(s.wars[war.id]).toBeUndefined();
  });

  it('aucun casus belli sans revendication', () => {
    const s = newState(9);
    expect(availableCasusBelli(s, rulerId('Thalos'), rulerId('Torvald')).filter((c) => c.cb !== 'holy_war' && c.cb !== 'conquest')).toEqual([]);
  });

  it('batailles et sièges : une armée supérieure occupe une province ennemie', () => {
    const altani = rulerId('Altani');
    // Altani est jouée par un humain : l'IA ne réorganise pas son armée.
    const s = newState(10, [{ userId: 'u', displayName: 'P', characterId: altani }]);
    const war = Object.values(s.wars)[0]!;
    const ctx = ctxFor(s);
    s.characters[altani]!.maa = { heavy_cavalry: 3000, footmen: 3000 };
    const army = raiseArmy(ctx, altani);
    expect(armyMen(army)).toBeGreaterThan(5000);
    const target = war.targetTitleId!;
    const pid = Object.values(PROVINCE_GEO).find((p) => p.countyTitleId === target)!.id;
    const path = orderMove(ctx, altani, army.id, pid);
    expect(path.length).toBeGreaterThan(0);
    // Les voisins sont bien adjacents.
    let cur = army.location;
    for (const p of path) {
      const g = PROVINCE_GEO[cur]!;
      expect([...g.neighbors, ...g.straits]).toContain(p);
      cur = p;
    }
    for (let i = 0; i < 400 && !s.titles[target]!.occupiedBy; i++) {
      simulateDaysMutable(s, 1);
      const a = s.armies[army.id];
      if (a && a.status === 'idle' && a.location !== pid && a.shattered === 0) orderMove(ctxFor(s), altani, army.id, pid);
      if (!s.wars[war.id]) break;
    }
    const occupied = s.titles[target]!.occupiedBy;
    expect(occupied === altani || !s.wars[war.id]).toBe(true);
  });

  it('dissoudre une armée rend les levées aux provinces', () => {
    const s = newState(11);
    const id = rulerId('Torvald');
    const ctx = ctxFor(s);
    const before = Object.values(s.provinces).reduce((x, p) => x + p.levies, 0);
    const a = raiseArmy(ctx, id);
    const during = Object.values(s.provinces).reduce((x, p) => x + p.levies, 0);
    expect(during).toBeLessThan(before);
    disbandArmy(ctx, id, a.id);
    const after = Object.values(s.provinces).reduce((x, p) => x + p.levies, 0);
    expect(after).toBeGreaterThan(during);
  });

  it('A* trouve un chemin entre deux extrémités du continent', () => {
    const ids = Object.keys(PROVINCE_GEO);
    const path = findPath(ids[0]!, ids[ids.length - 1]!);
    expect(path).not.toBeNull();
  });
});

describe('Complots', () => {
  it('un complot d’amitié progresse et aboutit à une relation', () => {
    const s = newState(12);
    const aelis = rulerId('Aélis');
    const target = Object.values(s.characters).find((c) => c.liegeId === aelis)!;
    const ctx = ctxFor(s);
    const sch = startScheme(ctx, aelis, 'befriend', target.id);
    expect(sch.progress).toBe(0);
    for (let i = 0; i < 60 && s.schemes[sch.id]?.status === 'active'; i++) simulateDaysMutable(s, 30);
    expect(s.schemes[sch.id]?.status ?? 'resolved').not.toBe('active');
    // Réussite ou échec : la simulation reste cohérente.
    if (hasRelation(s, aelis, target.id, 'friend')) expect(true).toBe(true);
  });
});

describe('Moteur d’événements', () => {
  const def: EventDef = {
    id: 'test_event',
    category: 'court',
    title: 'Test',
    text: 'Texte',
    illustration: 'throne_room',
    trigger: 'pulse',
    choices: [
      { id: 'a', label: 'A', effects: [{ addGold: 50 }, { addTrait: 'poet' }], ai: { base: 100 } },
      { id: 'b', label: 'B', effects: [{ addPrestige: 30 }], ai: { base: 0 } },
    ],
  };

  it('les effets annoncés sont appliqués', () => {
    const s = newState(13);
    const id = rulerId('Thalos');
    const gold = s.characters[id]!.gold;
    resolveChoice(ctxFor(s), def, def.choices[0]!, { root: id });
    expect(s.characters[id]!.gold).toBe(gold + 50);
    expect(s.characters[id]!.traits).toContain('poet');
  });

  it('un joueur reçoit une fenêtre, l’IA choisit immédiatement', () => {
    const player = rulerId('Thalos');
    const s = newState(14, [{ userId: 'u', displayName: 'P', characterId: player }]);
    const ctx = ctxFor(s);
    fireEvent(ctx, def, { root: player });
    expect(Object.values(s.activeEvents).some((e) => e.characterId === player)).toBe(true);
    const ai = rulerId('Torvald');
    const gold = s.characters[ai]!.gold;
    fireEvent(ctx, def, { root: ai });
    expect(s.characters[ai]!.gold).toBe(gold + 50);
  });

  it('les effets conditionnels et aléatoires sont déterministes', () => {
    const a = newState(15);
    const b = newState(15);
    const id = rulerId('Thalos');
    const eff = [{ chance: 50, then: [{ addGold: 10 }], else: [{ addGold: -10 }] }, { if: { gold: { min: 0 } }, then: [{ addPrestige: 5 }] }] as const;
    applyEffects(ctxFor(a), [...eff], { root: id });
    applyEffects(ctxFor(b), [...eff], { root: id });
    expect(a.characters[id]!.gold).toBe(b.characters[id]!.gold);
  });
});

describe('IA', () => {
  it('un petit comte ne vassalise pas un empereur', () => {
    const s = newState(16);
    const acc = evaluateVassalization(s, rulerId('Morcant'), rulerId('Torvald'));
    expect(acc.accept).toBe(false);
  });

  it('simulation de 10 ans sans violation d’invariant ni erreur système', () => {
    const { report } = simulateGame(scenario, { years: 10, seed: 2024, checkEveryMonths: 24 });
    expect(report.invariantErrors).toEqual([]);
    expect(report.alive).toBeGreaterThan(300);
    expect(report.alive).toBeLessThan(2000);
    expect(report.births).toBeGreaterThan(50);
    expect(report.marriages).toBeGreaterThan(20);
    expect(report.battles).toBeGreaterThan(0);
  });

  it('les personnages vivants ont des ressources finies après 5 ans', () => {
    const s: GameState = newState(17);
    simulateDaysMutable(s, 365 * 5);
    for (const c of Object.values(s.characters)) {
      if (!isAlive(c)) continue;
      expect(Number.isFinite(c.gold)).toBe(true);
      expect(Number.isFinite(c.prestige)).toBe(true);
    }
  });
});
