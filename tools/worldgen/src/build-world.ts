/**
 * Étape 5 — monde de jeu 1400 à partir des provinces physiques :
 *  1. cultures et confessions des populations (zones d'ancrage, Dijkstra) ;
 *  2. territoires des entités politiques de 1400 (ancrages, portée, poids) ;
 *  3. peuples non listés regroupés en entités « approximation de jeu » ;
 *  4. toponymes (lieux de 1400, lieux Natural Earth renommés, géographie) ;
 *  5. divisions administratives et hiérarchie de jure des titres ;
 *  6. sorties compactes : packages/content/data/world1400/{world,start}.json
 *     et un aperçu politique (.cache/worldgen/political.png).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  CULTURES_1400,
  CULTURE_1400_NAMES,
  CULTURE_FAITH,
  CULTURE_ZONES,
  GOVERNMENT_BY_ID,
  HISTORIC_PLACES,
  PLACE_RENAMES,
  POLITIES_1400,
  type GovernmentId,
  type PolitySpec,
} from '@ttc/content/world1400';
import type { Feature, LineString, MultiLineString, Point as GeoPoint, Position } from 'geojson';
import { MinHeap } from './heap';
import { CONTENT_DATA, NE_DIR, WORK } from './paths';
import { H, W, kmBetween, latToY, loadGridI32, lonToX, polygonsOf, readGeo } from './raster';
import { MACRO_NAMES, REGIONS, type MacroRegion } from './regions';

// ---------------------------------------------------------------------------
// Entrées
// ---------------------------------------------------------------------------

interface RawProvince {
  i: number;
  lon: number;
  lat: number;
  bbox: [number, number, number, number];
  cells: number;
  areaKm2: number;
  elevation: number;
  density: number;
  terrain: string;
  biomeShares: Record<string, number>;
  coastal: boolean;
  macro: MacroRegion;
  region: string;
  neighbors: number[];
  seas: number[];
}
interface RawSea {
  i: number;
  lon: number;
  lat: number;
  neighbors: number[];
  deep: boolean;
}
const raw = JSON.parse(fs.readFileSync(path.join(WORK, 'provinces.json'), 'utf8')) as {
  provinces: RawProvince[];
  straits: { a: number; b: number; km: number }[];
  seas: RawSea[];
};
const grid = loadGridI32('provinces');
const P = Math.max(...raw.provinces.map((p) => p.i)) + 1;
const prov: (RawProvince | undefined)[] = new Array(P);
for (const p of raw.provinces) prov[p.i] = p;
const ids = raw.provinces.map((p) => p.i);
// Îlots sans voisin ni côte détectée : rattachés à la zone maritime la plus proche.
for (const p of raw.provinces) {
  if (p.neighbors.length || p.seas.length) continue;
  let best = -1;
  let bestD = Infinity;
  for (const s of raw.seas) {
    const d = kmBetween(p.lon, p.lat, s.lon, s.lat);
    if (d < bestD) {
      bestD = d;
      best = s.i;
    }
  }
  if (best > 0) {
    p.seas = [best];
    p.coastal = true;
  }
}

// ---------------------------------------------------------------------------
// Graphe des provinces
// ---------------------------------------------------------------------------

const TERRAIN_COST: Record<string, number> = {
  plains: 1, farmlands: 1, steppe: 0.9, savanna: 1, forest: 1.2, hills: 1.3, jungle: 1.6, marsh: 1.5, mountains: 1.9, desert: 1.5, tundra: 1.3, ice: 3,
};
type Edge = [number, number]; // voisin, coût (km pondérés)
const landAdj: Edge[][] = Array.from({ length: P }, () => []);
const seaAdj: Edge[][] = Array.from({ length: P }, () => []);
const km = (a: number, b: number) => kmBetween(prov[a]!.lon, prov[a]!.lat, prov[b]!.lon, prov[b]!.lat);
for (const p of raw.provinces) {
  for (const n of p.neighbors) {
    if (!prov[n]) continue;
    const cost = km(p.i, n) * ((TERRAIN_COST[p.terrain] ?? 1.2) + (TERRAIN_COST[prov[n]!.terrain] ?? 1.2)) / 2;
    landAdj[p.i]!.push([n, cost]);
  }
}
const straitSet = new Set<string>();
for (const s of raw.straits) {
  if (!prov[s.a] || !prov[s.b]) continue;
  const cost = km(s.a, s.b) * 1.5 + 30;
  landAdj[s.a]!.push([s.b, cost]);
  landAdj[s.b]!.push([s.a, cost]);
  straitSet.add(`${Math.min(s.a, s.b)}:${Math.max(s.a, s.b)}`);
}
// Sauts maritimes : provinces côtières d'une même zone de mer.
const seaCoasts = new Map<number, number[]>();
for (const p of raw.provinces) for (const s of p.seas) (seaCoasts.get(s) ?? seaCoasts.set(s, []).get(s)!).push(p.i);
for (const list of seaCoasts.values()) {
  for (let x = 0; x < list.length; x++) {
    for (let y = x + 1; y < list.length; y++) {
      const a = list[x]!;
      const b = list[y]!;
      const d = km(a, b);
      if (d > 900) continue;
      seaAdj[a]!.push([b, d * 3 + 300]);
      seaAdj[b]!.push([a, d * 3 + 300]);
    }
  }
}

/** Dijkstra multi-sources ; `limit` borne le coût. Renvoie coût et source. */
function dijkstra(sources: { p: number; cost: number; tag: number }[], opts: { sea: boolean; limit?: number; allowed?: (p: number) => boolean }) {
  const dist = new Float64Array(P).fill(Infinity);
  const tag = new Int32Array(P).fill(-1);
  const done = new Uint8Array(P);
  const heap = new MinHeap(1 << 16);
  for (const s of sources) {
    if (s.cost < dist[s.p]!) {
      dist[s.p] = s.cost;
      tag[s.p] = s.tag;
      heap.push(s.cost, s.p);
    }
  }
  const limit = opts.limit ?? Infinity;
  while (heap.size) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    const relax = (edges: Edge[]) => {
      for (const [v, c] of edges) {
        if (opts.allowed && !opts.allowed(v)) continue;
        const nd = dist[u]! + c;
        if (nd < dist[v]! && nd <= limit) {
          dist[v] = nd;
          tag[v] = tag[u]!;
          heap.push(nd, v);
        }
      }
    };
    relax(landAdj[u]!);
    if (opts.sea) relax(seaAdj[u]!);
  }
  return { dist, tag };
}

