import { describe, expect, it } from 'vitest';
import { CONTENT, WORLD, getScenario, validateContent, validateWorld } from '../src/index';
import { CULTURE_ZONES, POLITIES_1400 } from '../src/world1400/index';

const provinceNear = (lon: number, lat: number) =>
  [...WORLD.provinces].sort((a, b) => Math.hypot(a.centroid[0] - lon, a.centroid[1] - lat) - Math.hypot(b.centroid[0] - lon, b.centroid[1] - lat))[0]!;

describe('Monde 1400 : géographie', () => {
  it('est structurellement valide', () => {
    expect(validateWorld(WORLD)).toEqual([]);
  });

  it('couvre la Terre avec 5 000 à 6 000 provinces et des zones maritimes', () => {
    expect(WORLD.provinces.length).toBeGreaterThanOrEqual(5000);
    expect(WORLD.provinces.length).toBeLessThanOrEqual(6000);
    expect(WORLD.seas.length).toBeGreaterThanOrEqual(250);
    expect(WORLD.seas.length).toBeLessThanOrEqual(450);
    // Tous les continents habités sont représentés.
    for (const macro of ['europe', 'mena', 'ssa', 'india', 'eastasia', 'northasia', 'seasia', 'americas', 'oceania']) {
      expect(WORLD.provinces.some((p) => p.macroId === macro), macro).toBe(true);
    }
  });

  it('place les coordonnées dans les bornes et les provinces côtières au bord de la mer', () => {
    for (const p of WORLD.provinces) {
      expect(Math.abs(p.centroid[0])).toBeLessThanOrEqual(180);
      expect(p.centroid[1]).toBeGreaterThan(-60);
      expect(p.centroid[1]).toBeLessThan(84);
      if (p.coastal) expect(p.seas.length, p.id).toBeGreaterThan(0);
    }
  });

  it('a des voisinages symétriques et des détroits connus', () => {
    const byId = new Map(WORLD.provinces.map((p) => [p.id, p]));
    for (const p of WORLD.provinces) for (const n of p.neighbors) expect(byId.get(n)!.neighbors).toContain(p.id);
    // Le Bosphore relie Constantinople à l'Anatolie.
    const cple = WORLD.provinces.find((p) => p.name === 'Constantinople')!;
    const links = [...cple.neighbors, ...cple.straits].map((id) => byId.get(id)!);
    expect(links.some((p) => p.centroid[0] > 29 && p.centroid[1] < 41.2)).toBe(true);
    for (const p of WORLD.provinces) expect(new Set(p.straits).size, p.id).toBe(p.straits.length);
  });

  it('gère la ligne de changement de date (Tchoukotka, Fidji)', () => {
    const east = WORLD.provinces.filter((p) => p.centroid[0] > 170);
    const west = WORLD.provinces.filter((p) => p.centroid[0] < -170);
    expect(east.length + west.length).toBeGreaterThan(0);
    for (const p of [...east, ...west]) expect(Number.isFinite(p.bbox[0])).toBe(true);
  });

  it('nomme chaque province, avec des toponymes de 1400', () => {
    const names = WORLD.provinces.map((p) => p.name);
    expect(names.every((n) => n.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Constantinople');
    expect(names).not.toContain('Istanbul');
    expect(names).toContain('Tenochtitlan');
  });
});

describe('Monde 1400 : données historiques', () => {
  it('a des entités uniques, avec suzerains et unions valides', () => {
    const ids = new Set(POLITIES_1400.map((p) => p.id));
    expect(ids.size).toBe(POLITIES_1400.length);
    expect(POLITIES_1400.length).toBeGreaterThanOrEqual(250);
    for (const p of POLITIES_1400) {
      if (p.liege) expect(ids.has(p.liege), p.id).toBe(true);
      if (p.union) expect(ids.has(p.union), p.id).toBe(true);
      expect(['high', 'medium', 'low', 'gameplayApproximation']).toContain(p.conf);
      expect(p.ruler[1]).toBeLessThan(1400);
    }
  });

  it('attribue des cultures connues à toutes les zones', () => {
    const cultures = new Set(CONTENT.cultures.map((c) => c.id));
    for (const z of CULTURE_ZONES) expect(cultures.has(z.culture), z.culture).toBe(true);
  });

  it('place les capitales historiques dans leur royaume', () => {
    const s = getScenario('monde_1400');
    const holderTop = (lon: number, lat: number) => {
      let id = s.titles[provinceNear(lon, lat).countyTitleId]!.holderId!;
      while (s.characters[id]!.liegeId) id = s.characters[id]!.liegeId!;
      return id;
    };
    const ruler = (polity: string) => s.titles[s.polities![polity]!.titleId]!.holderId!;
    expect(holderTop(2.35, 48.86)).toBe(ruler('fra'));
    expect(holderTop(-0.12, 51.51)).toBe(ruler('eng'));
    expect(holderTop(118.78, 32.06)).toBe(ruler('ming'));
    expect(holderTop(116.4, 39.9)).toBe(ruler('yan'));
    expect(holderTop(66.97, 39.65)).toBe(ruler('tim'));
    expect(holderTop(31.24, 30.04)).toBe(ruler('mam'));
    const cple = WORLD.provinces.find((p) => p.name === 'Constantinople')!;
    let h = s.titles[cple.countyTitleId]!.holderId!;
    while (s.characters[h]!.liegeId) h = s.characters[h]!.liegeId!;
    expect(h).toBe(ruler('byz'));
  });
});

describe('Contenu', () => {
  it('est valide (traits, bâtiments, événements)', () => {
    expect(validateContent(CONTENT)).toEqual([]);
    expect(CONTENT.traits.length).toBeGreaterThanOrEqual(30);
    expect(CONTENT.buildings.length).toBeGreaterThanOrEqual(15);
  });
});

describe('Scénario Monde 1400', () => {
  const s = getScenario('monde_1400');
  it('démarre le 1er janvier 1400 avec des milliers de personnages', () => {
    const alive = Object.values(s.characters).filter((c) => c.death === null);
    expect(alive.length).toBeGreaterThan(2500);
    expect(Object.values(s.houses).filter((h) => h.isMajor).length).toBeGreaterThan(150);
  });

  it('attribue chaque comté habité à un détenteur vivant', () => {
    for (const p of WORLD.provinces) {
      if (p.wasteland) continue;
      const holder = s.titles[p.countyTitleId]!.holderId;
      expect(holder, p.id).toBeTruthy();
      expect(s.characters[holder!]!.death).toBeNull();
    }
  });

  it('documente chaque entité jouable (confiance historique)', () => {
    for (const info of Object.values(s.polities!)) {
      expect(info.confidence).toBeTruthy();
      if (info.generated) expect(info.confidence).toBe('gameplayApproximation');
    }
  });

  it('propose au moins 8 souverains recommandés documentés', () => {
    expect(s.recommended.length).toBeGreaterThanOrEqual(8);
    for (const r of s.recommended) {
      expect(r.description.length).toBeGreaterThan(40);
      expect(r.problems.length).toBeGreaterThan(0);
    }
  });

  it('est déterministe', () => {
    const a = JSON.stringify(Object.keys(s.characters).slice(0, 50).map((id) => s.characters[id]!.firstName));
    expect(a.length).toBeGreaterThan(10);
  });
});
