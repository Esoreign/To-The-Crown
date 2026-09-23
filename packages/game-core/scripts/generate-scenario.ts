/**
 * Génère le scénario « La Couronne brisée » (12 avril 1087) à partir du monde
 * stable. Sortie versionnée : packages/content/data/scenario-1087.json.
 *
 * Exécution : pnpm --filter @ttc/game-core scenario:generate
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CULTURE_BY_ID, EMPIRE_DEFS, KINGDOM_DEFS, WORLD } from '@ttc/content';
import {
  toDay,
  yearsToDays,
  type Character,
  type GameState,
  type House,
  type RecommendedStart,
  type ScenarioData,
  type Sex,
  type Skills,
  type SuccessionLaw,
  type Title,
  type ProvinceState,
} from '@ttc/shared';
import { computePersonality } from '../src/characters';
import { DEJURE_CHILDREN, DEJURE_PROVINCES, PROVINCE_GEO, TITLE_DEFS } from '../src/content';
import { birthForAge, createCharacter, educationTraitFor, pickName } from '../src/factory';
import { makeRng, seedRng } from '../src/rng';
import { transferTitle } from '../src/titles';
import { autoFillCouncil } from '../src/council';
import { rankOf } from '../src/realm';

const START = toDay(1087, 4, 12);
const rng = makeRng(seedRng(108704));

const state = {
  date: START,
  nextId: 1,
  characters: {},
  houses: {},
  dynasties: {},
  titles: {},
  provinces: {},
  relations: {},
  claims: {},
  alliances: {},
  wars: {},
  secrets: {},
  hooks: {},
  factions: {},
} as unknown as GameState;

const nid = (prefix: string) => `${prefix}${state.nextId++}`;

// ---------------------------------------------------------------------------
// Titres et provinces
// ---------------------------------------------------------------------------
for (const def of WORLD.titles) {
  const t: Title = {
    id: def.id,
    active: def.rank === 'county',
    holderId: null,
    successionLaw: def.successionLaw,
    history: [],
    electionVotes: {},
    occupiedBy: null,
  };
  state.titles[def.id] = t;
}
for (const geo of WORLD.provinces) {
  const p: ProvinceState = {
    id: geo.id,
    development: geo.baseDevelopment,
    control: geo.baseControl,
    cultureId: geo.cultureId,
    faithId: geo.faithId,
    buildings: {},
    construction: null,
    levies: geo.baseLevies,
    garrison: geo.baseFort * 150,
    modifiers: [],
  };
  // Bâtiments de départ : fermes et murs dans les capitales.
  if (geo.terrain !== 'mountains' && geo.terrain !== 'marsh' && rng.chance(0.55)) p.buildings.farms = 1;
  if (rng.chance(0.25)) p.buildings.watchtowers = 1;
  if (geo.coastal && rng.chance(0.3)) p.buildings.port = 1;
  state.provinces[geo.id] = p;
}
for (const def of WORLD.titles) {
  if (def.rank === 'county') continue;
  const p = state.provinces[def.capitalProvinceId]!;
  p.buildings.walls = Math.max(p.buildings.walls ?? 0, def.rank === 'duchy' ? 1 : 2);
  if (def.rank !== 'duchy') p.buildings.market = 1;
}

// ---------------------------------------------------------------------------
// Maisons
// ---------------------------------------------------------------------------
const HOUSE_COLORS = ['#8b1e2d', '#1f3f7a', '#b8862b', '#2f5d3a', '#5b2a6e', '#7a4a1e', '#2a6470', '#6b6b6b', '#9c3d1a', '#3d4f7a'];

interface HouseSpec {
  id: string;
  name: string;
  motto: string;
  history: string;
  renown: number;
  cultureId: string;
  color?: string;
  dynastyOf?: string;
}

function makeHouse(spec: HouseSpec, major: boolean): House {
  let dynastyId: string;
  if (spec.dynastyOf) {
    dynastyId = state.houses[spec.dynastyOf]!.dynastyId;
    state.dynasties[dynastyId]!.houseIds.push(spec.id);
  } else {
    dynastyId = `dy_${spec.id.replace(/^h_/, '')}`;
    state.dynasties[dynastyId] = { id: dynastyId, name: spec.name, houseIds: [spec.id], renown: spec.renown };
  }
  const h: House = {
    id: spec.id,
    name: spec.name,
    motto: spec.motto,
    dynastyId,
    founderId: null,
    headId: null,
    coaSeed: rng.int(1, 2 ** 30),
    color: spec.color ?? rng.pick(HOUSE_COLORS),
    renown: spec.renown,
    history: spec.history,
    isMajor: major,
    cultureId: spec.cultureId,
  };
  state.houses[h.id] = h;
  return h;
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const MINOR_MOTTOS = [
  'Fidèles jusqu’à la cendre.', 'La terre avant l’or.', 'Nous tenons.', 'Humbles, mais debout.', 'Par le fer et la foi.',
  'Ce qui est promis sera rendu.', 'Le temps est notre allié.', 'Qui nous défie nous nourrit.', 'Veille et patience.',
  'Rien sans honneur.', 'L’aube pour témoin.', 'Nos racines sont profondes.', 'Le premier à la brèche.',
  'Sang clair, main sûre.', 'Nous nous souvenons.', 'Plier n’est pas rompre.', 'À chacun son serment.',
];

function minorHouse(name: string, cultureId: string): House {
  let id = `h_${slug(name)}`;
  while (state.houses[id]) id += '_b';
  return makeHouse(
    {
      id,
      name,
      motto: rng.pick(MINOR_MOTTOS),
      history: `Maison ${CULTURE_BY_ID[cultureId] ? 'enracinée' : 'ancienne'} tenant ses terres de ${name} depuis plusieurs générations.`,
      renown: rng.int(10, 160),
      cultureId,
    },
    false,
  );
}

// ---------------------------------------------------------------------------
// Personnages et familles
// ---------------------------------------------------------------------------
interface RulerSpec {
  key?: string;
  firstName: string;
  sex: Sex;
  age: number;
  traits: string[];
  skills?: Partial<Skills>;
  gold?: number;
  prestige?: number;
  education?: { skill: keyof Skills; level: number };
  married?: boolean;
  children?: { sex: Sex; age: number; name?: string; traits?: string[] }[];
  noRandomChildren?: boolean;
  siblings?: { sex: Sex; age: number; name?: string; traits?: string[] }[];
}

const keyed: Record<string, string> = {};

function newChar(o: Omit<Parameters<typeof createCharacter>[2], 'id' | 'now'>): Character {
  return createCharacter(state, rng, { ...o, id: nid('ch'), now: START });
}

function makeDeadParents(c: Character, houseId: string | null): void {
  const fatherAge = Math.floor((START - c.birth) / 365) + rng.int(22, 34);
  const father = newChar({
    sex: 'M',
    birth: birthForAge(START, fatherAge, rng),
    cultureId: c.cultureId,
    faithId: c.faithId,
    houseId,
    education: true,
  });
  father.death = START - yearsToDays(rng.int(1, Math.max(2, Math.min(25, fatherAge - 40)))) - rng.int(0, 300);
  father.deathCause = rng.pick(['natural', 'illness', 'battle', 'natural'] as const);
  const mother = newChar({
    sex: 'F',
    birth: father.birth + yearsToDays(rng.int(2, 8)),
    cultureId: c.cultureId,
    faithId: c.faithId,
    houseId: null,
    education: true,
  });
  const motherAlive = Math.floor((START - mother.birth) / 365) < 70 && rng.chance(0.2);
  if (!motherAlive) {
    mother.death = START - yearsToDays(rng.int(1, 15));
    mother.deathCause = 'natural';
  } else {
    mother.courtId = c.id;
  }
  // Veuvage : le conjoint vivant garde son ancien époux dans ses mariages passés.
  if (motherAlive) {
    mother.formerSpouseIds.push(father.id);
    father.spouseId = mother.id;
  } else {
    father.spouseId = mother.id;
    mother.spouseId = father.id;
  }
  c.fatherId = father.id;
  c.motherId = mother.id;
  father.childIds.push(c.id);
  mother.childIds.push(c.id);
}

function spouseFor(c: Character): Character {
  const age = Math.floor((START - c.birth) / 365);
  const sex: Sex = c.sex === 'M' ? 'F' : 'M';
  const sAge = Math.max(16, sex === 'F' ? age - rng.int(0, 9) : age + rng.int(-2, 8));
  // Maison du conjoint : autre maison existante de même culture, ou nouvelle maison mineure.
  const pool = Object.values(state.houses).filter((h) => h.cultureId === c.cultureId && h.id !== c.houseId);
  const house = pool.length && rng.chance(0.8) ? rng.pick(pool) : null;
  const spouse = newChar({
    sex,
    birth: birthForAge(START, sAge, rng),
    cultureId: c.cultureId,
    faithId: c.faithId,
    houseId: house?.id ?? minorHouse(rng.pick(CULTURE_BY_ID[c.cultureId]!.houseNames), c.cultureId).id,
    courtId: c.courtId ?? c.id,
    education: true,
  });
  spouse.spouseId = c.id;
  c.spouseId = spouse.id;
  return spouse;
}

function childHouse(father: Character, mother: Character): string | null {
  const fr = rankOf(father);
  const mr = rankOf(mother);
  return mr > fr ? mother.houseId : father.houseId;
}

function makeChildren(c: Character, spec?: RulerSpec['children'], randomCount = true): Character[] {
  const spouse = c.spouseId ? state.characters[c.spouseId]! : null;
  const mother = c.sex === 'F' ? c : spouse;
  const father = c.sex === 'M' ? c : spouse;
  if (!mother || !father) return [];
  const motherAge = Math.floor((START - mother.birth) / 365);
  const kids: Character[] = [];
  const specs = spec ? [...spec] : [];
  if (!spec && randomCount) {
    const years = Math.max(0, Math.min(motherAge, 45) - 18);
    const n = Math.min(4, Math.max(0, Math.round(rng.normal(years / 7, 0.9))));
    const used = new Set<number>();
    for (let i = 0; i < n; i++) {
      let age = rng.int(0, Math.max(0, Math.min(years, motherAge - 17)));
      let guard = 0;
      while (used.has(age) && guard++ < 10) age = rng.int(0, Math.max(0, motherAge - 17));
      used.add(age);
      specs.push({ sex: rng.chance(0.5) ? 'M' : 'F', age });
    }
  }
  specs.sort((a, b) => b.age - a.age);
  for (const s of specs) {
    const kid = newChar({
      sex: s.sex,
      firstName: s.name ?? pickName(rng, c.cultureId, s.sex, [father.firstName, mother.firstName]),
      birth: birthForAge(START, s.age, rng),
      cultureId: father.cultureId,
      faithId: c.faithId,
      houseId: childHouse(father, mother),
      fatherId: father.id,
      motherId: mother.id,
      courtId: c.courtId ?? c.id,
      traits: s.traits ?? [],
      education: true,
    });
    kids.push(kid);
  }
  return kids;
}

function makeRuler(spec: RulerSpec | null, houseId: string, cultureId: string, faithId: string, rank: number): Character {
  const sex: Sex = spec?.sex ?? (rng.chance(0.14) ? 'F' : 'M');
  const age = spec?.age ?? rng.int(22, 64);
  const bias: Partial<Skills> = {};
  const c = newChar({
    sex,
    birth: birthForAge(START, age, rng),
    cultureId,
    faithId,
    houseId,
    firstName: spec?.firstName,
    traits: spec?.traits ?? [],
    skills: { ...bias, ...(spec?.skills ?? {}) },
    education: spec?.education ?? true,
  });
  c.courtId = c.id;
  if (spec?.key) keyed[spec.key] = c.id;
  const goldByRank = [0, rng.int(25, 90), rng.int(80, 220), rng.int(220, 480), rng.int(450, 800)];
  c.gold = spec?.gold ?? goldByRank[rank]!;
  c.prestige = spec?.prestige ?? rank * rng.int(120, 260);
  c.fervor = rng.int(40, 220);
  c.authority = rank * rng.int(30, 70);
  c.crownAuthority = rank >= 3 ? 1 : 1;
  const h = state.houses[houseId]!;
  if (!h.headId) {
    h.headId = c.id;
    h.founderId ??= null;
  }
  makeDeadParents(c, houseId);
  if (spec?.siblings) {
    for (const s of spec.siblings) {
      const sib = newChar({
        sex: s.sex,
        firstName: s.name,
        birth: birthForAge(START, s.age, rng),
        cultureId,
        faithId,
        houseId,
        fatherId: c.fatherId,
        motherId: c.motherId,
        courtId: c.id,
        traits: s.traits ?? [],
        education: true,
      });
      void sib;
    }
  } else if (rng.chance(0.3)) {
    const n = 1;
    for (let i = 0; i < n; i++) {
      const sAge = Math.max(8, age + rng.int(-10, 10));
      newChar({
        sex: rng.chance(0.5) ? 'M' : 'F',
        birth: birthForAge(START, sAge, rng),
        cultureId,
        faithId,
        houseId,
        fatherId: c.fatherId,
        motherId: c.motherId,
        courtId: c.id,
        education: true,
      });
    }
  }
  const married = spec?.married ?? (age >= 19 && rng.chance(0.82));
  if (married) {
    spouseFor(c);
    makeChildren(c, spec?.children, !spec?.noRandomChildren);
  }
  // Courtisans.
  const nCourtiers = rank >= 3 ? 2 : rank === 2 ? 1 : rng.chance(0.15) ? 1 : 0;
  for (let i = 0; i < nCourtiers; i++) {
    const cs: Sex = rng.chance(0.7) ? 'M' : 'F';
    const pool = Object.values(state.houses).filter((hh) => hh.cultureId === cultureId && !hh.isMajor);
    newChar({
      sex: cs,
      birth: birthForAge(START, rng.int(20, 55), rng),
      cultureId,
      faithId,
      houseId: pool.length && rng.chance(0.8) ? rng.pick(pool).id : minorHouse(rng.pick(CULTURE_BY_ID[cultureId]!.houseNames), cultureId).id,
      courtId: c.id,
      education: true,
      skills: { [rng.pick(['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning'] as const)]: rng.int(8, 13) },
    });
  }
  return c;
}

function capitalCulture(titleId: string): { cultureId: string; faithId: string } {
  const geo = PROVINCE_GEO[TITLE_DEFS[titleId]!.capitalProvinceId]!;
  return { cultureId: geo.cultureId, faithId: geo.faithId };
}

function countiesOf(titleId: string): string[] {
  return (DEJURE_PROVINCES[titleId] ?? []).map((p) => PROVINCE_GEO[p]!.countyTitleId);
}

function capitalCountyOf(titleId: string): string {
  return PROVINCE_GEO[TITLE_DEFS[titleId]!.capitalProvinceId]!.countyTitleId;
}

/** Attribue les comtés d'un duché : duc + comtes vassaux. */
function populateDuchy(duchyId: string, liegeId: string | null, opts: { dukeSpec?: RulerSpec; dukeHouse?: string; createDuchy: boolean; holderId?: string }): string {
  const counties = countiesOf(duchyId);
  const capCounty = capitalCountyOf(duchyId);
  const { cultureId, faithId } = capitalCulture(duchyId);
  let lordId: string;
  if (opts.holderId) {
    lordId = opts.holderId;
    if (opts.createDuchy) transferTitle(state, duchyId, lordId, 'start');
    transferTitle(state, capCounty, lordId, 'start');
  } else if (opts.createDuchy) {
    const houseId = opts.dukeHouse ?? minorHouse(TITLE_DEFS[duchyId]!.name, cultureId).id;
    const duke = makeRuler(opts.dukeSpec ?? null, houseId, cultureId, faithId, 2);
    lordId = duke.id;
    transferTitle(state, duchyId, lordId, 'start', { liegeId });
    transferTitle(state, capCounty, lordId, 'start');
  } else {
    lordId = liegeId!;
  }
  const lord = state.characters[lordId]!;
  const capAssigned = state.titles[capCounty]!.holderId !== null;
  const rest = counties.filter((c) => c !== capCounty || !capAssigned);
  // Le seigneur garde un comté supplémentaire si le duché est grand.
  if (rest.length >= 4 && opts.createDuchy) {
    const extra = rest.shift()!;
    transferTitle(state, extra, lordId, 'start');
  }
  for (let i = 0; i < rest.length; i++) {
    const county = rest[i]!;
    const geo = PROVINCE_GEO[TITLE_DEFS[county]!.provinceId!]!;
    const house = minorHouse(TITLE_DEFS[county]!.name, geo.cultureId);
    const count = makeRuler(null, house.id, geo.cultureId, geo.faithId, 1);
    transferTitle(state, county, count.id, 'start', { liegeId: lordId });
    // Certains comtes tiennent deux comtés.
    if (i + 1 < rest.length && rest.length >= 4 && rng.chance(0.25)) {
      transferTitle(state, rest[i + 1]!, count.id, 'start');
      i++;
    }
  }
  void lord;
  return lordId;
}

