/**
 * Données géographiques et politiques statiques du monde (générées une fois,
 * versionnées dans @ttc/content/data/world.json).
 */
import type { CultureDef, SuccessionLaw, Terrain, TitleRank } from './content-schema';

export type Point = [number, number];

export interface ProvinceGeo {
  id: string;
  name: string;
  /** Contour extérieur (anneau fermé implicite). */
  polygon: Point[];
  /** Trous éventuels (enclaves). */
  holes?: Point[][];
  centroid: Point;
  /** Position de la capitale / du marqueur principal. */
  capital: Point;
  /** Position du label et orientation (radians). */
  label: { at: Point; angle: number; size: number };
  area: number;
  neighbors: string[];
  /** Voisins via un détroit (coût de traversée supérieur). */
  straits: string[];
  terrain: Terrain;
  coastal: boolean;
  cultureId: string;
  faithId: string;
  countyTitleId: string;
  duchyTitleId: string;
  kingdomTitleId: string;
  empireTitleId: string;
  baseDevelopment: number;
  baseControl: number;
  baseFort: number;
  /** Levées de base de la province (hommes). */
  baseLevies: number;
  /** Revenu de base mensuel. */
  baseTax: number;
  /** Nombre d'emplacements de bâtiments. */
  buildingSlots: number;
  elevation: number;
  isIsland?: boolean;
}

export interface TitleDef {
  id: string;
  name: string;
  rank: TitleRank;
  /** Couleur politique [r,g,b]. */
  color: [number, number, number];
  coaSeed: number;
  deJureParentId: string | null;
  capitalProvinceId: string;
  /** Pour un comté : la province correspondante. */
  provinceId?: string;
  successionLaw: SuccessionLaw;
  /** Adjectif (pour les noms de royaume). */
  adjective?: string;
}

export interface River {
  id: string;
  name?: string;
  points: Point[];
  /** Largeur finale (embouchure). */
  width: number;
}

export interface TerrainFeature {
  kind: 'mountain' | 'hill' | 'tree' | 'marsh' | 'wheat' | 'dune';
  at: Point;
  scale: number;
  variant: number;
}

export interface SeaLabel {
  name: string;
  at: Point;
  angle: number;
  size: number;
}

export interface WorldData {
  version: number;
  seed: number;
  width: number;
  height: number;
  /** Contours de terre émergée (côtes) pour le rendu. */
  landmasses: Point[][];
  lakes: Point[][];
  provinces: ProvinceGeo[];
  titles: TitleDef[];
  rivers: River[];
  features: TerrainFeature[];
  seas: SeaLabel[];
  /**
   * Arêtes de frontière partagées : chaque arête sépare deux provinces
   * (ou une province et la mer si b === null).
   */
  borders: { a: string; b: string | null; points: Point[] }[];
}

export type { CultureDef };
