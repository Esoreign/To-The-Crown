/**
 * Confessions du scénario Monde 1400. Familles larges ; les doctrines sont
 * des simplifications de jeu (voir docs/WORLD_1400.md) et non un jugement :
 * une différence de foi pèse sur l'opinion sans produire de haine automatique.
 */
import type { FaithDef } from '@ttc/shared';

interface Spec {
  id: string;
  name: string;
  family: string;
  color: string;
  symbol: string;
  holyWar: boolean;
  tolerance: number;
  female: 'equal' | 'allowed' | 'disallowed';
  divorce: boolean;
  virtues: string[];
  sins: string[];
  mods?: FaithDef['modifiers'];
}

const FAITH_NAMES: Record<string, { name: string; family: string }> = {};

function f(s: Spec): FaithDef {
  FAITH_NAMES[s.id] = { name: s.name, family: s.family };
  return {
    id: s.id,
    color: s.color,
    symbol: s.symbol,
    family: s.family,
    doctrines: { divorce: s.divorce, femaleRulers: s.female, holyWar: s.holyWar, tolerance: s.tolerance },
    modifiers: s.mods ?? {},
    virtues: s.virtues,
    sins: s.sins,
  };
}

export const FAITHS_1400: FaithDef[] = [
  f({ id: 'catholic', name: 'Chrétiens latins', family: 'christian', color: '#d9c070', symbol: 'cross', holyWar: true, tolerance: -1, female: 'allowed', divorce: false, virtues: ['just', 'humble', 'chaste'], sins: ['greedy', 'lustful', 'arrogant'], mods: { monthly_fervor: 0.05 } }),
  f({ id: 'orthodox', name: 'Chrétiens orthodoxes', family: 'christian', color: '#8a5ab0', symbol: 'cross', holyWar: true, tolerance: -1, female: 'allowed', divorce: false, virtues: ['humble', 'compassionate', 'patient'], sins: ['arrogant', 'greedy'] }),
  f({ id: 'miaphysite', name: 'Chrétiens orientaux (coptes, éthiopiens, arméniens)', family: 'christian', color: '#b07a5a', symbol: 'cross', holyWar: false, tolerance: 0, female: 'allowed', divorce: false, virtues: ['humble', 'patient', 'honest'], sins: ['greedy', 'wrathful'] }),
  f({ id: 'nestorian', name: 'Église de l’Orient', family: 'christian', color: '#7aa0b0', symbol: 'cross', holyWar: false, tolerance: 1, female: 'allowed', divorce: false, virtues: ['diligent', 'honest'], sins: ['greedy'] }),
  f({ id: 'sunni', name: 'Musulmans sunnites', family: 'islam', color: '#3a8a4a', symbol: 'crescent', holyWar: true, tolerance: 0, female: 'disallowed', divorce: true, virtues: ['just', 'generous', 'patient'], sins: ['greedy', 'arrogant', 'lazy'], mods: { monthly_fervor: 0.05 } }),
  f({ id: 'shia', name: 'Musulmans chiites', family: 'islam', color: '#2a6a5a', symbol: 'crescent', holyWar: true, tolerance: 0, female: 'disallowed', divorce: true, virtues: ['just', 'diligent', 'patient'], sins: ['cruel', 'arrogant'] }),
  f({ id: 'ibadi', name: 'Musulmans ibadites', family: 'islam', color: '#5aa06a', symbol: 'crescent', holyWar: false, tolerance: 1, female: 'disallowed', divorce: true, virtues: ['humble', 'honest', 'just'], sins: ['arrogant'] }),
  f({ id: 'jewish', name: 'Juifs', family: 'abrahamic', color: '#4a6ab0', symbol: 'star', holyWar: false, tolerance: 1, female: 'disallowed', divorce: true, virtues: ['diligent', 'patient'], sins: ['arrogant'] }),
  f({ id: 'hindu', name: 'Hindous', family: 'dharmic', color: '#d4843a', symbol: 'lotus', holyWar: false, tolerance: 1, female: 'allowed', divorce: false, virtues: ['patient', 'compassionate', 'diligent'], sins: ['wrathful', 'greedy'] }),
  f({ id: 'jain', name: 'Jaïns', family: 'dharmic', color: '#c9b05a', symbol: 'lotus', holyWar: false, tolerance: 2, female: 'allowed', divorce: false, virtues: ['compassionate', 'patient', 'humble'], sins: ['cruel', 'wrathful'] }),
  f({ id: 'theravada', name: 'Bouddhistes theravāda', family: 'buddhist', color: '#e0a83a', symbol: 'wheel', holyWar: false, tolerance: 1, female: 'allowed', divorce: false, virtues: ['patient', 'compassionate', 'humble'], sins: ['wrathful', 'cruel'] }),
  f({ id: 'mahayana', name: 'Bouddhistes mahāyāna', family: 'buddhist', color: '#d9b04a', symbol: 'wheel', holyWar: false, tolerance: 1, female: 'allowed', divorce: false, virtues: ['compassionate', 'diligent'], sins: ['cruel', 'greedy'] }),
  f({ id: 'vajrayana', name: 'Bouddhistes vajrayāna', family: 'buddhist', color: '#b04a6a', symbol: 'wheel', holyWar: false, tolerance: 1, female: 'allowed', divorce: false, virtues: ['patient', 'diligent'], sins: ['wrathful'] }),
  f({ id: 'sanjiao', name: 'Trois enseignements (confucianisme, bouddhisme, taoïsme)', family: 'east_asian', color: '#c23a3a', symbol: 'yin_yang', holyWar: false, tolerance: 2, female: 'disallowed', divorce: true, virtues: ['just', 'diligent'], sins: ['arbitrary', 'lazy'], mods: { monthly_prestige: 0.05 } }),
  f({ id: 'shinbutsu', name: 'Shintō et bouddhisme japonais', family: 'east_asian', color: '#c24a5a', symbol: 'torii', holyWar: false, tolerance: 1, female: 'allowed', divorce: true, virtues: ['brave', 'honest', 'diligent'], sins: ['deceitful', 'craven'] }),
  f({ id: 'tengri', name: 'Traditions des steppes (Tengri)', family: 'traditional', color: '#6a8ab0', symbol: 'sky', holyWar: false, tolerance: 2, female: 'equal', divorce: true, virtues: ['brave', 'honest'], sins: ['craven', 'deceitful'] }),
  f({ id: 'siberian', name: 'Traditions chamaniques du Nord', family: 'traditional', color: '#7a9ab0', symbol: 'drum', holyWar: false, tolerance: 2, female: 'equal', divorce: true, virtues: ['patient', 'brave'], sins: ['greedy'] }),
  f({ id: 'baltic_trad', name: 'Traditions baltes', family: 'traditional', color: '#6a9a5a', symbol: 'oak', holyWar: true, tolerance: 0, female: 'equal', divorce: true, virtues: ['brave', 'honest'], sins: ['craven'] }),
  f({ id: 'west_african', name: 'Traditions ouest-africaines', family: 'african', color: '#b07a3a', symbol: 'mask', holyWar: false, tolerance: 2, female: 'allowed', divorce: true, virtues: ['generous', 'just'], sins: ['greedy', 'deceitful'] }),
  f({ id: 'bantu_trad', name: 'Traditions d’Afrique centrale et australe', family: 'african', color: '#9a6a3a', symbol: 'mask', holyWar: false, tolerance: 2, female: 'allowed', divorce: true, virtues: ['generous', 'patient'], sins: ['greedy', 'cruel'] }),
  f({ id: 'nilotic_trad', name: 'Traditions nilotiques et couchitiques', family: 'african', color: '#8a8a3a', symbol: 'mask', holyWar: false, tolerance: 2, female: 'allowed', divorce: true, virtues: ['brave', 'generous'], sins: ['craven'] }),
  f({ id: 'mesoamerican', name: 'Religions mésoaméricaines', family: 'american', color: '#3ab0a0', symbol: 'sun', holyWar: true, tolerance: 0, female: 'disallowed', divorce: true, virtues: ['brave', 'diligent', 'zealous'], sins: ['craven', 'lazy'] }),
  f({ id: 'andean', name: 'Religions andines', family: 'american', color: '#c9a03a', symbol: 'sun', holyWar: false, tolerance: 1, female: 'allowed', divorce: false, virtues: ['diligent', 'just', 'honest'], sins: ['lazy', 'deceitful'] }),
  f({ id: 'north_american', name: 'Traditions d’Amérique du Nord', family: 'american', color: '#8a6a4a', symbol: 'feather', holyWar: false, tolerance: 2, female: 'equal', divorce: true, virtues: ['generous', 'brave', 'patient'], sins: ['greedy', 'arrogant'] }),
  f({ id: 'south_american', name: 'Traditions d’Amazonie et du Cône Sud', family: 'american', color: '#4a8a4a', symbol: 'feather', holyWar: false, tolerance: 2, female: 'equal', divorce: true, virtues: ['brave', 'generous'], sins: ['greedy'] }),
  f({ id: 'arctic', name: 'Traditions arctiques', family: 'american', color: '#9ab0c0', symbol: 'drum', holyWar: false, tolerance: 2, female: 'equal', divorce: true, virtues: ['patient', 'generous'], sins: ['greedy'] }),
  f({ id: 'polynesian', name: 'Traditions polynésiennes', family: 'oceanian', color: '#3ab0d0', symbol: 'wave', holyWar: false, tolerance: 1, female: 'allowed', divorce: true, virtues: ['brave', 'generous'], sins: ['craven'] }),
  f({ id: 'dreaming', name: 'Traditions aborigènes (Rêve)', family: 'oceanian', color: '#b0603a', symbol: 'wave', holyWar: false, tolerance: 2, female: 'equal', divorce: true, virtues: ['patient', 'generous'], sins: ['greedy'] }),
  f({ id: 'melanesian', name: 'Traditions mélanésiennes et papoues', family: 'oceanian', color: '#6a4a2a', symbol: 'wave', holyWar: false, tolerance: 2, female: 'allowed', divorce: true, virtues: ['brave', 'generous'], sins: ['greedy'] }),
];

export const FAITH_1400_NAMES = FAITH_NAMES;
