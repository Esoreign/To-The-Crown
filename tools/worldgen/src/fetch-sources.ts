/**
 * Étape 1 — téléchargement des sources ouvertes (voir docs/DATA_SOURCES.md).
 *  - Natural Earth (domaine public) : terres, lacs, fleuves, régions
 *    physiques, lieux habités, noms de mers, bathymétrie.
 *  - Terrain Tiles on AWS (format Terrarium) : altitude/bathymétrie mondiale.
 * Idempotent : un fichier déjà présent n'est pas re-téléchargé.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEM_ZOOM, NE_DIR, TERRARIUM_DIR, CACHE } from './paths';

const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
export const NE_FILES = [
  'ne_10m_land',
  'ne_10m_minor_islands',
  'ne_10m_lakes',
  'ne_10m_rivers_lake_centerlines',
  'ne_10m_populated_places_simple',
  'ne_10m_geography_regions_polys',
  'ne_10m_geography_regions_points',
  'ne_10m_geography_marine_polys',
  'ne_50m_land',
  'ne_50m_lakes',
  'ne_50m_rivers_lake_centerlines',
  'ne_50m_geography_marine_polys',
];
const TERRARIUM_BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';

async function download(url: string, dest: string): Promise<'cached' | 'ok'> {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return 'cached';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return 'ok';
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]!);
    }),
  );
}

async function main(): Promise<void> {
  for (const f of NE_FILES) {
    const r = await download(`${NE_BASE}${f}.geojson`, path.join(NE_DIR, `${f}.geojson`));
    console.log(`Natural Earth ${f}: ${r}`);
  }
  const n = 2 ** DEM_ZOOM;
  const tiles: [number, number][] = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) tiles.push([x, y]);
  let done = 0;
  await pool(tiles, 16, async ([x, y]) => {
    await download(
      `${TERRARIUM_BASE}${DEM_ZOOM}/${x}/${y}.png`,
      path.join(TERRARIUM_DIR, `${DEM_ZOOM}`, `${x}`, `${y}.png`),
    );
    if (++done % 128 === 0) console.log(`Terrarium z${DEM_ZOOM}: ${done}/${tiles.length}`);
  });
  fs.writeFileSync(
    path.join(CACHE, 'sources.json'),
    JSON.stringify(
      { accessed: new Date().toISOString().slice(0, 10), naturalEarth: NE_FILES, terrariumZoom: DEM_ZOOM },
      null,
      2,
    ),
  );
  console.log('Sources prêtes.');
}

await main();
