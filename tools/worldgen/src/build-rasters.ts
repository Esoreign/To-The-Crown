/**
 * Étape 2 — grilles de travail à 0,05° :
 *  - altitude (m, Int16) depuis les tuiles Terrarium (Web Mercator z5) ;
 *  - masque terre/eau/lac (Natural Earth 10m) ;
 *  - déserts (régions physiques Natural Earth) ;
 *  - fleuves (force 0..255 selon le rang Natural Earth).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { LineString, MultiLineString, Position } from 'geojson';
import { DEM_ZOOM, NE_DIR, TERRARIUM_DIR } from './paths';
import {
  H,
  W,
  cellLat,
  cellLon,
  latToY,
  lonToX,
  polygonsOf,
  rasterizePolygon,
  readGeo,
  ringCenter,
  saveGrid,
} from './raster';

async function buildElevation(): Promise<Int16Array> {
  const n = 2 ** DEM_ZOOM;
  const size = n * 256;
  const merc = new Int16Array(size * size);
  for (let tx = 0; tx < n; tx++) {
    for (let ty = 0; ty < n; ty++) {
      const file = path.join(TERRARIUM_DIR, `${DEM_ZOOM}`, `${tx}`, `${ty}.png`);
      const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let py = 0; py < info.height; py++) {
        const row = (ty * 256 + py) * size + tx * 256;
        for (let px = 0; px < info.width; px++) {
          const o = (py * info.width + px) * 3;
          const h = data[o]! * 256 + data[o + 1]! + data[o + 2]! / 256 - 32768;
          merc[row + px] = Math.max(-32000, Math.min(32000, Math.round(h)));
        }
      }
    }
  }
  const elev = new Int16Array(W * H);
  const sample = (fx: number, fy: number): number => {
    const x0 = Math.floor(fx);
    const y0 = Math.max(0, Math.min(size - 2, Math.floor(fy)));
    const dx = fx - x0;
    const dy = fy - y0;
    const xa = ((x0 % size) + size) % size;
    const xb = (xa + 1) % size;
    const a = merc[y0 * size + xa]!;
    const b = merc[y0 * size + xb]!;
    const c = merc[(y0 + 1) * size + xa]!;
    const d = merc[(y0 + 1) * size + xb]!;
    return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
  };
  for (let y = 0; y < H; y++) {
    const lat = (cellLat(y) * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2) * size - 0.5;
    for (let x = 0; x < W; x++) {
      const fx = ((cellLon(x) + 180) / 360) * size - 0.5;
      elev[y * W + x] = Math.round(sample(fx, fy));
    }
  }
  return elev;
}

function buildLandMask(): Uint8Array {
  const mask = new Uint8Array(W * H);
  for (const file of ['ne_10m_land', 'ne_10m_minor_islands']) {
    for (const f of readGeo(path.join(NE_DIR, `${file}.geojson`)).features) {
      for (const poly of polygonsOf(f)) {
        const n = rasterizePolygon(poly, (x, y) => {
          mask[y * W + x] = 1;
        });
        // Île plus petite qu'une cellule : on marque au moins sa cellule centrale.
        if (n === 0 && poly[0]) {
          const [lon, lat] = ringCenter(poly[0]);
          const x = Math.floor(lonToX(lon));
          const y = Math.floor(latToY(lat));
          if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = 1;
        }
      }
    }
  }
  // Grands lacs (2) : ni terre, ni mer.
  for (const f of readGeo(path.join(NE_DIR, 'ne_10m_lakes.geojson')).features) {
    const rank = Number((f.properties as { scalerank?: number } | null)?.scalerank ?? 10);
    if (rank > 6) continue;
    for (const poly of polygonsOf(f)) {
      rasterizePolygon(poly, (x, y) => {
        mask[y * W + x] = 2;
      });
    }
  }
  return mask;
}

function buildDeserts(): Uint8Array {
  const g = new Uint8Array(W * H);
  for (const f of readGeo(path.join(NE_DIR, 'ne_10m_geography_regions_polys.geojson')).features) {
    const p = (f.properties ?? {}) as { featurecla?: string };
    if (p.featurecla !== 'Desert') continue;
    for (const poly of polygonsOf(f)) {
      rasterizePolygon(poly, (x, y) => {
        g[y * W + x] = 1;
      });
    }
  }
  return g;
}

function drawLine(grid: Uint8Array, a: Position, b: Position, value: number): void {
  let x0 = lonToX(a[0]!);
  const y0 = latToY(a[1]!);
  let x1 = lonToX(b[0]!);
  const y1 = latToY(b[1]!);
  if (Math.abs(x1 - x0) > W / 2) {
    if (x1 > x0) x0 += W;
    else x1 += W;
  }
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ((Math.floor(x0 + (x1 - x0) * t) % W) + W) % W;
    const y = Math.floor(y0 + (y1 - y0) * t);
    if (y < 0 || y >= H) continue;
    const k = y * W + x;
    if (grid[k]! < value) grid[k] = value;
  }
}

function buildRivers(): Uint8Array {
  const g = new Uint8Array(W * H);
  for (const f of readGeo(path.join(NE_DIR, 'ne_10m_rivers_lake_centerlines.geojson')).features) {
    const p = (f.properties ?? {}) as { scalerank?: number; featurecla?: string };
    if (p.featurecla && !/River/.test(p.featurecla)) continue;
    const rank = Number(p.scalerank ?? 10);
    if (rank > 7) continue;
    const value = Math.max(40, 255 - rank * 30);
    const geom = f.geometry as LineString | MultiLineString | null;
    if (!geom) continue;
    const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
    for (const line of lines)
      for (let i = 0; i + 1 < line.length; i++) drawLine(g, line[i]!, line[i + 1]!, value);
  }
  return g;
}

async function main(): Promise<void> {
  console.time('altitude');
  const elev = await buildElevation();
  saveGrid('elevation', elev);
  console.timeEnd('altitude');
  console.time('terres');
  const land = buildLandMask();
  saveGrid('land', land);
  console.timeEnd('terres');
  saveGrid('deserts', buildDeserts());
  saveGrid('rivers', buildRivers());
  let n = 0;
  for (const v of land) if (v === 1) n++;
  const probe = (lon: number, lat: number) =>
    `${land[Math.floor(latToY(lat)) * W + Math.floor(lonToX(lon))]}/${elev[Math.floor(latToY(lat)) * W + Math.floor(lonToX(lon))]}m`;
  console.log(`Grille ${W}×${H}, cellules de terre : ${n}`);
  console.log(
    `Sondes (terre/altitude) : Paris ${probe(2.35, 48.85)} · Everest ${probe(86.92, 27.99)} · Caspienne ${probe(50.5, 42)} · Pacifique ${probe(-150, 0)} · Mont Blanc ${probe(6.86, 45.83)}`,
  );
  fs.writeFileSync(
    path.join(path.dirname(TERRARIUM_DIR), 'worldgen', 'grid.json'),
    JSON.stringify({ width: W, height: H }),
  );
}

await main();
