/**
 * Découpage mondial en macro-régions (budgets de provinces) et en régions
 * géographiques (fil d'Ariane, recherche). Frontières volontairement
 * grossières : elles servent à répartir la densité, pas à tracer l'histoire.
 */

export type MacroRegion =
  'europe' | 'mena' | 'ssa' | 'india' | 'eastasia' | 'northasia' | 'seasia' | 'americas' | 'oceania';

/** Budgets de graines par macro-région (≈ 5 200) ; les îles notables s'y ajoutent (≈ 5 800 provinces). */
export const MACRO_TARGETS: Record<MacroRegion, number> = {
  europe: 1000,
  mena: 650,
  ssa: 650,
  india: 650,
  eastasia: 800,
  northasia: 200,
  seasia: 380,
  americas: 800,
  oceania: 110,
};

export const MACRO_NAMES: Record<MacroRegion, string> = {
  europe: 'Europe',
  mena: 'Afrique du Nord, Proche-Orient et Asie centrale',
  ssa: 'Afrique subsaharienne',
  india: 'Sous-continent indien',
  eastasia: 'Asie orientale',
  northasia: 'Asie du Nord',
  seasia: 'Asie du Sud-Est',
  americas: 'Amériques',
  oceania: 'Océanie',
};

function inPoly(lon: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Polygones grossiers (lon, lat).
const P_INDIA: [number, number][] = [
  [61, 25],
  [66, 31],
  [71, 35],
  [75, 37],
  [80, 35.5],
  [89, 28.5],
  [97.5, 28.5],
  [97, 23],
  [92.5, 21],
  [89, 21.5],
  [80, 5],
  [72, 7],
  [66, 22],
  [61, 25],
];
const P_SEASIA: [number, number][] = [
  [92.2, 21.5],
  [95, 27],
  [98, 28.3],
  [101.5, 22],
  [106, 22.8],
  [108.5, 21.5],
  [121, 22.5],
  [127, 20],
  [135, 6],
  [141, -2],
  [141, -11],
  [105, -11],
  [90, 5],
  [92.2, 21.5],
];
const P_EUROPE_EAST_LIMIT: [number, number][] = [
  [-32, 34.5],
  [-5.5, 35.9],
  [-1, 37.2],
  [10, 37.8],
  [12.5, 36.5],
  [26.5, 35],
  [26, 40],
  [29, 41.3],
  [41, 41.6],
  [47, 44.5],
  [52, 46.5],
  [59, 50.5],
  [61, 56],
  [64, 66],
  [67, 70],
  [70, 82],
  [-32, 82],
];
const P_OCEANIA_AUS: [number, number][] = [
  [112, -8],
  [141, -8],
  [156, -8],
  [180, -8],
  [180, -50],
  [110, -50],
];

/** Macro-région d'un point de terre. */
export function macroRegion(lon: number, lat: number): MacroRegion {
  if (lon < -25) return 'americas';
  // Pacifique (îles), Australie, Nouvelle-Guinée, Nouvelle-Zélande.
  if (lon >= 141 && lat < -1) return 'oceania';
  if (lon > 155 && lat < 25 && lat > -50) return 'oceania';
  if (inPoly(lon, lat, P_OCEANIA_AUS)) return 'oceania';
  if (lon < -150 || lon > 165) return lat > 50 ? 'northasia' : 'oceania';
  if (inPoly(lon, lat, P_EUROPE_EAST_LIMIT) && !(lon > -18 && lon < 12 && lat < 37.2)) return 'europe';
  if (inPoly(lon, lat, P_INDIA)) return 'india';
  if (inPoly(lon, lat, P_SEASIA)) return 'seasia';
  // Afrique.
  if (
    lon > -20 &&
    lon < 52 &&
    lat < 37.5 &&
    lat > -36 &&
    !(lon > 32.5 && lat > 12.5 && lon < 60 && lat > 12.5 && (lon > 35 || lat > 30))
  ) {
    if (lat < 16.5 && !(lon > 38 && lat > 11.5)) return 'ssa';
    return 'mena';
  }
  if (lon >= 32 && lon < 75 && lat < 50.5 && lat > 12) return 'mena';
  if (lat > 49 || (lon > 75 && lat > 47 && lon < 122 && lat > 47)) return 'northasia';
  if (lon > 44 && lon < 88 && lat > 44) return 'northasia';
  return 'eastasia';
}

interface RegionDef {
  id: string;
  name: string;
  macro: MacroRegion;
  /** Test géographique (évalué dans l'ordre de la liste, premier vrai). */
  test: (lon: number, lat: number) => boolean;
}

/** Régions géographiques (fil d'Ariane « Monde › Région › … »). */
export const REGIONS: RegionDef[] = [
  {
    id: 'scandinavia',
    name: 'Scandinavie',
    macro: 'europe',
    test: (x, y) => y > 55.3 && x > 4 && x < 32 && !(x > 20 && y < 60 && x > 21.5),
  },
  {
    id: 'british_isles',
    name: 'Îles Britanniques',
    macro: 'europe',
    test: (x, y) => x < 2 && x > -11 && y > 49.8 && y < 61.5,
  },
  { id: 'iceland', name: 'Islande et Atlantique nord', macro: 'europe', test: (x, y) => x < -12 && y > 60 },
  { id: 'iberia', name: 'Péninsule Ibérique', macro: 'europe', test: (x, y) => x < 3.3 && y < 43.8 },
  { id: 'france', name: 'Europe de l’Ouest', macro: 'europe', test: (x, y) => x < 7.5 && y < 51.5 },
  { id: 'low_countries', name: 'Pays-Bas et Rhénanie', macro: 'europe', test: (x, y) => x < 9 && y >= 49 },
  {
    id: 'italy',
    name: 'Italie',
    macro: 'europe',
    test: (x, y) =>
      x > 6.5 && x < 19 && y < 46.6 && !(x > 13.5 && y > 45.3) && !(x > 15.5 && y > 42.5 && x > 16.2),
  },
  { id: 'germany', name: 'Europe centrale', macro: 'europe', test: (x, y) => x < 19 && y > 45.5 },
  { id: 'balkans', name: 'Balkans et Grèce', macro: 'europe', test: (x, y) => x < 30 && y < 46.5 },
  { id: 'baltic', name: 'Pays baltes et Pologne', macro: 'europe', test: (x, y) => x < 30 && y > 49 },
  { id: 'ruthenia', name: 'Ruthénie et steppe pontique', macro: 'europe', test: (_x, y) => y < 54 },
  { id: 'russia', name: 'Russie', macro: 'europe', test: () => true },

  { id: 'maghreb', name: 'Maghreb', macro: 'mena', test: (x, y) => x < 11.5 && y > 26 },
  { id: 'sahara', name: 'Sahara', macro: 'mena', test: (x, y) => x < 25 && y < 29 },
  { id: 'libya', name: 'Ifriqiya et Libye', macro: 'mena', test: (x) => x < 25 },
  {
    id: 'egypt',
    name: 'Égypte et Nubie',
    macro: 'mena',
    test: (x, y) => x < 35.5 && y < 31.8 && !(x > 32.6 && y > 27.5 && y < 31.5 && x > 33.5),
  },
  { id: 'arabia', name: 'Arabie', macro: 'mena', test: (x, y) => y < 30 && x < 60 && !(x > 47.5 && y > 29) },
  { id: 'anatolia', name: 'Anatolie', macro: 'mena', test: (x, y) => x < 41 && y > 36.2 },
  { id: 'caucasus', name: 'Caucase', macro: 'mena', test: (x, y) => x < 50.5 && y > 38.8 },
  { id: 'levant', name: 'Levant et Syrie', macro: 'mena', test: (x) => x < 39.5 },
  { id: 'mesopotamia', name: 'Mésopotamie', macro: 'mena', test: (x, y) => x < 48.5 && y < 38 },
  { id: 'persia', name: 'Iran', macro: 'mena', test: (x, y) => x < 61.5 && y < 38.5 },
  { id: 'khorasan', name: 'Khorassan et Afghanistan', macro: 'mena', test: (_x, y) => y < 37.5 },
  { id: 'transoxiana', name: 'Transoxiane et Asie centrale', macro: 'mena', test: () => true },

  { id: 'west_africa', name: 'Afrique de l’Ouest', macro: 'ssa', test: (x, y) => x < 4 && y > 4 },
  { id: 'sahel', name: 'Sahel et lac Tchad', macro: 'ssa', test: (x, y) => x < 24 && y > 9 },
  { id: 'horn', name: 'Corne de l’Afrique', macro: 'ssa', test: (x, y) => x > 33.5 && y > -1 },
  { id: 'central_africa', name: 'Afrique centrale', macro: 'ssa', test: (_x, y) => y > -7 },
  {
    id: 'swahili_coast',
    name: 'Grands Lacs et côte swahilie',
    macro: 'ssa',
    test: (x, y) => x > 31 && y > -17 && x < 45,
  },
  { id: 'madagascar', name: 'Madagascar et océan Indien', macro: 'ssa', test: (x) => x > 42 },
  { id: 'southern_africa', name: 'Afrique australe', macro: 'ssa', test: () => true },

  { id: 'hindustan', name: 'Hindoustan', macro: 'india', test: (x, y) => y > 23 && x < 84 && x > 70.5 },
  { id: 'punjab', name: 'Pendjab et Sind', macro: 'india', test: (x, y) => x <= 74.5 && y > 23 },
  { id: 'bengal', name: 'Bengale et Assam', macro: 'india', test: (x, y) => x >= 84 && y > 20 },
  { id: 'gujarat', name: 'Goujerat et Malwa', macro: 'india', test: (x, y) => x < 78.5 && y > 19.5 },
  { id: 'deccan', name: 'Deccan', macro: 'india', test: (_x, y) => y > 14.5 },
  { id: 'south_india', name: 'Inde du Sud et Ceylan', macro: 'india', test: () => true },

  {
    id: 'japan',
    name: 'Japon',
    macro: 'eastasia',
    test: (x, y) => x > 129.2 && !(x < 131 && y < 33) && y > 30,
  },
  { id: 'ryukyu', name: 'Ryūkyū', macro: 'eastasia', test: (x, y) => x > 122.5 && y < 30 && y > 23 },
  {
    id: 'korea',
    name: 'Corée',
    macro: 'eastasia',
    test: (x, y) => x > 124 && x < 131 && y > 33 && y < 43 && !(y > 41.8 && x > 129.8),
  },
  { id: 'manchuria', name: 'Mandchourie', macro: 'eastasia', test: (x, y) => x > 118 && y > 40.5 },
  {
    id: 'tibet',
    name: 'Tibet et Himalaya',
    macro: 'eastasia',
    test: (x, y) => x < 101.5 && y < 37 && y > 27.3,
  },
  { id: 'tarim', name: 'Bassin du Tarim', macro: 'eastasia', test: (x, y) => x < 98 && y >= 36 },
  { id: 'north_china', name: 'Chine du Nord', macro: 'eastasia', test: (_x, y) => y > 32.5 },
  { id: 'south_china', name: 'Chine du Sud', macro: 'eastasia', test: () => true },

  { id: 'mongolia', name: 'Mongolie', macro: 'northasia', test: (x, y) => x > 87 && x < 122 && y < 53 },
  { id: 'kazakh_steppe', name: 'Steppe kazakhe', macro: 'northasia', test: (x, y) => x < 87 && y < 56 },
  { id: 'siberia', name: 'Sibérie', macro: 'northasia', test: () => true },

  { id: 'burma', name: 'Birmanie', macro: 'seasia', test: (x, y) => x < 98.8 && y > 9.5 },
  {
    id: 'indochina',
    name: 'Indochine',
    macro: 'seasia',
    test: (x, y) => x < 110 && y > 8.5 && !(x > 99.5 && x < 104.5 && y < 13.5 && y > 8.5 && false),
  },
  {
    id: 'malaya',
    name: 'Péninsule malaise et Sumatra',
    macro: 'seasia',
    test: (x, y) => x < 106.2 && y > -6.5,
  },
  {
    id: 'java',
    name: 'Java et petites îles de la Sonde',
    macro: 'seasia',
    test: (x, y) => y < -5.7 && x < 127,
  },
  { id: 'borneo', name: 'Bornéo', macro: 'seasia', test: (x, y) => x < 119.3 && y > -4.5 && y < 7.5 },
  { id: 'philippines', name: 'Philippines', macro: 'seasia', test: (_x, y) => y > 4.5 },
  { id: 'moluccas', name: 'Célèbes et Moluques', macro: 'seasia', test: () => true },

  {
    id: 'north_america_arctic',
    name: 'Arctique américain',
    macro: 'americas',
    test: (x, y) => y > 60 || (x < -140 && y > 54),
  },
  { id: 'pacific_northwest', name: 'Côte nord-ouest', macro: 'americas', test: (x, y) => x < -118 && y > 40 },
  {
    id: 'great_plains',
    name: 'Grandes Plaines',
    macro: 'americas',
    test: (x, y) => x < -95 && x > -111 && y > 31,
  },
  {
    id: 'southwest',
    name: 'Sud-Ouest et Grand Bassin',
    macro: 'americas',
    test: (x, y) => x <= -111 && y > 27,
  },
  { id: 'eastern_woodlands', name: 'Forêts de l’Est', macro: 'americas', test: (x, y) => x > -95 && y > 36 },
  {
    id: 'mississippi',
    name: 'Mississippi et Sud-Est',
    macro: 'americas',
    test: (x, y) => x > -100 && y > 24.5,
  },
  {
    id: 'caribbean',
    name: 'Caraïbes',
    macro: 'americas',
    test: (x, y) => x > -85.5 && y > 10.3 && y < 27.5 && !(x < -76.5 && y < 14),
  },
  { id: 'mesoamerica', name: 'Mésoamérique', macro: 'americas', test: (x, y) => y > 13.5 && x < -86.5 },
  { id: 'central_america', name: 'Amérique centrale', macro: 'americas', test: (x, y) => y > 7.2 && x < -77 },
  { id: 'andes_north', name: 'Andes du Nord', macro: 'americas', test: (x, y) => y > -5 && x < -71.5 },
  { id: 'andes_central', name: 'Andes centrales', macro: 'americas', test: (x, y) => y > -26 && x < -68.2 },
  { id: 'amazonia', name: 'Amazonie et Guyanes', macro: 'americas', test: (_x, y) => y > -13 },
  { id: 'southern_cone', name: 'Cône Sud', macro: 'americas', test: () => true },

  { id: 'australia', name: 'Australie', macro: 'oceania', test: (x, y) => x < 154 && y < -10.5 },
  {
    id: 'new_guinea',
    name: 'Nouvelle-Guinée et Mélanésie',
    macro: 'oceania',
    test: (x, y) => x < 170 && y > -23 && y < 0,
  },
  { id: 'aotearoa', name: 'Aotearoa', macro: 'oceania', test: (x, y) => x > 165 && y < -33 },
  { id: 'polynesia', name: 'Polynésie et Micronésie', macro: 'oceania', test: () => true },
];

export function regionOf(lon: number, lat: number): RegionDef {
  const macro = macroRegion(lon, lat);
  for (const r of REGIONS) if (r.macro === macro && r.test(lon, lat)) return r;
  return REGIONS.find((r) => r.macro === macro)!;
}

/**
 * Foyers de peuplement historiques (vers 1400) pour moduler la densité de
 * provinces là où les lieux habités modernes seraient trompeurs (Amériques,
 * Afrique, Océanie). [lon, lat, rayon km, intensité].
 */
export const HISTORIC_HOTSPOTS: [number, number, number, number][] = [
  // Mésoamérique et Andes
  [-99.1, 19.4, 260, 6],
  [-96.7, 17.1, 200, 3.5],
  [-89.6, 20.6, 260, 3],
  [-90.5, 15, 220, 2.5],
  [-101.6, 19.6, 180, 3],
  [-72, -13.5, 350, 4.5],
  [-69.2, -16, 260, 3],
  [-79, -8, 260, 3],
  [-77.5, -12, 200, 2],
  [-74, 5, 220, 2.5],
  // Amérique du Nord (Mississippi, Pueblos, Iroquoiens)
  [-90.1, 38.6, 350, 2],
  [-86, 33, 400, 1.3],
  [-107, 35.5, 350, 1],
  [-76, 42.8, 350, 1.2],
  [-122, 38, 400, 1],
  // Caraïbes, Amazonie (várzea)
  [-70.5, 19, 250, 1.5],
  [-60, -3, 700, 0.6],
  // Afrique
  [31.2, 27, 450, 5],
  [31.3, 30.5, 180, 5],
  [-4, 13.5, 450, 2.5],
  [8.5, 12, 350, 2.5],
  [4.5, 7.5, 300, 2.5],
  [6.1, 6.3, 150, 1.6],
  [38.7, 11.5, 450, 2.5],
  [31, 0.5, 400, 2],
  [30.9, -20.2, 350, 1.5],
  [14.5, -5.5, 300, 1.8],
  [39.3, -6.5, 350, 1.4],
  [13.5, 12.5, 250, 1.6],
  // Océanie
  [174.8, -37, 350, 1.5],
  [-175.2, -21.2, 200, 2],
  [-155.5, 19.7, 300, 2],
  [178, -17.8, 250, 1.5],
  [-149.5, -17.6, 250, 1.2],
];

/**
 * Multiplicateurs de densité par région (ordre de grandeur des peuplements
 * vers 1400) : ils répartissent le budget d'une macro-région.
 */
export const REGION_DENSITY: Record<string, number> = {
  italy: 3.2,
  low_countries: 2.6,
  france: 2.2,
  germany: 1.9,
  british_isles: 1.5,
  iberia: 1.4,
  balkans: 1.2,
  baltic: 0.9,
  scandinavia: 0.95,
  iceland: 0.4,
  ruthenia: 0.42,
  russia: 0.4,
  sahara: 0.25,
  libya: 0.5,
  arabia: 0.5,
  egypt: 0.9,
  levant: 2,
  mesopotamia: 1.4,
  anatolia: 2.2,
  caucasus: 1.2,
  persia: 1.8,
  khorasan: 0.9,
  transoxiana: 1,
  maghreb: 1.2,
  southern_africa: 0.3,
  west_africa: 1.9,
  sahel: 1.5,
  horn: 1.4,
  central_africa: 0.75,
  swahili_coast: 1.1,
  madagascar: 0.8,
  south_india: 1.9,
  deccan: 1.3,
  bengal: 1.2,
  hindustan: 1,
  punjab: 1,
  gujarat: 1.1,
  tarim: 0.35,
  tibet: 0.5,
  manchuria: 0.6,
  korea: 1.3,
  japan: 1.1,
  north_china: 1.1,
  south_china: 1,
  ryukyu: 1,
  java: 3,
  siberia: 0.35,
  mongolia: 0.7,
  kazakh_steppe: 0.7,
  mesoamerica: 2.6,
  andes_central: 3.2,
  andes_north: 2.4,
  central_america: 1.6,
  caribbean: 1.3,
  mississippi: 1.1,
  eastern_woodlands: 0.8,
  southwest: 0.7,
  great_plains: 0.45,
  pacific_northwest: 0.8,
  north_america_arctic: 0.2,
  amazonia: 0.5,
  southern_cone: 0.4,
  australia: 0.2,
  new_guinea: 0.9,
  aotearoa: 1,
  polynesia: 1,
};
