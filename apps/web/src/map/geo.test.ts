import { describe, expect, it } from 'vitest';
import {
  boundsCenter,
  boundsWidth,
  fitFeatureSafely,
  getWrappedBounds,
  inverseMercator,
  mercator,
  mergeBounds,
  nearestLongitude,
  normalizeLongitude,
  unwrapBounds,
  unwrapGeometry,
} from './geo';

describe('longitudes et antiméridien', () => {
  it('normalise dans [-180, 180)', () => {
    expect(normalizeLongitude(190)).toBe(-170);
    expect(normalizeLongitude(-190)).toBe(170);
    expect(normalizeLongitude(540)).toBe(-180);
    expect(normalizeLongitude(12.5)).toBe(12.5);
  });

  it('choisit la longitude équivalente la plus proche', () => {
    expect(nearestLongitude(-179, 179)).toBe(181);
    expect(nearestLongitude(179, -179)).toBe(-181);
  });

  it('déroule un tracé qui traverse la ligne de changement de date', () => {
    const line = unwrapGeometry([[178, 60], [-179, 61], [-176, 62]]);
    expect(line.map(([l]) => l)).toEqual([178, 181, 184]);
  });

  it('calcule une emprise étroite pour un territoire à cheval sur l’antiméridien (Tchoukotka, Fidji)', () => {
    const b = getWrappedBounds([[172, 64], [179.5, 66], [-178, 65], [-170, 66]])!;
    expect(b[0]).toBe(172);
    expect(b[2]).toBe(-170);
    expect(boundsWidth(b)).toBeCloseTo(18);
    expect(unwrapBounds(b)[2]).toBe(190);
    expect(Math.abs(boundsCenter(b)[0])).toBeGreaterThan(170);
  });

  it('garde une emprise classique hors antiméridien', () => {
    expect(getWrappedBounds([[-5, 40], [8, 51]])).toEqual([-5, 40, 8, 51]);
  });

  it('fusionne des emprises de part et d’autre de 180°', () => {
    const m = mergeBounds([[170, -20, 179, -15], [-179, -19, -175, -16]])!;
    expect(boundsWidth(m)).toBeLessThan(20);
  });

  it('borne le cadrage d’une très petite île', () => {
    const f = fitFeatureSafely([-175.2, -21.2, -175.1, -21.1]);
    expect(f[2] - f[0]).toBeGreaterThanOrEqual(2.5);
  });

  it('projette et inverse Mercator', () => {
    const [x, y] = mercator([2.35, 48.86]);
    const [lon, lat] = inverseMercator(x, y);
    expect(lon).toBeCloseTo(2.35, 6);
    expect(lat).toBeCloseTo(48.86, 6);
    expect(mercator([0, 0])).toEqual([0.5, 0.5]);
  });
});
