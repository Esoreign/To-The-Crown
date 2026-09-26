/**
 * Géométrie sphérique pratique pour la caméra : longitudes, antiméridien
 * (ligne de changement de date), emprises « déroulées » et projection de
 * Mercator. Fonctions pures, testées (geo.test.ts).
 */

export type LngLat = [number, number];
/** [ouest, sud, est, nord] ; ouest > est signifie que l'emprise traverse l'antiméridien. */
export type Bounds = [number, number, number, number];

/** Ramène une longitude dans [-180, 180). */
export function normalizeLongitude(lon: number): number {
  const x = ((((lon + 180) % 360) + 360) % 360) - 180;
  return x === 180 ? -180 : x;
}

/** Longitude équivalente la plus proche d'une longitude de référence (continuité à l'écran). */
export function nearestLongitude(lon: number, ref: number): number {
  return lon + 360 * Math.round((ref - lon) / 360);
}

/**
 * « Déroule » une suite de longitudes : chaque point est ramené près du
 * précédent, pour qu'un tracé traversant l'antiméridien reste continu.
 */
export function unwrapGeometry(points: LngLat[]): LngLat[] {
  const out: LngLat[] = [];
  let prev: number | null = null;
  for (const [lon, lat] of points) {
    const l: number = prev === null ? lon : nearestLongitude(lon, prev);
    out.push([l, lat]);
    prev = l;
  }
  return out;
}

/**
 * Plus petite emprise contenant des points, en tenant compte de
 * l'antiméridien : on choisit la coupure dans le plus grand vide de
 * longitudes. Le résultat peut avoir ouest > est (traversée) ; voir
 * `unwrapBounds` pour une forme continue.
 */
export function getWrappedBounds(points: LngLat[]): Bounds | null {
  if (!points.length) return null;
  const lons = [...new Set(points.map(([lon]) => normalizeLongitude(lon)))].sort((a, b) => a - b);
  let south = Infinity;
  let north = -Infinity;
  for (const [, lat] of points) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (lons.length === 1) return [lons[0]!, south, lons[0]!, north];
  // Plus grand écart entre longitudes consécutives (y compris par-delà 180°).
  let gap = lons[0]! + 360 - lons[lons.length - 1]!;
  let west = lons[0]!;
  let east = lons[lons.length - 1]!;
  for (let i = 1; i < lons.length; i++) {
    const g = lons[i]! - lons[i - 1]!;
    if (g > gap) {
      gap = g;
      west = lons[i]!;
      east = lons[i - 1]!;
    }
  }
  return [west, south, east, north];
}

/** Emprise continue (est ≥ ouest, éventuellement > 180) utilisable par la caméra. */
export function unwrapBounds(b: Bounds): Bounds {
  const [w, s, e, n] = b;
  return e >= w ? b : [w, s, e + 360, n];
}

/** Centre d'une emprise (longitude normalisée). */
export function boundsCenter(b: Bounds): LngLat {
  const [w, s, e, n] = unwrapBounds(b);
  return [normalizeLongitude((w + e) / 2), (s + n) / 2];
}

/** Largeur en degrés de longitude d'une emprise (antiméridien compris). */
export function boundsWidth(b: Bounds): number {
  const [w, , e] = unwrapBounds(b);
  return e - w;
}

/** Fusionne des emprises (chacune pouvant traverser l'antiméridien). */
export function mergeBounds(list: Bounds[]): Bounds | null {
  const pts: LngLat[] = [];
  for (const b of list) {
    const [w, s, e, n] = unwrapBounds(b);
    // Échantillonne les bords pour conserver l'étendue réelle.
    const steps = Math.max(1, Math.ceil((e - w) / 30));
    for (let i = 0; i <= steps; i++) {
      const lon = w + ((e - w) * i) / steps;
      pts.push([lon, s], [lon, n]);
    }
  }
  return getWrappedBounds(pts);
}

const MAX_LAT = 85.051129;

/** Coordonnées de Mercator normalisées [0..1] (x vers l'est, y vers le sud). */
export function mercator([lon, lat]: LngLat): [number, number] {
  const l = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = (normalizeLongitude(lon) + 180) / 360;
  const r = (l * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
  return [x, y];
}

export function inverseMercator(x: number, y: number): LngLat {
  const lon = x * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [normalizeLongitude(lon), lat];
}

/**
 * Emprise « sûre » pour cadrer une entité : pas de zoom excessif sur une
 * minuscule île, pas de dézoom mondial pour un empire qui chevauche
 * l'antiméridien (la forme déroulée est utilisée).
 */
export function fitFeatureSafely(b: Bounds, minSpanDeg = 2.5): Bounds {
  const [w, s, e, n] = unwrapBounds(b);
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const halfW = Math.max((e - w) / 2, minSpanDeg / 2);
  const halfH = Math.max((n - s) / 2, minSpanDeg / 2);
  return [cx - halfW, Math.max(-80, cy - halfH), cx + halfW, Math.min(84, cy + halfH)];
}
