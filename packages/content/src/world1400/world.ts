/**
 * Chargement du monde 1400 : le pipeline écrit un format colonnaire compact
 * (data/world1400/world.json) que ce module déplie en `WorldData`.
 * Les statistiques de base des provinces dérivent du développement calculé
 * par le pipeline (densité de peuplement, lieux historiques).
 */
import type { ProvinceGeo, SeaZone, SuccessionLaw, Terrain, TitleDef, TitleRank, WorldData } from '@ttc/shared';
import worldJson from '../../data/world1400/world.json';

interface CompactWorld {
  version: number;
  scenario: string;
  cultures: string[];
  faiths: string[];
  terrains: string[];
  laws: string[];
  regions: { id: string; name: string; macro: string }[];
  macros: { id: string; name: string }[];
  provinces: {
    id: number[];
    name: string[];
    lon: number[];
    lat: number[];
    seat: ([number, number] | 0)[];
    bbox: [number, number, number, number][];
    area: number[];
    elevation: number[];
    density: number[];
    terrain: number[];
    coastal: number[];
    neighbors: number[][];
    straits: number[][];
    seas: number[][];
    culture: number[];
    faith: number[];
    region: number[];
    duchy: number[];
    dev: number[];
    fort: number[];
    waste: number[];
  };
  seas: { i: number; lon: number; lat: number; neighbors: number[]; deep: boolean }[];
  /** [id, nom, rang, couleur, parent (indice ou -1), province capitale, loi, nom court, entité, adjectif] */
  titles: [string, string, TitleRank, string, number, number, number, string, string, string][];
}

const W = worldJson as unknown as CompactWorld;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const provinceKey = (index: number): string => `p${index}`;
export const seaKey = (index: number): string => `s${index}`;

function build(): WorldData {
  const titles: TitleDef[] = W.titles.map(([id, name, rank, color, parent, capital, law, short, polity, adj]) => ({
    id,
    name,
    rank,
    color: rgb(color),
    coaSeed: hash(id),
    deJureParentId: parent >= 0 ? W.titles[parent]![0] : null,
    capitalProvinceId: provinceKey(capital),
    successionLaw: (W.laws[law] ?? 'primogeniture') as SuccessionLaw,
    ...(rank === 'county' ? { provinceId: provinceKey(Number(id.slice(1))) } : {}),
    ...(short ? { short } : {}),
    ...(polity ? { polityId: polity } : {}),
    ...(adj ? { adjective: adj } : {}),
  }));
  const byId = new Map(titles.map((t) => [t.id, t]));
  const P = W.provinces;
  const provinces: ProvinceGeo[] = P.id.map((index, k) => {
    const dev = P.dev[k]!;
    const duchy = titles[P.duchy[k]!]!;
    const kingdom = byId.get(duchy.deJureParentId ?? '')!;
    const empire = byId.get(kingdom.deJureParentId ?? '')!;
    const region = W.regions[P.region[k]!]!;
    const seat = P.seat[k];
    const density = P.density[k]!;
    const neighbors = P.neighbors[k]!.map(provinceKey);
    const straits = P.straits[k]!.map(provinceKey);
    return {
      id: provinceKey(index),
      index,
      name: P.name[k]!,
      centroid: [P.lon[k]!, P.lat[k]!],
      capital: seat ? seat : [P.lon[k]!, P.lat[k]!],
      bbox: P.bbox[k]!,
      area: P.area[k]!,
      neighbors,
      straits,
      seas: P.seas[k]!.map(seaKey),
      terrain: W.terrains[P.terrain[k]!] as Terrain,
      coastal: P.coastal[k] === 1,
      cultureId: W.cultures[P.culture[k]!]!,
      faithId: W.faiths[P.faith[k]!]!,
      countyTitleId: `c${index}`,
      duchyTitleId: duchy.id,
      kingdomTitleId: kingdom.id,
      empireTitleId: empire.id,
      baseDevelopment: dev,
      baseControl: Math.min(100, density < 0.3 ? 75 : 88 + Math.round(dev / 4)),
      baseFort: P.fort[k]!,
      baseLevies: Math.round(60 + dev * 16),
      baseTax: Math.round((0.4 + dev * 0.07) * 100) / 100,
      buildingSlots: 2 + (dev >= 8 ? 1 : 0) + (dev >= 16 ? 1 : 0) + (dev >= 26 ? 1 : 0),
      elevation: P.elevation[k]!,
      density,
      regionId: region.id,
      macroId: region.macro,
      ...(neighbors.length === 0 ? { isIsland: true } : {}),
      ...(P.waste[k] ? { wasteland: true } : {}),
    };
  });
  const seas: SeaZone[] = W.seas.map((s) => ({ id: seaKey(s.i), index: s.i, centroid: [s.lon, s.lat], neighbors: s.neighbors.map(seaKey), deep: s.deep }));
  return {
    version: W.version,
    scenarioId: W.scenario,
    provinces,
    titles,
    seas,
    regions: W.regions.map((r) => ({ id: r.id, name: r.name, macroId: r.macro })),
    macros: W.macros,
  };
}

export const WORLD_1400: WorldData = build();
