/**
 * Construction du scénario « Monde 1400 » à partir des données historiques
 * (entités, dirigeants connus) et de la répartition territoriale calculée par
 * le pipeline (data/world1400/start.json). La construction est déterministe
 * (graine fixe) : toutes les parties démarrent du même monde.
 *
 * Les familles, conseillers et gouverneurs non documentés sont générés à
 * partir des listes de noms de chaque culture.
 */
import {
  SKILL_KEYS,
  toDay,
  type Alliance,
  type Character,
  type Claim,
  type Dynasty,
  type House,
  type Pact,
  type PolityInfo,
  type ProvinceState,
  type RecommendedStart,
  type Relation,
  type RelationType,
  type ScenarioData,
  type Sex,
  type Skills,
  type SubjectType,
  type Title,
  type TitleRank,
  type War,
} from '@ttc/shared';
import startJson from '../../data/world1400/start.json';
import { TRAITS } from '../traits';
import { CULTURES_1400 } from './cultures';
import { GOVERNMENT_BY_ID, type GovernmentId } from './governments';
import type { PersonSpec, PolitySpec } from './polity-types';
import { POLITIES_1400 } from './index';
import { WORLD_1400, provinceKey } from './world';

export const START_1400 = toDay(1400, 1, 1);

interface StartData {
  fillers: PolitySpec[];
  polities: {
    id: string;
    /** Rang effectif (une entité comtale trop vaste est promue duché). */
    rank?: TitleRank;
    title?: [string, string];
    capital: number;
    provinces: number[];
    divisions: { id: string; provinces: number[]; seat: number }[];
  }[];
}
const START = startJson as unknown as StartData;

const RANK_N: Record<TitleRank, number> = { county: 1, duchy: 2, kingdom: 3, empire: 4 };
const VASSAL_TYPES = new Set<SubjectType>(['direct_vassal', 'autonomous_vassal', 'personal_union', 'confederate_member']);
/** Gouvernements où les gouverneurs sont nommés parmi l'élite du pouvoir central. */
const APPOINTED = new Set<GovernmentId>(['imperial_bureaucracy', 'mamluk_sultanate', 'iqta_realm', 'steppe_confederation', 'theocracy', 'holy_order', 'warrior_shogunate', 'city_republic', 'merchant_republic']);
const START_AUTHORITY: Record<GovernmentId, number> = {
  feudal_monarchy: 1, centralized_monarchy: 2, imperial_bureaucracy: 3, mamluk_sultanate: 2, iqta_realm: 2, steppe_confederation: 1, tribal_confederation: 0,
  warrior_shogunate: 1, clan_realm: 0, city_republic: 2, merchant_republic: 2, theocracy: 1, holy_order: 2, elective_monarchy: 1, tributary_empire: 1,
  mandala_kingdom: 1, city_state: 2, chiefdom: 0,
};
const TRIBUTE: Record<SubjectType, [number, number]> = {
  direct_vassal: [0.2, 0.4], autonomous_vassal: [0.1, 0.2], tributary: [0.15, 0.1], personal_union: [0.05, 0.1], client_state: [0.05, 0.15], confederate_member: [0.05, 0.25],
};

