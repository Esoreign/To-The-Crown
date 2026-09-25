/**
 * Milieux naturels à partir d'un modèle climatique simple et continu :
 *  - température T : latitude, altitude (−6,5 °C / km), légère continentalité ;
 *  - humidité M : ceintures de latitude (équatoriale humide, tropiques secs,
 *    moyennes latitudes humides), continentalité (distance à l'océan), déserts
 *    Natural Earth (flous), moussons d'Asie, grands bassins forestiers ;
 *    le tout perturbé par un bruit basse fréquence pour des contours naturels.
 * Les mêmes champs servent aux terrains de jeu et à la peinture des tuiles.
 * C'est une approximation de jeu, pas une reconstruction du climat de 1400.
 */
import { H, W, cellLat, cellLon } from './raster';

export const BIOMES = ['water', 'plains', 'farmlands', 'hills', 'mountains', 'forest', 'jungle', 'marsh', 'steppe', 'desert', 'savanna', 'tundra', 'ice'] as const;
export type Biome = (typeof BIOMES)[number];
export const B: Record<Biome, number> = Object.fromEntries(BIOMES.map((b, i) => [b, i])) as Record<Biome, number>;

export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const h = (a: number, b: number) => hash2(a + seed * 101, b - seed * 57);
  const top = h(xi, yi) * (1 - s(fx)) + h(xi + 1, yi) * s(fx);
  const bot = h(xi, yi + 1) * (1 - s(fx)) + h(xi + 1, yi + 1) * s(fx);
  return top * (1 - s(fy)) + bot * s(fy);
}
export function fbm(x: number, y: number, seed: number): number {
  return valueNoise(x, y, seed) * 0.55 + valueNoise(x * 2.1, y * 2.1, seed + 1) * 0.3 + valueNoise(x * 4.3, y * 4.3, seed + 2) * 0.15;
}

/** Flou boîte séparable (3 passes ≈ gaussienne), bouclé en longitude. */
export function blurField(src: Float32Array, r: number, passes = 3): Float32Array {
  const a = new Float32Array(src);
  const tmp = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let d = -r; d <= r; d++) acc += a[y * W + ((d + W) % W)]!;
      for (let x = 0; x < W; x++) {
        tmp[y * W + x] = acc / (2 * r + 1);
        acc += a[y * W + ((x + r + 1) % W)]! - a[y * W + ((x - r + W) % W)]!;
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let d = -r; d <= r; d++) acc += tmp[Math.min(H - 1, Math.max(0, d)) * W + x]!;
      for (let y = 0; y < H; y++) {
        a[y * W + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(H - 1, y + r + 1) * W + x]! - tmp[Math.max(0, y - r) * W + x]!;
      }
    }
  }
  return a;
}

/** Zones à renforcer (mousson, bassins forestiers) : [w, s, e, n, poids]. */
const WET_BOXES: [number, number, number, number, number][] = [
  [68, 8, 125, 32, 0.45], // Asie des moussons
  [100, 20, 128, 42, 0.4], // Chine humide
  [95, -11, 160, 8, 0.4], // Insulinde
  [-80, -16, -45, 6, 0.4], // Amazonie
  [9, -6, 30, 5, 0.35], // Congo
  [-13, 4, 8, 9, 0.3], // golfe de Guinée
  [-95, 6, -76, 19, 0.3], // Amérique centrale
  [128, 30, 146, 45, 0.25], // Japon
  [-97, 25, -65, 50, 0.45], // forêts de l'Est américain
  [-62, -36, -38, -12, 0.4], // Brésil méridional, Río de la Plata
  [25, -35, 41, -9, 0.3], // Afrique australe orientale
  [140, -40, 155, -24, 0.35], // Australie du Sud-Est
  [165, -48, 179, -34, 0.3], // Aotearoa
  [-76, -56, -70, -38, 0.35], // Chili austral
  [-10, 43, 30, 60, 0.15], // Europe tempérée
  [-130, 40, -120, 60, 0.35], // côte Pacifique nord
];
/** Sécheresses à renforcer : [w, s, e, n, poids]. */
const DRY_BOXES: [number, number, number, number, number][] = [
  [-20, 14, 60, 34, 0.35], // Sahara – Arabie
  [45, 25, 75, 42, 0.25], // Iran – Touran
  [75, 36, 110, 46, 0.3], // Tarim – Gobi
  [115, -32, 140, -20, 0.3], // Australie intérieure
  [-120, 25, -104, 40, 0.25], // Sud-Ouest américain
  [-75, -30, -68, -15, 0.3], // Atacama
  [12, -29, 24, -18, 0.25], // Namib – Kalahari
];

export interface ClimateFields {
  temp: Float32Array;
  moist: Float32Array;
}

function boxMask(boxes: [number, number, number, number, number][]): Float32Array {
  const m = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const lat = cellLat(y);
    for (let x = 0; x < W; x++) {
      const lon = cellLon(x);
      let v = 0;
      for (const [w, s, e, n, p] of boxes) if (lon >= w && lon <= e && lat >= s && lat <= n) v = Math.max(v, p);
      m[y * W + x] = v;
    }
  }
  return blurField(m, 50);
}

