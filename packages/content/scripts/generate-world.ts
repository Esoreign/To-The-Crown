/**
 * Générateur du continent de Caldria.
 *
 * Exécution : pnpm world:generate
 * Sortie stable : packages/content/data/world.json (versionnée).
 *
 * Étapes :
 *  1. champ d'élévation (bruit fractal + masses continentales autour des royaumes) ;
 *  2. découpe en ~180 comtés (Lloyd sur grille + déformation de domaine) ;
 *  3. extraction de frontières partagées, simplification puis lissage (une
 *     seule fois par arête → aucune fissure entre voisins) ;
 *  4. hiérarchie royaumes → duchés par croissance équilibrée sur le graphe ;
 *  5. terrain, rivières, décorations, toponymes.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNoise2D } from 'simplex-noise';
import type { Point, ProvinceGeo, River, TerrainFeature, TitleDef, WorldData, Terrain } from '@ttc/shared';
import { CULTURE_BY_ID } from '../src/cultures';
import { EMPIRE_DEFS, KINGDOM_DEFS, SEA_NAMES } from '../src/realm-defs';
import {
  chaikinClosed,
  chaikinOpen,
  mulberry32,
  polygonArea,
  polygonCentroid,
  polylineLength,
  round1,
  simplify,
} from './lib/geometry';

const SEED = 1087;
const W = 4000;
const H = 3000;
const CELL = 10;
const GW = W / CELL;
const GH = H / CELL;
const TARGET_COUNTIES = 180;
const WATER = -1;

const rand = mulberry32(SEED);
const noiseA = createNoise2D(mulberry32(SEED + 1));
const noiseB = createNoise2D(mulberry32(SEED + 2));
const noiseC = createNoise2D(mulberry32(SEED + 3));
const noiseWarpX = createNoise2D(mulberry32(SEED + 4));
const noiseWarpY = createNoise2D(mulberry32(SEED + 5));
const noiseMoist = createNoise2D(mulberry32(SEED + 6));

function fbm(n: (x: number, y: number) => number, x: number, y: number, oct: number, freq: number): number {
  let amp = 1;
  let f = freq;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * n(x * f, y * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

const idx = (x: number, y: number) => y * GW + x;

// ---------------------------------------------------------------------------
// 1. Élévation et masque de terres
// ---------------------------------------------------------------------------
const landField = new Float32Array(GW * GH);
const elevation = new Float32Array(GW * GH);
const moisture = new Float32Array(GW * GH);

const blobs = KINGDOM_DEFS.map((k) => ({ x: k.pos[0] * W, y: k.pos[1] * H, r: k.landRadius * W * 1.02 }));
// Îles de Myrrh, archipel oriental, île du Golfe.
const islandBlobs = [
  { x: 0.075 * W, y: 0.92 * H, r: 0.045 * W },
  { x: 0.2 * W, y: 0.93 * H, r: 0.035 * W },
  { x: 0.92 * W, y: 0.86 * H, r: 0.045 * W },
  { x: 0.52 * W, y: 0.66 * H, r: 0.03 * W },
];
// Mers intérieures et baies : Golfe d’Or (ouvert au sud), fjords, baies côtières.
const bays = [
  { x: 0.485 * W, y: 0.6 * H, r: 0.07 * W, s: 1.4 },
  { x: 0.475 * W, y: 0.72 * H, r: 0.045 * W, s: 1.4 },
  { x: 0.465 * W, y: 0.84 * H, r: 0.05 * W, s: 1.4 },
  { x: 0.455 * W, y: 0.97 * H, r: 0.07 * W, s: 1.4 },
  { x: 0.33 * W, y: 0.04 * H, r: 0.06 * W, s: 1.0 },
  { x: 0.61 * W, y: 0.03 * H, r: 0.05 * W, s: 1.0 },
  { x: 0.02 * W, y: 0.62 * H, r: 0.06 * W, s: 1.0 },
  { x: 0.8 * W, y: 0.95 * H, r: 0.07 * W, s: 1.0 },
  { x: 0.99 * W, y: 0.3 * H, r: 0.05 * W, s: 1.0 },
  { x: 0.25 * W, y: 0.31 * H, r: 0.022 * W, s: 0.9 },
  { x: 0.9 * W, y: 0.07 * H, r: 0.05 * W, s: 1.0 },
];

for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    const x = gx * CELL + CELL / 2;
    const y = gy * CELL + CELL / 2;
    let base = -0.6;
    for (const b of blobs) {
      const d = Math.hypot(x - b.x, (y - b.y) * 1.1) / b.r;
      base = Math.max(base, 0.7 * (1 - d * d * 0.75));
    }
    for (const b of islandBlobs) {
      const d = Math.hypot(x - b.x, y - b.y) / b.r;
      base = Math.max(base, 0.75 * (1 - d * d));
    }
    for (const g of bays) {
      const dg = Math.hypot(x - g.x, (y - g.y) * 1.2) / g.r;
      if (dg < 1.6) base -= g.s * Math.max(0, 1 - dg * dg * 0.4);
    }
    // Estompement vers les bords de la carte.
    const ex = Math.min(x, W - x) / (W * 0.05);
    const ey = Math.min(y, H - y) / (H * 0.06);
    const edge = Math.min(1, Math.min(ex, ey));
    const n = fbm(noiseA, x, y, 6, 1 / 1000) * 0.55 + fbm(noiseC, x, y, 3, 1 / 2400) * 0.45;
    const v = base * edge + n * 0.62 - (1 - edge) * 0.8 - 0.02;
    landField[idx(gx, gy)] = v;

    const ridge = 1 - Math.abs(fbm(noiseB, x, y, 4, 1 / 1400));
    const hills = fbm(noiseC, x, y, 4, 1 / 700);
    elevation[idx(gx, gy)] = Math.max(0, v) * 0.6 + Math.pow(ridge, 3) * 0.55 + hills * 0.15;
    moisture[idx(gx, gy)] = fbm(noiseMoist, x, y, 4, 1 / 1600) - (x / W) * 0.25 + (1 - y / H) * 0.1;
  }
}

const land = new Uint8Array(GW * GH);
for (let i = 0; i < land.length; i++) land[i] = landField[i]! > 0.02 ? 1 : 0;

/** Supprime les motifs en damier (connexions diagonales) qui compliquent le traçage. */
function fixDiagonals(grid: Int32Array | Uint8Array, fillValue: (a: number, b: number) => number): number {
  let changes = 0;
  for (let gy = 0; gy < GH - 1; gy++) {
    for (let gx = 0; gx < GW - 1; gx++) {
      const a = grid[idx(gx, gy)]!;
      const b = grid[idx(gx + 1, gy)]!;
      const c = grid[idx(gx, gy + 1)]!;
      const d = grid[idx(gx + 1, gy + 1)]!;
      if (a === d && b === c && a !== b) {
        grid[idx(gx + 1, gy)] = fillValue(a, b);
        changes++;
      }
    }
  }
  return changes;
}

