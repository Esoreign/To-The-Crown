/**
 * Étape 3 — découpage de la Terre en provinces de jeu et en zones maritimes.
 *
 * 1. Poids de peuplement par cellule (lieux habités Natural Earth pour
 *    l'Ancien Monde, foyers historiques ailleurs, fleuves, altitude, climat).
 * 2. Graines : échantillonnage systématique pondéré le long d'une courbe de
 *    Hilbert, par macro-région (budgets de `regions.ts`), puis relaxation de
 *    Lloyd pondérée (3 passes).
 * 3. Remplissage Dijkstra multi-sources sur les terres : le coût croît avec
 *    la pente et au franchissement des grands fleuves, si bien que les
 *    frontières suivent crêtes et rivières.
 * 4. Îles : une graine par île notable ; les îlots rejoignent la province la
 *    plus proche par la mer.
 * 5. Zones maritimes : même procédé sur l'eau, plus denses près des côtes.
 * 6. Adjacences : terre, détroits (≤ 40 km d'eau), mer.
 * Sortie : .cache/worldgen/provinces.bin (étiquettes) + provinces.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MinHeap } from './heap';
import { classifyBiomes, climate, B, BIOMES } from './biome';
import { NE_DIR, WORK } from './paths';
import { H, W, cellLat, cellLon, kmBetween, latToY, loadGridI16, loadGridU8, lonToX, readGeo, saveGrid } from './raster';
import { HISTORIC_HOTSPOTS, MACRO_TARGETS, REGION_DENSITY, REGIONS, macroRegion, regionOf, type MacroRegion } from './regions';

const MACROS = Object.keys(MACRO_TARGETS) as MacroRegion[];
const N = W * H;
const RES_KM = 0.05 * 111.2;
const cosLat = new Float64Array(H);
for (let y = 0; y < H; y++) cosLat[y] = Math.max(0.05, Math.cos((cellLat(y) * Math.PI) / 180));

function hilbert(x: number, y: number, order = 13): number {
  let d = 0;
  for (let s = 1 << (order - 1); s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      const t = x;
      x = y;
      y = t;
    }
  }
  return d;
}

/** Voisins 8-connexes avec bouclage en longitude. */
function neighbors8(k: number, out: Int32Array): number {
  const y = (k / W) | 0;
  const x = k - y * W;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= H) continue;
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      out[n++] = yy * W + ((x + dx + W) % W);
    }
  }
  return n;
}

function stepKm(a: number, b: number): number {
  const ya = (a / W) | 0;
  const yb = (b / W) | 0;
  const dx = (a - ya * W) !== (b - yb * W) ? 1 : 0;
  const dy = ya !== yb ? 1 : 0;
  const kx = dx * RES_KM * cosLat[(ya + yb) >> 1]!;
  const ky = dy * RES_KM;
  return Math.sqrt(kx * kx + ky * ky);
}

interface Grids {
  land: Uint8Array;
  elev: Int16Array;
  rivers: Uint8Array;
}

/**
 * Dijkstra multi-sources : `label[k]` = indice de graine (≥ 1). `allowed(k)`
 * limite l'expansion ; `costFn(a, b)` donne le coût d'un pas.
 */
function flood(seeds: Int32Array, allowed: (k: number) => boolean, costFn: (a: number, b: number) => number): Int32Array {
  const label = new Int32Array(N);
  const dist = new Float32Array(N).fill(Infinity);
  const heap = new MinHeap(1 << 22);
  for (let i = 0; i < seeds.length; i++) {
    const k = seeds[i]!;
    dist[k] = 0;
    label[k] = i + 1;
    heap.push(0, k);
  }
  const nb = new Int32Array(8);
  while (heap.size) {
    const k = heap.pop();
    const d = heap.lastKey;
    if (d > dist[k]!) continue;
    const n = neighbors8(k, nb);
    for (let i = 0; i < n; i++) {
      const j = nb[i]!;
      if (!allowed(j)) continue;
      const nd = d + costFn(k, j);
      if (nd < dist[j]!) {
        dist[j] = nd;
        label[j] = label[k]!;
        heap.push(nd, j);
      }
    }
  }
  return label;
}

function terrainCost(g: Grids): (a: number, b: number) => number {
  return (a, b) => {
    const km = stepKm(a, b);
    const slope = Math.abs(g.elev[b]! - g.elev[a]!) / Math.max(1, km);
    let c = km * (1 + slope / 22);
    if (g.rivers[b]! >= 150 && g.rivers[a]! < 150) c += km * 4;
    return c;
  };
}

