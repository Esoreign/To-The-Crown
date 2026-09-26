/** Petites opérations géométriques (planaires, en degrés). */
import type { Position } from 'geojson';

/** Douglas–Peucker itératif. */
export function simplifyDP(points: Position[], tol: number): Position[] {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const pa = points[a]!;
    const pb = points[b]!;
    const dx = pb[0]! - pa[0]!;
    const dy = pb[1]! - pa[1]!;
    const len2 = dx * dx + dy * dy || 1e-18;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i]!;
      const t = Math.max(0, Math.min(1, ((p[0]! - pa[0]!) * dx + (p[1]! - pa[1]!) * dy) / len2));
      const ex = pa[0]! + t * dx - p[0]!;
      const ey = pa[1]! + t * dy - p[1]!;
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Lissage de Chaikin (extrémités conservées). */
export function chaikin(points: Position[], iterations = 1): Position[] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    if (pts.length < 3) return pts;
    const out: Position[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      out.push([0.75 * a[0]! + 0.25 * b[0]!, 0.75 * a[1]! + 0.25 * b[1]!]);
      out.push([0.25 * a[0]! + 0.75 * b[0]!, 0.25 * a[1]! + 0.75 * b[1]!]);
    }
    out.push(pts[pts.length - 1]!);
    pts = out;
  }
  return pts;
}

/** Découpe d'un anneau par un rectangle (Sutherland–Hodgman). */
export function clipRing(
  ring: Position[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Position[] {
  let pts = ring;
  const edges: [(p: Position) => boolean, (a: Position, b: Position) => Position][] = [
    [(p) => p[0]! >= minX, (a, b) => [minX, a[1]! + ((b[1]! - a[1]!) * (minX - a[0]!)) / (b[0]! - a[0]!)]],
    [(p) => p[0]! <= maxX, (a, b) => [maxX, a[1]! + ((b[1]! - a[1]!) * (maxX - a[0]!)) / (b[0]! - a[0]!)]],
    [(p) => p[1]! >= minY, (a, b) => [a[0]! + ((b[0]! - a[0]!) * (minY - a[1]!)) / (b[1]! - a[1]!), minY]],
    [(p) => p[1]! <= maxY, (a, b) => [a[0]! + ((b[0]! - a[0]!) * (maxY - a[1]!)) / (b[1]! - a[1]!), maxY]],
  ];
  for (const [inside, cut] of edges) {
    if (!pts.length) return pts;
    const out: Position[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i]!;
      const prev = pts[(i - 1 + pts.length) % pts.length]!;
      const ci = inside(cur);
      const pi = inside(prev);
      if (ci) {
        if (!pi) out.push(cut(prev, cur));
        out.push(cur);
      } else if (pi) out.push(cut(prev, cur));
    }
    pts = out;
  }
  if (pts.length && (pts[0]![0] !== pts[pts.length - 1]![0] || pts[0]![1] !== pts[pts.length - 1]![1]))
    pts.push(pts[0]!);
  return pts.length >= 4 ? pts : [];
}

export function ringArea(ring: Position[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    s += (ring[j]![0]! - ring[i]![0]!) * (ring[j]![1]! + ring[i]![1]!);
  return s / 2;
}

export function round(p: Position, d = 4): Position {
  const f = 10 ** d;
  return [Math.round(p[0]! * f) / f, Math.round(p[1]! * f) / f];
}
