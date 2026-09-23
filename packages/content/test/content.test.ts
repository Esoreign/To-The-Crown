import { describe, expect, it } from 'vitest';
import { CONTENT, WORLD, getScenario, validateContent, validateWorld } from '../src/index';

describe('Monde de Caldria', () => {
  it('est structurellement valide', () => {
    expect(validateWorld(WORLD)).toEqual([]);
  });

  it('respecte les ordres de grandeur demandés', () => {
    const ranks = (r: string) => WORLD.titles.filter((t) => t.rank === r).length;
    expect(WORLD.provinces.length).toBe(180);
    expect(ranks('duchy')).toBeGreaterThanOrEqual(30);
    expect(ranks('kingdom')).toBe(10);
    expect(ranks('empire')).toBe(3);
    expect(new Set(WORLD.provinces.map((p) => p.cultureId)).size).toBe(8);
    expect(new Set(WORLD.provinces.map((p) => p.faithId)).size).toBe(6);
  });
});

describe('Contenu', () => {
  it('est valide (traits, bâtiments, événements)', () => {
    expect(validateContent(CONTENT)).toEqual([]);
    expect(CONTENT.traits.length).toBeGreaterThanOrEqual(30);
    expect(CONTENT.buildings.length).toBeGreaterThanOrEqual(15);
  });
});

describe('Scénario de 1087', () => {
  const s = getScenario('couronne_brisee');
  it('possède environ 500+ personnages vivants et 12 maisons majeures', () => {
    const alive = Object.values(s.characters).filter((c) => c.death === null);
    expect(alive.length).toBeGreaterThan(450);
    expect(Object.values(s.houses).filter((h) => h.isMajor).length).toBe(12);
  });

  it('attribue chaque comté à un détenteur vivant', () => {
    for (const t of WORLD.titles.filter((x) => x.rank === 'county')) {
      const holder = s.titles[t.id]!.holderId;
      expect(holder, t.id).toBeTruthy();
      expect(s.characters[holder!]!.death).toBeNull();
    }
  });

  it('propose au moins 8 souverains recommandés documentés', () => {
    expect(s.recommended.length).toBeGreaterThanOrEqual(8);
    for (const r of s.recommended) {
      expect(r.description.length).toBeGreaterThan(40);
      expect(r.problems.length).toBeGreaterThan(0);
    }
  });
});