/** Composantes connexes (8-connexes) d'un masque. */
function components(mask: (k: number) => boolean): { comp: Int32Array; sizes: number[] } {
  const comp = new Int32Array(N);
  const sizes: number[] = [0];
  const stack = new Int32Array(N);
  const nb = new Int32Array(8);
  let id = 0;
  for (let k = 0; k < N; k++) {
    if (!mask(k) || comp[k]) continue;
    id++;
    let size = 0;
    let top = 0;
    stack[top++] = k;
    comp[k] = id;
    while (top) {
      const c = stack[--top]!;
      size++;
      const n = neighbors8(c, nb);
      for (let i = 0; i < n; i++) {
        const j = nb[i]!;
        if (!comp[j] && mask(j)) {
          comp[j] = id;
          stack[top++] = j;
        }
      }
    }
    sizes.push(size);
  }
  return { comp, sizes };
}

function dilate(src: Uint8Array, r: number): Uint8Array {
  let cur = src;
  for (let i = 0; i < r; i++) {
    const next = new Uint8Array(cur);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        const v = Math.max(cur[k - 1] ?? 0, cur[k + 1] ?? 0, cur[k - W]!, cur[k + W]!);
        if (v > next[k]!) next[k] = Math.max(0, v - 20);
      }
    }
    cur = next;
  }
  return cur;
}

// ---------------------------------------------------------------------------

function computeWeights(g: Grids, macro: Uint8Array): Float32Array {
  const w = new Float32Array(N);
  const riverBand = dilate(g.rivers, 2);
  // Lieux habités : noyau gaussien (Ancien Monde seulement : les villes
  // modernes des Amériques ou de l'Océanie ne disent rien de 1400).
  const places = readGeo(path.join(NE_DIR, 'ne_10m_populated_places_simple.geojson')).features;
  const boost = new Float32Array(N);
  const oldWorld = new Set<MacroRegion>(['europe', 'mena', 'india', 'eastasia', 'seasia']);
  for (const f of places) {
    const [lon, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
    if (!oldWorld.has(macroRegion(lon, lat))) continue;
    const pop = Number((f.properties as { pop_max?: number }).pop_max ?? 0);
    const s = Math.min(2.5, Math.max(0.25, Math.log10(Math.max(1, pop)) - 3.8));
    const cx = lonToX(lon);
    const cy = latToY(lat);
    const rCells = 22;
    for (let dy = -rCells; dy <= rCells; dy++) {
      const y = Math.floor(cy + dy);
      if (y < 0 || y >= H) continue;
      for (let dx = -rCells; dx <= rCells; dx++) {
        const x = ((Math.floor(cx + dx) % W) + W) % W;
        const dkm = Math.sqrt((dx * cosLat[y]!) ** 2 + dy * dy) * RES_KM;
        boost[y * W + x]! += s * Math.exp(-((dkm / 55) ** 2));
      }
    }
  }
  for (const [lon, lat, rKm, s] of HISTORIC_HOTSPOTS) {
    const cx = lonToX(lon);
    const cy = latToY(lat);
    const r = Math.ceil(rKm / RES_KM / Math.max(0.3, Math.cos((lat * Math.PI) / 180)));
    for (let dy = -r; dy <= r; dy++) {
      const y = Math.floor(cy + dy);
      if (y < 0 || y >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = ((Math.floor(cx + dx) % W) + W) % W;
        const dkm = kmBetween(lon, lat, cellLon(x), cellLat(y));
        if (dkm < rKm) boost[y * W + x]! += s * (1 - dkm / rKm);
      }
    }
  }
  // Densité régionale : évaluée sur une grille grossière (0,5°) pour rester rapide.
  const regionMul = new Float32Array(720 * 288).fill(1);
  for (let ry = 0; ry < 288; ry++) {
    for (let rx = 0; rx < 720; rx++) {
      const lon = rx * 0.5 - 180 + 0.25;
      const lat = 84 - ry * 0.5 - 0.25;
      regionMul[ry * 720 + rx] = REGION_DENSITY[regionOf(lon, lat).id] ?? 1;
    }
  }
  void REGIONS;
  for (let y = 0; y < H; y++) {
    const alat = Math.abs(cellLat(y));
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (g.land[k] !== 1) continue;
      const e = g.elev[k]!;
      let v = regionMul[Math.min(287, (y / 10) | 0) * 720 + ((x / 10) | 0)]!;
      if (alat > 66) v *= 0.12;
      else if (alat > 60) v *= 0.3;
      else if (alat > 55) v *= 0.6;
      if (e > 4000) v *= 0.15;
      else if (e > 2500) v *= 0.4;
      else if (e > 1500) v *= 0.75;
      if (riverBand[k]! > 60) v *= 1 + riverBand[k]! / 200;
      v *= 1 + boost[k]!;
      w[k] = v;
    }
  }
  void macro;
  return w;
}