function components(mask: (i: number) => boolean): number[][] {
  const seen = new Uint8Array(GW * GH);
  const out: number[][] = [];
  for (let i = 0; i < GW * GH; i++) {
    if (seen[i] || !mask(i)) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      const cx = c % GW;
      const cy = (c / GW) | 0;
      const nbs = [cx > 0 ? c - 1 : -1, cx < GW - 1 ? c + 1 : -1, cy > 0 ? c - GW : -1, cy < GH - 1 ? c + GW : -1];
      for (const nb of nbs) {
        if (nb >= 0 && !seen[nb] && mask(nb)) {
          seen[nb] = 1;
          stack.push(nb);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

// Frontière : pas de terre sur les bords.
for (let gx = 0; gx < GW; gx++) {
  land[idx(gx, 0)] = 0;
  land[idx(gx, GH - 1)] = 0;
}
for (let gy = 0; gy < GH; gy++) {
  land[idx(0, gy)] = 0;
  land[idx(GW - 1, gy)] = 0;
}
for (let pass = 0; pass < 4; pass++) fixDiagonals(land, () => 1);

// Supprime les îlots trop petits, comble les étendues d'eau intérieures.
const MIN_ISLAND = 320;
for (const comp of components((i) => land[i] === 1)) {
  if (comp.length < MIN_ISLAND) for (const c of comp) land[c] = 0;
}
const waterComps = components((i) => land[i] === 0);
const lakes: number[][] = [];
for (const comp of waterComps) {
  const touchesEdge = comp.some((c) => {
    const x = c % GW;
    const y = (c / GW) | 0;
    return x === 0 || y === 0 || x === GW - 1 || y === GH - 1;
  });
  if (!touchesEdge && comp.length < 1500) {
    if (comp.length >= 60 && comp.length <= 900 && lakes.length < 4) lakes.push(comp);
    for (const c of comp) land[c] = 1; // les lacs appartiennent aux comtés, rendus par-dessus
  }
}
for (let pass = 0; pass < 4; pass++) fixDiagonals(land, () => 1);

const landComps = components((i) => land[i] === 1).sort((a, b) => b.length - a.length);
const totalLand = landComps.reduce((s, c) => s + c.length, 0);
console.log(`Terres : ${totalLand} cellules, ${landComps.length} masses, ${lakes.length} lacs`);

// ---------------------------------------------------------------------------
// 2. Découpe en comtés
// ---------------------------------------------------------------------------
const compOf = new Int32Array(GW * GH).fill(-1);
landComps.forEach((comp, ci) => comp.forEach((c) => (compOf[c] = ci)));

// Répartition des germes par masse (plus fort reste).
const raw = landComps.map((c) => (c.length / totalLand) * TARGET_COUNTIES);
const counts = raw.map((r) => Math.max(1, Math.floor(r)));
let remaining = TARGET_COUNTIES - counts.reduce((a, b) => a + b, 0);
const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
for (let k = 0; remaining > 0; k = (k + 1) % order.length, remaining--) counts[order[k]!.i]!++;
while (counts.reduce((a, b) => a + b, 0) > TARGET_COUNTIES) {
  const i = counts.indexOf(Math.max(...counts));
  counts[i]!--;
}

interface Seed {
  x: number;
  y: number;
  comp: number;
}
const seeds: Seed[] = [];
landComps.forEach((comp, ci) => {
  const n = counts[ci]!;
  // Échantillonnage du point le plus éloigné pour un départ régulier.
  const chosen: number[] = [comp[Math.floor(rand() * comp.length)]!];
  while (chosen.length < n) {
    let best = -1;
    let bestD = -1;
    for (let s = 0; s < 400; s++) {
      const c = comp[Math.floor(rand() * comp.length)]!;
      const cx = c % GW;
      const cy = (c / GW) | 0;
      let dmin = Infinity;
      for (const o of chosen) {
        const d = (o % GW - cx) ** 2 + (((o / GW) | 0) - cy) ** 2;
        if (d < dmin) dmin = d;
      }
      if (dmin > bestD) {
        bestD = dmin;
        best = c;
      }
    }
    chosen.push(best);
  }
  for (const c of chosen) seeds.push({ x: c % GW, y: (c / GW) | 0, comp: ci });
});

const label = new Int32Array(GW * GH).fill(WATER);
const seedsByComp: number[][] = landComps.map(() => []);
seeds.forEach((s, i) => seedsByComp[s.comp]!.push(i));

function assign(warp: boolean): void {
  for (let i = 0; i < GW * GH; i++) {
    const ci = compOf[i]!;
    if (ci < 0) {
      label[i] = WATER;
      continue;
    }
    let x = i % GW;
    let y = (i / GW) | 0;
    if (warp) {
      x += noiseWarpX(x / 22, y / 22) * 4.5 + noiseWarpX(x / 7, y / 7) * 1.2;
      y += noiseWarpY(x / 22, y / 22) * 4.5 + noiseWarpY(x / 7, y / 7) * 1.2;
    }
    let best = -1;
    let bestD = Infinity;
    for (const si of seedsByComp[ci]!) {
      const s = seeds[si]!;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = si;
      }
    }
    label[i] = best;
  }
}

for (let it = 0; it < 12; it++) {
  assign(false);
  const sx = new Float64Array(seeds.length);
  const sy = new Float64Array(seeds.length);
  const sn = new Float64Array(seeds.length);
  for (let i = 0; i < GW * GH; i++) {
    const l = label[i]!;
    if (l < 0) continue;
    sx[l] = sx[l]! + (i % GW);
    sy[l] = sy[l]! + ((i / GW) | 0);
    sn[l] = sn[l]! + 1;
  }
  seeds.forEach((s, k) => {
    if (sn[k]! > 0) {
      s.x = sx[k]! / sn[k]!;
      s.y = sy[k]! / sn[k]!;
    }
  });
}
assign(true);

/** Chaque comté doit être connexe : les fragments sont réattribués aux voisins. */
function enforceConnectivity(): void {
  for (let pass = 0; pass < 10; pass++) {
    let orphans = 0;
    for (let r = 0; r < seeds.length; r++) {
      const comps = components((i) => label[i] === r).sort((a, b) => b.length - a.length);
      for (const frag of comps.slice(1)) {
        for (const c of frag) label[c] = -3;
        orphans += frag.length;
      }
    }
    let unresolved = true;
    while (unresolved) {
      unresolved = false;
      for (let i = 0; i < GW * GH; i++) {
        if (label[i] !== -3) continue;
        const cx = i % GW;
        const cy = (i / GW) | 0;
        const votes = new Map<number, number>();
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const l = label[idx(nx, ny)]!;
          if (l >= 0) votes.set(l, (votes.get(l) ?? 0) + 1);
        }
        if (votes.size === 0) {
          unresolved = true;
          continue;
        }
        label[i] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      }
    }
    const diag = fixDiagonals(label, (a) => a);
    if (orphans === 0 && diag === 0) break;
  }
}
enforceConnectivity();

// ---------------------------------------------------------------------------
// 3. Extraction des frontières
// ---------------------------------------------------------------------------
const CW = GW + 1;
const cornerId = (x: number, y: number) => y * CW + x;
const labelAt = (x: number, y: number) => (x < 0 || y < 0 || x >= GW || y >= GH ? WATER : label[idx(x, y)]!);

interface Seg {
  a: number; // corner
  b: number;
  l1: number;
  l2: number;
  used: boolean;
}
const segs: Seg[] = [];
const cornerSegs = new Map<number, number[]>();
function addSeg(c1: number, c2: number, l1: number, l2: number): void {
  const s: Seg = { a: c1, b: c2, l1: Math.min(l1, l2), l2: Math.max(l1, l2), used: false };
  const i = segs.push(s) - 1;
  for (const c of [c1, c2]) {
    const arr = cornerSegs.get(c);
    if (arr) arr.push(i);
    else cornerSegs.set(c, [i]);
  }
}
for (let y = 0; y <= GH; y++) {
  for (let x = 0; x < GW; x++) {
    const up = labelAt(x, y - 1);
    const down = labelAt(x, y);
    if (up !== down) addSeg(cornerId(x, y), cornerId(x + 1, y), up, down);
  }
}
for (let y = 0; y < GH; y++) {
  for (let x = 0; x <= GW; x++) {
    const left = labelAt(x - 1, y);
    const right = labelAt(x, y);
    if (left !== right) addSeg(cornerId(x, y), cornerId(x, y + 1), left, right);
  }
}

function isJunction(c: number): boolean {
  const x = c % CW;
  const y = (c / CW) | 0;
  const set = new Set([labelAt(x - 1, y - 1), labelAt(x, y - 1), labelAt(x - 1, y), labelAt(x, y)]);
  return set.size >= 3 || (cornerSegs.get(c)?.length ?? 0) !== 2;
}

interface Chain {
  l1: number;
  l2: number;
  corners: number[];
  closed: boolean;
}
const chains: Chain[] = [];

function walk(startCorner: number, segIdx: number): Chain {
  const first = segs[segIdx]!;
  const corners = [startCorner];
  let cur = startCorner;
  let si = segIdx;
  for (;;) {
    const s = segs[si]!;
    s.used = true;
    const next = s.a === cur ? s.b : s.a;
    corners.push(next);
    cur = next;
    if (isJunction(cur) || cur === startCorner) break;
    const cand = (cornerSegs.get(cur) ?? []).find((k) => !segs[k]!.used && segs[k]!.l1 === first.l1 && segs[k]!.l2 === first.l2);
    if (cand === undefined) break;
    si = cand;
  }
  return { l1: first.l1, l2: first.l2, corners, closed: cur === startCorner };
}

for (const [c, list] of cornerSegs) {
  if (!isJunction(c)) continue;
  for (const si of list) if (!segs[si]!.used) chains.push(walk(c, si));
}
for (let si = 0; si < segs.length; si++) {
  if (!segs[si]!.used) chains.push(walk(segs[si]!.a, si));
}

const cornerPoint = (c: number): Point => [(c % CW) * CELL, ((c / CW) | 0) * CELL];

interface SmoothChain extends Chain {
  points: Point[];
}
const smoothChains: SmoothChain[] = chains.map((ch) => {
  const pts = ch.corners.map(cornerPoint);
  let out: Point[];
  if (ch.closed) {
    const ring = pts.slice(0, -1);
    const simp = simplify([...ring, ring[0]!], CELL * 0.75).slice(0, -1);
    out = chaikinClosed(simp.length >= 3 ? simp : ring, 2);
    out.push(out[0]!);
  } else {
    out = chaikinOpen(simplify(pts, CELL * 0.75), 2);
  }
  return { ...ch, points: out.map(round1) };
});

function assembleRings(chainList: SmoothChain[], cornerKey: (ch: SmoothChain, end: 0 | 1) => number): Point[][] {
  const rings: Point[][] = [];
  const pool = chainList.filter((c) => !c.closed);
  for (const c of chainList) if (c.closed) rings.push(c.points.slice(0, -1));
  const used = new Set<SmoothChain>();
  for (const start of pool) {
    if (used.has(start)) continue;
    used.add(start);
    const ring: Point[] = start.points.slice();
    const startKey = cornerKey(start, 0);
    let endKey = cornerKey(start, 1);
    let guard = 0;
    while (endKey !== startKey && guard++ < 10000) {
      const next = pool.find((c) => !used.has(c) && (cornerKey(c, 0) === endKey || cornerKey(c, 1) === endKey));
      if (!next) break;
      used.add(next);
      if (cornerKey(next, 0) === endKey) {
        ring.push(...next.points.slice(1));
        endKey = cornerKey(next, 1);
      } else {
        ring.push(...next.points.slice(0, -1).reverse());
        endKey = cornerKey(next, 0);
      }
    }
    ring.pop();
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}
const chainEnd = (ch: SmoothChain, end: 0 | 1) => (end === 0 ? ch.corners[0]! : ch.corners[ch.corners.length - 1]!);

const regionRings: Point[][][] = seeds.map(() => []);
const chainsByRegion: SmoothChain[][] = seeds.map(() => []);
for (const ch of smoothChains) {
  if (ch.l1 >= 0) chainsByRegion[ch.l1]!.push(ch);
  if (ch.l2 >= 0) chainsByRegion[ch.l2]!.push(ch);
}
chainsByRegion.forEach((list, r) => (regionRings[r] = assembleRings(list, chainEnd)));

const coastChains = smoothChains.filter((c) => c.l1 === WATER);
const landmasses = assembleRings(coastChains, chainEnd).filter((r) => Math.abs(polygonArea(r)) > CELL * CELL * 30);

// Lacs : contours lissés extraits de leurs cellules.
const lakeRings: Point[][] = lakes.map((cells) => {
  const set = new Set(cells);
  const edges: [Point, Point][] = [];
  for (const c of cells) {
    const x = c % GW;
    const y = (c / GW) | 0;
    if (!set.has(c - GW)) edges.push([[x, y], [x + 1, y]]);
    if (!set.has(c + GW)) edges.push([[x + 1, y + 1], [x, y + 1]]);
    if (!set.has(c - 1)) edges.push([[x, y + 1], [x, y]]);
    if (!set.has(c + 1)) edges.push([[x + 1, y], [x + 1, y + 1]]);
  }
  const map = new Map<string, Point>();
  for (const [a, b] of edges) map.set(a.join(','), b);
  const start = edges[0]![0];
  const ring: Point[] = [start];
  let cur = map.get(start.join(','))!;
  let guard = 0;
  while (cur.join(',') !== start.join(',') && guard++ < 100000) {
    ring.push(cur);
    const nxt = map.get(cur.join(','));
    if (!nxt) break;
    cur = nxt;
  }
  const scaled = ring.map((p) => [p[0] * CELL, p[1] * CELL] as Point);
  const simp = simplify([...scaled, scaled[0]!], CELL * 0.8).slice(0, -1);
  return chaikinClosed(simp, 3).map(round1);
});

// ---------------------------------------------------------------------------
// Adjacence
// ---------------------------------------------------------------------------
const neighborSets = seeds.map(() => new Set<number>());
const sharedLen = new Map<string, number>();
for (const ch of smoothChains) {
  if (ch.l1 < 0 || ch.l2 < 0) continue;
  const k = `${ch.l1}|${ch.l2}`;
  sharedLen.set(k, (sharedLen.get(k) ?? 0) + polylineLength(ch.points));
}
for (const [k, len] of sharedLen) {
  if (len < CELL * 2.5) continue;
  const [a, b] = k.split('|').map(Number) as [number, number];
  neighborSets[a]!.add(b);
  neighborSets[b]!.add(a);
}
const coastal = seeds.map(() => false);
for (const ch of smoothChains) if (ch.l1 === WATER && ch.l2 >= 0) coastal[ch.l2] = true;

// Cellules par région, centres, distance au bord (pôle d'inaccessibilité).
const regionCells: number[][] = seeds.map(() => []);
for (let i = 0; i < GW * GH; i++) if (label[i]! >= 0) regionCells[label[i]!]!.push(i);

const distIn = new Float32Array(GW * GH).fill(0);
{
  const queue: number[] = [];
  for (let i = 0; i < GW * GH; i++) {
    const l = label[i]!;
    if (l < 0) continue;
    const x = i % GW;
    const y = (i / GW) | 0;
    const border =
      labelAt(x + 1, y) !== l || labelAt(x - 1, y) !== l || labelAt(x, y + 1) !== l || labelAt(x, y - 1) !== l;
    if (border) {
      distIn[i] = 1;
      queue.push(i);
    } else distIn[i] = Infinity;
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    const x = c % GW;
    const y = (c / GW) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = idx(nx, ny);
      if (label[n] === label[c] && distIn[n]! > distIn[c]! + 1) {
        distIn[n] = distIn[c]! + 1;
        queue.push(n);
      }
    }
  }
}

// Détroits : relie chaque masse isolée à la masse la plus proche.
const regionComp = seeds.map((s) => s.comp);
const straitPairs: [number, number][] = [];
{
  const compIds = [...new Set(regionComp)];
  const linked = new Set<number>([0]);
  const pending = compIds.filter((c) => c !== 0);
  while (pending.length) {
    let best: { a: number; b: number; d: number; comp: number } | null = null;
    for (const comp of pending) {
      for (let a = 0; a < seeds.length; a++) {
        if (regionComp[a] !== comp || !coastal[a]) continue;
        for (let b = 0; b < seeds.length; b++) {
          if (!linked.has(regionComp[b]!) || !coastal[b]) continue;
          const d = Math.hypot(seeds[a]!.x - seeds[b]!.x, seeds[a]!.y - seeds[b]!.y);
          if (!best || d < best.d) best = { a, b, d, comp };
        }
      }
    }
    if (!best) break;
    straitPairs.push([best.a, best.b]);
    linked.add(best.comp);
    pending.splice(pending.indexOf(best.comp), 1);
  }
}
const straitSets = seeds.map(() => new Set<number>());
for (const [a, b] of straitPairs) {
  straitSets[a]!.add(b);
  straitSets[b]!.add(a);
}
const allNeighbors = (r: number) => [...neighborSets[r]!, ...straitSets[r]!];

// ---------------------------------------------------------------------------
// 4. Hiérarchie : royaumes puis duchés
// ---------------------------------------------------------------------------
const regionCenter: Point[] = seeds.map((_, r) => {
  let best = regionCells[r]![0]!;
  for (const c of regionCells[r]!) if (distIn[c]! > distIn[best]!) best = c;
  return [(best % GW) * CELL + CELL / 2, ((best / GW) | 0) * CELL + CELL / 2];
});

function growGroups(
  members: number[],
  seedsIdx: number[],
  targets: number[],
  neighbors: (m: number) => number[],
  center: (m: number) => Point,
): Map<number, number> {
  const owner = new Map<number, number>();
  const size = seedsIdx.map(() => 1);
  seedsIdx.forEach((m, g) => owner.set(m, g));
  const memberSet = new Set(members);
  for (;;) {
    const candidates: { g: number; m: number; score: number }[] = [];
    for (let g = 0; g < seedsIdx.length; g++) {
      const sc = center(seedsIdx[g]!);
      const frontier = new Set<number>();
      for (const [m, og] of owner) {
        if (og !== g) continue;
        for (const n of neighbors(m)) if (memberSet.has(n) && !owner.has(n)) frontier.add(n);
      }
      for (const f of frontier) {
        const fc = center(f);
        const d = Math.hypot(fc[0] - sc[0], fc[1] - sc[1]);
        candidates.push({ g, m: f, score: size[g]! / targets[g]! + d / 4000 });
      }
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => a.score - b.score);
    const c = candidates[0]!;
    owner.set(c.m, c.g);
    size[c.g]!++;
  }
  // Membres non atteints (ne devrait pas arriver) : au groupe le plus proche.
  for (const m of members) {
    if (owner.has(m)) continue;
    const mc = center(m);
    let best = 0;
    let bestD = Infinity;
    seedsIdx.forEach((s, g) => {
      const sc = center(s);
      const d = Math.hypot(sc[0] - mc[0], sc[1] - mc[1]);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    });
    owner.set(m, best);
  }
  return owner;
}

const allRegions = seeds.map((_, i) => i);
const kingdomSeedRegions = KINGDOM_DEFS.map((k) => {
  const px = k.pos[0] * W;
  const py = k.pos[1] * H;
  let best = 0;
  let bestD = Infinity;
  for (const r of allRegions) {
    const c = regionCenter[r]!;
    const d = Math.hypot(c[0] - px, c[1] - py);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
});
const kingdomOf = growGroups(
  allRegions,
  kingdomSeedRegions,
  KINGDOM_DEFS.map((k) => k.weight),
  allNeighbors,
  (r) => regionCenter[r]!,
);

const duchyOfRegion = new Map<number, number>();
const duchyKingdom: number[] = [];
KINGDOM_DEFS.forEach((_, kg) => {
  const members = allRegions.filter((r) => kingdomOf.get(r) === kg);
  const nDuchies = Math.max(2, Math.round(members.length / 5));
  // Germes : point le plus éloigné.
  const dseeds = [members.reduce((a, b) => (regionCenter[a]![1] < regionCenter[b]![1] ? a : b))];
  while (dseeds.length < nDuchies) {
    let best = members[0]!;
    let bestD = -1;
    for (const m of members) {
      if (dseeds.includes(m)) continue;
      const mc = regionCenter[m]!;
      const d = Math.min(...dseeds.map((s) => Math.hypot(regionCenter[s]![0] - mc[0], regionCenter[s]![1] - mc[1])));
      if (d > bestD) {
        bestD = d;
        best = m;
      }
    }
    dseeds.push(best);
  }
  const owner = growGroups(
    members,
    dseeds,
    dseeds.map(() => members.length / nDuchies),
    allNeighbors,
    (r) => regionCenter[r]!,
  );
  const base = duchyKingdom.length;
  dseeds.forEach(() => duchyKingdom.push(kg));
  for (const [m, g] of owner) duchyOfRegion.set(m, base + g);
});

// ---------------------------------------------------------------------------
// 5. Terrain, cultures, confessions, noms
// ---------------------------------------------------------------------------
const regionElev = seeds.map((_, r) => {
  const cells = regionCells[r]!;
  return cells.reduce((s, c) => s + elevation[c]!, 0) / cells.length;
});
const regionMoist = seeds.map((_, r) => {
  const cells = regionCells[r]!;
  return cells.reduce((s, c) => s + moisture[c]!, 0) / cells.length;
});
const sortedElev = [...regionElev].sort((a, b) => b - a);
const mountainT = sortedElev[Math.floor(seeds.length * 0.1)]!;
const hillT = sortedElev[Math.floor(seeds.length * 0.26)]!;
const sortedMoist = [...regionMoist].sort((a, b) => b - a);
const forestT = sortedMoist[Math.floor(seeds.length * 0.22)]!;
const dryT = sortedMoist[Math.floor(seeds.length * 0.82)]!;

// Rivières : descente vers la mer via distance à la côte.
const distSea = new Int32Array(GW * GH).fill(-1);
{
  const q: number[] = [];
  for (let i = 0; i < GW * GH; i++) {
    if (label[i]! < 0) {
      distSea[i] = 0;
      q.push(i);
    }
  }
  for (let k = 0; k < q.length; k++) {
    const c = q[k]!;
    const x = c % GW;
    const y = (c / GW) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = idx(nx, ny);
      if (distSea[n]! < 0) {
        distSea[n] = distSea[c]! + 1;
        q.push(n);
      }
    }
  }
}
const riverCells = new Set<number>();
const rivers: River[] = [];
const riverRegions = new Set<number>();
{
  const candidates: number[] = [];
  for (let i = 0; i < GW * GH; i++) if (label[i]! >= 0 && distSea[i]! > 28 && elevation[i]! > 0.35) candidates.push(i);
  candidates.sort((a, b) => elevation[b]! + distSea[b]! * 0.004 - (elevation[a]! + distSea[a]! * 0.004));
  const sources: number[] = [];
  for (const c of candidates) {
    if (sources.length >= 14) break;
    const cx = c % GW;
    const cy = (c / GW) | 0;
    if (sources.every((s) => Math.hypot((s % GW) - cx, ((s / GW) | 0) - cy) > 38)) sources.push(c);
  }
  const riverNamesPool = [
    'Aurèle', 'Vanne', 'Sombre-Eau', 'Ysel', 'Brume', 'Kaldå', 'Ormée', 'Sarre d’Or', 'Veltava', 'Lethe', 'Marelle',
    'Dunore', 'Serpentine', 'Argentine',
  ];
  // Potentiel d'écoulement lissé puis « priority-flood » : toute cellule a un
  // voisin strictement plus bas → les rivières atteignent toujours la mer.
  const potential = new Float32Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) {
    const x = i % GW;
    const y = (i / GW) | 0;
    potential[i] = distSea[i]! * 0.35 + elevation[i]! * 10 + noiseA(x / 30, y / 30) * 3.5 + noiseB(x / 11, y / 11) * 1.1;
  }
  const filled = new Float32Array(GW * GH).fill(Infinity);
  const heap: number[] = [];
  const push = (i: number) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (filled[heap[parent]!]! <= filled[heap[k]!]!) break;
      [heap[parent], heap[k]] = [heap[k]!, heap[parent]!];
      k = parent;
    }
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && filled[heap[l]!]! < filled[heap[m]!]!) m = l;
        if (r < heap.length && filled[heap[r]!]! < filled[heap[m]!]!) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k]!, heap[m]!];
        k = m;
      }
    }
    return top;
  };
  for (let i = 0; i < GW * GH; i++) {
    if (label[i]! < 0) {
      filled[i] = -1;
      push(i);
    }
  }
  while (heap.length) {
    const c = pop();
    const x = c % GW;
    const y = (c / GW) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = idx(nx, ny);
      if (filled[n] !== Infinity) continue;
      filled[n] = Math.max(potential[n]!, filled[c]! + 0.001);
      push(n);
    }
  }
  sources.forEach((src, ri) => {
    const path: number[] = [src];
    let cur = src;
    let joined = false;
    for (let step = 0; step < 1200; step++) {
      const x = cur % GW;
      const y = (cur / GW) | 0;
      let best = -1;
      let bestV = filled[cur]!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const n = idx(nx, ny);
        if (filled[n]! < bestV) {
          bestV = filled[n]!;
          best = n;
        }
      }
      if (best < 0) break;
      path.push(best);
      cur = best;
      if (label[cur]! < 0) break;
      if (riverCells.has(cur)) {
        joined = true;
        break;
      }
    }
    if (path.length < 25) return;
    for (const c of path) {
      riverCells.add(c);
      if (label[c]! >= 0) riverRegions.add(label[c]!);
    }
    const pts = path.map((c) => [(c % GW) * CELL + CELL / 2, ((c / GW) | 0) * CELL + CELL / 2] as Point);
    const smooth = chaikinOpen(simplify(pts, CELL * 1.5), 3).map(round1);
    rivers.push({ id: `river_${ri}`, name: riverNamesPool[ri % riverNamesPool.length], points: smooth, width: joined ? 3 : 5 });
  });
}