// ---------------------------------------------------------------------------
// Maisons majeures et plans des royaumes
// ---------------------------------------------------------------------------
const MAJOR: Record<string, HouseSpec> = {
  valorie: {
    id: 'h_valorie', name: 'Valorie', motto: 'Le lys ne plie pas.', cultureId: 'valorien', renown: 820, color: '#2f4f9a',
    history: 'Rois de Valorie depuis sept générations, les Valorie ont donné deux Hauts-Rois à Caldria. La mort soudaine du roi Galeran a placé sa fille Aélis sur un trône que ses vassaux jugent trop lourd pour elle.',
  },
  veyr: {
    id: 'h_veyr', name: 'Veyr', motto: 'Nous attendons notre heure.', cultureId: 'valorien', renown: 420, color: '#6a1f2b', dynastyOf: 'h_valorie',
    history: 'Branche cadette des Valorie, fondée par un prince écarté du trône. Les Veyr n’ont jamais oublié que leur sang est royal.',
  },
  aurevanne: {
    id: 'h_aurevanne', name: 'Aurevanne', motto: 'De l’or dans la cendre.', cultureId: 'caldrien', renown: 900, color: '#8b1e2d',
    history: 'Cousins du dernier Haut-Roi, les Aurevanne tiennent le cœur de l’ancien empire. Leur vieux roi voit ses trois fils se disputer un héritage que la loi de partage va morceler.',
  },
  castelmar: {
    id: 'h_castelmar', name: 'Castelmar', motto: 'La lanterne veille.', cultureId: 'caldrien', renown: 610, color: '#b8862b',
    history: 'Protecteurs des Veilleurs de l’Aube, les Castelmar sont réputés pieux et austères. Leur lignée tient désormais à une enfant de santé fragile.',
  },
  caerwyn: {
    id: 'h_caerwyn', name: 'Caerwyn', motto: 'Choisis par les pierres.', cultureId: 'ardhe', renown: 380, color: '#5b2a6e',
    history: 'Élus rois d’Ardh par le conseil des pierres levées, les Caerwyn doivent leur couronne au vote des ducs — et le savent.',
  },
  ardhmor: {
    id: 'h_ardhmor', name: 'Ardhmor', motto: 'Nous étions rois.', cultureId: 'ardhe', renown: 1100, color: '#3d3d5c',
    history: 'La plus ancienne maison d’Ardh a régné quatre siècles avant d’être ruinée par une guerre civile. Il ne lui reste qu’un comté, des dettes… et un nom que tout Ardh respecte.',
  },
  hrovmark: {
    id: 'h_hrovmark', name: 'Hrovmark', motto: 'Le givre ne recule pas.', cultureId: 'hrovar', renown: 950, color: '#3d4f7a',
    history: 'Fondateurs de l’Empire du Nord, les Hrovmark règnent sur les fjords et les hautes terres. L’empereur Torvald vieillit, et ses rois vassaux regardent déjà ailleurs.',
  },
  skarnholt: {
    id: 'h_skarnholt', name: 'Skarnholt', motto: 'Libres comme la tempête.', cultureId: 'hrovar', renown: 480, color: '#2f5d3a',
    history: 'Rois vassaux de l’Empire, les Skarnholt n’ont prêté serment que sous la contrainte, il y a trente ans.',
  },
  radvel: {
    id: 'h_radvel', name: 'Radvel', motto: 'Les racines tiennent la forêt.', cultureId: 'vesnar', renown: 520, color: '#4f6b2a',
    history: 'Rois de Vesnagrad sous la tutelle de l’Empire du Nord. Deux frères, un seul trône : la cour de Vesnagrad bruisse de murmures.',
  },
  azhar: {
    id: 'h_azhar', name: 'Azhar', motto: 'Les étoiles ont écrit notre nom.', cultureId: 'sarrhan', renown: 700, color: '#c8a24a',
    history: 'Princes-marchands devenus rois, les Azhar ont bâti leur fortune sur les routes de l’ambre et rêvent de restaurer l’Hégémonie.',
  },
  kharzul: {
    id: 'h_kharzul', name: 'Kharzul', motto: 'Le ciel est notre toit.', cultureId: 'kharzul', renown: 560, color: '#9c3d1a',
    history: 'Seigneurs des steppes, les Kharzul ne reconnaissent que la force. Leur reine a déjà tiré l’épée contre Azhar.',
  },
  corvane: {
    id: 'h_corvane', name: 'Corvane', motto: 'Tout se vend, même la mer.', cultureId: 'myrrhain', renown: 340, color: '#2a6470',
    history: 'Armateurs devenus ducs, les Corvane possèdent la moitié des navires de Myrrh. Leur richesse suscite autant de convoitises que de mépris.',
  },
};
const majorHouse = (k: string) => {
  const spec = MAJOR[k]!;
  return state.houses[spec.id] ?? makeHouse(spec, true);
};
// Les branches cadettes nécessitent leur dynastie parente.
majorHouse('valorie');