/** Province contenant un point (recherche en spirale si le point tombe en mer). */
function provinceAt(lon: number, lat: number, radius = 40): number {
  const x0 = Math.floor(lonToX(lon));
  const y0 = Math.floor(latToY(lat));
  for (let r = 0; r <= radius; r++) {
    let best = -1;
    let bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const y = y0 + dy;
        if (y < 0 || y >= H) continue;
        const x = (((x0 + dx) % W) + W) % W;
        const l = grid[y * W + x]!;
        if (l > 0 && prov[l]) {
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = l;
          }
        }
      }
    }
    if (best > 0) return best;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 1. Cultures et confessions
// ---------------------------------------------------------------------------

const cultureIds = new Set(CULTURES_1400.map((c) => c.id));
interface Seed {
  culture: string;
  faith: string | null;
}
const seeds: Seed[] = [];
const cultSources: { p: number; cost: number; tag: number }[] = [];
for (const zone of CULTURE_ZONES) {
  if (!cultureIds.has(zone.culture)) throw new Error(`Culture inconnue dans les zones : ${zone.culture}`);
  for (const [lon, lat] of zone.at) {
    const p = provinceAt(lon, lat);
    if (p < 0) continue;
    seeds.push({ culture: zone.culture, faith: zone.faith ?? null });
    cultSources.push({ p, cost: 0, tag: seeds.length - 1 });
  }
}
for (const pol of POLITIES_1400) {
  for (const [lon, lat] of [pol.cap, ...(pol.at ?? [])]) {
    const p = provinceAt(lon, lat);
    if (p < 0) continue;
    seeds.push({ culture: pol.culture, faith: null });
    cultSources.push({ p, cost: 180, tag: seeds.length - 1 });
  }
}
const cult = dijkstra(cultSources, { sea: true });
const provCulture: string[] = new Array(P).fill('');
const provFaith: string[] = new Array(P).fill('');
for (const i of ids) {
  let t = cult.tag[i]!;
  if (t < 0) {
    // Île isolée : ancrage le plus proche à vol d'oiseau.
    let best = Infinity;
    for (let s = 0; s < cultSources.length; s++) {
      const d = km(i, cultSources[s]!.p);
      if (d < best) {
        best = d;
        t = cultSources[s]!.tag;
      }
    }
  }
  const seed = seeds[t]!;
  provCulture[i] = seed.culture;
  provFaith[i] = seed.faith ?? CULTURE_FAITH[seed.culture] ?? 'catholic';
}

// ---------------------------------------------------------------------------
// 2. Territoires des entités politiques
// ---------------------------------------------------------------------------

const WASTE = new Set<number>();
for (const i of ids) {
  const p = prov[i]!;
  if (p.terrain === 'ice' || (p.biomeShares.ice ?? 0) > 0.5) WASTE.add(i);
}
const owner: number[] = new Array(P).fill(-1); // indice dans `polities`
interface Polity {
  spec: PolitySpec;
  filler: boolean;
  seeds: { p: number; reach: number }[];
  capital: number;
  provinces: number[];
}
const polities: Polity[] = POLITIES_1400.map((spec) => ({ spec, filler: false, seeds: [], capital: -1, provinces: [] }));
const byId = new Map(polities.map((p, k) => [p.spec.id, k]));
if (byId.size !== polities.length) throw new Error('Identifiants d’entités en double');
for (const pol of polities) {
  const s = pol.spec;
  if (s.liege && !byId.has(s.liege)) throw new Error(`${s.id} : suzerain inconnu ${s.liege}`);
  if (s.union && !byId.has(s.union)) throw new Error(`${s.id} : union inconnue ${s.union}`);
  if (!cultureIds.has(s.culture)) throw new Error(`${s.id} : culture inconnue ${s.culture}`);
  if (!GOVERNMENT_BY_ID[s.gov]) throw new Error(`${s.id} : gouvernement inconnu ${s.gov}`);
}

const specOf0 = (id: string) => polities[byId.get(id) ?? -1]?.spec;
// Capitales : les entités de faible portée se servent d'abord.
const capitalOf = new Map<number, number>(); // province → entité
const order = polities.map((_, k) => k).sort((a, b) => (polities[a]!.spec.reach ?? 350) - (polities[b]!.spec.reach ?? 350));
for (const k of order) {
  const pol = polities[k]!;
  const partner = pol.spec.union ? specOf0(pol.spec.union) : undefined;
  if (partner && !pol.spec.at?.length && partner.cap[0] === pol.spec.cap[0] && partner.cap[1] === pol.spec.cap[1]) continue;
  const [lon, lat] = pol.spec.cap;
  let p = provinceAt(lon, lat);
  if (p < 0) continue;
  if (capitalOf.has(p)) {
    const free = landAdj[p]!.map(([v]) => v).filter((v) => !capitalOf.has(v) && !WASTE.has(v));
    free.sort((a, b) => kmBetween(lon, lat, prov[a]!.lon, prov[a]!.lat) - kmBetween(lon, lat, prov[b]!.lon, prov[b]!.lat));
    if (!free.length) {
      console.warn(`Capitale sans province libre : ${pol.spec.id}`);
      continue;
    }
    p = free[0]!;
  }
  capitalOf.set(p, k);
  pol.capital = p;
}
for (const [k, pol] of polities.entries()) {
  if (pol.capital < 0) continue;
  const reach = pol.spec.reach ?? 350;
  pol.seeds.push({ p: pol.capital, reach });
  for (const a of pol.spec.at ?? []) {
    const p = provinceAt(a[0], a[1]);
    if (p < 0) continue;
    pol.seeds.push({ p, reach: a[2] ?? reach });
  }
  void k;
}
const bestScore = new Float64Array(P).fill(Infinity);
for (const [k, pol] of polities.entries()) {
  const w = pol.spec.w ?? 1;
  for (const s of pol.seeds) {
    const r = dijkstra([{ p: s.p, cost: 0, tag: 0 }], { sea: true, limit: s.reach, allowed: (v) => !WASTE.has(v) });
    for (const i of ids) {
      const d = r.dist[i]!;
      if (d === Infinity) continue;
      const score = d / w;
      if (score < bestScore[i]!) {
        bestScore[i] = score;
        owner[i] = k;
      }
    }
  }
}
for (const [p, k] of capitalOf) owner[p] = k;