function terrainFor(r: number): Terrain {
  const e = regionElev[r]!;
  const m = regionMoist[r]!;
  const kg = kingdomOf.get(r)!;
  const culture = KINGDOM_DEFS[kg]!.cultureId;
  if (e >= mountainT) return 'mountains';
  if (e >= hillT) return 'hills';
  if (culture === 'kharzul' && m < forestT) return 'steppe';
  if (m <= dryT && (culture === 'sarrhan' || culture === 'kharzul')) return 'steppe';
  if (coastal[r] && m > forestT * 0.6 && (culture === 'myrrhain' || regionElev[r]! < 0.18)) return 'marsh';
  if (m >= forestT) return 'forest';
  if (riverRegions.has(r)) return 'farmlands';
  return 'plains';
}
const terrains = seeds.map((_, r) => terrainFor(r));
// Limite le nombre de marais.
{
  const marsh = allRegions.filter((r) => terrains[r] === 'marsh');
  marsh.slice(9).forEach((r) => (terrains[r] = 'plains'));
}

// Noms de lieux.
const usedNames = new Set<string>();
function placeName(cultureId: string): string {
  const syl = CULTURE_BY_ID[cultureId]!.placeSyllables;
  for (let attempt = 0; attempt < 200; attempt++) {
    const s = syl.start[Math.floor(rand() * syl.start.length)]!;
    const m = rand() < 0.45 ? syl.mid[Math.floor(rand() * syl.mid.length)]! : '';
    const e = syl.end[Math.floor(rand() * syl.end.length)]!;
    let name = s + m + e;
    name = name.replace(/(.)\1\1/g, '$1$1');
    name = name.charAt(0).toUpperCase() + name.slice(1);
    if (name.length < 4 || name.length > 13 || usedNames.has(name)) continue;
    usedNames.add(name);
    return name;
  }
  throw new Error(`Impossible de générer un nom pour ${cultureId}`);
}
for (const k of KINGDOM_DEFS) usedNames.add(k.name);

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Culture et confession par comté (royaume + mélange aux frontières).
const regionCulture: string[] = [];
const regionFaith: string[] = [];
for (const r of allRegions) {
  const kd = KINGDOM_DEFS[kingdomOf.get(r)!]!;
  regionCulture[r] = kd.cultureId;
  regionFaith[r] = kd.faithId;
}
for (const r of allRegions) {
  const kg = kingdomOf.get(r)!;
  const foreign = allNeighbors(r).filter((n) => kingdomOf.get(n) !== kg);
  if (foreign.length && rand() < 0.18) {
    const n = foreign[Math.floor(rand() * foreign.length)]!;
    regionCulture[r] = KINGDOM_DEFS[kingdomOf.get(n)!]!.cultureId;
  }
  const kd = KINGDOM_DEFS[kg]!;
  if (kd.minorityFaithId && rand() < 0.2) regionFaith[r] = kd.minorityFaithId;
}

