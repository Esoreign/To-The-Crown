/**
 * Étape 4 — géométries servies au client (apps/web/public/world/) :
 *  - provinces.geojson : polygones lissés, côtes nettes (intersection avec
 *    les terres Natural Earth 10m simplifiées), id numérique = indice ;
 *  - borders.geojson : frontières partagées (a, b) et côtes (b = 0), issues
 *    d'une topologie des polygones finaux (arcs communs exacts) ;
 *  - seas.geojson : zones maritimes ; rivers.geojson, lakes.geojson.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import polygonClipping, { type MultiPolygon as PCMulti } from 'polygon-clipping';
import Flatbush from 'flatbush';
import { topology } from 'topojson-server';
import { feature } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { chaikin, clipRing, ringArea, round, simplifyDP } from './geom';
import { NE_DIR, PUBLIC_WORLD, WORK } from './paths';
import { H, W, loadGridI32, loadGridU8, polygonsOf, readGeo } from './raster';
import { ringsToMultiPolygon, traceLabels } from './vectorize';

const BAND = 4;

function bandLabels(label: Int32Array, land: Uint8Array): Int32Array {
  const out = new Int32Array(label);
  const dist = new Uint8Array(W * H).fill(255);
  const q = new Int32Array(W * H);
  let h = 0;
  let t = 0;
  for (let k = 0; k < W * H; k++)
    if (label[k]) {
      dist[k] = 0;
      q[t++] = k;
    }
  while (h < t) {
    const k = q[h++]!;
    const d = dist[k]!;
    if (d >= BAND) continue;
    const y = (k / W) | 0;
    const x = k - y * W;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      const j = yy * W + ((x + dx + W) % W);
      if (land[j] === 1 || dist[j]! <= d + 1) continue;
      dist[j] = d + 1;
      out[j] = out[k]!;
      q[t++] = j;
    }
  }
  return out;
}

type Topo = Topology<{ f: GeometryCollection }>;

/** Lissage des arcs d'une topologie (les frontières partagées restent communes). */
function smoothArcs(topo: Topo, tolerance: number, iterations: number): void {
  topo.arcs = topo.arcs.map((arc: number[][]) => simplifyDP(chaikin(simplifyDP(arc.map((p: number[]) => [p[0]!, p[1]!]), tolerance), iterations), tolerance / 3));
}

function toFeatures(topo: Topo): Feature<MultiPolygon | Polygon>[] {
  const fc = feature(topo, topo.objects.f) as unknown as FeatureCollection<MultiPolygon | Polygon>;
  return fc.features;
}