/** Traits notables de dirigeants documentés. */
const RULER_TRAITS: Record<string, string[]> = {
  fra: ['lunatic', 'generous', 'trusting'], bur: ['ambitious', 'brave', 'diligent', 'education_diplomacy_3'], orl: ['ambitious', 'lustful', 'arrogant'],
  ber: ['greedy', 'generous', 'education_learning_2'], eng: ['ambitious', 'diligent', 'paranoid', 'war_hero'], sco: ['infirm', 'content', 'humble'],
  cas: ['frail', 'just', 'diligent'], ara: ['zealous', 'patient'], por: ['brave', 'just', 'ambitious', 'war_hero'], mil: ['ambitious', 'deceitful', 'diligent', 'administrator'],
  hre: ['lazy', 'wrathful', 'reclusive'], boh: ['lazy', 'wrathful', 'reclusive'], hun: ['ambitious', 'lustful', 'brave'], pol: ['zealous', 'patient', 'loyal'],
  lit: ['ambitious', 'brave', 'strategist', 'education_martial_3'], teu: ['just', 'patient'], kal: ['ambitious'], byz: ['patient', 'diligent', 'poet', 'education_diplomacy_3'],
  ott: ['wrathful', 'brave', 'ambitious', 'aggressive_attacker'], tim: ['ambitious', 'cruel', 'brave', 'strategist', 'maimed', 'education_martial_3'],
  mam: ['arrogant', 'wrathful'], ming: ['compassionate', 'humble', 'education_learning_3'], yan: ['ambitious', 'brave', 'wrathful', 'strategist', 'education_martial_3'],
  jpn: ['ambitious', 'arrogant', 'administrator', 'education_diplomacy_3'], jos: ['content', 'humble'], vij: ['zealous', 'ambitious'], dvt: ['ambitious', 'deceitful', 'administrator'],
  eth: ['zealous', 'brave', 'education_martial_2'], aze: ['ambitious', 'deceitful', 'patient', 'education_intrigue_3'], ven: ['just', 'patient'], pap: ['greedy', 'diligent'],
  avi: ['zealous', 'arrogant', 'paranoid'], nap: ['ambitious', 'brave', 'lustful'], msc: ['patient', 'deceitful'], gh: ['lazy'], bah: ['education_learning_3', 'lustful', 'generous'],
  bng: ['just', 'poet'], mgh: ['brave'], nyu: ['brave'], kas: ['zealous', 'cruel'], mlk: ['ambitious', 'deceitful'], maj: ['content'],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** PRNG déterministe (mulberry32). */
function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
    normal: (mu: number, sigma: number) => {
      const u = Math.max(1e-9, next());
      const v = next();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

const PERSONALITY = TRAITS.filter((t) => t.category === 'personality');
const TRAIT_OPP = new Map(TRAITS.map((t) => [t.id, t.opposites ?? []]));
const CULTURE_BY = new Map(CULTURES_1400.map((c) => [c.id, c]));
const TITLE_DEF = new Map(WORLD_1400.titles.map((t) => [t.id, t]));
const PROV_GEO = new Map(WORLD_1400.provinces.map((p) => [p.id, p]));

function buildScenario(): ScenarioData {
  const rng = makeRng(1400);
  let next = 1;
  const nid = (prefix: string) => `${prefix}${next++}`;
  const characters: Record<string, Character> = {};
  const houses: Record<string, House> = {};
  const dynasties: Record<string, Dynasty> = {};
  const titles: Record<string, Title> = {};
  const provinces: Record<string, ProvinceState> = {};
  const relations: Record<string, Relation> = {};
  const claims: Record<string, Claim> = {};
  const alliances: Record<string, Alliance> = {};
  const wars: Record<string, War> = {};
  const pacts: Record<string, Pact> = {};
  const polityInfo: Record<string, PolityInfo> = {};

  // --- Titres et provinces ------------------------------------------------
  for (const def of WORLD_1400.titles) {
    titles[def.id] = { id: def.id, active: false, holderId: null, successionLaw: def.successionLaw, history: [], electionVotes: {}, occupiedBy: null };
  }
  for (const g of WORLD_1400.provinces) {
    provinces[g.id] = {
      id: g.id,
      development: g.baseDevelopment,
      control: g.baseControl,
      cultureId: g.cultureId,
      faithId: g.faithId,
      buildings: {},
      construction: null,
      levies: g.baseLevies,
      garrison: g.baseFort * 150,
      modifiers: [],
    };
  }

  // --- Maisons -----------------------------------------------------------
  const houseByKey = new Map<string, string>();
  function house(name: string, culture: string, color: string, major: boolean, history = ''): string {
    const key = `${name}|${CULTURE_BY.get(culture)?.region ?? culture}`;
    const found = houseByKey.get(key);
    if (found) {
      if (major) houses[found]!.isMajor = true;
      return found;
    }
    const id = nid('h');
    const dy = nid('dy');
    houses[id] = { id, name, motto: '', dynastyId: dy, founderId: null, headId: null, coaSeed: hash(`${name}:${culture}`), color, renown: major ? rng.int(200, 900) : rng.int(0, 120), history, isMajor: major, cultureId: culture };
    dynasties[dy] = { id: dy, name, houseIds: [id], renown: houses[id]!.renown };
    houseByKey.set(key, id);
    return id;
  }
  function randomHouse(culture: string, avoid?: string): string {
    const def = CULTURE_BY.get(culture) ?? CULTURES_1400[0]!;
    let name = rng.pick(def.houseNames);
    if (name === avoid && def.houseNames.length > 1) name = rng.pick(def.houseNames.filter((n) => n !== avoid));
    return house(name, culture, def.color, false);
  }

  // --- Personnages -------------------------------------------------------
  function birthDay(year: number): number {
    return toDay(year, rng.int(1, 12), rng.int(1, 28));
  }
  function randomTraits(adult: boolean, age: number, fixed: string[]): string[] {
    const out = [...fixed];
    const want = adult ? 3 : age >= 6 ? 1 : 0;
    let guard = 0;
    while (out.filter((t) => PERSONALITY.some((p) => p.id === t)).length < want && guard++ < 40) {
      const t = rng.pick(PERSONALITY).id;
      if (out.includes(t) || out.some((o) => TRAIT_OPP.get(o)?.includes(t) || TRAIT_OPP.get(t)?.includes(o))) continue;
      out.push(t);
    }
    if (rng.chance(0.08)) {
      const cg = rng.pick(['robust', 'frail', 'sharp', 'dull', 'comely', 'homely']);
      if (!out.some((o) => TRAIT_OPP.get(cg)?.includes(o))) out.push(cg);
    }
    return out;
  }
  function person(o: {
    first: string;
    sex: Sex;
    year: number;
    culture: string;
    faith: string;
    houseId: string | null;
    court: string | null;
    father?: string | null;
    mother?: string | null;
    traits?: string[];
    skillBias?: number;
  }): Character {
    const id = nid('ch');
    const birth = birthDay(o.year);
    const age = 1400 - o.year;
    const adult = age >= 16;
    const traits = randomTraits(adult, age, o.traits ?? []);
    const skills = {} as Skills;
    for (const k of SKILL_KEYS) skills[k] = Math.max(0, Math.min(14, Math.round(rng.normal(5 + (o.skillBias ?? 0), 2.2))));
    if (adult && !traits.some((t) => t.startsWith('education_'))) {
      const best = [...SKILL_KEYS].sort((a, b) => skills[b] - skills[a])[0]!;
      const lvl = rng.next() < 0.45 ? 1 : rng.next() < 0.8 ? 2 : 3;
      traits.push(`education_${best}_${lvl}`);
    }
    const c: Character = {
      id,
      firstName: o.first,
      houseId: o.houseId,
      sex: o.sex,
      birth,
      death: null,
      deathCause: null,
      killerId: null,
      fatherId: o.father ?? null,
      motherId: o.mother ?? null,
      spouseId: null,
      formerSpouseIds: [],
      betrothedId: null,
      childIds: [],
      cultureId: o.culture,
      faithId: o.faith,
      courtId: o.court,
      liegeId: null,
      titleIds: [],
      skills,
      traits,
      health: Math.round((rng.normal(5, 0.6) - Math.max(0, age - 55) * 0.06) * 10) / 10,
      fertility: Math.round(Math.max(0.2, Math.min(0.95, rng.normal(0.6, 0.12))) * 100) / 100,
      stress: 0,
      gold: 0,
      prestige: adult ? rng.int(20, 120) : 0,
      fervor: adult ? rng.int(20, 100) : 0,
      authority: 0,
      crownAuthority: 1,
      portraitSeed: rng.int(1, 2 ** 30),
      education: !adult && age >= 6 ? { focus: rng.pick(SKILL_KEYS), tutorId: null, progress: rng.int(0, 60) } : null,
      guardianId: null,
      opinions: {},
      modifiers: [],
      flags: {},
      cooldowns: {},
      pregnancy: null,
      prisonerOf: null,
      council: null,
      maa: {},
      nominatedHeirId: null,
      personality: { ambition: 0, honor: 0, aggression: 0, greed: 0, sociability: 0, caution: 0, intrigue: 0, loyalty: 0, compassion: 0, zeal: 0 },
      aiNextThink: START_1400 + rng.int(1, 60),
      isPlayer: false,
    };
    characters[id] = c;
    if (c.fatherId) characters[c.fatherId]?.childIds.push(id);
    if (c.motherId) characters[c.motherId]?.childIds.push(id);
    return c;
  }
  function nameFor(culture: string, sex: Sex): string {
    const def = CULTURE_BY.get(culture) ?? CULTURES_1400[0]!;
    return rng.pick(sex === 'M' ? def.maleNames : def.femaleNames);
  }
  function marry(a: Character, b: Character): void {
    a.spouseId = b.id;
    b.spouseId = a.id;
  }
  /** Famille d'un dirigeant : conjoint et enfants (connus ou générés). */
  function family(ruler: Character, spec: { spouse?: PersonSpec; kids?: PersonSpec[] } | null, size: 'full' | 'small'): void {
    const age = 1400 - Math.floor(ruler.birth / 365) - 1;
    void age;
    const rulerAge = Math.floor((START_1400 - ruler.birth) / 365);
    const court = ruler.id;
    let spouse: Character | null = null;
    const wantSpouse = spec?.spouse ?? (rulerAge >= 18 && rng.chance(size === 'full' ? 0.8 : 0.65) ? ('gen' as const) : null);
    if (wantSpouse) {
      const sex: Sex = ruler.sex === 'M' ? 'F' : 'M';
      const sp = wantSpouse === 'gen' ? null : wantSpouse;
      spouse = person({
        first: sp?.[0] ?? nameFor(ruler.cultureId, sex),
        sex: sp?.[2] ?? sex,
        year: sp?.[1] ?? Math.min(1383, 1400 - rulerAge + rng.int(-4, 12) * (sex === 'F' ? 1 : -1)),
        culture: ruler.cultureId,
        faith: ruler.faithId,
        houseId: randomHouse(ruler.cultureId, houses[ruler.houseId ?? '']?.name),
        court,
      });
      marry(ruler, spouse);
    }
    const father = ruler.sex === 'M' ? ruler : spouse;
    const mother = ruler.sex === 'F' ? ruler : spouse;
    const kids: PersonSpec[] = spec?.kids ? [...spec.kids] : [];
    if (!spec?.kids && spouse) {
      const motherAge = mother ? Math.floor((START_1400 - mother.birth) / 365) : rulerAge;
      const maxKids = size === 'full' ? 4 : 2;
      const n = Math.max(0, Math.min(maxKids, rng.int(-1, maxKids)));
      for (let i = 0; i < n; i++) {
        const kidAge = rng.int(0, Math.max(0, Math.min(motherAge - 17, 24)));
        if (motherAge - kidAge < 16) continue;
        kids.push([nameFor(ruler.cultureId, rng.chance(0.5) ? 'M' : 'F'), 1400 - kidAge, rng.chance(0.5) ? 'M' : 'F']);
      }
    }
    for (const k of kids) {
      const sex = k[2] ?? 'M';
      const first = k[0];
      person({ first, sex, year: k[1], culture: ruler.cultureId, faith: ruler.faithId, houseId: father?.houseId ?? ruler.houseId, court, father: father?.id ?? null, mother: mother?.id ?? null });
    }
    // Les enfants sans nom attribué gardent un nom de leur culture.
    for (const id of ruler.childIds) {
      const kid = characters[id]!;
      if (!kid.firstName) kid.firstName = nameFor(ruler.cultureId, kid.sex);
    }
  }
  function give(titleId: string, holderId: string): void {
    const t = titles[titleId];
    if (!t) throw new Error(`Titre inconnu : ${titleId}`);
    if (t.holderId === holderId) return;
    if (t.holderId) {
      const prev = characters[t.holderId]!;
      prev.titleIds = prev.titleIds.filter((x) => x !== titleId);
    }
    t.holderId = holderId;
    t.active = true;
    t.history = [{ date: START_1400, holderId, how: 'start' }];
    characters[holderId]!.titleIds.push(titleId);
  }
  function sortTitles(c: Character, primary: string | null): void {
    c.titleIds.sort((a, b) => {
      if (a === primary) return -1;
      if (b === primary) return 1;
      return RANK_N[TITLE_DEF.get(b)!.rank] - RANK_N[TITLE_DEF.get(a)!.rank];
    });
  }
  function setupRuler(c: Character, rank: TitleRank, gov: GovernmentId): void {
    const r = RANK_N[rank];
    c.courtId = c.id;
    c.gold = [0, rng.int(20, 80), rng.int(70, 200), rng.int(200, 450), rng.int(400, 800)][r]!;
    c.prestige = r * rng.int(120, 260);
    c.fervor = rng.int(40, 220);
    c.authority = r * rng.int(30, 70);
    c.crownAuthority = Math.min(3, START_AUTHORITY[gov]);
    c.government = gov;
    c.legitimacy = rng.int(55, 85);
    c.aiNextThink = START_1400 + rng.int(1, [30, 120, 75, 45, 30][r]!);
  }
  function courtiers(ruler: Character, n: number): void {
    for (let i = 0; i < n; i++) {
      const sex: Sex = rng.chance(0.75) ? 'M' : 'F';
      person({ first: nameFor(ruler.cultureId, sex), sex, year: 1400 - rng.int(20, 55), culture: ruler.cultureId, faith: ruler.faithId, houseId: randomHouse(ruler.cultureId), court: ruler.id, skillBias: 2 });
    }
  }

  // --- Entités politiques ------------------------------------------------
  const startRank = new Map(START.polities.map((p) => [p.id, p]));
  const specs = new Map<string, PolitySpec>(
    [...POLITIES_1400, ...START.fillers].map((s) => {
      const st = startRank.get(s.id);
      return [s.id, st?.rank && st.rank !== s.rank ? { ...s, rank: st.rank, ...(st.title && !s.title ? { title: st.title } : {}) } : s];
    }),
  );
  const rulerOf = new Map<string, string>();
  const primaryOf = new Map<string, string>();
  const startById = new Map(START.polities.map((p) => [p.id, p]));
  const primaryTitle = (s: PolitySpec, capital: number) =>
    s.rank === 'empire' ? `e_${s.id}` : s.rank === 'kingdom' ? `k_${s.id}` : s.rank === 'duchy' ? `d_${s.id}` : `c${capital}`;

  const ordered = [...specs.values()].sort((a, b) => Number(!!a.union) - Number(!!b.union));
  for (const s of ordered) {
    const st = startById.get(s.id);
    if (!st) continue;
    const gov = s.gov;
    const filler = s.id.startsWith('f') && /^f\d+$/.test(s.id);
    let ruler: Character;
    if (s.union) {
      const rid = rulerOf.get(s.union);
      if (!rid) continue;
      ruler = characters[rid]!;
    } else {
      const houseId = house(s.house, s.culture, s.color, !filler, s.note ?? '');
      ruler = person({
        first: s.ruler[0],
        sex: s.ruler[2] ?? 'M',
        year: s.ruler[1],
        culture: s.culture,
        faith: s.faith,
        houseId,
        court: null,
        traits: RULER_TRAITS[s.id] ?? [],
        skillBias: filler ? 0 : 1,
      });
      setupRuler(ruler, s.rank, gov);
      const h = houses[houseId]!;
      h.headId ??= ruler.id;
      family(ruler, { ...(s.spouse ? { spouse: s.spouse } : {}), ...(s.kids ? { kids: s.kids } : {}) }, filler ? 'small' : 'full');
      courtiers(ruler, filler ? 0 : RANK_N[s.rank] >= 3 ? 2 : 1);
    }
    rulerOf.set(s.id, ruler.id);
    const primary = primaryTitle(s, st.capital);
    primaryOf.set(s.id, primary);
    if (TITLE_DEF.has(primary)) give(primary, ruler.id);
    // Empire : le royaume interne de la capitale.
    if (s.rank === 'empire' && TITLE_DEF.has(`k_${s.id}_0`)) give(`k_${s.id}_0`, ruler.id);
    // Divisions.
    st.divisions.forEach((d, n) => {
      const counties = d.provinces.map((p) => `c${p}`);
      if (n === 0) {
        if (s.rank !== 'county' && TITLE_DEF.has(d.id)) give(d.id, ruler.id);
        for (const c of counties) give(c, ruler.id);
        return;
      }
      // Gouverneur ou seigneur de la division.
      const seatGeo = PROV_GEO.get(provinceKey(d.seat))!;
      const local = !APPOINTED.has(gov) && seatGeo.cultureId !== s.culture && CULTURE_BY.has(seatGeo.cultureId);
      const culture = local ? seatGeo.cultureId : s.culture;
      const faith = local ? seatGeo.faithId : s.faith;
      const sex: Sex = rng.chance(0.06) ? 'F' : 'M';
      const gv = person({ first: nameFor(culture, sex), sex, year: 1400 - rng.int(22, 62), culture, faith, houseId: randomHouse(culture), court: null });
      const vRank: TitleRank = RANK_N[s.rank] >= 3 ? 'duchy' : 'county';
      setupRuler(gv, vRank, gov);
      family(gv, null, 'small');
      if (vRank === 'duchy' && TITLE_DEF.has(d.id)) give(d.id, gv.id);
      for (const c of counties) give(c, gv.id);
      gv.liegeId = ruler.id;
      sortTitles(gv, vRank === 'duchy' ? d.id : counties[0]!);
    });
    // Titres de jure « régionaux » tenus par un empereur (Germanie, Italie).
    sortTitles(ruler, primaryOf.get(s.union ?? s.id) ?? primary);
    polityInfo[s.id] = {
      id: s.id,
      name: s.name,
      short: s.short,
      adjective: s.adj,
      titleId: primary,
      government: gov,
      confidence: s.conf,
      note: s.note ?? '',
      generated: filler,
      capitalProvinceId: provinceKey(st.capital > 0 ? st.capital : (st.provinces[0] ?? 0)),
      ...(s.title ? { rulerTitle: s.title } : {}),
    };
  }
  // Royaumes de Germanie et d'Italie : au roi des Romains.
  const emperor = rulerOf.get('hre');
  if (emperor) {
    for (const k of ['k_germania', 'k_italia']) if (TITLE_DEF.has(k)) give(k, emperor);
    sortTitles(characters[emperor]!, 'e_hre');
  }

  // --- Suzerainetés et contrats -------------------------------------------
  for (const s of specs.values()) {
    if (!s.liege || !rulerOf.has(s.id) || !rulerOf.has(s.liege)) continue;
    const vassal = characters[rulerOf.get(s.id)!]!;
    const overlord = characters[rulerOf.get(s.liege)!]!;
    if (vassal.id === overlord.id) continue;
    const type: SubjectType = s.subject ?? 'autonomous_vassal';
    const liegeSpec = specs.get(s.liege)!;
    const overlordRank = Math.max(...overlord.titleIds.map((t) => RANK_N[TITLE_DEF.get(t)!.rank]));
    const inRealm = VASSAL_TYPES.has(type) && RANK_N[s.rank] < overlordRank && !s.union;
    if (inRealm && !vassal.liegeId) vassal.liegeId = overlord.id;
    const [tribute, levies] = TRIBUTE[type];
    const id = nid('pc');
    pacts[id] = { id, subjectTitleId: primaryOf.get(s.id)!, overlordTitleId: primaryOf.get(liegeSpec.union ?? liegeSpec.id) ?? primaryOf.get(s.liege)!, type, since: START_1400 - 365 * rng.int(1, 20), tribute, levies };
  }

  // --- Relations, revendications, alliances, guerres ---------------------
  const R = (id: string) => rulerOf.get(id);
  function relation(a: string | undefined, b: string | undefined, type: RelationType): void {
    if (!a || !b) return;
    const id = nid('rel');
    relations[id] = { id, a, b, type, since: START_1400 - 365 * rng.int(1, 8) };
  }
  relation(R('orl'), R('bur'), 'rival');
  relation(R('tim'), R('ott'), 'rival');
  relation(R('yan'), R('ming'), 'nemesis');
  relation(R('ava'), R('peg'), 'rival');
  relation(R('vij'), R('bah'), 'rival');
  relation(R('eng'), R('fra'), 'rival');
  relation(R('pap'), R('avi'), 'rival');
  relation(R('aze'), R('txc'), 'rival');
  relation(R('eth'), R('ifa'), 'rival');
  function claim(who: string | undefined, titleId: string, kind: Claim['kind']): void {
    if (!who || !titles[titleId]) return;
    const id = nid('cl');
    claims[id] = { id, characterId: who, titleId, kind, pressed: kind !== 'weak', createdAt: START_1400, expires: null, origin: 'history' };
  }
  claim(R('yan'), 'e_ming', 'strong');
  claim(R('anj'), 'k_nap', 'strong');
  claim(R('eng'), 'k_fra', 'weak');
  claim(R('nap'), 'k_hun', 'weak');
  claim(R('avi'), 'k_pap', 'weak');
  function ally(a: string | undefined, b: string | undefined, reason: Alliance['reason']): void {
    if (!a || !b) return;
    const id = nid('al');
    alliances[id] = { id, a, b, reason, createdAt: START_1400 - 365 * rng.int(1, 12) };
  }
  ally(R('fra'), R('sco'), 'pact');
  ally(R('eng'), R('por'), 'pact');
  ally(R('eng'), R('cas'), 'family');
  ally(R('bur'), R('hol'), 'marriage');
  ally(R('hun'), R('wal'), 'pact');
  ally(R('msc'), R('lit'), 'marriage');
  ally(R('tim'), R('aqq'), 'pact');
  function war(attacker: string | undefined, defender: string | undefined, cb: War['cb'], target: string | null, claimant: string | null, since: number): void {
    if (!attacker || !defender) return;
    const id = nid('war');
    wars[id] = {
      id, cb, attackerId: attacker, defenderId: defender, attackers: [attacker], defenders: [defender], targetTitleId: target, claimantId: claimant,
      warScore: 0, battleScore: 0, occupationScore: 0, ticking: 0, startedAt: since, battles: [], casualties: [0, 0], factionId: null, maxEnd: START_1400 + 365 * 6,
    };
  }
  war(R('yan'), R('ming'), 'kingdom_claim', 'e_ming', R('yan') ?? null, toDay(1399, 8, 6));
  war(R('ott'), R('byz'), 'conquest', 'e_byz', R('ott') ?? null, toDay(1394, 9, 1));
  war(R('tim'), R('geo'), 'conquest', 'k_geo', R('tim') ?? null, toDay(1399, 10, 1));

  // --- Départs conseillés -------------------------------------------------
  const start = (id: string, difficulty: RecommendedStart['difficulty'], tagline: string, description: string, problems: string[], objective: string): RecommendedStart | null =>
    R(id) ? { characterId: R(id)!, difficulty, tagline, description, problems, objective } : null;
  const recommended = [
    start('fra', 'hard', 'Le roi fou et les princes des lys.', 'Charles VI règne sur le royaume le plus peuplé d’Europe, mais ses crises de folie livrent le Conseil aux ducs de Bourgogne et d’Orléans.', ['Folie du roi.', 'Rivalité Orléans–Bourgogne.', 'L’Angleterre revendique la couronne.'], 'Tenir le royaume uni et préparer la succession du dauphin.'),
    start('eng', 'normal', 'Une couronne prise à Richard II.', 'Henri de Lancastre vient de déposer son cousin. Il doit prouver sa légitimité face aux Écossais, aux Gallois et aux barons.', ['Légitimité contestée.', 'Frontière écossaise.'], 'Consolider la maison de Lancastre et faire valoir ses droits en France.'),
    start('cas', 'easy', 'La Castille se relève.', 'Henri III reprend en main un royaume riche en laine et en ports, allié de l’Angleterre et du Portugal.', ['Santé fragile du roi.', 'Grands seigneurs turbulents.'], 'Achever la Reconquista face à Grenade.'),
    start('bur', 'normal', 'Le plus riche des vassaux.', 'Philippe le Hardi tient la Bourgogne, la Flandre et l’Artois. Il domine le Conseil du roi fou.', ['Vassal du roi de France.', 'Rivalité avec Louis d’Orléans.'], 'Faire de la Bourgogne une puissance entre France et Empire.'),
    start('ott', 'normal', 'La Foudre sur deux continents.', 'Bayezid tient les Balkans et l’Anatolie et assiège Constantinople. À l’est, Tamerlan gronde.', ['Tamerlan exige la soumission.', 'Constantinople résiste.'], 'Prendre Constantinople sans être brisé par Tamerlan.'),
    start('byz', 'very_hard', 'Une ville, un empire.', 'Il ne reste à Manuel II que Constantinople et quelques îles. Il parcourt l’Occident pour chercher des alliés.', ['Blocus ottoman.', 'Trésor vide.'], 'Survivre et restaurer l’Empire.'),
    start('tim', 'easy', 'Le conquérant boiteux.', 'Timour, maître de l’Asie centrale et de l’Iran, revient d’Inde chargé de butin. Ottomans, Mamelouks et Ming sont à portée.', ['Âge avancé.', 'Succession entre petits-fils.'], 'Étendre l’empire et assurer la succession.'),
    start('ming', 'hard', 'Le Fils du Ciel contre son oncle.', 'Le jeune empereur Jianwen affronte la révolte du prince de Yan, meilleur général de l’empire.', ['Guerre civile.', 'Généraux peu fiables.'], 'Écraser la révolte de Yan et réformer l’État.'),
    start('yan', 'hard', 'Le prince rebelle.', 'Zhu Di tient Beiping et les armées du Nord. Il marche sur Yingtian pour « purifier » la cour.', ['Armées impériales supérieures en nombre.', 'Légitimité à conquérir.'], 'Prendre le trône des Ming.'),
    start('vij', 'normal', 'Le trône du Sud.', 'Harihara II règne sur l’Inde du Sud hindoue face au sultanat bahmanide.', ['Guerre récurrente pour le Raichur.', 'Nayaka ambitieux.'], 'Dominer le Deccan.'),
    start('mli', 'normal', 'L’or du Mandé.', 'Le mansa règne sur les routes de l’or et du sel, de Tombouctou à l’Atlantique, mais la périphérie s’émancipe.', ['Provinces lointaines.', 'Touaregs et Songhaï.'], 'Garder l’empire et ses routes commerciales.'),
    start('eth', 'normal', 'Le roi des rois.', 'Dawit Ier règne sur les hauts plateaux chrétiens, en guerre avec le sultanat d’Ifat.', ['Guerre avec Ifat.', 'Isolement.'], 'Sécuriser les frontières et le commerce de la mer Rouge.'),
    start('jpn', 'normal', 'L’âge d’or des Ashikaga.', 'Yoshimitsu vient d’écraser les Ōuchi. Il domine la cour et les shugo, et rêve du commerce avec la Chine.', ['Shugo trop puissants.', 'Kantō autonome.'], 'Unifier l’autorité du shogunat.'),
    start('jos', 'easy', 'La jeune dynastie Yi.', 'Joseon est neuf et solide, mais les princes Yi se disputent la succession.', ['Querelles de succession.'], 'Assurer la dynastie et développer le royaume.'),
    start('ven', 'normal', 'La Sérénissime.', 'Venise tient les routes de la Méditerranée orientale et les îles grecques.', ['Gênes rivale.', 'Menace ottomane.'], 'Étendre la Terre ferme et l’empire maritime.'),
    start('aze', 'normal', 'Le vieux renard de la lagune.', 'Tezozomoc domine le bassin de Mexico et ses tributaires mexica.', ['Texcoco rivale.', 'Âge très avancé.'], 'Soumettre Texcoco et étendre l’hégémonie tépanèque.'),
    start('cuz', 'hard', 'Avant l’empire.', 'Cuzco n’est qu’un royaume parmi d’autres, menacé par les Chanka.', ['Voisins puissants.'], 'Faire de Cuzco la première puissance des Andes.'),
    start('kgo', 'normal', 'Le royaume du fleuve.', 'Le jeune royaume du Kongo s’étend au sud du grand fleuve.', ['Voisins indépendants.', 'Faible centralisation.'], 'Unir les chefferies voisines.'),
    start('maj', 'normal', 'L’empire des îles.', 'Majapahit domine Java et l’archipel, mais sa cour orientale se prépare à la guerre.', ['Rivalité de Wirabhumi.', 'Tributaires lointains.'], 'Garder l’unité de Java et l’archipel.'),
    start('msc', 'hard', 'Rassembler la terre russe.', 'Vassili Ier paie tribut à la Horde et doit tenir face à la Lituanie et à Tver.', ['Tributaire de la Horde.', 'Rivalité lituanienne.'], 'S’affranchir de la Horde.'),
  ].filter((x): x is RecommendedStart => x !== null);

  return {
    id: 'monde_1400',
    name: 'Monde 1400',
    startDate: START_1400,
    intro:
      'Premier janvier 1400. Tamerlan revient des Indes et regarde vers l’ouest ; Bayezid assiège Constantinople ; en Chine, le prince de Yan marche contre son neveu l’empereur. ' +
      'En France, un roi fou laisse ses oncles se disputer le pouvoir ; en Angleterre, un usurpateur vient de ceindre la couronne. Au Mali, au Vijayanagara, à Majapahit ou dans le bassin de Mexico, ' +
      'd’autres souverains écrivent leur propre histoire. Choisissez votre dynastie : le monde entier est ouvert.',
    characters,
    houses,
    dynasties,
    titles,
    provinces,
    relations,
    claims,
    alliances,
    wars,
    secrets: {},
    hooks: {},
    factions: {},
    pacts,
    recommended,
    nextId: next,
    polities: polityInfo,
  };
}

let cached: ScenarioData | null = null;
/** Scénario Monde 1400 (construit à la première demande puis mis en cache). */
export function scenario1400(): ScenarioData {
  cached ??= buildScenario();
  return cached;
}

/** Gouvernement effectif d'une entité (pour l'interface). */
export function governmentOf(id: GovernmentId) {
  return GOVERNMENT_BY_ID[id];
}