// ---------------------------------------------------------------------------
// Assemblage des titres et provinces
// ---------------------------------------------------------------------------
function jitterColor(c: [number, number, number], amount: number): [number, number, number] {
  const f = 1 + (rand() * 2 - 1) * amount;
  const shift = (rand() * 2 - 1) * amount * 40;
  return c.map((v) => Math.max(20, Math.min(235, Math.round(v * f + shift)))) as [number, number, number];
}

const titles: TitleDef[] = [];
for (const e of EMPIRE_DEFS) {
  titles.push({
    id: e.id,
    name: e.name,
    rank: 'empire',
    color: e.color,
    coaSeed: Math.floor(rand() * 1e9),
    deJureParentId: null,
    capitalProvinceId: '',
    successionLaw: e.law,
    adjective: e.adjective,
  });
}
KINGDOM_DEFS.forEach((k) => {
  titles.push({
    id: k.id,
    name: k.name,
    rank: 'kingdom',
    color: k.color,
    coaSeed: Math.floor(rand() * 1e9),
    deJureParentId: k.empireId,
    capitalProvinceId: '',
    successionLaw: k.law,
    adjective: k.adjective,
  });
});

const provinceIdOf = (r: number) => `p${String(r).padStart(3, '0')}`;
const duchyIds: string[] = [];
const duchyColors: [number, number, number][] = [];
duchyKingdom.forEach((kg, d) => {
  const k = KINGDOM_DEFS[kg]!;
  const members = allRegions.filter((r) => duchyOfRegion.get(r) === d);
  const cultureCounts = new Map<string, number>();
  for (const m of members) cultureCounts.set(regionCulture[m]!, (cultureCounts.get(regionCulture[m]!) ?? 0) + 1);
  const culture = [...cultureCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const name = placeName(culture);
  const id = `d_${slug(name)}`;
  duchyIds.push(id);
  const color = jitterColor(k.color, 0.14);
  duchyColors.push(color);
  titles.push({
    id,
    name,
    rank: 'duchy',
    color,
    coaSeed: Math.floor(rand() * 1e9),
    deJureParentId: k.id,
    capitalProvinceId: '',
    successionLaw: CULTURE_BY_ID[culture]!.succession === 'elective' ? 'elective' : k.law,
  });
});

const provinces: ProvinceGeo[] = [];
const countyIdOf: string[] = [];
for (const r of allRegions) {
  const culture = regionCulture[r]!;
  const name = placeName(culture);
  countyIdOf[r] = `c_${slug(name)}`;
}

for (const r of allRegions) {
  const rings = regionRings[r]!.map((ring) => ({ ring, area: Math.abs(polygonArea(ring)) })).sort((a, b) => b.area - a.area);
  if (!rings.length) throw new Error(`Région ${r} sans contour`);
  const outer = rings[0]!.ring;
  const holes = rings.slice(1).map((x) => x.ring);
  const kg = kingdomOf.get(r)!;
  const d = duchyOfRegion.get(r)!;
  const kd = KINGDOM_DEFS[kg]!;
  const terrain = terrains[r]!;
  const cells = regionCells[r]!;
  // Axe principal pour l'orientation du label.
  let mx = 0;
  let my = 0;
  for (const c of cells) {
    mx += c % GW;
    my += (c / GW) | 0;
  }
  mx /= cells.length;
  my /= cells.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const c of cells) {
    const dx = (c % GW) - mx;
    const dy = ((c / GW) | 0) - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  let angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  angle = Math.max(-0.6, Math.min(0.6, angle));
  let bestCell = cells[0]!;
  for (const c of cells) if (distIn[c]! > distIn[bestCell]!) bestCell = c;
  const maxD = distIn[bestCell]!;
  const labelAt: Point = [(bestCell % GW) * CELL + CELL / 2, ((bestCell / GW) | 0) * CELL + CELL / 2];

  const terrainDev: Record<Terrain, number> = {
    farmlands: 14, plains: 10, hills: 7, forest: 5, marsh: 3, mountains: 2, steppe: 4, coast_cliffs: 6,
  };
  const dev = Math.round(terrainDev[terrain] + rand() * 12 + (coastal[r] ? 3 : 0) + (kd.cultureId === 'caldrien' ? 5 : 0));
  const levies = Math.round(120 + dev * 9 + rand() * 80 + (terrain === 'mountains' ? -40 : 0));
  const tax = Math.round((0.6 + dev * 0.045 + rand() * 0.3 + (coastal[r] ? 0.15 : 0)) * 100) / 100;
  const polyCentroid = polygonCentroid(outer);

  provinces.push({
    id: provinceIdOf(r),
    name: '', // rempli ci-dessous (nom du comté)
    polygon: outer,
    ...(holes.length ? { holes } : {}),
    centroid: round1(polyCentroid),
    capital: round1(labelAt),
    label: { at: round1(labelAt), angle: Math.round(angle * 100) / 100, size: Math.round(Math.min(34, 10 + maxD * 1.6)) },
    area: Math.round(Math.abs(polygonArea(outer))),
    neighbors: [...neighborSets[r]!].sort((a, b) => a - b).map(provinceIdOf),
    straits: [...straitSets[r]!].sort((a, b) => a - b).map(provinceIdOf),
    terrain,
    coastal: coastal[r]!,
    cultureId: regionCulture[r]!,
    faithId: regionFaith[r]!,
    countyTitleId: countyIdOf[r]!,
    duchyTitleId: duchyIds[d]!,
    kingdomTitleId: kd.id,
    empireTitleId: kd.empireId,
    baseDevelopment: Math.min(45, dev),
    baseControl: 85 + Math.round(rand() * 15),
    baseFort: terrain === 'mountains' || terrain === 'hills' ? 2 : 1,
    baseLevies: Math.max(80, levies),
    baseTax: tax,
    buildingSlots: terrain === 'mountains' || terrain === 'marsh' ? 3 : terrain === 'farmlands' ? 5 : 4,
    elevation: Math.round(regionElev[r]! * 100) / 100,
    ...(regionComp[r] !== 0 ? { isIsland: true } : {}),
  });
}

// Les noms lisibles ont été générés avant la slugification : on les recrée.
{
  const readable = new Map<string, string>();
  for (const n of usedNames) readable.set(slug(n), n);
  for (const r of allRegions) {
    const p = provinces[r]!;
    const cid = countyIdOf[r]!;
    p.name = readable.get(cid.slice(2)) ?? cid.slice(2);
    const d = duchyOfRegion.get(r)!;
    titles.push({
      id: cid,
      name: p.name,
      rank: 'county',
      color: jitterColor(duchyColors[d]!, 0.06),
      coaSeed: Math.floor(rand() * 1e9),
      deJureParentId: duchyIds[d]!,
      capitalProvinceId: p.id,
      provinceId: p.id,
      successionLaw: 'partition',
    });
  }
}

// Capitales de titres : comté le plus développé proche du centre.
function pickCapital(members: ProvinceGeo[]): string {
  const cx = members.reduce((s, p) => s + p.centroid[0], 0) / members.length;
  const cy = members.reduce((s, p) => s + p.centroid[1], 0) / members.length;
  return members
    .map((p) => ({ p, score: p.baseDevelopment * 12 - Math.hypot(p.centroid[0] - cx, p.centroid[1] - cy) * 0.08 }))
    .sort((a, b) => b.score - a.score)[0]!.p.id;
}
for (const t of titles) {
  if (t.rank === 'county') continue;
  const members = provinces.filter((p) =>
    t.rank === 'duchy' ? p.duchyTitleId === t.id : t.rank === 'kingdom' ? p.kingdomTitleId === t.id : p.empireTitleId === t.id,
  );
  t.capitalProvinceId = pickCapital(members);
}
// Les capitales sont des centres développés.
for (const t of titles) {
  if (t.rank === 'county') continue;
  const p = provinces.find((x) => x.id === t.capitalProvinceId)!;
  const bonus = t.rank === 'empire' ? 6 : t.rank === 'kingdom' ? 8 : 4;
  p.baseDevelopment = Math.min(50, p.baseDevelopment + bonus);
  p.baseFort = Math.min(4, p.baseFort + (t.rank === 'duchy' ? 1 : 1));
}

// ---------------------------------------------------------------------------
// Décorations de terrain
// ---------------------------------------------------------------------------
const features: TerrainFeature[] = [];
{
  const occupied: Point[] = [];
  const minDist = (kind: TerrainFeature['kind']) => (kind === 'mountain' ? 34 : kind === 'tree' ? 16 : 26);
  const tryPlace = (kind: TerrainFeature['kind'], at: Point, scale: number): void => {
    const md = minDist(kind);
    for (const o of occupied) if (Math.abs(o[0] - at[0]) < md && Math.abs(o[1] - at[1]) < md) return;
    for (const p of provinces) {
      if (Math.hypot(p.label.at[0] - at[0], p.label.at[1] - at[1]) < p.label.size * 2.2) return;
    }
    occupied.push(at);
    features.push({ kind, at: round1(at), scale: Math.round(scale * 100) / 100, variant: Math.floor(rand() * 4) });
  };
  for (let i = 0; i < GW * GH; i += 1) {
    const l = label[i]!;
    if (l < 0) continue;
    if (distIn[i]! < 2) continue;
    const x = (i % GW) * CELL + rand() * CELL;
    const y = ((i / GW) | 0) * CELL + rand() * CELL;
    const e = elevation[i]!;
    const t = terrains[l]!;
    if (e > mountainT * 1.02 && rand() < 0.09) tryPlace('mountain', [x, y], 0.8 + (e - mountainT) * 2 + rand() * 0.3);
    else if (t === 'mountains' && rand() < 0.04) tryPlace('mountain', [x, y], 0.7 + rand() * 0.3);
    else if (t === 'hills' && rand() < 0.035) tryPlace('hill', [x, y], 0.8 + rand() * 0.4);
    else if (t === 'forest' && rand() < 0.1) tryPlace('tree', [x, y], 0.8 + rand() * 0.4);
    else if (moisture[i]! > forestT * 0.9 && t !== 'steppe' && rand() < 0.012) tryPlace('tree', [x, y], 0.7 + rand() * 0.3);
    else if (t === 'marsh' && rand() < 0.05) tryPlace('marsh', [x, y], 1);
    else if (t === 'farmlands' && rand() < 0.02) tryPlace('wheat', [x, y], 1);
    else if (t === 'steppe' && rand() < 0.015) tryPlace('dune', [x, y], 1);
  }
}

// ---------------------------------------------------------------------------
// Frontières pour le rendu
// ---------------------------------------------------------------------------
const borders = smoothChains
  .filter((ch) => ch.l2 >= 0)
  .map((ch) => ({
    a: provinceIdOf(ch.l1 < 0 ? ch.l2 : ch.l1),
    b: ch.l1 < 0 ? null : provinceIdOf(ch.l2),
    points: ch.points,
  }));

const world: WorldData = {
  version: 1,
  seed: SEED,
  width: W,
  height: H,
  landmasses: landmasses.map((r) => r.map(round1)),
  lakes: lakeRings,
  provinces,
  titles,
  rivers,
  features,
  seas: SEA_NAMES.map((s) => ({ name: s.name, at: [s.pos[0] * W, s.pos[1] * H], angle: 0, size: s.size })),
  borders,
};

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../data/world.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(world));
const sizes = KINGDOM_DEFS.map((k) => `${k.name}:${provinces.filter((p) => p.kingdomTitleId === k.id).length}`).join(' ');
console.log(
  `Monde écrit : ${provinces.length} comtés, ${duchyIds.length} duchés, ${KINGDOM_DEFS.length} royaumes, ${rivers.length} rivières, ${features.length} décors`,
);
console.log(`Royaumes : ${sizes}`);
console.log(`Détroits : ${straitPairs.length}, îles : ${provinces.filter((p) => p.isIsland).length}`);