function populateKingdom(
  kingdomId: string,
  opts: {
    king?: { spec: RulerSpec; houseKey: string; law?: SuccessionLaw };
    liegeId?: string | null;
    extraDuchiesForKing?: number;
    fragmented?: boolean;
    duchySpecs?: Record<number, { spec: RulerSpec; houseKey: string }>;
    kingId?: string;
  },
): string | null {
  const duchies = DEJURE_CHILDREN[kingdomId]!;
  const capitalDuchy = PROVINCE_GEO[TITLE_DEFS[kingdomId]!.capitalProvinceId]!.duchyTitleId;
  let kingId: string | null = opts.kingId ?? null;
  const { cultureId, faithId } = capitalCulture(kingdomId);
  if (opts.king && !kingId) {
    const house = majorHouse(opts.king.houseKey);
    const king = makeRuler(opts.king.spec, house.id, cultureId, faithId, 3);
    kingId = king.id;
    transferTitle(state, kingdomId, kingId, 'start', { liegeId: opts.liegeId ?? null });
    if (opts.king.law) state.titles[kingdomId]!.successionLaw = opts.king.law;
  } else if (kingId) {
    transferTitle(state, kingdomId, kingId, 'start');
  }
  const ordered = [capitalDuchy, ...duchies.filter((d) => d !== capitalDuchy)];
  let kingDuchies = 1 + (opts.extraDuchiesForKing ?? 0);
  ordered.forEach((duchyId, i) => {
    const special = opts.duchySpecs?.[i];
    if (kingId && kingDuchies > 0 && !special) {
      kingDuchies--;
      populateDuchy(duchyId, null, { createDuchy: true, holderId: kingId });
      return;
    }
    const createDuchy = opts.fragmented || !!special || rng.chance(0.8);
    const lord = populateDuchy(duchyId, kingId, {
      createDuchy,
      dukeSpec: special?.spec,
      dukeHouse: special ? majorHouse(special.houseKey).id : undefined,
    });
    void lord;
  });
  return kingId;
}

