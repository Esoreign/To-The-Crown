/**
 * Étape 5 — tuiles raster « atlas » (Web Mercator, z0–z5, WebP) servies
 * sous apps/web/public/world/terrain/{z}/{x}/{y}.webp : couleur de milieu,
 * ombrage du relief, bathymétrie, neige des hauts sommets, léger grain.
 * Les couleurs politiques sont superposées côté client.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { B, climateColor, fbm, hash2 as hash } from './biome';
import { DEM_ZOOM, GRID, PUBLIC_WORLD, TERRARIUM_DIR } from './paths';
import { H, W, loadGridF32, loadGridU8 } from './raster';

const MAXZ = DEM_ZOOM;
const SIZE = 2 ** MAXZ * 256;

const PALETTE: Record<number, [number, number, number]> = {
  [B.plains]: [170, 170, 120],
  [B.farmlands]: [178, 172, 116],
  [B.hills]: [160, 154, 116],
  [B.mountains]: [146, 138, 120],
  [B.forest]: [104, 126, 82],
  [B.jungle]: [78, 110, 70],
  [B.marsh]: [118, 132, 100],
  [B.steppe]: [192, 180, 126],
  [B.desert]: [216, 194, 150],
  [B.savanna]: [186, 168, 108],
  [B.tundra]: [160, 164, 144],
  [B.ice]: [232, 236, 238],
};

async function loadMercatorElevation(): Promise<Float32Array> {
  const n = 2 ** DEM_ZOOM;
  const elev = new Float32Array(SIZE * SIZE);
  for (let tx = 0; tx < n; tx++) {
    for (let ty = 0; ty < n; ty++) {
      const { data, info } = await sharp(path.join(TERRARIUM_DIR, `${DEM_ZOOM}`, `${tx}`, `${ty}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let py = 0; py < info.height; py++) {
        for (let px = 0; px < info.width; px++) {
          const o = (py * info.width + px) * 3;
          elev[(ty * 256 + py) * SIZE + tx * 256 + px] = data[o]! * 256 + data[o + 1]! + data[o + 2]! / 256 - 32768;
        }
      }
    }
  }
  return elev;
}

async function main(): Promise<void> {
  const biome = loadGridU8('biome');
  const land = loadGridU8('land');
  const temp = loadGridF32('temp');
  const moist = loadGridF32('moist');
  void biome;
  console.time('altitude mercator');
  const elev = await loadMercatorElevation();
  console.timeEnd('altitude mercator');

  // Image mondiale pleine résolution (z5) en RGB.
  console.time('peinture');
  const rgb = new Uint8Array(SIZE * SIZE * 3);
  const latOf = (py: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * (py + 0.5)) / SIZE))) * 180) / Math.PI;
  for (let py = 0; py < SIZE; py++) {
    const lat = latOf(py);
    const gy = Math.floor((GRID.north - lat) / GRID.res);
    const pxKm = (40075 / SIZE) * Math.cos((lat * Math.PI) / 180);
    for (let px = 0; px < SIZE; px++) {
      const k = py * SIZE + px;
      const e = elev[k]!;
      const lon = ((px + 0.5) / SIZE) * 360 - 180;
      const gx = Math.floor((lon + 180) / GRID.res);
      const inGrid = gy >= 0 && gy < H;
      const gk = inGrid ? gy * W + Math.min(W - 1, gx) : -1;
      const isLand = inGrid ? land[gk] === 1 : e > 0;
      const isLake = inGrid && land[gk] === 2;
      // Ombrage : gradient est-ouest / nord-sud, lumière du nord-ouest.
      const ex = elev[py * SIZE + ((px + 1) % SIZE)]! - elev[py * SIZE + ((px - 1 + SIZE) % SIZE)]!;
      const ey = elev[Math.min(SIZE - 1, py + 1) * SIZE + px]! - elev[Math.max(0, py - 1) * SIZE + px]!;
      const grain = (hash(px, py) - 0.5) * 6;
      let r: number;
      let g: number;
      let b: number;
      if (isLand) {
        const greenlandIce = lat > 59 && e > 900 && lon > -75 && lon < -10;
        const base: [number, number, number] = greenlandIce ? [...PALETTE[B.ice]!] : inGrid ? climateColor(temp[gk]!, moist[gk]!) : lat < -60 || lat > 80 ? [...PALETTE[B.ice]!] : [...PALETTE[B.tundra]!];
        // Variation douce de teinte (taches de végétation).
        const v = (fbm(px / 40, py / 40, 21) - 0.5) * 18;
        base[0] += v * 0.8;
        base[1] += v;
        base[2] += v * 0.6;
        const z = 2.2 / (2 * pxKm * 1000);
        const nx = -ex * z;
        const ny = -ey * z;
        const shade = (nx * -0.6 + ny * -0.6 + 1) / Math.sqrt(nx * nx + ny * ny + 1);
        const s = Math.max(0.62, Math.min(1.22, 0.35 + shade * 0.72));
        [r, g, b] = base.map((c) => c * s + grain) as [number, number, number];
        if (e > 3800) {
          const snow = Math.min(1, (e - 3800) / 1600) * 0.75;
          r = r * (1 - snow) + 244 * snow;
          g = g * (1 - snow) + 245 * snow;
          b = b * (1 - snow) + 247 * snow;
        }
      } else {
        const depth = Math.max(0, -e);
        const t = Math.min(1, Math.sqrt(depth / 6000));
        const shallow = isLake ? [104, 148, 164] : [98, 144, 164];
        const deep = [26, 52, 78];
        r = shallow[0]! * (1 - t) + deep[0]! * t + grain * 0.5;
        g = shallow[1]! * (1 - t) + deep[1]! * t + grain * 0.5;
        b = shallow[2]! * (1 - t) + deep[2]! * t + grain * 0.5;
        // Relief sous-marin très discret.
        const sh = Math.max(-8, Math.min(8, (ex + ey) * 0.004));
        r += sh;
        g += sh;
        b += sh;
      }
      rgb[k * 3] = Number.isFinite(r) ? Math.max(0, Math.min(255, r)) : 200;
      rgb[k * 3 + 1] = Number.isFinite(g) ? Math.max(0, Math.min(255, g)) : 200;
      rgb[k * 3 + 2] = Number.isFinite(b) ? Math.max(0, Math.min(255, b)) : 200;
    }
  }
  console.timeEnd('peinture');

  console.time('tuiles');
  const base = path.join(PUBLIC_WORLD, 'terrain');
  fs.rmSync(base, { recursive: true, force: true });
  const full = sharp(Buffer.from(rgb.buffer), { raw: { width: SIZE, height: SIZE, channels: 3 }, limitInputPixels: false });
  let bytes = 0;
  for (let z = 0; z <= MAXZ; z++) {
    const dim = 2 ** z * 256;
    const level = z === MAXZ ? Buffer.from(rgb.buffer) : await full.clone().resize(dim, dim, { kernel: 'lanczos3' }).raw().toBuffer();
    const n = 2 ** z;
    for (let tx = 0; tx < n; tx++) {
      for (let ty = 0; ty < n; ty++) {
        const dir = path.join(base, `${z}`, `${tx}`);
        fs.mkdirSync(dir, { recursive: true });
        const out = path.join(dir, `${ty}.webp`);
        await sharp(level, { raw: { width: dim, height: dim, channels: 3 }, limitInputPixels: false })
          .extract({ left: tx * 256, top: ty * 256, width: 256, height: 256 })
          .webp({ quality: 72, effort: 4 })
          .toFile(out);
        bytes += fs.statSync(out).size;
      }
    }
    console.log(`z${z} ok`);
  }
  // Minicarte : vue mondiale unique (équirectangulaire non requise : Mercator z2).
  await full.clone().resize(1024, 1024).webp({ quality: 70 }).toFile(path.join(PUBLIC_WORLD, 'minimap.webp'));
  console.timeEnd('tuiles');
  console.log(`tuiles : ${(bytes / 1e6).toFixed(1)} Mo`);
}

await main();
