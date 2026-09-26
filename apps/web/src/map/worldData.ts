/**
 * Géométries du monde (servies statiquement depuis /world) : chargées une
 * seule fois et partagées par toutes les cartes de l'application.
 *
 * - provinces.topo.json : polygones des provinces (découpés par les côtes).
 * - borders.json : arcs de frontière exacts entre deux provinces (a, b),
 *   d'où l'on compose toutes les frontières (provinces, vassaux, royaumes)
 *   par un simple filtre sur les deux provinces voisines.
 * - coast.geojson : littoral ; seas.topo.json : zones maritimes ;
 *   rivers/lakes.geojson : hydrographie.
 */
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiLineString, Position } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

export interface BorderArcs {
  a: Int32Array;
  b: Int32Array;
  /** Morceaux terrestres de chaque arc. */
  lines: Position[][][];
}

export interface WorldGeometry {
  arcs: BorderArcs;
  provinces: FeatureCollection<Geometry, { i: number }>;
  seas: FeatureCollection<Geometry, { i: number }>;
  rivers: FeatureCollection<Geometry, { r: number; n: string }>;
  lakes: FeatureCollection<Geometry, { n: string }>;
  /** Frontières entre provinces différentes (statique). */
  provinceBorders: MultiLineString;
  /** Littoral. */
  coasts: FeatureCollection;
}

let pending: Promise<WorldGeometry> | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chargement impossible : ${url} (${res.status})`);
  return (await res.json()) as T;
}

/** URL de base des ressources du monde (sous-chemin de déploiement pris en compte). */
export const WORLD_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/world`;

export function loadWorldGeometry(): Promise<WorldGeometry> {
  pending ??= (async () => {
    const [topo, seaTopo, rivers, lakes, rawArcs, coasts] = await Promise.all([
      fetchJson<Topology<{ provinces: GeometryCollection<{ i: number }> }>>(
        `${WORLD_BASE}/provinces.topo.json`,
      ),
      fetchJson<Topology<{ seas: GeometryCollection<{ i: number }> }>>(`${WORLD_BASE}/seas.topo.json`),
      fetchJson<WorldGeometry['rivers']>(`${WORLD_BASE}/rivers.geojson`),
      fetchJson<WorldGeometry['lakes']>(`${WORLD_BASE}/lakes.geojson`),
      fetchJson<{ a: number[]; b: number[]; p: number[][][] }>(`${WORLD_BASE}/borders.json`),
      fetchJson<FeatureCollection>(`${WORLD_BASE}/coast.geojson`),
    ]);
    const provinces = feature(topo, topo.objects.provinces) as unknown as WorldGeometry['provinces'];
    const seas = feature(seaTopo, seaTopo.objects.seas) as unknown as WorldGeometry['seas'];
    const arcs: BorderArcs = {
      a: Int32Array.from(rawArcs.a),
      b: Int32Array.from(rawArcs.b),
      lines: rawArcs.p.map((pieces) =>
        pieces.map((q) => {
          const out: Position[] = [];
          let x = 0;
          let y = 0;
          for (let i = 0; i < q.length; i += 2) {
            x += q[i]!;
            y += q[i + 1]!;
            out.push([x / 1000, y / 1000]);
          }
          return out;
        }),
      ),
    };
    const provinceBorders: MultiLineString = { type: 'MultiLineString', coordinates: arcs.lines.flat() };
    return { arcs, provinces, seas, rivers, lakes, provinceBorders, coasts };
  })();
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

/**
 * Frontières entre provinces dont la clé diffère (royaume, vassal…).
 * `keyOf` reçoit l'indice numérique de la province.
 */
export function bordersBy(geo: WorldGeometry, keyOf: (index: number) => string | null): MultiLineString {
  const out: Position[][] = [];
  const { a, b, lines } = geo.arcs;
  for (let i = 0; i < a.length; i++) {
    const ka = keyOf(a[i]!);
    const kb = keyOf(b[i]!);
    if (ka !== kb) out.push(...lines[i]!);
  }
  return { type: 'MultiLineString', coordinates: out };
}

/** Frontière terrestre d'un ensemble de provinces. */
export function outlineOf(geo: WorldGeometry, inside: (index: number) => boolean): MultiLineString {
  const out: Position[][] = [];
  const { a, b, lines } = geo.arcs;
  for (let i = 0; i < a.length; i++) if (inside(a[i]!) !== inside(b[i]!)) out.push(...lines[i]!);
  return { type: 'MultiLineString', coordinates: out };
}

export function asFeature(g: Geometry): Feature {
  return { type: 'Feature', properties: {}, geometry: g };
}
