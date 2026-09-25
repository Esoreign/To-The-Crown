/**
 * Outil de contrôle visuel : extrait une zone de l'aperçu politique.
 * Usage : tsx src/crop.ts <ouest> <sud> <est> <nord> <sortie.png> [échelle]
 */
import path from 'node:path';
import sharp from 'sharp';
import { WORK } from './paths';

const [w, s, e, n, out, scale = '1'] = process.argv.slice(2);
const x0 = Math.round((Number(w) + 180) * 10);
const x1 = Math.round((Number(e) + 180) * 10);
const y0 = Math.round((84 - Number(n)) * 10);
const y1 = Math.round((84 - Number(s)) * 10);
await sharp(path.join(WORK, 'political.png'))
  .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
  .resize({ width: Math.round((x1 - x0) * Number(scale)), kernel: 'nearest' })
  .toFile(out!);