export function climate(land: Uint8Array, elev: Int16Array, deserts: Uint8Array): ClimateFields {
  // Distance à l'océan (cellules), BFS 4-connexe.
  const dist = new Float32Array(W * H).fill(1e9);
  const q = new Int32Array(W * H);
  let h = 0;
  let t = 0;
  for (let k = 0; k < W * H; k++)
    if (land[k] !== 1) {
      dist[k] = 0;
      q[t++] = k;
    }
  while (h < t) {
    const k = q[h++]!;
    const y = (k / W) | 0;
    const x = k - y * W;
    const d = dist[k]! + 1;
    for (const j of [y * W + ((x + 1) % W), y * W + ((x - 1 + W) % W), k - W, k + W]) {
      if (j < 0 || j >= W * H) continue;
      if (dist[j]! > d) {
        dist[j] = d;
        q[t++] = j;
      }
    }
  }
  const desertBlur = blurField(Float32Array.from(deserts), 12);
  const wet = boxMask(WET_BOXES);
  const dry = boxMask(DRY_BOXES);
  const temp = new Float32Array(W * H);
  const moist = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const lat = cellLat(y);
    const alat = Math.abs(lat);
    // Ceintures d'humidité selon la latitude.
    const belt = alat < 8 ? 0.95 : alat < 18 ? 0.95 - ((alat - 8) / 10) * 0.45 : alat < 30 ? 0.5 - ((alat - 18) / 12) * 0.35 : alat < 45 ? 0.15 + ((alat - 30) / 15) * 0.5 : alat < 62 ? 0.65 : 0.65 - Math.min(0.3, (alat - 62) / 30);
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (land[k] !== 1) continue;
      const km = dist[k]! * 5.5 * Math.max(0.3, Math.cos((lat * Math.PI) / 180));
      const cont = Math.min(1, km / 2200);
      const e = Math.max(0, elev[k]!);
      temp[k] = 29 - 0.35 * alat - Math.max(0, alat - 40) * 0.25 - (4.5 * e) / 1000 - cont * 4;
      const noise = (fbm(x / 100, y / 100, 7) - 0.5) * 0.32;
      moist[k] = Math.max(0, Math.min(1, belt - cont * 0.35 + wet[k]! - dry[k]! - desertBlur[k]! * 0.8 + noise));
    }
  }
  return { temp, moist };
}

/** Classement discret (terrain de jeu) à partir des champs climatiques et du relief. */
export function classifyBiomes(land: Uint8Array, elev: Int16Array, deserts: Uint8Array, rivers: Uint8Array, weight: Float32Array | null, fields?: ClimateFields): Uint8Array {
  const { temp, moist } = fields ?? climate(land, elev, deserts);
  const biome = new Uint8Array(W * H);
  const R = 3;
  const rowMax = new Int16Array(W * H);
  const rowMin = new Int16Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let mx = -32768;
      let mn = 32767;
      for (let d = -R; d <= R; d++) {
        const v = elev[y * W + ((x + d + W) % W)]!;
        if (v > mx) mx = v;
        if (v < mn) mn = v;
      }
      rowMax[y * W + x] = mx;
      rowMin[y * W + x] = mn;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (land[k] !== 1) {
        biome[k] = B.water;
        continue;
      }
      let mx = -32768;
      let mn = 32767;
      for (let d = -R; d <= R; d++) {
        const yy = Math.min(H - 1, Math.max(0, y + d));
        mx = Math.max(mx, rowMax[yy * W + x]!);
        mn = Math.min(mn, rowMin[yy * W + x]!);
      }
      const relief = mx - mn;
      const e = elev[k]!;
      const T = temp[k]!;
      const M = moist[k]!;
      let b: number;
      if (T < -14 || (cellLat(y) > 60 && e > 1200 && cellLon(x) > -75 && cellLon(x) < -10)) b = B.ice;
      else if (e > 2600 || relief > 1400) b = B.mountains;
      else if (T < -3) b = B.tundra;
      else if (M < 0.13) b = relief > 900 ? B.mountains : B.desert;
      else if (relief > 650 || e > 1500) b = B.hills;
      else if (e < 4 && rivers[k]! > 100 && M > 0.4) b = B.marsh;
      else if (M < 0.3) b = T > 20 ? B.savanna : B.steppe;
      else if (T > 21 && M > 0.72) b = B.jungle;
      else if (T > 19 && M < 0.5) b = B.savanna;
      else if (rivers[k]! > 110 || (weight !== null && weight[k]! > 3.2)) b = B.farmlands;
      else if (M > 0.58) b = B.forest;
      else b = B.plains;
      biome[k] = b;
    }
  }
  for (let k = 0; k < W * H; k++) {
    if (land[k] === 1 && rivers[k]! > 150 && (biome[k] === B.desert || biome[k] === B.steppe || biome[k] === B.savanna)) biome[k] = B.farmlands;
  }
  return biome;
}

/** Couleur « atlas » continue d'un couple (T, M). */
export function climateColor(T: number, M: number): [number, number, number] {
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i]! - v) * Math.max(0, Math.min(1, t))) as [number, number, number];
  const desert = [214, 192, 148];
  const semiArid = [198, 182, 128];
  const grass = [166, 166, 110];
  const forest = [98, 122, 78];
  const tropical = [70, 104, 64];
  const taiga = [84, 106, 80];
  const tundra = [156, 160, 140];
  const ice = [234, 238, 240];
  let c: [number, number, number];
  if (M < 0.25) c = mix(desert, semiArid, M / 0.25);
  else if (M < 0.45) c = mix(semiArid, grass, (M - 0.25) / 0.2);
  else c = mix(grass, T > 20 ? tropical : forest, (M - 0.45) / 0.35);
  if (T < 8 && M > 0.35) c = mix(c, taiga, (8 - T) / 8);
  if (T < 0) c = mix(c, tundra, -T / 5);
  if (T < -11) c = mix(c, ice, (-11 - T) / 5);
  return c;
}