function asMulti(g: Polygon | MultiPolygon): Position[][][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

function bboxOf(polys: Position[][][]): [number, number, number, number] {
  let a = Infinity;
  let b = Infinity;
  let c = -Infinity;
  let d = -Infinity;
  for (const poly of polys)
    for (const p of poly[0]!) {
      a = Math.min(a, p[0]!);
      b = Math.min(b, p[1]!);
      c = Math.max(c, p[0]!);
      d = Math.max(d, p[1]!);
    }
  return [a, b, c, d];
}

function writeJson(name: string, data: unknown): void {
  fs.mkdirSync(PUBLIC_WORLD, { recursive: true });
  const file = path.join(PUBLIC_WORLD, name);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(`${name} : ${(fs.statSync(file).size / 1e6).toFixed(2)} Mo`);
}

function main(): void {
  const label = loadGridI32('provinces');
  const seaLabel = loadGridI32('seas');
  const land = loadGridU8('land');

  // --- Provinces : tracé, topologie, lissage -------------------------------
  console.time('tracé provinces');
  const rings = traceLabels(bandLabels(label, land));
  const fc: FeatureCollection<MultiPolygon> = { type: 'FeatureCollection', features: [] };
  for (const [l, r] of rings) fc.features.push({ type: 'Feature', id: l, properties: { i: l }, geometry: ringsToMultiPolygon(r) });
  console.timeEnd('tracé provinces');
  console.time('topologie');
  let topo = topology({ f: fc }) as unknown as Topo;
  topo = presimplify(topo) as Topo;
  topo = simplify(topo, 0.0016) as Topo;
  smoothArcs(topo, 0.018, 1);
  const smoothed = toFeatures(topo);
  console.timeEnd('topologie');

  // --- Découpe par les terres (côtes nettes) --------------------------------
  console.time('côtes');
  const landParts: Position[][][] = [];
  for (const file of ['ne_10m_land', 'ne_10m_minor_islands']) {
    for (const f of readGeo(path.join(NE_DIR, `${file}.geojson`)).features) {
      for (const poly of polygonsOf(f)) {
        const simplified = poly.map((ring) => {
          const s = simplifyDP(ring, 0.018);
          return s.length >= 4 ? s : ring;
        });
        landParts.push(simplified);
      }
    }
  }
  const index = new Flatbush(landParts.length);
  for (const p of landParts) {
    const [a, b, c, d] = bboxOf([p]);
    index.add(a, b, c, d);
  }
  index.finish();
  const hasWaterBand = new Set<number>();
  for (let k = 0; k < W * H; k++) if (label[k] === 0 && land[k] !== 1) void 0;
  {
    const band = bandLabels(label, land);
    for (let k = 0; k < W * H; k++) if (band[k] && !label[k]) hasWaterBand.add(band[k]!);
  }
  const finalFeatures: Feature<MultiPolygon>[] = [];
  let clipped = 0;
  let fallback = 0;
  for (const f of smoothed) {
    const id = Number(f.id);
    const polys = asMulti(f.geometry);
    if (!hasWaterBand.has(id)) {
      finalFeatures.push({ type: 'Feature', id, properties: { i: id }, geometry: { type: 'MultiPolygon', coordinates: polys } });
      continue;
    }
    const [a, b, c, d] = bboxOf(polys);
    const m = 0.05;
    const parts: PCMulti = [];
    for (const idx of index.search(a - m, b - m, c + m, d + m)) {
      const part = landParts[idx]!;
      const outer = clipRing(part[0]!, a - m, b - m, c + m, d + m);
      if (!outer.length) continue;
      const holes = part
        .slice(1)
        .map((r) => clipRing(r, a - m, b - m, c + m, d + m))
        .filter((r) => r.length);
      parts.push([outer, ...holes] as never);
    }
    let result: Position[][][] = [];
    try {
      result = parts.length ? (polygonClipping.intersection(polys as never, parts) as unknown as Position[][][]) : [];
    } catch {
      result = [];
    }
    result = result.filter((poly) => Math.abs(ringArea(poly[0]!)) > 2e-5);
    if (!result.length) {
      fallback++;
      result = polys;
    } else clipped++;
    finalFeatures.push({ type: 'Feature', id, properties: { i: id }, geometry: { type: 'MultiPolygon', coordinates: result } });
  }
  console.timeEnd('côtes');
  console.log(`découpées ${clipped}, conservées telles quelles ${fallback}`);

  // --- Topologie finale : frontières et côtes --------------------------------
  console.time('frontières');
  const finalTopo = topology({ f: { type: 'FeatureCollection', features: finalFeatures } as FeatureCollection }, 1e6) as unknown as Topo;
  const owners: number[][] = finalTopo.arcs.map(() => []);
  for (const g of finalTopo.objects.f.geometries) {
    const id = Number((g as { id?: number }).id);
    const walk = (arcs: unknown): void => {
      if (typeof arcs === 'number') owners[arcs < 0 ? ~arcs : arcs]!.push(id);
      else if (Array.isArray(arcs)) for (const a of arcs) walk(a);
    };
    walk((g as { arcs?: unknown }).arcs);
  }
  const lineTopo = {
    ...finalTopo,
    objects: {
      f: {
        type: 'GeometryCollection',
        geometries: owners.map((o, i) => ({ type: 'LineString', arcs: [i], properties: { a: o[0] ?? 0, b: o[1] ?? 0 } })),
      },
    },
  } as unknown as Topo;
  const lines = (feature(lineTopo, lineTopo.objects.f) as unknown as FeatureCollection<LineString>).features;
  const borders = {
    type: 'FeatureCollection',
    features: lines
      .filter((l) => l.geometry && l.geometry.coordinates.length >= 2 && (l.properties as { b: number }).b !== 0)
      .map((l, i) => ({
        type: 'Feature',
        id: i + 1,
        properties: { a: (l.properties as { a: number }).a, b: (l.properties as { b: number }).b },
        geometry: { type: 'LineString', coordinates: l.geometry.coordinates.map((p) => round(p, 3)) },
      })),
  };
  const provincesOut = (feature(finalTopo, finalTopo.objects.f) as unknown as FeatureCollection<MultiPolygon | Polygon>).features.map((f) => ({
    type: 'Feature',
    id: Number(f.id),
    properties: { i: Number(f.id) },
    geometry: { type: f.geometry.type, coordinates: f.geometry.type === 'Polygon' ? f.geometry.coordinates.map((r) => r.map((p) => round(p, 3))) : f.geometry.coordinates.map((poly) => poly.map((r) => r.map((p) => round(p, 3)))) },
  }));
  console.timeEnd('frontières');
  // Topologie compacte pour le client : provinces (arcs partagés) ; le client
  // en dérive les polygones et toutes les frontières (provinces, royaumes, côtes).
  const clientTopo = topology({ provinces: { type: 'FeatureCollection', features: provincesOut } as FeatureCollection }, 4e5);
  writeJson('provinces.topo.json', clientTopo);
  void borders;

  // --- Zones maritimes -------------------------------------------------------
  console.time('mers');
  const seaRings = traceLabels(seaLabel);
  const seaFc: FeatureCollection<MultiPolygon> = { type: 'FeatureCollection', features: [] };
  for (const [l, r] of seaRings) seaFc.features.push({ type: 'Feature', id: l, properties: { i: l }, geometry: ringsToMultiPolygon(r) });
  let seaTopo = topology({ f: seaFc }) as unknown as Topo;
  seaTopo = presimplify(seaTopo) as Topo;
  seaTopo = simplify(seaTopo, 0.08) as Topo;
  smoothArcs(seaTopo, 0.12, 1);
  const seaOut = toFeatures(seaTopo).map((f) => ({
    type: 'Feature',
    id: Number(f.id),
    properties: { i: Number(f.id) },
    geometry: { type: f.geometry.type, coordinates: f.geometry.type === 'Polygon' ? f.geometry.coordinates.map((r) => r.map((p) => round(p, 2))) : f.geometry.coordinates.map((poly) => poly.map((r) => r.map((p) => round(p, 2)))) },
  }));
  console.timeEnd('mers');
  writeJson('seas.topo.json', topology({ seas: { type: 'FeatureCollection', features: seaOut } as FeatureCollection }, 1e5));

  // --- Fleuves et lacs --------------------------------------------------------
  const rivers = readGeo(path.join(NE_DIR, 'ne_10m_rivers_lake_centerlines.geojson'));
  const riverOut = rivers.features
    .filter((f) => {
      const p = (f.properties ?? {}) as { scalerank?: number; featurecla?: string };
      return Number(p.scalerank ?? 10) <= 7 && (!p.featurecla || /River/.test(p.featurecla));
    })
    .map((f) => {
      const p = f.properties as { scalerank: number; name?: string };
      const g = f.geometry as LineString | MultiLineString;
      const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
      return {
        type: 'Feature',
        properties: { r: p.scalerank, n: p.name ?? '' },
        geometry: { type: 'MultiLineString', coordinates: lines.map((l) => simplifyDP(l, 0.01).map((q) => round(q, 3))) },
      };
    });
  writeJson('rivers.geojson', { type: 'FeatureCollection', features: riverOut });
  const lakes = readGeo(path.join(NE_DIR, 'ne_10m_lakes.geojson'));
  const lakeOut = lakes.features
    .filter((f) => Number((f.properties as { scalerank?: number }).scalerank ?? 10) <= 6)
    .map((f) => ({
      type: 'Feature',
      properties: { n: (f.properties as { name?: string }).name ?? '' },
      geometry: { type: 'MultiPolygon', coordinates: polygonsOf(f).map((poly) => poly.map((r) => simplifyDP(r, 0.01).map((q) => round(q, 3)))) },
    }));
  writeJson('lakes.geojson', { type: 'FeatureCollection', features: lakeOut });
  fs.writeFileSync(path.join(WORK, 'geometry.done'), new Date().toISOString());
}

main();