// --- Haute-Couronne de Caldria (vacante) ---------------------------------
const aelisId = populateKingdom('k_valorie', {
  king: {
    houseKey: 'valorie',
    spec: {
      key: 'aelis', firstName: 'Aélis', sex: 'F', age: 22, traits: ['sociable', 'just', 'patient', 'comely'],
      skills: { diplomacy: 14, stewardship: 8, intrigue: 6, martial: 4, learning: 7 }, education: { skill: 'diplomacy', level: 2 },
      married: false, gold: 260, prestige: 700,
      siblings: [{ sex: 'M', age: 15, name: 'Tristan', traits: ['brave'] }, { sex: 'F', age: 19, name: 'Isaure' }],
    },
  },
  duchySpecs: {
    1: {
      houseKey: 'veyr',
      spec: {
        key: 'aldren', firstName: 'Aldren', sex: 'M', age: 41, traits: ['ambitious', 'brave', 'deceitful'],
        skills: { martial: 12, diplomacy: 9, intrigue: 11, stewardship: 7, learning: 5 }, education: { skill: 'martial', level: 2 },
        married: true, gold: 240, prestige: 520,
        children: [{ sex: 'M', age: 19, name: 'Béric' }, { sex: 'F', age: 16, name: 'Mahaut' }, { sex: 'M', age: 13, name: 'Renaud' }],
        siblings: [{ sex: 'M', age: 37, name: 'Galeran', traits: ['ambitious', 'cruel'] }],
      },
    },
  },
})!;
const aurelanId = populateKingdom('k_aurevanne', {
  extraDuchiesForKing: 1,
  king: {
    houseKey: 'aurevanne',
    spec: {
      key: 'aurelan', firstName: 'Aurelan', sex: 'M', age: 67, traits: ['arrogant', 'wrathful', 'generous', 'administrator'],
      skills: { diplomacy: 9, martial: 10, stewardship: 13, intrigue: 7, learning: 8 }, education: { skill: 'stewardship', level: 3 },
      married: true, gold: 520, prestige: 1400, noRandomChildren: true,
      children: [
        { sex: 'M', age: 42, name: 'Maxence', traits: ['ambitious', 'cruel', 'arrogant'] },
        { sex: 'M', age: 39, name: 'Séverin', traits: ['just', 'patient', 'zealous'] },
        { sex: 'M', age: 34, name: 'Lucan', traits: ['deceitful', 'sociable', 'ambitious'] },
        { sex: 'F', age: 27, name: 'Octavie' },
      ],
    },
    law: 'partition',
  },
})!;
const severinId = populateKingdom('k_castelmar', {
  king: {
    houseKey: 'castelmar',
    spec: {
      key: 'severin', firstName: 'Anselme', sex: 'M', age: 46, traits: ['zealous', 'humble', 'compassionate', 'mystic'],
      skills: { diplomacy: 8, martial: 6, stewardship: 9, intrigue: 4, learning: 15 }, education: { skill: 'learning', level: 3 },
      married: false, gold: 300, prestige: 800, noRandomChildren: true,
    },
    law: 'primogeniture',
  },
})!;
const caedmonId = populateKingdom('k_ardh', {
  king: {
    houseKey: 'caerwyn',
    spec: {
      key: 'caedmon', firstName: 'Caedmon', sex: 'M', age: 51, traits: ['content', 'honest', 'sociable'],
      skills: { diplomacy: 11, martial: 8, stewardship: 8, intrigue: 5, learning: 9 }, gold: 210,
    },
    law: 'elective',
  },
})!;

