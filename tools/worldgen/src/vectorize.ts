/**
 * Vectorisation d'une grille d'étiquettes en polygones à frontières
 * partagées : chaque arête de cellule séparant deux étiquettes devient un
 * segment orienté ; les segments sont chaînés en anneaux. Les frontières
 * voisines ont donc exactement les mêmes sommets (topologie propre).
 * La grille n'est pas bouclée en longitude : une province à cheval sur ±180°
 * produit deux parties (découpage à l'antiméridien).
 */
import type { MultiPolygon, Position } from 'geojson';
import { GRID } from './paths';
import { H, W } from './raster';

type Ring = number[]; // sommets encodés vy * (W + 1) + vx

function vx(v: number): number {
  return v % (W + 1);
}
function vy(v: number): number {
  return Math.floor(v / (W + 1));
}

/**
 * Anneaux de toutes les étiquettes > 0 : Map étiquette → anneaux.
 * Orientation : sens horaire à l'écran (y vers le bas) pour l'extérieur,
 * soit anti-horaire en lon/lat (conforme RFC 7946).
 */
export function traceLabels(label: Int32Array): Map<number, Ring[]> {
  // Arêtes orientées regroupées par étiquette : départ → liste d'arrivées.
  const edges = new Map<number, Map<number, number[]>>();
  const add = (l: number, a: number, b: number) => {
    let m = edges.get(l);
    if (!m) edges.set(l, (m = new Map()));
    const list = m.get(a);
    if (list) list.push(b);
    else m.set(a, [b]);
  };
  const V = (x: number, y: number) => y * (W + 1) + x;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = label[y * W + x]!;
      if (!l) continue;
      const up = y > 0 ? label[(y - 1) * W + x]! : 0;
      const down = y < H - 1 ? label[(y + 1) * W + x]! : 0;
      const left = x > 0 ? label[y * W + x - 1]! : 0;
      const right = x < W - 1 ? label[y * W + x + 1]! : 0;
      if (up !== l) add(l, V(x, y), V(x + 1, y));
      if (right !== l) add(l, V(x + 1, y), V(x + 1, y + 1));
      if (down !== l) add(l, V(x + 1, y + 1), V(x, y + 1));
      if (left !== l) add(l, V(x, y + 1), V(x, y));
    }
  }
  const out = new Map<number, Ring[]>();
  for (const [l, m] of edges) {
    const rings: Ring[] = [];
    for (const [start, list] of m) {
      while (list.length) {
        const ring: Ring = [start];
        let prev = start;
        let cur = list.pop()!;
        let guard = 0;
        while (cur !== start && guard++ < 10_000_000) {
          ring.push(cur);
          const nexts = m.get(cur)!;
          let pick = 0;
          if (nexts.length > 1) {
            // Point de pincement : on tourne à droite (à l'écran) pour séparer les anneaux.
            const dx = vx(cur) - vx(prev);
            const dy = vy(cur) - vy(prev);
            let best = -Infinity;
            for (let i = 0; i < nexts.length; i++) {
              const ex = vx(nexts[i]!) - vx(cur);
              const ey = vy(nexts[i]!) - vy(cur);
              const cross = dx * ey - dy * ex; // > 0 : virage à droite (y vers le bas)
              const score = cross > 0 ? 2 : cross === 0 ? 1 : 0;
              if (score > best) {
                best = score;
                pick = i;
              }
            }
          }
          const nxt = nexts.splice(pick, 1)[0]!;
          prev = cur;
          cur = nxt;
        }
        rings.push(simplifyCollinear(ring));
      }
    }
    out.set(l, rings);
  }
  return out;
}

function simplifyCollinear(ring: Ring): Ring {
  const n = ring.length;
  if (n < 4) return ring;
  const out: Ring = [];
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n]!;
    const b = ring[i]!;
    const c = ring[(i + 1) % n]!;
    const collinear = (vx(b) - vx(a)) * (vy(c) - vy(b)) - (vy(b) - vy(a)) * (vx(c) - vx(b)) === 0;
    if (!collinear) out.push(b);
  }
  return out.length >= 3 ? out : ring;
}

export function vertexLonLat(v: number): [number, number] {
  return [+(vx(v) * GRID.res - 180).toFixed(4), +(GRID.north - vy(v) * GRID.res).toFixed(4)];
}

function signedArea(ring: Position[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j]![0]! - ring[i]![0]!) * (ring[j]![1]! + ring[i]![1]!);
  return s / 2;
}

function pointInRing(p: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    if (yi > p[1]! !== yj > p[1]! && p[0]! < ((xj - xi) * (p[1]! - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Anneaux (encodés) → MultiPolygon GeoJSON (extérieurs anti-horaires, trous rattachés). */
export function ringsToMultiPolygon(rings: Ring[]): MultiPolygon {
  const polys: Position[][][] = [];
  const holes: Position[][] = [];
  for (const r of rings) {
    // Tracé horaire en lon/lat : on inverse pour obtenir des extérieurs anti-horaires.
    const coords: Position[] = r.map(vertexLonLat).reverse();
    coords.push(coords[0]!);
    // Aire signée > 0 en lon/lat ⇒ anti-horaire.
    if (signedArea(coords) > 0) polys.push([coords]);
    else holes.push(coords);
  }
  for (const h of holes) {
    const owner = polys.find((p) => pointInRing(h[0]!, p[0]!));
    if (owner) owner.push(h);
  }
  return { type: 'MultiPolygon', coordinates: polys };
}