function main(): void {
  const g: Grids = { land: loadGridU8('land'), elev: loadGridI16('elevation'), rivers: loadGridU8('rivers') };
  const deserts = loadGridU8('deserts');
  console.time('macro-régions');
  const macro = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.land[y * W + x] === 1) macro[y * W + x] = MACROS.indexOf(macroRegion(cellLon(x), cellLat(y))) + 1;
  console.timeEnd('macro-régions');
  console.time('poids');
  let weight = computeWeights(g, macro);
  const fields = climate(g.land, g.elev, deserts);
  saveGrid('temp', fields.temp);
  saveGrid('moist', fields.moist);
  const biome = classifyBiomes(g.land, g.elev, deserts, dilate(g.rivers, 1), weight, fields);
  // Les déserts et glaces pèsent peu (après classification).
  for (let k = 0; k < N; k++) {
    const b = biome[k]!;
    if (b === B.desert) weight[k]! *= 0.06;
    else if (b === B.ice) weight[k]! *= 0.03;
    else if (b === B.tundra) weight[k]! *= 0.4;
    else if (b === B.jungle) weight[k]! *= 0.6;
  }
  saveGrid('biome', biome);
  console.timeEnd('poids');

  // --- Graines par macro-région -------------------------------------------
  console.time('graines');
  const seedList: number[] = [];
  for (let m = 0; m < MACROS.length; m++) {
    const cells: number[] = [];
    for (let k = 0; k < N; k++) if (macro[k] === m + 1) cells.push(k);
    const keys = new Float64Array(cells.length);
    for (let i = 0; i < cells.length; i++) {
      const k = cells[i]!;
      const y = (k / W) | 0;
      keys[i] = hilbert(k - y * W, y);
    }
    const order = Array.from(cells.keys()).sort((a, b) => keys[a]! - keys[b]!);
    let total = 0;
    for (const i of order) total += weight[cells[i]!]!;
    const target = MACRO_TARGETS[MACROS[m]!];
    const step = total / target;
    let acc = 0;
    let nextAt = step / 2;
    for (const i of order) {
      acc += weight[cells[i]!]!;
      while (acc >= nextAt && seedList.length < 1e6) {
        seedList.push(cells[i]!);
        nextAt += step;
      }
    }
  }
  let seeds = Int32Array.from(new Set(seedList));
  console.timeEnd('graines');
  console.log('graines initiales', seeds.length);

  const landOnly = (k: number) => g.land[k] === 1;
  const cost = terrainCost(g);
  const { comp, sizes } = components(landOnly);

  // --- Relaxation de Lloyd pondérée ---------------------------------------
  for (let it = 0; it < 3; it++) {
    console.time(`lloyd ${it}`);
    const label = flood(seeds, landOnly, cost);
    const sx = new Float64Array(seeds.length + 1);
    const sy = new Float64Array(seeds.length + 1);
    const sw = new Float64Array(seeds.length + 1);
    for (let k = 0; k < N; k++) {
      const l = label[k]!;
      if (!l) continue;
      const s = seeds[l - 1]!;
      const syy = (s / W) | 0;
      const sxx = s - syy * W;
      const y = (k / W) | 0;
      let dx = k - y * W - sxx;
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      const w = weight[k]! + 0.05;
      sx[l]! += dx * w;
      sy[l]! += (y - syy) * w;
      sw[l]! += w;
    }
    const best = new Int32Array(seeds.length + 1).fill(-1);
    const bestD = new Float64Array(seeds.length + 1).fill(Infinity);
    for (let k = 0; k < N; k++) {
      const l = label[k]!;
      if (!l) continue;
      const s = seeds[l - 1]!;
      const syy = (s / W) | 0;
      const sxx = s - syy * W;
      const cx = sxx + sx[l]! / sw[l]!;
      const cy = syy + sy[l]! / sw[l]!;
      const y = (k / W) | 0;
      let dx = k - y * W - cx;
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      const d = (dx * cosLat[y]!) ** 2 + (y - cy) ** 2;
      if (d < bestD[l]!) {
        bestD[l] = d;
        best[l] = k;
      }
    }
    seeds = Int32Array.from(seeds.map((s, i) => (best[i + 1]! >= 0 ? best[i + 1]! : s)));
    seeds = Int32Array.from(new Set(seeds));
    console.timeEnd(`lloyd ${it}`);
  }

  // --- Îles sans graine ----------------------------------------------------
  const seeded = new Set<number>();
  for (const s of seeds) seeded.add(comp[s]!);
  const extra: number[] = [];
  // Distance (km) à la côte d'une autre île semée : estimée par le centre de l'île.
  const compCenter = new Map<number, [number, number, number]>();
  for (let k = 0; k < N; k++) {
    const c = comp[k]!;
    if (!c || seeded.has(c)) continue;
    const y = (k / W) | 0;
    const e = compCenter.get(c) ?? [0, 0, 0];
    e[0] += k - y * W;
    e[1] += y;
    e[2]++;
    compCenter.set(c, e);
  }
  const seedPts = Array.from(seeds, (s) => [cellLon(s % W), cellLat((s / W) | 0)] as [number, number]);
  for (const [c, [sx, sy, n]] of compCenter) {
    const size = sizes[c]!;
    if (size < 3) continue;
    const lon = cellLon(sx / n);
    const lat = cellLat(sy / n);
    let nearest = Infinity;
    for (const [plon, plat] of seedPts) {
      if (Math.abs(plat - lat) > 6) continue;
      nearest = Math.min(nearest, kmBetween(lon, lat, plon, plat));
    }
    const arctic = Math.abs(lat) > 58;
    const notable = arctic ? size >= 1500 : size >= 200 || (size >= 55 && nearest > 60) || nearest > 220 || (size >= 8 && nearest > 110);
    if (notable) {
      // Graine : cellule de l'île la plus proche du centre.
      let bestK = -1;
      let bestD = Infinity;
      for (let k = 0; k < N; k++) {
        if (comp[k] !== c) continue;
        const y = (k / W) | 0;
        const d = (k - y * W - sx / n) ** 2 + (y - sy / n) ** 2;
        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }
      if (bestK >= 0) extra.push(bestK);
    }
  }
  seeds = Int32Array.from([...seeds, ...extra]);
  console.log('graines insulaires ajoutées', extra.length, '— total', seeds.length);

  // --- Remplissage final ---------------------------------------------------
  console.time('remplissage');
  let label = flood(seeds, landOnly, cost);
  // Îlots restants : rattachés à la province la plus proche par la mer.
  {
    const lbl = label;
    const land = g.land;
    const seedsWater = new Int32Array(N);
    const dist = new Float32Array(N).fill(Infinity);
    const heap = new MinHeap(1 << 22);
    for (let k = 0; k < N; k++)
      if (lbl[k]) {
        dist[k] = 0;
        seedsWater[k] = lbl[k]!;
        heap.push(0, k);
      }
    const nb = new Int32Array(8);
    while (heap.size) {
      const k = heap.pop();
      const d = heap.lastKey;
      if (d > dist[k]! || d > 900) continue;
      const n = neighbors8(k, nb);
      for (let i = 0; i < n; i++) {
        const j = nb[i]!;
        const nd = d + stepKm(k, j);
        if (nd < dist[j]!) {
          dist[j] = nd;
          seedsWater[j] = seedsWater[k]!;
          heap.push(nd, j);
        }
      }
    }
    let orphan = 0;
    for (let k = 0; k < N; k++)
      if (land[k] === 1 && !lbl[k]) {
        lbl[k] = seedsWater[k]!;
        orphan++;
      }
    console.log('cellules d’îlots rattachées', orphan);
  }
  console.timeEnd('remplissage');

  // --- Fusion des provinces minuscules -------------------------------------
  const P = seeds.length;
  const count = new Int32Array(P + 1);
  for (let k = 0; k < N; k++) count[label[k]!]!++;
  const remap = new Int32Array(P + 1).map((_, i) => i);
  const nb = new Int32Array(8);
  for (let k = 0; k < N; k++) {
    const l = label[k]!;
    if (!l || count[l]! >= 4) continue;
    const n = neighbors8(k, nb);
    for (let i = 0; i < n; i++) {
      const m = label[nb[i]!]!;
      if (m && m !== l && count[m]! >= 4) {
        remap[l] = m;
        break;
      }
    }
  }
  // Renumérotation compacte (1..P').
  const compact = new Int32Array(P + 1);
  let next = 0;
  for (let l = 1; l <= P; l++) {
    const r = remap[l]!;
    if (r === l && count[l]! > 0) compact[l] = ++next;
  }
  for (let l = 1; l <= P; l++) if (remap[l] !== l) compact[l] = compact[remap[l]!]!;
  for (let k = 0; k < N; k++) if (label[k]) label[k] = compact[label[k]!]!;
  const PROV = next;
  console.log('provinces', PROV);

  // --- Zones maritimes ------------------------------------------------------
  console.time('mers');
  const water = (k: number) => g.land[k] === 0;
  // Distance à la terre (BFS en cellules, plafonnée).
  const coastDist = new Uint16Array(N).fill(65535);
  {
    const q = new Int32Array(N);
    let h = 0;
    let t = 0;
    for (let k = 0; k < N; k++)
      if (g.land[k] === 1) {
        coastDist[k] = 0;
        q[t++] = k;
      }
    while (h < t) {
      const k = q[h++]!;
      const d = coastDist[k]!;
      if (d > 400) continue;
      const n = neighbors8(k, nb);
      for (let i = 0; i < n; i++) {
        const j = nb[i]!;
        if (coastDist[j]! > d + 1) {
          coastDist[j] = d + 1;
          q[t++] = j;
        }
      }
    }
  }
  const seaCells: number[] = [];
  for (let k = 0; k < N; k++) if (water(k)) seaCells.push(k);
  const seaW = (k: number) => {
    const d = coastDist[k]!;
    return (d < 30 ? 6 : d < 80 ? 1.5 : 0.25) * cosLat[(k / W) | 0]!;
  };
  seaCells.sort((a, b) => hilbert(a % W, (a / W) | 0) - hilbert(b % W, (b / W) | 0));
  let totalW = 0;
  for (const k of seaCells) totalW += seaW(k);
  const SEA_TARGET = 360;
  const seaSeeds: number[] = [];
  {
    const step = totalW / SEA_TARGET;
    let acc = 0;
    let at = step / 2;
    for (const k of seaCells) {
      acc += seaW(k);
      if (acc >= at) {
        seaSeeds.push(k);
        at += step;
      }
    }
  }
  // Chaque étendue d'eau fermée notable (Caspienne, mer d'Aral…) a au moins une zone.
  const { comp: wcomp, sizes: wsizes } = components(water);
  const wSeeded = new Set(seaSeeds.map((k) => wcomp[k]!));
  for (let k = 0; k < N; k++) {
    const c = wcomp[k]!;
    if (c && !wSeeded.has(c) && wsizes[c]! > 400) {
      seaSeeds.push(k);
      wSeeded.add(c);
    }
  }
  const seaLabel = flood(Int32Array.from(seaSeeds), water, (a, b) => stepKm(a, b));
  const SEAS = seaSeeds.length;
  console.timeEnd('mers');
  console.log('zones maritimes', SEAS);

  // --- Attributs et adjacences --------------------------------------------
  console.time('attributs');
  interface Acc {
    cells: number;
    areaKm2: number;
    sx: number;
    sy: number;
    ref: number;
    elev: number;
    wsum: number;
    biomes: number[];
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
    coastal: boolean;
    macro: number[];
  }
  const acc: Acc[] = Array.from({ length: PROV + 1 }, () => ({
    cells: 0,
    areaKm2: 0,
    sx: 0,
    sy: 0,
    ref: -1,
    elev: 0,
    wsum: 0,
    biomes: new Array(BIOMES.length).fill(0),
    minLon: Infinity,
    maxLon: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
    coastal: false,
    macro: new Array(MACROS.length + 1).fill(0),
  }));
  const landNb = new Map<number, Map<number, number>>();
  const seaNb = new Map<number, Set<number>>();
  const seaSeaNb = new Map<number, Set<number>>();
  const addPair = (m: Map<number, Map<number, number>>, a: number, b: number) => {
    const x = m.get(a) ?? new Map<number, number>();
    x.set(b, (x.get(b) ?? 0) + 1);
    m.set(a, x);
  };
  for (let y = 0; y < H; y++) {
    const cellArea = RES_KM * RES_KM * cosLat[y]!;
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const l = label[k]!;
      if (l) {
        const a = acc[l]!;
        if (a.ref < 0) a.ref = x;
        let dx = x - a.ref;
        if (dx > W / 2) dx -= W;
        if (dx < -W / 2) dx += W;
        a.cells++;
        a.areaKm2 += cellArea;
        a.sx += dx;
        a.sy += y;
        a.elev += g.elev[k]!;
        a.wsum += weight[k]!;
        a.biomes[biome[k]!]!++;
        a.macro[macro[k]!]!++;
        const lon = cellLon(a.ref + dx);
        a.minLon = Math.min(a.minLon, lon);
        a.maxLon = Math.max(a.maxLon, lon);
        a.minLat = Math.min(a.minLat, cellLat(y));
        a.maxLat = Math.max(a.maxLat, cellLat(y));
      }
      // Paires orthogonales (droite, bas).
      for (const [xx, yy] of [
        [(x + 1) % W, y],
        [x, y + 1],
      ] as const) {
        if (yy >= H) continue;
        const j = yy * W + xx;
        const m = label[j]!;
        if (l && m && l !== m) {
          addPair(landNb, l, m);
          addPair(landNb, m, l);
        }
        const sl = seaLabel[k]!;
        const sm = seaLabel[j]!;
        if (l && sm) {
          acc[l]!.coastal = true;
          (seaNb.get(l) ?? seaNb.set(l, new Set()).get(l)!).add(sm);
        }
        if (m && sl) {
          acc[m]!.coastal = true;
          (seaNb.get(m) ?? seaNb.set(m, new Set()).get(m)!).add(sl);
        }
        if (sl && sm && sl !== sm) {
          (seaSeaNb.get(sl) ?? seaSeaNb.set(sl, new Set()).get(sl)!).add(sm);
          (seaSeaNb.get(sm) ?? seaSeaNb.set(sm, new Set()).get(sm)!).add(sl);
        }
      }
    }
  }
  // Détroits : côtes de deux provinces à ≤ 40 km d'eau.
  const straits = new Map<string, number>();
  {
    const MAXKM = 40;
    const src = new Int32Array(N);
    const dist = new Float32Array(N).fill(Infinity);
    const heap = new MinHeap(1 << 20);
    for (let k = 0; k < N; k++) {
      const l = label[k]!;
      if (!l || !acc[l]!.coastal) continue;
      // Cellule côtière : voisine d'une eau de mer.
      const n = neighbors8(k, nb);
      let coast = false;
      for (let i = 0; i < n; i++) if (g.land[nb[i]!] === 0) coast = true;
      if (!coast) continue;
      dist[k] = 0;
      src[k] = l;
      heap.push(0, k);
    }
    while (heap.size) {
      const k = heap.pop();
      const d = heap.lastKey;
      if (d > dist[k]!) continue;
      const n = neighbors8(k, nb);
      for (let i = 0; i < n; i++) {
        const j = nb[i]!;
        if (g.land[j] === 2) continue;
        const nd = d + stepKm(k, j);
        if (g.land[j] === 1) {
          const m = label[j]!;
          if (m && m !== src[k] && dist[j] === 0) {
            const total = d + stepKm(k, j) + (dist[j] ?? 0);
            const a = Math.min(src[k]!, m);
            const b = Math.max(src[k]!, m);
            const key = `${a}:${b}`;
            if (total <= MAXKM * 2 && total < (straits.get(key) ?? Infinity)) straits.set(key, total);
          }
          continue;
        }
        if (nd > MAXKM) continue;
        if (nd < dist[j]!) {
          dist[j] = nd;
          src[j] = src[k]!;
          heap.push(nd, j);
        } else if (src[j] && src[j] !== src[k] && d + dist[j]! + stepKm(k, j) <= MAXKM * 2) {
          const a = Math.min(src[k]!, src[j]!);
          const b = Math.max(src[k]!, src[j]!);
          const key = `${a}:${b}`;
          const total = d + dist[j]! + stepKm(k, j);
          if (total < (straits.get(key) ?? Infinity)) straits.set(key, total);
        }
      }
    }
  }
  console.timeEnd('attributs');

  // --- Pôle d'inaccessibilité (point d'étiquette/capitale) -----------------
  // Transformée de distance (en cellules) au bord de la province.
  const inner = new Uint16Array(N);
  {
    const q = new Int32Array(N);
    let h = 0;
    let t = 0;
    for (let k = 0; k < N; k++) {
      const l = label[k]!;
      if (!l) continue;
      const n = neighbors8(k, nb);
      let edge = n < 8;
      for (let i = 0; i < n && !edge; i++) if (label[nb[i]!] !== l) edge = true;
      if (edge) {
        inner[k] = 1;
        q[t++] = k;
      }
    }
    while (h < t) {
      const k = q[h++]!;
      const n = neighbors8(k, nb);
      for (let i = 0; i < n; i++) {
        const j = nb[i]!;
        if (label[j] === label[k] && inner[j] === 0) {
          inner[j] = inner[k]! + 1;
          q[t++] = j;
        }
      }
    }
  }
  const pole = new Int32Array(PROV + 1).fill(-1);
  const poleV = new Float64Array(PROV + 1);
  for (let k = 0; k < N; k++) {
    const l = label[k]!;
    if (!l) continue;
    const v = inner[k]! + weight[k]! * 0.01;
    if (v > poleV[l]!) {
      poleV[l] = v;
      pole[l] = k;
    }
  }

  const provinces = [];
  for (let l = 1; l <= PROV; l++) {
    const a = acc[l]!;
    const pk = pole[l]!;
    const plon = cellLon(pk % W);
    const plat = cellLat((pk / W) | 0);
    const mIdx = a.macro.indexOf(Math.max(...a.macro));
    const reg = regionOf(plon, plat);
    const dominant = a.biomes.indexOf(Math.max(...a.biomes));
    const share = (b: number) => a.biomes[b]! / a.cells;
    let terrain = BIOMES[dominant]!;
    if (share(B.mountains) > 0.4) terrain = 'mountains';
    else if (share(B.farmlands) > 0.35 && terrain !== 'mountains') terrain = 'farmlands';
    if (terrain === 'water') terrain = 'plains';
    const nbs = [...(landNb.get(l) ?? new Map<number, number>()).entries()].filter(([, c]) => c >= 1).map(([m]) => m);
    provinces.push({
      i: l,
      lon: +plon.toFixed(3),
      lat: +plat.toFixed(3),
      bbox: [+a.minLon.toFixed(2), +a.minLat.toFixed(2), +a.maxLon.toFixed(2), +a.maxLat.toFixed(2)],
      cells: a.cells,
      areaKm2: Math.round(a.areaKm2),
      elevation: Math.round(a.elev / a.cells),
      density: +(a.wsum / a.cells).toFixed(3),
      terrain,
      biomeShares: Object.fromEntries(a.biomes.map((c, i) => [BIOMES[i], +(c / a.cells).toFixed(2)]).filter(([, v]) => (v as number) > 0.05)),
      coastal: a.coastal,
      macro: MACROS[mIdx - 1] ?? reg.macro,
      region: reg.id,
      neighbors: nbs.sort((x, y) => x - y),
      seas: [...(seaNb.get(l) ?? [])].sort((x, y) => x - y),
    });
  }
  const straitList = [...straits.entries()].map(([k, km]) => {
    const [a, b] = k.split(':').map(Number) as [number, number];
    return { a, b, km: Math.round(km) };
  });
  const seas = seaSeeds.map((k, i) => ({
    i: i + 1,
    lon: +cellLon(k % W).toFixed(2),
    lat: +cellLat((k / W) | 0).toFixed(2),
    neighbors: [...(seaSeaNb.get(i + 1) ?? [])].sort((x, y) => x - y),
    deep: coastDist[k]! > 60,
  }));
  saveGrid('provinces', label);
  saveGrid('seas', seaLabel);
  fs.writeFileSync(path.join(WORK, 'provinces.json'), JSON.stringify({ provinces, straits: straitList, seas }));
  const perMacro: Record<string, number> = {};
  for (const p of provinces) perMacro[p.macro] = (perMacro[p.macro] ?? 0) + 1;
  console.log('par macro-région', perMacro);
  console.log('détroits', straitList.length, '· provinces côtières', provinces.filter((p) => p.coastal).length);
}

main();