// --- Empire de Hrovmark ---------------------------------------------------
const hrovHouse = majorHouse('hrovmark');
const emperor = makeRuler(
  {
    key: 'torvald', firstName: 'Torvald', sex: 'M', age: 58, traits: ['brave', 'just', 'paranoid', 'war_hero'],
    skills: { diplomacy: 9, martial: 16, stewardship: 10, intrigue: 8, learning: 6 }, education: { skill: 'martial', level: 3 },
    married: true, gold: 750, prestige: 2100,
    children: [{ sex: 'M', age: 33, name: 'Hakon', traits: ['brave', 'wrathful'] }, { sex: 'F', age: 29, name: 'Sigrun' }, { sex: 'M', age: 21, name: 'Leif' }],
  },
  hrovHouse.id,
  'hrovar',
  'anciens_chemins',
  4,
);
transferTitle(state, 'e_hrovmark', emperor.id, 'start');
state.titles.e_hrovmark!.active = true;
populateKingdom('k_hrovmark', { kingId: emperor.id, extraDuchiesForKing: 1 });
emperor.crownAuthority = 2;
const eskilId = populateKingdom('k_skarnholt', {
  liegeId: emperor.id,
  king: {
    houseKey: 'skarnholt',
    spec: { key: 'eskil', firstName: 'Eskil', sex: 'M', age: 40, traits: ['ambitious', 'wrathful', 'brave'], skills: { martial: 13 } },
  },
})!;
const radovanId = populateKingdom('k_vesnagrad', {
  liegeId: emperor.id,
  king: {
    houseKey: 'radvel',
    spec: {
      key: 'radovan', firstName: 'Radovan', sex: 'M', age: 44, traits: ['trusting', 'lazy', 'generous'],
      skills: { diplomacy: 10, stewardship: 7, intrigue: 4 }, married: true,
    },
  },
  duchySpecs: {
    1: {
      houseKey: 'radvel',
      spec: {
        key: 'velimir', firstName: 'Velimir', sex: 'M', age: 39, traits: ['deceitful', 'ambitious', 'patient'],
        skills: { intrigue: 16, diplomacy: 10, stewardship: 9, martial: 6, learning: 8 }, education: { skill: 'intrigue', level: 3 },
        married: true, gold: 190,
      },
    },
  },
})!;

