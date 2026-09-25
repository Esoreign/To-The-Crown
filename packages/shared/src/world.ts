/**
 * Données géographiques et politiques statiques du monde (générées par le
 * pipeline `tools/worldgen`, versionnées dans @ttc/content/data/world1400).
 * Les géométries (contours, frontières, relief) ne sont pas ici : elles sont
 * servies à part au client de rendu (apps/web/public/world).
 * Coordonnées en degrés : [longitude, latitude].
 */
import type { CultureDef, SuccessionLaw, Terrain, TitleRank } from './content-schema';

export type Point = [number, number];

export interface ProvinceGeo {
  id: string;
  /** Indice numérique (identifiant des entités géométriques). */
  index: number;
  name: string;
  /** Point représentatif (pôle d'inaccessibilité) [lon, lat]. */
  centroid: Point;
  /** Lieu principal (ville, siège) [lon, lat]. */
  capital: Point;
  /** Emprise [ouest, sud, est, nord]. */
  bbox: [number, number, number, number];
  /** Superficie (km²). */
  area: number;
  neighbors: string[];
  /** Voisins via un détroit (coût de traversée supérieur). */
  straits: string[];
  /** Zones maritimes adjacentes. */
  seas: string[];
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
  /** Densité de peuplement relative (1 ≈ médiane). */
  density: number;
  regionId: string;
  macroId: string;
  isIsland?: boolean;
  /** Terres inhabitées (inlandsis) : aucun titulaire. */
  wasteland?: boolean;
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
  /** Nom court du territoire (« France »). */
  short?: string;
  /** Entité politique historique dont c'est le titre principal. */
  polityId?: string;
}

export interface SeaZone {
  id: string;
  index: number;
  centroid: Point;
  neighbors: string[];
  deep: boolean;
}

export interface RegionInfo {
  id: string;
  name: string;
  macroId: string;
}

export interface WorldData {
  version: number;
  scenarioId: string;
  provinces: ProvinceGeo[];
  titles: TitleDef[];
  seas: SeaZone[];
  regions: RegionInfo[];
  macros: { id: string; name: string }[];
}

export type { CultureDef };
