/**
 * Emplacements du pipeline. Les sources brutes vont dans `.cache/` (non
 * versionné, re-téléchargeable) ; les produits dérivés sont versionnés.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const CACHE = path.join(ROOT, '.cache');
export const NE_DIR = path.join(CACHE, 'natural-earth');
export const TERRARIUM_DIR = path.join(CACHE, 'terrarium');
export const WORK = path.join(CACHE, 'worldgen');

/** Données de jeu statiques (versionnées) consommées par game-core et le client. */
export const CONTENT_DATA = path.join(ROOT, 'packages/content/data/world1400');
/** Ressources servies telles quelles par le site (géométries, tuiles). */
export const PUBLIC_WORLD = path.join(ROOT, 'apps/web/public/world');

/** Zoom des tuiles d'altitude sources (Terrarium). */
export const DEM_ZOOM = 5;

/**
 * Grille de travail équirectangulaire : 0,05° (≈ 5,5 km à l'équateur).
 * Latitudes de +84° à −60° (l'Antarctique n'a pas de provinces).
 */
export const GRID = {
  res: 0.05,
  north: 84,
  south: -60,
  get width(): number {
    return Math.round(360 / this.res);
  },
  get height(): number {
    return Math.round((this.north - this.south) / this.res);
  },
};