// --- Azhar, Kharzul, Myrrh ------------------------------------------------
const iskanderId = populateKingdom('k_azhar', {
  extraDuchiesForKing: 1,
  king: {
    houseKey: 'azhar',
    spec: {
      key: 'iskander', firstName: 'Iskander', sex: 'M', age: 51, traits: ['greedy', 'patient', 'arbitrary'],
      skills: { stewardship: 14, diplomacy: 9, martial: 8 }, gold: 680, married: true,
    },
  },
})!;
const altaniId = populateKingdom('k_kharzul', {
  king: {
    houseKey: 'kharzul',
    spec: {
      key: 'altani', firstName: 'Altani', sex: 'F', age: 34, traits: ['brave', 'wrathful', 'honest', 'strategist'],
      skills: { martial: 17, diplomacy: 7, stewardship: 8, intrigue: 6, learning: 5 }, education: { skill: 'martial', level: 3 },
      married: true, gold: 240, prestige: 900,
      children: [{ sex: 'F', age: 12, name: 'Khulan' }, { sex: 'M', age: 9, name: 'Temek' }],
    },
  },
})!;
populateKingdom('k_myrrh', {
  fragmented: true,
  duchySpecs: {
    0: {
      houseKey: 'corvane',
      spec: {
        key: 'thalos', firstName: 'Thalos', sex: 'M', age: 38, traits: ['greedy', 'diligent', 'sociable'],
        skills: { stewardship: 17, diplomacy: 11, martial: 5, intrigue: 9, learning: 8 }, education: { skill: 'stewardship', level: 3 },
        married: true, gold: 1150, prestige: 450,
      },
    },
  },
});
// Tous les ducs de Myrrh sont indépendants.
for (const d of DEJURE_CHILDREN.k_myrrh!) {
  const holder = state.titles[d]!.holderId;
  if (holder) state.characters[holder]!.liegeId = null;
}

// Castelmar : seule héritière, une enfant fragile. Anselme est veuf.
{
  const anselme = state.characters[severinId]!;
  const wife = newChar({
    sex: 'F', birth: birthForAge(START, 33, rng), cultureId: 'caldrien', faithId: 'veilleurs',
    houseId: minorHouse('Sévrane', 'caldrien').id, courtId: anselme.id, education: true,
  });
  wife.death = START - 400;
  wife.deathCause = 'childbirth';
  anselme.formerSpouseIds.push(wife.id);
  const lucille = newChar({
    sex: 'F', firstName: 'Lucille', birth: birthForAge(START, 6, rng), cultureId: 'caldrien', faithId: 'veilleurs',
    houseId: anselme.houseId, fatherId: anselme.id, motherId: wife.id, courtId: anselme.id, traits: ['frail', 'patient'],
  });
  lucille.health = 3.2;
  keyed.lucille = lucille.id;
}

// Ardh : la maison Ardhmor, ruinée mais prestigieuse, tient un seul comté.
{
  const ardhCounties = countiesOf('k_ardh');
  const target = ardhCounties.find((c) => {
    const h = state.titles[c]!.holderId;
    return h && state.characters[h]!.titleIds.length === 1 && rankOf(state.characters[h]!) === 1;
  })!;
  const oldHolder = state.characters[state.titles[target]!.holderId!]!;
  const liege = oldHolder.liegeId;
  const house = majorHouse('ardhmor');
  const morcant = makeRuler(
    {
      key: 'morcant', firstName: 'Morcant', sex: 'M', age: 29, traits: ['ambitious', 'honest', 'brave', 'poet'],
      skills: { diplomacy: 11, martial: 10, stewardship: 5, intrigue: 7, learning: 10 }, gold: 12, prestige: 950, married: false,
    },
    house.id,
    'ardhe',
    'anciens_chemins',
    1,
  );
  transferTitle(state, target, morcant.id, 'start', { liegeId: liege });
  // L'ancien comte devient courtisan de son suzerain.
  oldHolder.courtId = liege;
}

// Réalignements : les seigneurs dont le rang ne convient plus.
for (const c of Object.values(state.characters)) if (c.titleIds.length) {
  if (c.liegeId && rankOf(state.characters[c.liegeId]!) <= rankOf(c)) c.liegeId = state.characters[c.liegeId]!.liegeId;
}

// ---------------------------------------------------------------------------
// Chefs de maison, conseils
// ---------------------------------------------------------------------------
for (const h of Object.values(state.houses)) {
  if (h.headId && state.characters[h.headId]?.death === null) continue;
  const members = Object.values(state.characters).filter((c) => c.houseId === h.id && c.death === null);
  members.sort((a, b) => rankOf(b) - rankOf(a) || a.birth - b.birth);
  h.headId = members[0]?.id ?? null;
}
for (const c of Object.values(state.characters)) {
  if (c.titleIds.length && c.death === null) autoFillCouncil(state, c.id);
}

// ---------------------------------------------------------------------------
// Relations, revendications, alliances, guerre, factions, secrets
// ---------------------------------------------------------------------------
const rel = (a: string, b: string, type: 'friend' | 'rival' | 'lover' | 'best_friend' | 'nemesis' | 'mentor') => {
  const id = nid('rel');
  state.relations[id] = { id, a, b, type, since: START - yearsToDays(rng.int(1, 8)) };
};
const opinion = (of: string, towards: string, value: number, reason: string, years = 5) => {
  const c = state.characters[of]!;
  (c.opinions[towards] ??= []).push({ reason, value, expires: START + yearsToDays(years) });
};
const claim = (charId: string, titleId: string, kind: 'strong' | 'weak' | 'inherited', origin: string) => {
  const id = nid('cl');
  state.claims[id] = { id, characterId: charId, titleId, kind, pressed: kind !== 'weak', createdAt: START, expires: null, origin };
};

