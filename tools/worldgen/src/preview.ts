/** Aperçu PNG équirectangulaire des provinces (contrôle visuel du pipeline) : tsx src/preview.ts w,s,e,n sortie.png */
import fs from 'node:fs';
import sharp from 'sharp';
const [,, bboxArg, out] = process.argv;
const [w0, s0, e0, n0] = (bboxArg ?? '-180,-60,180,84').split(',').map(Number) as [number, number, number, number];
const Wd = 2400;
const Hd = Math.round((Wd * (n0 - s0)) / (e0 - w0));
const X = (lon: number) => ((lon - w0) / (e0 - w0)) * Wd;
const Y = (lat: number) => ((n0 - lat) / (n0 - s0)) * Hd;
const prov = JSON.parse(fs.readFileSync('/home/user/To-The-Crown/apps/web/public/world/provinces.geojson', 'utf8'));
const borders = JSON.parse(fs.readFileSync('/home/user/To-The-Crown/apps/web/public/world/borders.geojson', 'utf8'));
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Hd}"><rect width="100%" height="100%" fill="#1d3b53"/>`;
for (const f of prov.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const h = (f.id * 137.5) % 360;
  let d = '';
  for (const poly of polys) for (const ring of poly) { d += 'M' + ring.map((p: number[]) => `${X(p[0]!).toFixed(1)},${Y(p[1]!).toFixed(1)}`).join('L') + 'Z'; }
  svg += `<path d="${d}" fill="hsl(${h},35%,${55 + (f.id % 3) * 7}%)" fill-rule="evenodd"/>`;
}
for (const f of borders.features) svg += `<path d="M${f.geometry.coordinates.map((p: number[]) => `${X(p[0]!).toFixed(1)},${Y(p[1]!).toFixed(1)}`).join('L')}" stroke="#222" stroke-width="0.6" fill="none"/>`;
svg += '</svg>';
await sharp(Buffer.from(svg)).png().toFile(out!);
console.log('ok', out);
