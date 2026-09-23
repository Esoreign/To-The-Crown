import { describe, expect, it } from 'vitest';
import { ErrorCodes, GameError, type GameState } from '@ttc/shared';
import { makeRng, seedRng } from '../src/rng';
import { runCommand, simulateDaysMutable, stepDay } from '../src/engine';
import { ledgerOf, domainPenalty } from '../src/economy';
import { domainProvinceIds } from '../src/characters';
import { domainLimit, directVassals, rankOf, realmProvinceIds } from '../src/realm';
import { opinionOf } from '../src/opinion';
import { publicPatches, publicView, privateViewFor } from '../src/views';
import { checkInvariants } from '../src/simulate';
import { buildOptions } from '../src/buildings';
import { ctxFor, newState, rulerId, scenario } from './helpers';

describe('PRNG déterministe', () => {
  it('produit la même suite pour la même graine', () => {
    const a = makeRng(seedRng(123));
    const b = makeRng(seedRng(123));
    const sa = Array.from({ length: 50 }, () => a.next());
    const sb = Array.from({ length: 50 }, () => b.next());
    expect(sa).toEqual(sb);
    expect(new Set(sa).size).toBeGreaterThan(45);
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true);
  });

  it('diffère selon la graine', () => {
    expect(makeRng(seedRng(1)).next()).not.toBe(makeRng(seedRng(2)).next());
  });

  it('int reste dans les bornes', () => {
    const r = makeRng(seedRng(5));
    for (let i = 0; i < 500; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe('Déterminisme de la simulation', () => {
  it('même état + même graine ⇒ même résultat après 120 jours', () => {
    const a = newState(99);
    const b = newState(99);
    simulateDaysMutable(a, 120);
    simulateDaysMutable(b, 120);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('stepDay (Immer) et simulation mutable donnent le même état', () => {
    let a: GameState = newState(7);
    const b = newState(7);
    for (let i = 0; i < 40; i++) a = stepDay(a).state;
    simulateDaysMutable(b, 40);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('le scénario initial respecte les invariants', () => {
    expect(checkInvariants(newState(1))).toEqual([]);
  });
});

describe('Économie', () => {
  it('le ledger correspond exactement à la variation mensuelle d’or', () => {
    const id = rulerId('Aurelan');
    // Joueur humain : l'IA ne dépense pas son or pendant le test.
    const s = newState(3, [{ userId: 'u1', displayName: 'Test', characterId: id }]);
    while (!isEveOfMonth(s.date)) simulateDaysMutable(s, 1);
    const before = s.characters[id]!.gold;
    const net = ledgerOf(s, s.characters[id]!).net;
    simulateDaysMutable(s, 1);
    expect(s.characters[id]!.gold).toBeCloseTo(before + net, 1);
    expect(net).toBeGreaterThan(0);
  });

  it('pénalise un domaine trop grand', () => {
    const s = newState(4);
    const c = Object.values(s.characters).find((x) => x.titleIds.length && x.death === null)!;
    const limit = domainLimit(s, c);
    const extra = Object.values(s.titles)
      .filter((t) => t.id.startsWith('c_') && t.holderId !== c.id)
      .slice(0, limit + 3);
    for (const t of extra) {
      const prev = s.characters[t.holderId!]!;
      prev.titleIds = prev.titleIds.filter((x) => x !== t.id);
      t.holderId = c.id;
      c.titleIds.push(t.id);
    }
    expect(domainProvinceIds(c).length).toBeGreaterThan(limit);
    expect(domainPenalty(s, c)).toBeGreaterThan(0);
  });
});

function isEveOfMonth(day: number): boolean {
  // Le jour suivant est un 1er du mois.
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let d = (day + 1) % 365;
  for (const len of lengths) {
    if (d === 0) return true;
    if (d < len) return false;
    d -= len;
  }
  return false;
}

describe('Opinion', () => {
  it('le total correspond à la somme des lignes (bornée)', () => {
    const s = newState(2);
    const aelis = rulerId('Aélis');
    for (const v of directVassals(s, aelis)) {
      const o = opinionOf(s, v.id, aelis);
      const sum = o.rows.reduce((x, r) => x + r.value, 0);
      expect(o.total).toBe(Math.max(-100, Math.min(100, Math.round(sum))));
    }
  });

  it('les vassaux de la reine de Valorie doutent de sa légitimité', () => {
    const s = newState(2);
    const aelis = rulerId('Aélis');
    const aldren = rulerId('Aldren');
    const o = opinionOf(s, aldren, aelis);
    expect(o.rows.some((r) => r.reason === 'opinion.reason.contested_succession')).toBe(true);
    expect(o.total).toBeLessThan(0);
  });
});

describe('Commandes et serveur autoritaire', () => {
  it('refuse une commande de développement hors mode dev, sans modifier l’état', () => {
    const s = newState(5, [{ userId: 'u1', displayName: 'A', characterId: rulerId('Thalos') }]);
    const before = JSON.stringify(s);
    expect(() => runCommand(s, rulerId('Thalos'), { type: 'dev.addResources', payload: { gold: 99999 } })).toThrowError(GameError);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('refuse de déplacer l’armée d’un autre', () => {
    let s = newState(5, [{ userId: 'u1', displayName: 'A', characterId: rulerId('Thalos') }]);
    const other = rulerId('Altani');
    const raised = runCommand(s, other, { type: 'army.raise', payload: {} });
    s = raised.state;
    const armyId = raised.result.armyId as string;
    try {
      runCommand(s, rulerId('Thalos'), { type: 'army.move', payload: { armyId, to: 'p001' } });
      expect.unreachable();
    } catch (e) {
      expect((e as GameError).code).toBe(ErrorCodes.ARMY_NOT_OWNED);
    }
  });

  it('une erreur de commande n’applique aucune mutation (transaction)', () => {
    const s = newState(6);
    const id = rulerId('Morcant');
    const before = JSON.stringify(s);
    expect(() => runCommand(s, id, { type: 'building.construct', payload: { provinceId: 'p000', buildingId: 'fortress' } })).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('construit réellement : or déduit puis bâtiment achevé', () => {
    let s = newState(8);
    const id = rulerId('Thalos');
    const c = s.characters[id]!;
    const pick = domainProvinceIds(c)
      .flatMap((p) => buildOptions(s, p, id).map((o) => ({ p, o })))
      .find((x) => x.o.available)!;
    const pid = pick.p;
    const bid = pick.o.def.id;
    const goldBefore = c.gold;
    const levelBefore = s.provinces[pid]!.buildings[bid] ?? 0;
    const r = runCommand(s, id, { type: 'building.construct', payload: { provinceId: pid, buildingId: bid } });
    s = r.state;
    expect(s.characters[id]!.gold).toBeLessThan(goldBefore);
    const done = s.provinces[pid]!.construction!.completeAt;
    const mutable = structuredClone(s);
    simulateDaysMutable(mutable, done - mutable.date);
    expect(mutable.provinces[pid]!.buildings[bid]).toBe(levelBefore + 1);
    expect(goldBefore - s.characters[id]!.gold).toBe(pick.o.cost);
    expect(mutable.provinces[pid]!.construction).toBeNull();
  });

  it('refuse une construction faute d’or', () => {
    const s = newState(8);
    const id = rulerId('Morcant');
    const pid = domainProvinceIds(s.characters[id]!)[0]!;
    try {
      runCommand(s, id, { type: 'building.construct', payload: { provinceId: pid, buildingId: 'chancery' } });
      expect.unreachable();
    } catch (e) {
      expect([ErrorCodes.INSUFFICIENT_GOLD, ErrorCodes.BUILDING_UNAVAILABLE]).toContain((e as GameError).code);
    }
  });
});

describe('Vues joueur', () => {
  it('ne divulgue ni la RNG ni les secrets d’autrui', () => {
    const s = newState(9);
    const velimir = rulerId('Velimir');
    const pub = publicView(s);
    expect('rng' in pub).toBe(false);
    expect(Object.keys(pub.secrets)).toHaveLength(0);
    const priv = privateViewFor(s, velimir);
    const own = Object.values(s.secrets).filter((x) => x.knownBy.includes(velimir) || x.ownerId === velimir);
    expect(Object.keys(priv.secrets).sort()).toEqual(own.map((x) => x.id).sort());
    const otherPriv = privateViewFor(s, rulerId('Aélis'));
    for (const sec of Object.values(otherPriv.secrets)) expect(sec.knownBy.includes(rulerId('Aélis')) || sec.ownerId === rulerId('Aélis') || sec.exposed).toBe(true);
  });

  it('filtre les patches privés', () => {
    const s = newState(10);
    const r = stepDay(s);
    const pub = publicPatches(r.patches, r.state);
    for (const p of pub) expect(['rng', 'secrets', 'schemes', 'hooks', 'activeEvents', 'scheduledEvents']).not.toContain(String(p.path[0]));
  });
});

describe('Royaume', () => {
  it('le royaume inclut les terres des vassaux', () => {
    const s = newState(11);
    const id = rulerId('Aurelan');
    const realm = realmProvinceIds(s, id);
    expect(realm.length).toBeGreaterThan(domainProvinceIds(s.characters[id]!).length);
    expect(rankOf(s.characters[id]!)).toBe(3);
  });

  it('chaque souverain recommandé est jouable', () => {
    for (const r of scenario.recommended) {
      const c = scenario.characters[r.characterId]!;
      expect(c.titleIds.length).toBeGreaterThan(0);
      expect(c.death).toBeNull();
    }
    expect(scenario.recommended.length).toBeGreaterThanOrEqual(8);
  });

  it('le contexte crée un PRNG lié à l’état', () => {
    const s = newState(12);
    const ctx = ctxFor(s);
    const before = [...s.rng];
    ctx.rng.next();
    expect(s.rng).not.toEqual(before);
  });
});