// Les fils d'Aurelan se haïssent.
{
  const sons = state.characters[aurelanId]!.childIds.map((id) => state.characters[id]!).filter((c) => c.sex === 'M');
  keyed.maxence = sons[0]!.id;
  rel(sons[0]!.id, sons[1]!.id, 'rival');
  rel(sons[0]!.id, sons[2]!.id, 'nemesis');
  rel(sons[1]!.id, sons[2]!.id, 'rival');
}
// Aldren revendique la couronne de Valorie ; ses pairs doutent de la jeune reine.
claim(keyed.aldren!, 'k_valorie', 'strong', 'claim.origin.cadet_blood');
for (const v of Object.values(state.characters)) {
  if (v.liegeId === aelisId) opinion(v.id, aelisId, v.id === keyed.aldren ? -40 : -15, 'opinion.reason.contested_succession', 6);
}
{
  const members = Object.values(state.characters).filter((c) => c.liegeId === aelisId && c.id !== keyed.aldren).slice(0, 2);
  const fid = nid('fa');
  state.factions[fid] = {
    id: fid, type: 'claimant', targetId: aelisId, leaderId: keyed.aldren!, members: [keyed.aldren!, ...members.map((m) => m.id)],
    claimantId: keyed.aldren!, discontent: 35, createdAt: START, ultimatumSent: false,
  };
}
// Morcant d'Ardhmor : revendication héritée sur Ardh.
claim(keyed.morcant!, 'k_ardh', 'inherited', 'claim.origin.ancient_kings');
// Un cousin revendique Castelmar.
{
  const castelmarVassals = Object.values(state.characters).filter((c) => c.liegeId === severinId && rankOf(c) === 1);
  const cousin = castelmarVassals[0];
  if (cousin) {
    claim(cousin.id, 'k_castelmar', 'strong', 'claim.origin.royal_cousin');
    keyed.castelmar_claimant = cousin.id;
  }
}
// Velimir tient un levier sur le chancelier de son frère et cache un secret.
{
  const radovan = state.characters[radovanId]!;
  const chancellor = radovan.council?.chancellor.characterId;
  if (chancellor) {
    const sid = nid('se');
    state.secrets[sid] = { id: sid, type: 'corruption', ownerId: chancellor, aboutId: null, knownBy: [keyed.velimir!], createdAt: START - 200, exposed: false };
    const hid = nid('hk');
    state.hooks[hid] = { id: hid, ownerId: keyed.velimir!, targetId: chancellor, strong: false, secretId: sid, createdAt: START - 200, expires: null, cooldownUntil: START };
  }
  const sid2 = nid('se');
  state.secrets[sid2] = { id: sid2, type: 'political_crime', ownerId: keyed.velimir!, aboutId: radovanId, knownBy: [], createdAt: START - 800, exposed: false };
  opinion(keyed.velimir!, radovanId, -20, 'opinion.reason.envy', 10);
}
// Skarnholt veut l'indépendance.
{
  const fid = nid('fa');
  state.factions[fid] = {
    id: fid, type: 'independence', targetId: emperor.id, leaderId: eskilId, members: [eskilId], claimantId: null,
    discontent: 20, createdAt: START, ultimatumSent: false,
  };
  opinion(eskilId, emperor.id, -30, 'opinion.reason.forced_oath', 10);
}
// Guerre de départ : Kharzul contre Azhar pour un comté frontalier.
{
  const azharProvinces = WORLD.provinces.filter((p) => p.kingdomTitleId === 'k_azhar');
  const border = azharProvinces.find((p) => p.neighbors.some((n) => PROVINCE_GEO[n]!.kingdomTitleId === 'k_kharzul'))!;
  const county = border.countyTitleId;
  claim(altaniId, county, 'strong', 'claim.origin.ancestral_pasture');
  const wid = nid('wa');
  state.wars[wid] = {
    id: wid, cb: 'county_claim', attackerId: altaniId, defenderId: iskanderId, attackers: [altaniId], defenders: [iskanderId],
    targetTitleId: county, claimantId: altaniId, warScore: 0, battleScore: 0, occupationScore: 0, ticking: 0,
    startedAt: START - 12, battles: [], casualties: [0, 0], factionId: null, maxEnd: START + 3650,
  };
  keyed.war_county = county;
}

// Mariages croisés entre familles régnantes : alliances.
{
  const rulers = Object.values(state.characters).filter((c) => c.titleIds.length && rankOf(c) >= 2 && c.death === null);
  const singles = (r: Character) =>
    r.childIds
      .map((id) => state.characters[id]!)
      .filter((k) => k.death === null && !k.spouseId && START - k.birth >= yearsToDays(17));
  let made = 0;
  for (const a of rng.shuffle([...rulers])) {
    if (made >= 10) break;
    for (const b of rulers) {
      if (a.id === b.id || a.houseId === b.houseId) continue;
      const ka = singles(a);
      const kb = singles(b);
      const x = ka.find((k) => kb.some((j) => j.sex !== k.sex && Math.abs(j.birth - k.birth) < yearsToDays(10)));
      if (!x) continue;
      const y = kb.find((j) => j.sex !== x.sex && Math.abs(j.birth - x.birth) < yearsToDays(10))!;
      if (keyed.maxence === x.id || keyed.maxence === y.id || rng.chance(0.3)) continue;
      x.spouseId = y.id;
      y.spouseId = x.id;
      // L'épouse rejoint la cour du mari.
      const wife = x.sex === 'F' ? x : y;
      const husband = x.sex === 'M' ? x : y;
      wife.courtId = husband.courtId;
      const aid = nid('al');
      state.alliances[aid] = { id: aid, a: a.id, b: b.id, reason: 'marriage', createdAt: START - yearsToDays(1), viaMarriage: [x.id, y.id] };
      made++;
      break;
    }
  }
}
// Amitiés et rivalités aléatoires entre dirigeants voisins.
{
  const landed = Object.values(state.characters).filter((c) => c.titleIds.length && c.death === null);
  for (let i = 0; i < 26; i++) {
    const a = rng.pick(landed);
    const b = rng.pick(landed);
    if (a.id === b.id) continue;
    rel(a.id, b.id, rng.chance(0.55) ? 'friend' : 'rival');
  }
}