// Contiguïté : un morceau sans ancrage retourne aux terres libres.
function components(list: number[], inSet: (p: number) => boolean): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (const start of list) {
    if (seen.has(start)) continue;
    const comp: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(u);
      for (const [v] of landAdj[u]!) {
        if (!seen.has(v) && inSet(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    out.push(comp);
  }
  return out;
}
for (const [k, pol] of polities.entries()) {
  const list = ids.filter((i) => owner[i] === k);
  const seedSet = new Set(pol.seeds.map((s) => s.p));
  for (const comp of components(list, (v) => owner[v] === k)) {
    if (!comp.some((p) => seedSet.has(p))) for (const p of comp) owner[p] = -1;
  }
}
// Enclaves libres entièrement entourées par une même entité.
for (let pass = 0; pass < 4; pass++) {
  for (const i of ids) {
    if (owner[i] !== -1 || WASTE.has(i)) continue;
    const around = new Set(landAdj[i]!.map(([v]) => owner[v]!));
    if (around.size === 1) {
      const k = [...around][0]!;
      if (k >= 0) owner[i] = k;
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Toponymes
// ---------------------------------------------------------------------------

function deName(n: string): string {
  return /^[aeiouyàâäéèêëîïôöûüœh]/i.test(n) ? `d’${n}` : `de ${n}`;
}
const NAMEABLE_MODERN = new Set<MacroRegion>(['europe', 'mena', 'india', 'eastasia', 'seasia']);
const provName: string[] = new Array(P).fill('');
const provSeat: ([number, number] | null)[] = new Array(P).fill(null);
const provImportance = new Float64Array(P);
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

for (const [name, lon, lat, imp] of HISTORIC_PLACES) {
  const p = provinceAt(lon, lat, 6);
  if (p < 0 || imp <= provImportance[p]!) continue;
  provName[p] = name;
  provSeat[p] = [lon, lat];
  provImportance[p] = imp + 10;
}
{
  const places = readGeo(path.join(NE_DIR, 'ne_10m_populated_places_simple.geojson'));
  const best = new Map<number, { name: string; score: number; at: [number, number] }>();
  for (const f of places.features) {
    const pr = f.properties as { name: string; scalerank: number; pop_max: number; featurecla: string };
    if (/Station/.test(pr.featurecla)) continue;
    const [lon, lat] = (f.geometry as GeoPoint).coordinates as [number, number];
    const p = provinceAt(lon, lat, 3);
    if (p < 0 || provImportance[p]! >= 10) continue;
    if (!NAMEABLE_MODERN.has(prov[p]!.macro)) continue;
    let name: string | null = pr.name;
    if (Object.prototype.hasOwnProperty.call(PLACE_RENAMES, pr.name)) name = PLACE_RENAMES[pr.name]!;
    if (!name) continue;
    const score = (10 - pr.scalerank) * 10 + Math.log10(1 + pr.pop_max);
    const cur = best.get(p);
    if (!cur || score > cur.score) best.set(p, { name, score, at: [lon, lat] });
  }
  for (const [p, b] of best) {
    provName[p] = b.name;
    provSeat[p] = b.at;
    provImportance[p] = b.score / 20;
  }
}
// Lieux voisins (≤ 70 km) encore inutilisés, pour les régions où les noms
// modernes sont acceptables : évite de nommer des provinces d'après un fleuve.
{
  const places = readGeo(path.join(NE_DIR, 'ne_10m_populated_places_simple.geojson'));
  const used = new Set(ids.map((i) => provName[i]).filter(Boolean));
  const cands: { name: string; lon: number; lat: number; score: number }[] = [];
  for (const f of places.features) {
    const pr = f.properties as { name: string; scalerank: number; pop_max: number; featurecla: string };
    if (/Station/.test(pr.featurecla)) continue;
    let name: string | null = pr.name;
    if (Object.prototype.hasOwnProperty.call(PLACE_RENAMES, pr.name)) name = PLACE_RENAMES[pr.name]!;
    if (!name) continue;
    const [lon, lat] = (f.geometry as GeoPoint).coordinates as [number, number];
    cands.push({ name, lon, lat, score: (10 - pr.scalerank) * 10 + Math.log10(1 + pr.pop_max) });
  }
  for (const i of ids) {
    if (provName[i]) continue;
    const p = prov[i]!;
    if (!NAMEABLE_MODERN.has(p.macro)) continue;
    let best: (typeof cands)[number] | null = null;
    let bestScore = -Infinity;
    for (const c of cands) {
      if (used.has(c.name) || Math.abs(c.lat - p.lat) > 1 || Math.abs(c.lon - p.lon) > 1.6) continue;
      const d = kmBetween(p.lon, p.lat, c.lon, c.lat);
      if (d > 70) continue;
      const score = c.score - d / 3;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      provName[i] = best.name;
      provSeat[i] = [p.lon, p.lat];
      used.add(best.name);
    }
  }
}
const riverNamed = new Set<number>();
// Géographie physique pour les provinces sans lieu nommé.
{
  const rivers = readGeo(path.join(NE_DIR, 'ne_10m_rivers_lake_centerlines.geojson'));
  const riverScore = new Map<number, Map<string, number>>();
  for (const f of rivers.features) {
    const pr = f.properties as { name: string | null; scalerank: number; featurecla: string };
    if (!pr.name || pr.featurecla !== 'River' || pr.scalerank > 8) continue;
    const g = f.geometry as LineString | MultiLineString;
    const lines: Position[][] = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    for (const line of lines) {
      for (const pt of line) {
        const p = provinceAt(pt[0]!, pt[1]!, 2);
        if (p < 0) continue;
        const m = riverScore.get(p) ?? riverScore.set(p, new Map()).get(p)!;
        m.set(pr.name, (m.get(pr.name) ?? 0) + (11 - pr.scalerank));
      }
    }
  }
  const regionsPolys = readGeo(path.join(NE_DIR, 'ne_10m_geography_regions_polys.geojson'));
  const physical: { name: string; island: boolean; area: number; rings: Position[][][] }[] = [];
  for (const f of regionsPolys.features) {
    const pr = f.properties as { FEATURECLA: string; NAME_FR: string | null; NAME: string };
    if (['Continent', 'Dragons-be-here', 'Coast', 'Lake'].includes(pr.FEATURECLA)) continue;
    const name = pr.NAME_FR || pr.NAME;
    if (!name) continue;
    const polys = polygonsOf(f);
    let area = 0;
    for (const poly of polys) {
      const ring = poly[0]!;
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j]![0]! + ring[i]![0]!) * (ring[j]![1]! - ring[i]![1]!);
      area += Math.abs(a / 2);
    }
    physical.push({ name: cap1(name), island: pr.FEATURECLA === 'Island' || pr.FEATURECLA === 'Island group', area, rings: polys });
  }
  physical.sort((a, b) => a.area - b.area);
  const inRing = (lon: number, lat: number, ring: Position[]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i]![0]!;
      const yi = ring[i]![1]!;
      const xj = ring[j]![0]!;
      const yj = ring[j]![1]!;
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const physicalAt = (lon: number, lat: number) => {
    for (const ph of physical) {
      for (const poly of ph.rings) if (inRing(lon, lat, poly[0]!)) return ph;
    }
    return null;
  };
  for (const i of ids) {
    if (provName[i]) continue;
    const p = prov[i]!;
    const ph = physicalAt(p.lon, p.lat);
    if (ph?.island && ph.area < 6) {
      provName[i] = ph.name;
      continue;
    }
    const rs = riverScore.get(i);
    const river = rs ? [...rs.entries()].sort((a, b) => b[1] - a[1])[0] : undefined;
    if (river && river[1] >= 12) {
      provName[i] = river[0];
      riverNamed.add(i);
    } else if (ph) provName[i] = ph.name;
    else if (river) {
      provName[i] = river[0];
      riverNamed.add(i);
    }
    else provName[i] = REGIONS.find((r) => r.id === p.region)?.name ?? MACRO_NAMES[p.macro];
  }
}
// Grandes régions génériques (« Deccan » ×26…) : dans les régions où les
// toponymes actuels sont admissibles, on préfère « Pays de <ville proche> ».
{
  const places = readGeo(path.join(NE_DIR, 'ne_10m_populated_places_simple.geojson'))
    .features.map((f) => {
      const pr = f.properties as { name: string; featurecla: string };
      const name = Object.prototype.hasOwnProperty.call(PLACE_RENAMES, pr.name) ? PLACE_RENAMES[pr.name]! : pr.name;
      const [lon, lat] = (f.geometry as GeoPoint).coordinates as [number, number];
      return { name, lon, lat, ok: !/Station/.test(pr.featurecla) };
    })
    .filter((x): x is { name: string; lon: number; lat: number; ok: boolean } => !!x.name && x.ok);
  const count = new Map<string, number>();
  for (const i of ids) count.set(provName[i]!, (count.get(provName[i]!) ?? 0) + 1);
  const taken = new Set(ids.map((i) => provName[i]!));
  for (const i of ids) {
    const p = prov[i]!;
    if ((count.get(provName[i]!) ?? 0) < 6 || !NAMEABLE_MODERN.has(p.macro)) continue;
    let best: string | null = null;
    let bestD = 300;
    for (const c of places) {
      if (Math.abs(c.lat - p.lat) > 3 || Math.abs(c.lon - p.lon) > 4) continue;
      const d = kmBetween(p.lon, p.lat, c.lon, c.lat);
      const candidate = `Pays ${deName(c.name)}`;
      if (d < bestD && !taken.has(candidate)) {
        bestD = d;
        best = candidate;
      }
    }
    if (best) {
      taken.add(best);
      provName[i] = best;
    }
  }
}
// Homonymes : qualificatif d'orientation, puis numéro.
{
  const groups = new Map<string, number[]>();
  for (const i of ids) (groups.get(provName[i]!) ?? groups.set(provName[i]!, []).get(provName[i]!)!).push(i);
  const DIRS = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est'];
  for (const [name, list] of groups) {
    if (list.length < 2) continue;
    // Vallées : amont / moyen / aval selon l'altitude.
    if (list.length <= 3 && list.every((i) => riverNamed.has(i))) {
      const sorted = [...list].sort((a, b) => prov[b]!.elevation - prov[a]!.elevation);
      const tags = list.length === 2 ? ['amont', 'aval'] : ['amont', 'cours moyen', 'aval'];
      sorted.forEach((i, k) => (provName[i] = `${name} (${tags[k]})`));
      continue;
    }
    const cx = list.reduce((s, i) => s + prov[i]!.lon, 0) / list.length;
    const cy = list.reduce((s, i) => s + prov[i]!.lat, 0) / list.length;
    const used = new Map<string, number>();
    const labels = list.map((i) => {
      const dx = prov[i]!.lon - cx;
      const dy = prov[i]!.lat - cy;
      if (Math.hypot(dx, dy) < 0.35) return 'centre';
      const a = Math.atan2(dy, dx);
      return DIRS[(Math.round(a / (Math.PI / 4)) + 8) % 8]!;
    });
    list.forEach((i, k) => {
      const lab = labels[k]!;
      const n = (used.get(lab) ?? 0) + 1;
      used.set(lab, n);
      const roman = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'][n] ?? ` ${n}`;
      provName[i] = `${name} (${lab}${roman})`;
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Entités de remplissage (peuples non listés)
// ---------------------------------------------------------------------------

const STEPPE = new Set(['kipchak', 'kazakh', 'mongol', 'oirat', 'turkmen']);
const TRIBAL = new Set([
  'siberian', 'inuit', 'sami', 'aboriginal', 'khoisan', 'amazonian', 'athabaskan', 'papuan', 'dayak', 'pacific_nw', 'algonquian', 'plains', 'puebloan',
  'ainu', 'nilotic', 'oromo', 'tupi', 'carib', 'mapuche', 'maori', 'polynesian', 'micronesian', 'arab_bedouin', 'berber', 'tuareg', 'afghan', 'iroquoian',
  'mississippian', 'taino', 'jurchen', 'circassian', 'kurdish', 'somali',
]);
function fillerGov(culture: string, size: number): GovernmentId {
  if (STEPPE.has(culture)) return 'steppe_confederation';
  if (TRIBAL.has(culture)) return size >= 6 ? 'tribal_confederation' : 'chiefdom';
  if (['kongo', 'luba', 'shona', 'nguni', 'great_lakes', 'malagasy', 'mossi', 'akan', 'yoruba', 'igbo', 'edo', 'hausa', 'mande', 'soninke', 'wolof', 'songhai', 'kanuri', 'swahili'].includes(culture)) return 'chiefdom';
  return 'clan_realm';
}
const FILLER_LABEL: Partial<Record<GovernmentId, string>> = {
  steppe_confederation: 'Tribus nomades',
  tribal_confederation: 'Confédération',
  chiefdom: 'Chefferie',
  clan_realm: 'Seigneuries',
};
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const CULTURE_BY = new Map(CULTURES_1400.map((c) => [c.id, c]));

{
  const free = new Set(ids.filter((i) => owner[i] === -1 && !WASTE.has(i)));
  let fk = 0;
  while (free.size) {
    let seed = -1;
    let bestD = -1;
    for (const i of free) {
      const d = prov[i]!.density + provImportance[i]!;
      if (d > bestD) {
        bestD = d;
        seed = i;
      }
    }
    const culture = provCulture[seed]!;
    const target = prov[seed]!.density < 0.3 ? 14 : 9;
    const r = dijkstra([{ p: seed, cost: 0, tag: 0 }], { sea: false, allowed: (v) => free.has(v) && provCulture[v] === culture });
    const cluster = ids.filter((i) => r.dist[i]! < Infinity && free.has(i)).sort((a, b) => r.dist[a]! - r.dist[b]!).slice(0, target);
    for (const c of cluster) free.delete(c);
    const size = cluster.length;
    const gov = fillerGov(culture, size);
    const def = CULTURE_BY.get(culture)!;
    const h = hashStr(`${culture}:${seed}`);
    const place = provName[seed]!.replace(/ \(.*\)$/, '');
    const cultureName = CULTURE_1400_NAMES[culture]?.name ?? culture;
    const spec: PolitySpec = {
      id: `f${++fk}`,
      name: `${FILLER_LABEL[gov] ?? 'Seigneuries'} ${deName(place)}`,
      short: place,
      adj: cultureName,
      rank: size >= 5 ? 'duchy' : 'county',
      gov,
      culture,
      faith: provFaith[seed]!,
      color: '',
      cap: [prov[seed]!.lon, prov[seed]!.lat, place],
      house: def.houseNames[h % def.houseNames.length]!,
      ruler: [def.maleNames[(h >>> 8) % def.maleNames.length]!, 1335 + (h % 40), 'M'],
      conf: 'gameplayApproximation',
      note: `Peuples ${cultureName.toLowerCase()} regroupés pour le jeu : l’organisation politique réelle vers 1400 était plus fragmentée ou mal documentée.`,
    };
    const k = polities.length;
    polities.push({ spec, filler: true, seeds: [{ p: seed, reach: 0 }], capital: seed, provinces: [] });
    for (const c of cluster) owner[c] = k;
  }
}
for (const i of ids) if (owner[i]! >= 0) polities[owner[i]!]!.provinces.push(i);
// Une entité de rang comtal devenue trop vaste est gouvernée comme un duché
// (l'intitulé du dirigeant reste celui de la fiche).
for (const pol of polities) {
  if (pol.spec.rank === 'county' && pol.provinces.length > 4) {
    const gov = GOVERNMENT_BY_ID[pol.spec.gov]!;
    pol.spec = { ...pol.spec, rank: 'duchy', title: pol.spec.title ?? gov.rulerTitles.county };
  }
}

// Confession : dans le monde malais, la population suit la foi de la cour.
const COURT_FAITH = new Set(['malay', 'philippine', 'bugis', 'dayak']);
for (const i of ids) {
  const k = owner[i]!;
  if (k < 0) continue;
  const s = polities[k]!.spec;
  if (s.culture === provCulture[i] && COURT_FAITH.has(s.culture)) provFaith[i] = s.faith;
}

// ---------------------------------------------------------------------------
// 5. Statistiques de base, divisions, titres
// ---------------------------------------------------------------------------

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const provDev = new Int32Array(P);
for (const i of ids) {
  const p = prov[i]!;
  const imp = provImportance[i]! >= 10 ? provImportance[i]! - 10 : provImportance[i]! / 2;
  provDev[i] = clamp(Math.round(2 + 6 * Math.log2(1 + p.density) + imp * 2), 1, 45);
}
const capitalProvinces = new Set(polities.map((p) => p.capital).filter((c) => c > 0));

const DIV_LABEL: Record<GovernmentId, string> = {
  feudal_monarchy: 'Duché', centralized_monarchy: 'Bailliage', imperial_bureaucracy: 'Province', mamluk_sultanate: 'Niyaba', iqta_realm: 'Iqta',
  steppe_confederation: 'Oulous', tribal_confederation: 'Terres', warrior_shogunate: 'Province', clan_realm: 'Seigneurie', city_republic: 'Contado',
  merchant_republic: 'Contado', theocracy: 'Diocèse', holy_order: 'Commanderie', elective_monarchy: 'Duché', tributary_empire: 'Province tributaire',
  mandala_kingdom: 'Mandala', city_state: 'Territoire', chiefdom: 'Terres',
};
const REALM_LABEL: Partial<Record<GovernmentId, string>> = {
  imperial_bureaucracy: 'Grand gouvernement', mamluk_sultanate: 'Vice-royauté', iqta_realm: 'Province', steppe_confederation: 'Grand oulous',
  tributary_empire: 'Seigneurie tributaire', mandala_kingdom: 'Royaume vassal', warrior_shogunate: 'Région',
};
const DIV_SIZE: Partial<Record<GovernmentId, number>> = { imperial_bureaucracy: 9, steppe_confederation: 9, tributary_empire: 8, feudal_monarchy: 6, elective_monarchy: 6 };

interface TitleOut {
  id: string;
  name: string;
  rank: 'county' | 'duchy' | 'kingdom' | 'empire';
  color: string;
  parent: string | null;
  capital: number;
  law: string;
  short?: string;
  polity?: string;
  adj?: string;
}
const titles = new Map<string, TitleOut>();
const provDuchy: string[] = new Array(P).fill('');
const provKingdom: string[] = new Array(P).fill('');
const provEmpire: string[] = new Array(P).fill('');

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}
function jitter(hex: string, seed: number, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const j = (k: number) => (((hashStr(`${seed}:${k}`) % 1000) / 1000) * 2 - 1) * amount;
  return rgbToHex([r + j(1), g + j(2), b + j(3)]);
}
// Couleurs des entités de remplissage : teinte de la culture, variée.
for (const pol of polities) {
  if (pol.spec.color) continue;
  const base = CULTURE_BY.get(pol.spec.culture)?.color ?? '#888888';
  pol.spec.color = jitter(base, hashStr(pol.spec.id), 38);
}
function lawOf(spec: PolitySpec): string {
  const gov = GOVERNMENT_BY_ID[spec.gov]!;
  if (spec.gov === 'feudal_monarchy' || spec.gov === 'clan_realm') return CULTURE_BY.get(spec.culture)?.succession ?? gov.succession;
  return gov.succession;
}

/** Partition d'un ensemble de provinces en k groupes contigus (graines les plus éloignées). */
function partition(list: number[], k: number, first: number): number[][] {
  if (k <= 1 || list.length <= 1) return [list];
  const inSet = new Set(list);
  const seedsP = [first];
  while (seedsP.length < k) {
    const r = dijkstra(seedsP.map((p) => ({ p, cost: 0, tag: 0 })), { sea: true, allowed: (v) => inSet.has(v) });
    let far = -1;
    let farD = -1;
    for (const p of list) {
      const d = r.dist[p] === Infinity ? 1e7 + km(p, first) : r.dist[p]!;
      if (d > farD) {
        farD = d;
        far = p;
      }
    }
    if (far < 0 || seedsP.includes(far)) break;
    seedsP.push(far);
  }
  const r = dijkstra(seedsP.map((p, t) => ({ p, cost: 0, tag: t })), { sea: true, allowed: (v) => inSet.has(v) });
  const groups: number[][] = seedsP.map(() => []);
  for (const p of list) {
    let t = r.tag[p]!;
    if (t < 0) {
      let best = Infinity;
      seedsP.forEach((s, u) => {
        const d = km(p, s);
        if (d < best) {
          best = d;
          t = u;
        }
      });
    }
    groups[t]!.push(p);
  }
  return groups.filter((g) => g.length);
}
const seatOf = (group: number[]) => group.reduce((a, b) => (provImportance[b]! + provDev[b]! / 10 > provImportance[a]! + provDev[a]! / 10 ? b : a));

interface DivisionOut {
  id: string;
  polity: string;
  provinces: number[];
  seat: number;
}
const divisions: DivisionOut[] = [];
const polityDivisions = new Map<string, DivisionOut[]>();
for (const pol of polities) {
  const s = pol.spec;
  if (!pol.provinces.length) continue;
  const size = DIV_SIZE[s.gov] ?? 7;
  const k = pol.provinces.length <= size * 1.5 ? 1 : Math.round(pol.provinces.length / size);
  const first = pol.capital > 0 && pol.provinces.includes(pol.capital) ? pol.capital : pol.provinces[0]!;
  const groups = partition(pol.provinces, k, first);
  // Équilibrage : une division trop grande est coupée en deux (récursivement).
  const maxSize = Math.ceil(size * 1.4);
  for (let guard = 0; guard < 200; guard++) {
    const big = groups.findIndex((g) => g.length > maxSize);
    if (big < 0) break;
    const g = groups[big]!;
    const halves = partition(g, 2, g.includes(first) ? first : g[0]!);
    if (halves.length < 2) break;
    groups.splice(big, 1, ...halves);
  }
  // Groupe de la capitale en premier.
  groups.sort((a, b) => Number(b.includes(pol.capital)) - Number(a.includes(pol.capital)));
  const list: DivisionOut[] = groups.map((g, n) => ({ id: n === 0 ? `d_${s.id}` : `d_${s.id}_${n}`, polity: s.id, provinces: g, seat: n === 0 && g.includes(pol.capital) ? pol.capital : seatOf(g) }));
  polityDivisions.set(s.id, list);
  divisions.push(...list);
}

// Chaîne de suzeraineté (pour la hiérarchie de jure).
const specOf = (id: string) => polities[byId.get(id) ?? -1]?.spec;
function chain(id: string): PolitySpec[] {
  const out: PolitySpec[] = [];
  let cur = specOf(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.liege ? specOf(cur.liege) : undefined;
  }
  return out;
}
const DEJURE_EMPIRE: Record<string, string> = { yan: 'ming' };
const MACRO_EMPIRE: Record<MacroRegion, string> = {
  europe: 'Empire d’Europe', mena: 'Empire du Levant et de l’Iran', ssa: 'Empire d’Afrique', india: 'Empire des Indes', eastasia: 'Empire d’Asie orientale',
  northasia: 'Empire du Nord', seasia: 'Empire des mers du Sud', americas: 'Empire des Amériques', oceania: 'Empire du Pacifique',
};
const REGION_KINGDOM: Record<string, [string, string]> = {
  germany: ['k_germania', 'Royaume de Germanie'],
  low_countries: ['k_germania', 'Royaume de Germanie'],
  italy: ['k_italia', 'Royaume d’Italie'],
};

// Titres impériaux et royaux des entités.
for (const pol of polities) {
  const s = pol.spec;
  const law = lawOf(s);
  const capital = pol.capital > 0 ? pol.capital : (pol.provinces[0] ?? provinceAt(s.cap[0], s.cap[1]));
  if (s.rank === 'empire') titles.set(`e_${s.id}`, { id: `e_${s.id}`, name: s.name, rank: 'empire', color: s.color, parent: null, capital, law, short: s.short, polity: s.id, adj: s.adj });
  if (s.rank === 'kingdom') titles.set(`k_${s.id}`, { id: `k_${s.id}`, name: s.name, rank: 'kingdom', color: s.color, parent: null, capital, law, short: s.short, polity: s.id, adj: s.adj });
}
function ensureTitle(t: TitleOut): TitleOut {
  if (!titles.has(t.id)) titles.set(t.id, t);
  return titles.get(t.id)!;
}
// Pour chaque division : royaume et empire de jure.
for (const pol of polities) {
  const s = pol.spec;
  const divs = polityDivisions.get(s.id) ?? [];
  if (!divs.length) continue;
  const law = lawOf(s);
  const ch = chain(s.id);
  const empireSpec = ch.find((c) => c.rank === 'empire') ?? (DEJURE_EMPIRE[s.id] ? specOf(DEJURE_EMPIRE[s.id]!) : undefined);
  const kingdomSpec = ch.find((c) => c.rank === 'kingdom');
  // Empires : royaumes internes de ~5 divisions (sauf entités qui sont elles-mêmes empire sans royaume propre).
  let kingdomFor: (d: DivisionOut) => string;
  if (s.rank === 'empire') {
    const nk = Math.max(1, Math.round(divs.length / 5));
    const seatProvs = divs.map((d) => d.seat);
    const groups = nk <= 1 ? [seatProvs] : partition(seatProvs, nk, divs[0]!.seat);
    const map = new Map<number, string>();
    groups.forEach((g, n) => {
      const seat = g.includes(divs[0]!.seat) ? divs[0]!.seat : g[0]!;
      const id = `k_${s.id}_${n}`;
      const label = REALM_LABEL[s.gov] ?? 'Royaume';
      ensureTitle({ id, name: `${label} ${deName(provName[seat]!.replace(/ \(.*\)$/, ''))}`, rank: 'kingdom', color: jitter(s.color, n + 7, 22), parent: `e_${s.id}`, capital: seat, law, polity: s.id });
      for (const p of g) map.set(p, id);
    });
    kingdomFor = (d) => map.get(d.seat)!;
  } else if (s.rank === 'kingdom') {
    kingdomFor = () => `k_${s.id}`;
  } else if (kingdomSpec && kingdomSpec.id !== s.id) {
    kingdomFor = () => `k_${kingdomSpec.id}`;
  } else {
    kingdomFor = (d) => {
      const reg = prov[d.seat]!.region;
      const special = REGION_KINGDOM[reg];
      const regName = REGIONS.find((r) => r.id === reg)?.name ?? reg;
      const [id, name] = special ?? [`k_r_${reg}`, `Couronne ${deName(regName)}`];
      ensureTitle({ id, name, rank: 'kingdom', color: jitter('#8a8070', hashStr(id), 30), parent: null, capital: d.seat, law: 'elective' });
      return id;
    };
  }
  const empireFor = (kid: string, seat: number): string => {
    const own = titles.get(kid)!;
    if (own.parent) return own.parent;
    let eid: string;
    if (empireSpec && empireSpec.id !== s.id) eid = `e_${empireSpec.id}`;
    else if (s.rank === 'empire') eid = `e_${s.id}`;
    else {
      const macro = prov[seat]!.macro;
      eid = `e_m_${macro}`;
      ensureTitle({ id: eid, name: MACRO_EMPIRE[macro], rank: 'empire', color: jitter('#7a6a5a', hashStr(eid), 30), parent: null, capital: seat, law: 'elective' });
    }
    own.parent = eid;
    return eid;
  };
  divs.forEach((d, n) => {
    const kid = kingdomFor(d);
    const eid = empireFor(kid, d.seat);
    const seatName = provName[d.seat]!.replace(/ \(.*\)$/, '');
    const primary = n === 0 && s.rank === 'duchy';
    titles.set(d.id, {
      id: d.id,
      name: primary ? s.name : `${DIV_LABEL[s.gov]} ${deName(seatName)}`,
      rank: 'duchy',
      color: primary ? s.color : jitter(s.color, n + 1, 16),
      parent: kid,
      capital: d.seat,
      law,
      ...(primary ? { short: s.short, polity: s.id, adj: s.adj } : {}),
    });
    for (const p of d.provinces) {
      provDuchy[p] = d.id;
      provKingdom[p] = kid;
      provEmpire[p] = eid;
    }
  });
}
// Terres désolées : titres de jure régionaux sans titulaire.
for (const i of ids) {
  if (provDuchy[i]) continue;
  const reg = prov[i]!.region;
  const did = `d_w_${reg}`;
  const kid = `k_w_${prov[i]!.macro}`;
  const eid = `e_m_${prov[i]!.macro}`;
  ensureTitle({ id: eid, name: MACRO_EMPIRE[prov[i]!.macro], rank: 'empire', color: '#7a6a5a', parent: null, capital: i, law: 'elective' });
  ensureTitle({ id: kid, name: `Terres sauvages — ${MACRO_NAMES[prov[i]!.macro]}`, rank: 'kingdom', color: '#9aa0a6', parent: eid, capital: i, law: 'elective' });
  ensureTitle({ id: did, name: `Étendues ${deName(REGIONS.find((r) => r.id === reg)?.name ?? reg)}`, rank: 'duchy', color: '#b0b4b8', parent: kid, capital: i, law: 'elective' });
  provDuchy[i] = did;
  provKingdom[i] = kid;
  provEmpire[i] = eid;
}
// Comtés.
for (const i of ids) {
  const k = owner[i]!;
  const s = k >= 0 ? polities[k]!.spec : null;
  const primary = s && s.rank === 'county' && polities[k]!.capital === i;
  titles.set(`c${i}`, {
    id: `c${i}`,
    name: primary ? s.name : provName[i]!,
    rank: 'county',
    color: s ? jitter(s.color, i, 12) : '#b0b4b8',
    parent: provDuchy[i]!,
    capital: i,
    law: s ? lawOf(s) : 'elective',
    ...(primary ? { short: s.short, polity: s.id, adj: s.adj } : {}),
  });
}

// ---------------------------------------------------------------------------
// 6. Sorties
// ---------------------------------------------------------------------------

const TERRAINS = ['plains', 'farmlands', 'hills', 'mountains', 'forest', 'marsh', 'steppe', 'coast_cliffs', 'jungle', 'desert', 'savanna', 'tundra', 'ice'];
const LAWS = ['partition', 'primogeniture', 'elective', 'seniority'];
const cultureList = [...new Set(ids.map((i) => provCulture[i]!))].sort();
const faithList = [...new Set(ids.map((i) => provFaith[i]!))].sort();
const regionList = REGIONS.map((r) => ({ id: r.id, name: r.name, macro: r.macro }));
const regionIdx = new Map(regionList.map((r, k) => [r.id, k]));
const titleList = [...titles.values()];
const titleIdx = new Map(titleList.map((t, k) => [t.id, k]));
const round2 = (v: number) => Math.round(v * 100) / 100;

const world = {
  version: 1,
  scenario: 'monde_1400',
  cultures: cultureList,
  faiths: faithList,
  terrains: TERRAINS,
  laws: LAWS,
  regions: regionList,
  macros: Object.entries(MACRO_NAMES).map(([id, name]) => ({ id, name })),
  provinces: {
    id: ids,
    name: ids.map((i) => provName[i]),
    lon: ids.map((i) => prov[i]!.lon),
    lat: ids.map((i) => prov[i]!.lat),
    seat: ids.map((i) => (provSeat[i] ? [round2(provSeat[i]![0]), round2(provSeat[i]![1])] : 0)),
    bbox: ids.map((i) => prov[i]!.bbox),
    area: ids.map((i) => prov[i]!.areaKm2),
    elevation: ids.map((i) => prov[i]!.elevation),
    density: ids.map((i) => prov[i]!.density),
    terrain: ids.map((i) => TERRAINS.indexOf(prov[i]!.terrain)),
    coastal: ids.map((i) => (prov[i]!.coastal ? 1 : 0)),
    neighbors: ids.map((i) => prov[i]!.neighbors.filter((n) => prov[n])),
    straits: ids.map((i) => [...new Set(landAdj[i]!.map(([v]) => v).filter((v) => straitSet.has(`${Math.min(i, v)}:${Math.max(i, v)}`) && !prov[i]!.neighbors.includes(v)))]),
    seas: ids.map((i) => prov[i]!.seas),
    culture: ids.map((i) => cultureList.indexOf(provCulture[i]!)),
    faith: ids.map((i) => faithList.indexOf(provFaith[i]!)),
    region: ids.map((i) => regionIdx.get(prov[i]!.region) ?? 0),
    duchy: ids.map((i) => titleIdx.get(provDuchy[i]!)!),
    dev: ids.map((i) => provDev[i]!),
    fort: ids.map((i) => (provImportance[i]! >= 12 ? 3 : capitalProvinces.has(i) ? 2 : 1)),
    waste: ids.map((i) => (WASTE.has(i) ? 1 : 0)),
  },
  seas: raw.seas.map((s) => ({ i: s.i, lon: s.lon, lat: s.lat, neighbors: s.neighbors, deep: s.deep })),
  titles: titleList.map((t) => [t.id, t.name, t.rank, t.color, t.parent ? titleIdx.get(t.parent)! : -1, t.capital, LAWS.indexOf(t.law), t.short ?? '', t.polity ?? '', t.adj ?? '']),
};

const fillerSpecs = polities.filter((p) => p.filler).map((p) => p.spec);
const start = {
  version: 1,
  /** Entités de remplissage générées (les entités historiques sont dans @ttc/content/world1400). */
  fillers: fillerSpecs,
  polities: polities
    .filter((p) => p.provinces.length || p.spec.union || p.spec.id === 'hre')
    .map((p) => ({
      id: p.spec.id,
      rank: p.spec.rank,
      ...(p.spec.title ? { title: p.spec.title } : {}),
      capital: p.capital > 0 ? p.capital : provinceAt(p.spec.cap[0], p.spec.cap[1]),
      provinces: p.provinces,
      divisions: (polityDivisions.get(p.spec.id) ?? []).map((d) => ({ id: d.id, provinces: d.provinces, seat: d.seat })),
    })),
};

fs.mkdirSync(CONTENT_DATA, { recursive: true });
fs.writeFileSync(path.join(CONTENT_DATA, 'world.json'), JSON.stringify(world));
fs.writeFileSync(path.join(CONTENT_DATA, 'start.json'), JSON.stringify(start));

// Statistiques et contrôles.
const lost = polities.filter((p) => !p.filler && !p.provinces.length && !p.spec.union && p.spec.id !== 'hre').map((p) => p.spec.id);
if (lost.length) console.warn(`Entités sans territoire : ${lost.join(', ')}`);
const counts = polities.filter((p) => !p.filler).map((p) => [p.spec.id, p.provinces.length] as const).sort((a, b) => b[1] - a[1]);
console.log(`Entités historiques : ${counts.length}, de remplissage : ${fillerSpecs.length}, terres désolées : ${WASTE.size}`);
console.log(`Plus grandes : ${counts.slice(0, 20).map(([id, n]) => `${id}:${n}`).join(' ')}`);
console.log(`Titres : ${titleList.length} (divisions ${divisions.length}), cultures ${cultureList.length}, confessions ${faithList.length}`);
console.log(`world.json ${(fs.statSync(path.join(CONTENT_DATA, 'world.json')).size / 1e6).toFixed(2)} Mo, start.json ${(fs.statSync(path.join(CONTENT_DATA, 'start.json')).size / 1e6).toFixed(2)} Mo`);

// Aperçu politique (équirectangulaire, 1/2 résolution).
{
  const w2 = W / 2;
  const h2 = H / 2;
  const img = Buffer.alloc(w2 * h2 * 3);
  const colorOf = new Array<[number, number, number]>(P);
  for (const i of ids) {
    const k = owner[i]!;
    let c: [number, number, number] = WASTE.has(i) ? [230, 234, 238] : [150, 150, 150];
    if (k >= 0) {
      const s = polities[k]!.spec;
      let top = s;
      // Les vassaux prennent une nuance de la couleur du suzerain direct.
      if (s.liege && (s.subject === 'direct_vassal' || s.subject === 'autonomous_vassal' || s.subject === 'personal_union')) top = specOf(s.liege) ?? s;
      c = hexToRgb(top.id === s.id ? s.color : jitter(top.color, hashStr(s.id), 18));
    }
    colorOf[i] = c;
  }
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const k = y * 2 * W + x * 2;
      const l = grid[k]!;
      const o = (y * w2 + x) * 3;
      if (l > 0 && colorOf[l]) {
        let [r, g, b] = colorOf[l]!;
        const right = grid[k + 2] ?? l;
        const down = grid[k + 2 * W] ?? l;
        if ((right > 0 && owner[right] !== owner[l]) || (down > 0 && owner[down] !== owner[l])) {
          r *= 0.35;
          g *= 0.35;
          b *= 0.35;
        }
        img[o] = r;
        img[o + 1] = g;
        img[o + 2] = b;
      } else {
        img[o] = 40;
        img[o + 1] = 70;
        img[o + 2] = 100;
      }
    }
  }
  await sharp(img, { raw: { width: w2, height: h2, channels: 3 } }).png().toFile(path.join(WORK, 'political.png'));
  console.log('Aperçu : .cache/worldgen/political.png');
}
void ({} as Feature);
