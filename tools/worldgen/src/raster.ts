/**
 * Outils raster : grille équirectangulaire de travail, rasterisation de
 * polygones (règle pair-impair par ligne de balayage), lecture/écriture
 * binaire des grilles intermédiaires.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { GRID, WORK } from './paths';

export const W = GRID.width;
export const H = GRID.height;

export function lonToX(lon: number): number {
  return (lon + 180) / GRID.res;
}
export function latToY(lat: number): number {
  return (GRID.north - lat) / GRID.res;
}
export function xToLon(x: number): number {
  return x * GRID.res - 180;
}
export function yToLat(y: number): number {
  return GRID.north - y * GRID.res;
}
/** Centre de cellule. */
export function cellLon(x: number): number {
  return xToLon(x + 0.5);
}
export function cellLat(y: number): number {
  return yToLat(y + 0.5);
}

export function readGeo(file: string): FeatureCollection {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as FeatureCollection;
}

export function polygonsOf(f: Feature): Position[][][] {
  const g = f.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [(g as Polygon).coordinates];
  if (g.type === 'MultiPolygon') return (g as MultiPolygon).coordinates;
  return [];
}

/**
 * Rasterise un polygone (anneaux extérieur + trous) : `set(x, y)` est appelé
 * pour chaque cellule dont le centre est à l'intérieur.
 * Retourne le nombre de cellules marquées.
 */
export function rasterizePolygon(rings: Position[][], set: (x: number, y: number) => void): number {
  let minY = Infinity;
  let maxY = -Infinity;
  const edges: [number, number, number, number][] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]!;
      const b = ring[i + 1]!;
      const ax = lonToX(a[0]!);
      const ay = latToY(a[1]!);
      const bx = lonToX(b[0]!);
      const by = latToY(b[1]!);
      if (ay === by) continue;
      edges.push([ax, ay, bx, by]);
      minY = Math.min(minY, ay, by);
      maxY = Math.max(maxY, ay, by);
    }
  }
  if (!edges.length) return 0;
  const y0 = Math.max(0, Math.floor(minY - 0.5));
  const y1 = Math.min(H - 1, Math.ceil(maxY + 0.5));
  // Arêtes triées par ymin pour un balayage efficace.
  const sorted = edges.map(([ax, ay, bx, by]) =>
    ay < by
      ? { y0: ay, y1: by, x0: ax, dx: (bx - ax) / (by - ay) }
      : { y0: by, y1: ay, x0: bx, dx: (ax - bx) / (ay - by) },
  );
  sorted.sort((p, q) => p.y0 - q.y0);
  let next = 0;
  let active: typeof sorted = [];
  const xs: number[] = [];
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    while (next < sorted.length && sorted[next]!.y0 <= cy) active.push(sorted[next++]!);
    active = active.filter((e) => e.y1 > cy);
    xs.length = 0;
    for (const e of active) if (e.y0 <= cy) xs.push(e.x0 + (cy - e.y0) * e.dx);
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.max(0, Math.ceil(xs[i]! - 0.5));
      const xb = Math.min(W - 1, Math.floor(xs[i + 1]! - 0.5));
      for (let x = xa; x <= xb; x++) {
        set(x, y);
        count++;
      }
    }
  }
  return count;
}

/** Point représentatif grossier (centre de la bbox de l'anneau extérieur). */
export function ringCenter(ring: Position[]): [number, number] {
  let a = Infinity;
  let b = -Infinity;
  let c = Infinity;
  let d = -Infinity;
  for (const p of ring) {
    a = Math.min(a, p[0]!);
    b = Math.max(b, p[0]!);
    c = Math.min(c, p[1]!);
    d = Math.max(d, p[1]!);
  }
  return [(a + b) / 2, (c + d) / 2];
}

export function saveGrid(name: string, data: ArrayBufferView): void {
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(
    path.join(WORK, `${name}.bin`),
    Buffer.from(data.buffer, data.byteOffset, data.byteLength),
  );
}

export function loadGridI16(name: string): Int16Array {
  const b = fs.readFileSync(path.join(WORK, `${name}.bin`));
  return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
}
export function loadGridU8(name: string): Uint8Array {
  const b = fs.readFileSync(path.join(WORK, `${name}.bin`));
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}
export function loadGridI32(name: string): Int32Array {
  const b = fs.readFileSync(path.join(WORK, `${name}.bin`));
  return new Int32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}

/** Distance approximative en km entre deux points (lon/lat en degrés). */
export function kmBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const r = Math.PI / 180;
  let dl = Math.abs(lon1 - lon2);
  if (dl > 180) dl = 360 - dl;
  const x = dl * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat1 - lat2) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}
export function loadGridF32(name: string): Float32Array {
  const b = fs.readFileSync(path.join(WORK, `${name}.bin`));
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