// ---------------------------------------------------------------------------
// Souverains recommandés
// ---------------------------------------------------------------------------
const recommended: RecommendedStart[] = [
  {
    characterId: aelisId, difficulty: 'hard',
    tagline: 'Une couronne trop lourde pour une reine de vingt-deux ans ?',
    description: 'Aélis a hérité du trône de Valorie il y a trois mois. Brillante diplomate, elle n’a ni époux, ni héritier, ni l’appui de ses grands vassaux.',
    problems: ['Le duc Aldren de Veyr revendique votre couronne et mène une faction.', 'Vos vassaux doutent de votre légitimité.', 'Aucun héritier direct.'],
    objective: 'Assurer votre succession et briser la faction de Veyr.',
  },
  {
    characterId: aurelanId, difficulty: 'hard',
    tagline: 'Un vieux lion et trois louveteaux affamés.',
    description: 'Aurelan d’Aurevanne a soixante-sept ans et le plus riche royaume du Cœur. La loi de partage divisera son héritage entre trois fils qui se haïssent.',
    problems: ['Succession par partage.', 'Maxence, Séverin et Lucan sont rivaux.', 'Santé déclinante.'],
    objective: 'Préserver l’unité d’Aurevanne après votre mort, puis restaurer la Haute-Couronne.',
  },
  {
    characterId: keyed.thalos!, difficulty: 'easy',
    tagline: 'L’or de la mer achète tout — même un trône ?',
    description: 'Thalos de Corvane est un petit duc indépendant de Myrrh, mais ses coffres débordent. Ses voisins sont plus faibles que lui… et le savent.',
    problems: ['Petit domaine, grande convoitise.', 'Armée réduite.'],
    objective: 'Unifier les duchés de Myrrh et créer le royaume.',
  },
  {
    characterId: keyed.aldren!, difficulty: 'normal',
    tagline: 'Le sang royal coule dans les veines de Veyr.',
    description: 'Cousin de la reine par une branche cadette, Aldren de Veyr possède une revendication forte sur la Valorie et une faction prête à le suivre.',
    problems: ['Votre suzeraine est plus puissante que vous.', 'Votre frère Galeran rêve de votre place.'],
    objective: 'Faire valoir votre revendication et ceindre la couronne de Valorie.',
  },
  {
    characterId: altaniId, difficulty: 'hard',
    tagline: 'La guerre a déjà commencé.',
    description: 'Altani de Kharzul, stratège redoutée, a déclaré la guerre à Azhar pour des pâturages ancestraux. Le roi Iskander est riche et patient.',
    problems: ['Guerre en cours contre un royaume plus riche.', 'Trésor limité.'],
    objective: 'Gagner la guerre, puis étendre votre domination sur les steppes.',
  },
  {
    characterId: keyed.velimir!, difficulty: 'normal',
    tagline: 'Le frère du roi n’a jamais aimé l’ombre.',
    description: 'Velimir de Vesnagrad est duc sous l’autorité de son frère Radovan, roi paresseux et trop confiant. Il détient un levier sur le chancelier… et un secret dangereux.',
    problems: ['Vous êtes vassal d’un vassal de l’Empereur.', 'Votre propre secret pourrait vous perdre.'],
    objective: 'Prendre la couronne de Vesnagrad par l’intrigue plutôt que par l’épée.',
  },
  {
    characterId: severinId, difficulty: 'normal',
    tagline: 'Une lanterne pour une enfant fragile.',
    description: 'Anselme de Castelmar, roi pieux et érudit, est veuf. Sa seule héritière, Lucille, a six ans et une santé fragile. Un cousin attend dans l’ombre.',
    problems: ['Succession fragile.', 'Un comte vassal revendique votre couronne.'],
    objective: 'Vous remarier, assurer votre lignée et protéger la foi des Veilleurs.',
  },
  {
    characterId: keyed.morcant!, difficulty: 'very_hard',
    tagline: 'Nous étions rois.',
    description: 'Dernier chef de la maison Ardhmor, Morcant ne possède qu’un comté et douze pièces d’or. Mais son nom pèse lourd au conseil des pierres levées.',
    problems: ['Un seul comté, presque aucun revenu.', 'Aucun héritier, aucune alliance.'],
    objective: 'Relever la maison Ardhmor et reconquérir le trône électif d’Ardh.',
  },
  {
    characterId: emperor.id, difficulty: 'easy',
    tagline: 'Le givre ne recule pas.',
    description: 'Torvald de Hrovmark est l’empereur du Nord, héros de guerre et suzerain de trois rois. Mais Skarnholt veut l’indépendance et l’âge le rattrape.',
    problems: ['Faction d’indépendance de Skarnholt.', 'Âge avancé.'],
    objective: 'Maintenir l’Empire uni et étendre son influence vers le Cœur de Caldria.',
  },
];


// Personnalités finales et nettoyage.
for (const c of Object.values(state.characters)) {
  c.personality = computePersonality(c.traits);
  if (c.titleIds.length) c.courtId = c.id;
}
void EMPIRE_DEFS;
void caedmonId;

const scenario: ScenarioData = {
  id: 'couronne_brisee',
  name: 'La Couronne brisée',
  startDate: START,
  intro:
    'Le Haut-Roi Valéran est mort sans héritier reconnu. La Haute-Couronne de Caldria gît vacante, et l’autorité impériale s’est brisée comme un miroir. ' +
    'Au nord, l’Empire de Hrovmark observe ; au sud, les princes d’Azhar rêvent d’une hégémonie nouvelle. Dans le Cœur, les maisons de Valorie, d’Aurevanne et de Castelmar ' +
    'revendiquent chacune une part de l’héritage. Les mariages valent désormais des armées, et chaque serment a un prix.',
  characters: state.characters,
  houses: state.houses,
  dynasties: state.dynasties,
  titles: state.titles,
  provinces: state.provinces,
  relations: state.relations,
  claims: state.claims,
  alliances: state.alliances,
  wars: state.wars,
  secrets: state.secrets,
  hooks: state.hooks,
  factions: state.factions,
  recommended,
  nextId: state.nextId,
};

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../content/data/scenario-1087.json');
writeFileSync(out, JSON.stringify(scenario));
const alive = Object.values(state.characters).filter((c) => c.death === null);
const landed = alive.filter((c) => c.titleIds.length);
console.log(
  `Scénario écrit : ${alive.length} personnages vivants (${Object.keys(state.characters).length} au total), ${landed.length} titrés, ${Object.keys(state.houses).length} maisons, ${Object.keys(state.alliances).length} alliances.`,
);
console.log(`Indépendants : ${landed.filter((c) => !c.liegeId).length}`);
void educationTraitFor;
