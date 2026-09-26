import { describe, expect, it } from 'vitest';
import { GameError, type GameState } from '@ttc/shared';
import { runCommand, simulateDaysMutable } from '../src/engine';
import { offerPeace } from '../src/war';
import { ledgerOf } from '../src/economy';
import { opinionOf } from '../src/opinion';
import { BALANCE } from '../src/balance';
import { governmentOf, isExternalPact, legitimacyOf, legitimacyTarget, pactsAsOverlord, pactsAsSubject } from '../src/politics';
import { ctxFor, newState, rulerOf, scenario } from './helpers';

function pactOf(s: GameState, subjectPolity: string) {
  const info = scenario.polities![subjectPolity]!;
  const pact = Object.values(s.pacts).find((p) => p.subjectTitleId === info.titleId);
  if (!pact) throw new Error(`Aucun contrat pour ${subjectPolity}`);
  return pact;
}

describe('Contrats de sujétion', () => {
  it('le scénario relie la Corée aux Ming par un contrat tributaire', () => {
    const s = newState(3);
    const pact = pactOf(s, 'jos');
    expect(pact.type).toBe('tributary');
    expect(isExternalPact(pact)).toBe(true);
    const joseon = rulerOf('jos');
    const ming = rulerOf('ming');
    // Un tributaire reste souverain : pas de suzerain direct.
    expect(s.characters[joseon]!.liegeId).toBeNull();
    expect(pactsAsSubject(s, joseon).map((p) => p.id)).toContain(pact.id);
    expect(pactsAsOverlord(s, ming).map((p) => p.id)).toContain(pact.id);
  });

  it('le tribut apparaît dans les deux trésoreries', () => {
    const s = newState(3);
    const joseon = s.characters[rulerOf('jos')]!;
    const ming = s.characters[rulerOf('ming')]!;
    const paid = ledgerOf(s, joseon).expenses.find((r) => r.key === 'tribute_paid')?.value ?? 0;
    const received = ledgerOf(s, ming).income.find((r) => r.key === 'tribute_received')?.value ?? 0;
    expect(paid).toBeGreaterThan(0);
    expect(received).toBeGreaterThanOrEqual(paid);
  });

  it('le tributaire garde rancune à son suzerain', () => {
    const s = newState(3);
    const rows = opinionOf(s, rulerOf('jos'), rulerOf('ming')).rows;
    expect(rows.some((r) => r.reason === 'tributary')).toBe(true);
  });

  it('seul le suzerain fixe le tribut, qui modifie l’opinion du sujet', () => {
    const s = newState(3);
    const pact = pactOf(s, 'jos');
    expect(() => runCommand(s, rulerOf('jos'), { type: 'subject.tribute', payload: { pactId: pact.id, level: 'light' } })).toThrowError(GameError);
    const before = opinionOf(s, rulerOf('jos'), rulerOf('ming')).total;
    const r = runCommand(s, rulerOf('ming'), { type: 'subject.tribute', payload: { pactId: pact.id, level: 'heavy' } });
    expect(r.state.pacts[pact.id]!.tribute).toBe(BALANCE.politics.tributeLevels.heavy);
    expect(opinionOf(r.state, rulerOf('jos'), rulerOf('ming')).total).toBeLessThan(before);
  });

  it('affranchir un vassal le rend indépendant et rapporte du prestige', () => {
    const s = newState(3);
    // Un vassal à l'intérieur d'un royaume (contrat interne).
    const pact = Object.values(s.pacts).find((p) => !isExternalPact(p) && s.characters[s.titles[p.subjectTitleId]!.holderId!]?.liegeId === s.titles[p.overlordTitleId]!.holderId)!;
    expect(pact).toBeDefined();
    const vassal = s.titles[pact.subjectTitleId]!.holderId!;
    const overlord = s.titles[pact.overlordTitleId]!.holderId!;
    const prestige = s.characters[overlord]!.prestige;
    const r = runCommand(s, overlord, { type: 'subject.release', payload: { pactId: pact.id } });
    expect(r.state.pacts[pact.id]).toBeUndefined();
    expect(r.state.characters[vassal]!.liegeId).toBeNull();
    expect(r.state.characters[overlord]!.prestige).toBeGreaterThan(prestige);
    expect(() => runCommand(r.state, overlord, { type: 'subject.release', payload: { pactId: pact.id } })).toThrowError(GameError);
  });
});

describe('Légitimité', () => {
  it('chaque souverain a un gouvernement et une légitimité bornée', () => {
    const s = newState(4);
    for (const polity of ['fra', 'ming', 'mli', 'ven', 'tim']) {
      const c = s.characters[rulerOf(polity)]!;
      expect(governmentOf(c)).toBeDefined();
      const { total, rows } = legitimacyTarget(s, c);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
      expect(rows[0]!.key).toBe('base');
    }
  });

  it('la légitimité converge vers sa cible au fil des mois', () => {
    const s = newState(4);
    const id = rulerOf('fra');
    s.characters[id]!.legitimacy = 0;
    simulateDaysMutable(s, 70);
    const c = s.characters[id]!;
    expect(legitimacyOf(c)).toBeGreaterThan(0);
    expect(legitimacyOf(c)).toBeLessThanOrEqual(100);
  });
});

describe('Propositions aux joueurs', () => {
  it('une offre de paix blanche en attente n’est pas renvoyée en double', () => {
    const ott = rulerOf('ott');
    const s = newState(5, [{ userId: 'u1', displayName: 'Joueur', characterId: ott }]);
    const war = Object.values(s.wars).find((w) => w.attackerId === ott || w.defenderId === ott)!;
    const other = war.attackerId === ott ? war.defenderId : war.attackerId;
    const ctx = ctxFor(s);
    expect(offerPeace(ctx, other, war.id, 'white').pending).toBe(true);
    expect(offerPeace(ctx, other, war.id, 'white').pending).toBe(true);
    expect(Object.values(s.proposals).filter((p) => p.kind === 'white_peace' && p.toId === ott)).toHaveLength(1);
  });
});
