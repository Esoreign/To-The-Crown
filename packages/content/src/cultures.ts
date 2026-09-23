import type { CultureDef } from '@ttc/shared';

/**
 * Huit cultures fictives de Caldria. Les différences mécaniques sont
 * volontairement lisibles : un bonus principal, parfois une contrepartie.
 */
export const CULTURES: CultureDef[] = [
  {
    id: 'caldrien',
    color: '#b9894a',
    region: 'Cœur de Caldria',
    maleNames: [
      'Aurelan', 'Cassor', 'Maxence', 'Séverin', 'Lucan', 'Octave', 'Valéran', 'Adrien', 'Corentin', 'Flavien',
      'Émeric', 'Hadrien', 'Justin', 'Marcel', 'Romain', 'Tibère', 'Quentin', 'Césaire', 'Aurèle', 'Lucien',
      'Albéric', 'Sévère', 'Anselme', 'Domitien',
    ],
    femaleNames: [
      'Aurélie', 'Livane', 'Séraphine', 'Octavie', 'Valérie', 'Cassia', 'Julienne', 'Honorine', 'Flavia', 'Lucille',
      'Marcelline', 'Aemilia', 'Domitille', 'Sabine', 'Clarisse', 'Aurora', 'Placide', 'Iréna', 'Ludivine', 'Justine',
    ],
    houseNames: [
      'Aurevanne', 'Castelmar', 'Sévrane', 'Dorval', 'Montclair', 'Varenne', 'Lucerne', 'Maurevert', 'Aldécie',
      'Cassel', 'Vireval', 'Saint-Oriane', 'Belcastre', 'Orvanne', 'Tercel',
    ],
    placeSyllables: {
      start: ['Aur', 'Cas', 'Val', 'Sev', 'Luc', 'Mar', 'Ors', 'Tib', 'Cor', 'Ver', 'Ald', 'Pal', 'Rom', 'Vir', 'Lor'],
      mid: ['e', 'a', 'i', 'el', 'en', 'or', 'an', ''],
      end: ['anne', 'ia', 'ence', 'ecie', 'ine', 'ante', 'ium', 'ane', 'elle', 'ouse', 'ance', 'ise'],
    },
    modifiers: { monthly_prestige: 0.1, tax_mult: 0.05 },
    favoredUnit: 'footmen',
    appearance: { skinTones: [1, 2, 3], hairColors: [1, 2, 3, 4], clothing: 'imperial' },
    succession: 'partition',
  },
  {
    id: 'valorien',
    color: '#4f6fa8',
    region: 'Marches occidentales',
    maleNames: [
      'Aldren', 'Béric', 'Galeran', 'Renaud', 'Thibalt', 'Enguerrand', 'Hugues', 'Raoul', 'Amaury', 'Gauvard',
      'Josselin', 'Morvan', 'Tancrède', 'Bertrand', 'Herbelot', 'Odon', 'Gilduin', 'Ancel', 'Robelin', 'Aymar',
    ],
    femaleNames: [
      'Aélis', 'Ysolde', 'Mahaut', 'Clémence', 'Ermengarde', 'Béatrix', 'Guenièvre', 'Aliénor', 'Mélisende',
      'Isaure', 'Adèle', 'Blanche', 'Héloïse', 'Ide', 'Oriane', 'Sibylle', 'Pétronille', 'Richilde',
    ],
    houseNames: [
      'Valorie', 'Hautclair', 'Dumarais', 'Veyr', 'Roncelin', 'Montfarel', 'Brisecour', 'Lanvel', 'Ormessant',
      'Guerche', 'Sombreval', 'Clairfont', 'Morlanne', 'Ferrand', 'Aubrecy',
    ],
    placeSyllables: {
      start: ['Val', 'Mont', 'Beau', 'Ro', 'Gui', 'Fer', 'Ormes', 'Lan', 'Ver', 'Cler', 'Bris', 'Mor', 'Haut', 'Sau'],
      mid: ['e', 'en', 'on', 'a', 'el', ''],
      end: ['court', 'mont', 'val', 'lac', 'fort', 'mar', 'ville', 'bourg', 'noir', 'clair', 'ais', 'ières', 'y'],
    },
    modifiers: { commander_advantage: 2 },
    favoredUnit: 'heavy_cavalry',
    appearance: { skinTones: [0, 1, 2], hairColors: [0, 1, 2, 5], clothing: 'chivalric' },
    succession: 'primogeniture',
  },
  {
    id: 'hrovar',
    color: '#6b8a9e',
    region: 'Hautes terres du Nord',
    maleNames: [
      'Brannoc', 'Torvald', 'Eskil', 'Ragnvar', 'Halvard', 'Orm', 'Sten', 'Hakon', 'Vigdar', 'Ulfric', 'Arnkel',
      'Gunnvar', 'Tormod', 'Leif', 'Bjarni', 'Kolbein', 'Sverr', 'Hjalmar', 'Ingvar', 'Roald',
    ],
    femaleNames: [
      'Sigrun', 'Ylva', 'Astrid', 'Brynja', 'Gudrid', 'Hilde', 'Ragna', 'Solveig', 'Thora', 'Unna', 'Eira',
      'Freydis', 'Ingrid', 'Svala', 'Halla', 'Runa',
    ],
    houseNames: [
      'Hrovmark', 'Skarnholt', 'Ulvsted', 'Jarnvik', 'Grimsdal', 'Kaldfjell', 'Brannstad', 'Norrvard', 'Isleif',
      'Havsten', 'Vargheim', 'Tordsholm',
    ],
    placeSyllables: {
      start: ['Hrov', 'Skar', 'Ulv', 'Jarn', 'Grim', 'Kald', 'Bran', 'Norr', 'Is', 'Hav', 'Varg', 'Tord', 'Stor', 'Frost'],
      mid: ['', 'a', 'e', 'en', 'ar'],
      end: ['mark', 'holt', 'sted', 'vik', 'dal', 'fjell', 'stad', 'heim', 'ness', 'by', 'gard', 'fjord'],
    },
    modifiers: { levy_mult: 0.1, tax_mult: -0.05 },
    favoredUnit: 'footmen',
    appearance: { skinTones: [0, 1], hairColors: [0, 5, 2, 6], clothing: 'northern' },
    succession: 'seniority',
  },
  {
    id: 'sarrhan',
    color: '#c8a24a',
    region: 'Rivages du Sud',
    maleNames: [
      'Azrenn', 'Tahvir', 'Zarahel', 'Mehren', 'Tavish', 'Iskander', 'Darrek', 'Soravel', 'Kaelim', 'Rashen',
      'Vehram', 'Ozrin', 'Hazeel', 'Samir', 'Teyvan', 'Arazel', 'Nadrim', 'Ferhan',
    ],
    femaleNames: [
      'Ysmera', 'Nahira', 'Sahvi', 'Liraé', 'Zamira', 'Anaïs', 'Kesra', 'Tahlia', 'Shirin', 'Veyla', 'Mirael',
      'Ashana', 'Soraya', 'Iméra', 'Delara',
    ],
    houseNames: [
      'Azhar', 'Qesmir', 'Talvéra', 'Suhrane', 'Mehvaz', 'Kharane', 'Dallen', 'Irsaq', 'Vehrin', 'Zohal', 'Amarane',
      'Sefreh',
    ],
    placeSyllables: {
      start: ['Az', 'Qes', 'Tal', 'Suh', 'Meh', 'Khar', 'Ir', 'Veh', 'Zo', 'Am', 'Sef', 'Dar', 'Ish', 'Nah'],
      mid: ['a', 'e', 'ir', 'ar', 'an', ''],
      end: ['har', 'mir', 'vera', 'rane', 'vaz', 'saq', 'rin', 'hal', 'abad', 'esh', 'ira', 'oun'],
    },
    modifiers: { tax_mult: 0.1, levy_mult: -0.05 },
    favoredUnit: 'light_cavalry',
    appearance: { skinTones: [3, 4, 5], hairColors: [3, 6, 4], clothing: 'southern' },
    succession: 'partition',
  },
  {
    id: 'vesnar',
    color: '#7a9b5a',
    region: 'Forêts de l’Est',
    maleNames: [
      'Radovan', 'Velimir', 'Stanko', 'Dragan', 'Bogumil', 'Vesko', 'Mirko', 'Ratibor', 'Zvonimir', 'Borislav',
      'Jaromir', 'Dobran', 'Svetozar', 'Lubor', 'Vojtan', 'Kresimir',
    ],
    femaleNames: [
      'Milena', 'Vesna', 'Darina', 'Zora', 'Ludmila', 'Radka', 'Jarmila', 'Dobrava', 'Svetlana', 'Bogna', 'Mirna',
      'Vlasta', 'Zlata',
    ],
    houseNames: ['Vesnagrad', 'Dragomir', 'Radvel', 'Borvic', 'Lesnova', 'Jarovec', 'Stribor', 'Velkov', 'Ostrava', 'Mrakov'],
    placeSyllables: {
      start: ['Ves', 'Drag', 'Rad', 'Bor', 'Les', 'Jar', 'Strib', 'Vel', 'Ostr', 'Mrak', 'Zlat', 'Dub', 'Brez', 'Lip'],
      mid: ['o', 'a', 'e', 'i', ''],
      end: ['grad', 'vec', 'nova', 'kov', 'ava', 'mir', 'slav', 'nik', 'ice', 'ov', 'ina', 'ograd'],
    },
    modifiers: { development_growth: 0.1, defender_advantage: 2 },
    favoredUnit: 'archers',
    appearance: { skinTones: [0, 1, 2], hairColors: [1, 2, 0, 3], clothing: 'eastern' },
    succession: 'partition',
  },
  {
    id: 'ardhe',
    color: '#8d6a9f',
    region: 'Landes et collines d’Ardh',
    maleNames: [
      'Caedmon', 'Bran', 'Eoghan', 'Tadhg', 'Faelan', 'Rhodri', 'Cadoc', 'Morcant', 'Iorwen', 'Dunstan', 'Gwion',
      'Maelor', 'Owain', 'Taliesin', 'Cynan',
    ],
    femaleNames: [
      'Morwen', 'Aislin', 'Brigh', 'Eluned', 'Gwenllian', 'Nesta', 'Rhian', 'Cerys', 'Deirdre', 'Fionnuala', 'Tegan',
      'Olwen', 'Senna',
    ],
    houseNames: ['Ardhmor', 'Caerwyn', 'Dunmorren', 'Glasfryn', 'Pencarrow', 'Tregarth', 'Llanvael', 'Mornagh', 'Rhosyn', 'Bryngal'],
    placeSyllables: {
      start: ['Ardh', 'Caer', 'Dun', 'Glas', 'Pen', 'Tre', 'Llan', 'Morn', 'Rhos', 'Bryn', 'Aber', 'Kil', 'Tor'],
      mid: ['', 'a', 'e', 'y', 'o'],
      end: ['mor', 'wyn', 'morren', 'fryn', 'carrow', 'garth', 'vael', 'agh', 'yn', 'gal', 'dare', 'lough', 'ech'],
    },
    modifiers: { learning: 1, monthly_fervor: 0.1 },
    favoredUnit: 'pikemen',
    appearance: { skinTones: [0, 1], hairColors: [5, 2, 1, 0], clothing: 'moorland' },
    succession: 'elective',
  },
  {
    id: 'myrrhain',
    color: '#3f8a8a',
    region: 'Îles et marais de Myrrh',
    maleNames: [
      'Thalos', 'Nérion', 'Coralan', 'Pélias', 'Ithel', 'Maréo', 'Sélas', 'Oréon', 'Tyrian', 'Galen', 'Lysandre',
      'Nautès', 'Évandre', 'Callis',
    ],
    femaleNames: [
      'Maris', 'Thessalie', 'Nérissa', 'Coralie', 'Ondine', 'Pélagie', 'Ismène', 'Callirhoé', 'Lysia', 'Naïa',
      'Oréa', 'Sélène', 'Théa',
    ],
    houseNames: ['Myrrhal', 'Thalassène', 'Corvane', 'Nérite', 'Pélagon', 'Ondrys', 'Maréval', 'Salicorne', 'Écume', 'Lysor'],
    placeSyllables: {
      start: ['Myr', 'Thal', 'Cor', 'Nér', 'Pél', 'Ond', 'Mar', 'Sal', 'Lys', 'Ith', 'Cal', 'Nau', 'Sél'],
      mid: ['a', 'e', 'i', 'o', ''],
      end: ['rhal', 'assène', 'vane', 'ite', 'agon', 'rys', 'éval', 'icorne', 'os', 'ée', 'ys', 'ion', 'ène'],
    },
    modifiers: { monthly_gold: 0.2, build_cost_mult: -0.1 },
    favoredUnit: 'archers',
    appearance: { skinTones: [2, 3, 4], hairColors: [3, 4, 1, 6], clothing: 'maritime' },
    succession: 'primogeniture',
  },
  {
    id: 'kharzul',
    color: '#a5563f',
    region: 'Steppes orientales',
    maleNames: [
      'Bakhor', 'Arslun', 'Jochir', 'Turgan', 'Khasar', 'Batu-Ren', 'Oghrul', 'Temek', 'Sübrak', 'Yesun', 'Kaidar',
      'Mönkar', 'Toghar', 'Altan', 'Beren',
    ],
    femaleNames: [
      'Altani', 'Sarnai', 'Khulan', 'Borte', 'Oyuna', 'Tsetseg', 'Naran', 'Gerel', 'Saran', 'Anu', 'Yesui', 'Chagan',
    ],
    houseNames: ['Kharzul', 'Ordukhan', 'Tengrel', 'Borjai', 'Khongor', 'Esenbai', 'Taiyun', 'Mergen', 'Uldai', 'Sartak'],
    placeSyllables: {
      start: ['Khar', 'Ord', 'Teng', 'Bor', 'Khon', 'Esen', 'Tai', 'Mer', 'Ul', 'Sar', 'Kar', 'Tol', 'Bay'],
      mid: ['a', 'u', 'o', 'e', ''],
      end: ['zul', 'khan', 'rel', 'jai', 'gor', 'bai', 'yun', 'gen', 'dai', 'tak', 'kum', 'tai', 'ur'],
    },
    modifiers: { levy_mult: 0.05, commander_advantage: 1, development_growth: -0.1 },
    favoredUnit: 'light_cavalry',
    appearance: { skinTones: [2, 3], hairColors: [6, 3, 4], clothing: 'steppe' },
    succession: 'seniority',
  },
];

export const CULTURE_BY_ID: Record<string, CultureDef> = Object.fromEntries(CULTURES.map((c) => [c.id, c]));
