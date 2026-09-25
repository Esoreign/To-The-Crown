/**
 * Asie du Sud au 1er janvier 1400 : Delhi ne s'est pas relevée du sac de
 * 1398 et ses gouverneurs deviennent souverains ; au sud, Vijayanagara et le
 * sultanat bahmanide se disputent le Doab du Raichur.
 */
import { P } from './polity-types';

export const POLITIES_SOUTH_ASIA = [
  P({
    id: 'del', name: 'Sultanat de Delhi', short: 'Delhi', adj: 'delhite', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'hindustani', faith: 'sunni', color: '#3a8a6a', cap: [77.21, 28.64, 'Delhi'], at: [[77.29, 26.91], [75.72, 29.15], [76.19, 30.15], [78.0, 29.4]], reach: 140,
    house: 'Tughluq', ruler: ['Mahmud', 1380, 'M', 'Nasir ud-Din'], title: ['Sultan', 'Sultane'], conf: 'medium',
    note: 'Après le sac de Delhi par Tamerlan (décembre 1398), le sultan est en exil ; Mallu Iqbal Khan tient la capitale.',
  }),
  P({
    id: 'jau', name: 'Sultanat de Jaunpur', short: 'Jaunpur', adj: 'sharqi', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'hindustani', faith: 'sunni', color: '#5ab08a', cap: [82.68, 25.75, 'Jaunpur'], at: [[79.92, 27.05], [82.2, 26.8], [85.14, 25.6], [81.85, 25.43], [80.9, 26.85], [84.0, 26.5]], reach: 140,
    house: 'Sharqi', ruler: ['Mubarak Chah', 1370, 'M'], title: ['Sultan', 'Sultane'], conf: 'medium',
  }),
  P({
    id: 'guj', name: 'Gujarat', short: 'Gujarat', adj: 'gujarati', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'gujarati', faith: 'sunni', color: '#d87a3a', cap: [72.12, 23.85, 'Patan'], at: [[72.62, 22.3], [72.98, 21.7], [72.58, 23.03], [73.2, 22.3], [71.0, 22.0], [70.0, 23.2]], reach: 130,
    house: 'Muzaffarides', ruler: ['Zafar Khan', 1342, 'M'], title: ['Gouverneur', 'Gouverneure'], conf: 'high',
    note: 'Gouverneur de Delhi devenu souverain de fait ; il se proclamera sultan (Muzaffar Chah) en 1407.',
  }),
  P({
    id: 'mlw', name: 'Malwa', short: 'Malwa', adj: 'malwi', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'hindustani', faith: 'sunni', color: '#b0a03a', cap: [75.3, 22.6, 'Dhar'], at: [[75.39, 22.35], [75.78, 23.18], [77.4, 23.25], [76.5, 24.0]], reach: 120,
    house: 'Ghourides', ruler: ['Dilawar Khan', 1345, 'M'], title: ['Gouverneur', 'Gouverneure'], conf: 'high',
    note: 'Dilawar Khan Ghuri se rendra indépendant en 1401.',
  }),
  P({
    id: 'khd', name: 'Khandesh', short: 'Khandesh', adj: 'faruqi', rank: 'duchy', gov: 'iqta_realm',
    culture: 'marathi', faith: 'sunni', color: '#8a8a3a', cap: [76.23, 21.31, 'Thalner'], at: [[76.23, 21.0]], reach: 80,
    house: 'Faruqi', ruler: ['Nasir Khan', 1370, 'M'], title: ['Khan', 'Khanum'], conf: 'high',
  }),
  P({
    id: 'bah', name: 'Sultanat bahmanide', short: 'Bahmanides', adj: 'bahmanide', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'marathi', faith: 'sunni', color: '#2e7a5a', cap: [76.83, 17.33, 'Gulbarga'],
    at: [[77.52, 17.91], [75.21, 19.94], [77.35, 16.2], [73.2, 17.59], [75.38, 19.48], [74.3, 16.7], [76.0, 18.5], [78.5, 18.8], [74.5, 18.5], [79.6, 18.0]],
    w: 1.1, reach: 180, house: 'Bahmanides', ruler: ['Firuz Chah', 1370, 'M', 'Taj ud-Din'], title: ['Sultan', 'Sultane'], conf: 'high',
  }),
  P({
    id: 'vij', name: 'Empire de Vijayanagara', short: 'Vijayanagara', adj: 'vijayanagarais', rank: 'empire', gov: 'feudal_monarchy',
    culture: 'kannada', faith: 'hindu', color: '#c0303a', cap: [76.46, 15.33, 'Vijayanagara'],
    at: [[77.6, 14.08], [76.69, 12.42], [79.7, 12.83], [78.12, 9.93], [79.14, 10.79], [78.69, 10.8], [74.86, 12.91], [73.83, 15.49], [79.3, 14.87], [79.32, 13.59], [77.7, 8.73], [75.0, 14.0], [78.0, 12.0], [76.9, 11.0], [78.4, 15.5]],
    w: 1.25, reach: 200, house: 'Sangama', ruler: ['Harihara', 1340, 'M', 'II'], kids: [['Virupaksha', 1370], ['Bukka', 1375], ['Devaraya', 1380]],
    title: ['Raya', 'Rani'], conf: 'high', note: 'Harihara II prend le titre impérial ; ses nayaka gouvernent les provinces tamoules conquises sur Madurai (1378).',
  }),
  P({
    id: 'kdv', name: 'Royaume reddi de Kondavidu', short: 'Kondavidu', adj: 'reddi', rank: 'duchy', gov: 'feudal_monarchy',
    culture: 'telugu', faith: 'hindu', color: '#e0a03a', cap: [80.27, 16.26, 'Kondavidu'], at: [[81.8, 17.0], [80.0, 15.5]], reach: 110,
    house: 'Reddi', ruler: ['Kumaragiri', 1350, 'M'], title: ['Raja', 'Rani'], conf: 'medium',
  }),
  P({
    id: 'vel', name: 'Nayakas velama de Rachakonda', short: 'Rachakonda', adj: 'velama', rank: 'duchy', gov: 'feudal_monarchy',
    culture: 'telugu', faith: 'hindu', color: '#c08a3a', cap: [78.95, 17.2, 'Rachakonda'], at: [[79.6, 17.97]], reach: 90,
    house: 'Recherla', ruler: ['Anapota', 1350, 'M', 'II'], title: ['Nayaka', 'Nayaki'], conf: 'medium',
  }),
  P({
    id: 'ori', name: 'Royaume ganga d’Odisha', short: 'Odisha', adj: 'odia', rank: 'kingdom', gov: 'feudal_monarchy',
    culture: 'oriya', faith: 'hindu', color: '#d0703a', cap: [85.88, 20.46, 'Cuttack'], at: [[85.83, 19.81], [84.0, 18.8], [86.5, 21.5], [83.5, 20.5]], reach: 130,
    house: 'Ganga orientale', ruler: ['Narasimha', 1350, 'M', 'IV'], title: ['Gajapati', 'Gajapati'], conf: 'medium',
  }),
  P({
    id: 'bng', name: 'Sultanat du Bengale', short: 'Bengale', adj: 'bengali', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'bengali', faith: 'sunni', color: '#3a9a4a', cap: [88.17, 25.13, 'Pandua'], at: [[90.6, 23.65], [88.38, 22.95], [91.83, 22.34], [91.87, 24.9], [89.5, 24.4], [90.4, 24.75], [87.8, 24.0], [89.5, 22.7]],
    w: 1.1, reach: 150, house: 'Ilyas Chahi', ruler: ['Ghiyas ud-Din Azam Chah', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'high',
    note: 'Sultan lettré, correspondant du poète Hafez ; il entretient des ambassades avec la Chine des Ming.',
  }),
  P({
    id: 'kmt', name: 'Royaume de Kamata', short: 'Kamata', adj: 'kamata', rank: 'duchy', gov: 'feudal_monarchy',
    culture: 'assamese', faith: 'hindu', color: '#8a5a3a', cap: [89.4, 26.4, 'Kamatapur'], at: [[91.7, 26.15]], reach: 100,
    house: 'Khen', ruler: ['Indranarayan', 1360, 'M'], title: ['Raja', 'Rani'], conf: 'low',
  }),
  P({
    id: 'aho', name: 'Royaume ahom', short: 'Ahom', adj: 'ahom', rank: 'duchy', gov: 'clan_realm',
    culture: 'assamese', faith: 'hindu', color: '#b0603a', cap: [94.8, 26.95, 'Charaideo'], at: [[93.8, 26.6]], reach: 110,
    house: 'Ahom', ruler: ['Sudangphaa', 1370, 'M'], title: ['Swargadeo', 'Swargadeo'], conf: 'medium',
    note: 'Dynastie tai venue du haut Irrawaddy ; culte royal propre adossé aux traditions locales.',
  }),
  P({
    id: 'tpr', name: 'Royaume de Tripura', short: 'Tripura', adj: 'tripuri', rank: 'county', gov: 'feudal_monarchy',
    culture: 'bengali', faith: 'hindu', color: '#a07a4a', cap: [91.48, 23.53, 'Udaipur'], reach: 80,
    house: 'Manikya', ruler: ['Mahamanikya', 1370, 'M'], title: ['Maharaja', 'Maharani'], conf: 'low',
  }),
  P({
    id: 'mnp', name: 'Royaume de Manipur', short: 'Manipur', adj: 'manipuri', rank: 'county', gov: 'clan_realm',
    culture: 'assamese', faith: 'hindu', color: '#6a9a5a', cap: [93.94, 24.8, 'Kangla'], reach: 70,
    house: 'Ningthouja', ruler: ['Punshiba', 1370, 'M'], title: ['Meidingu', 'Meidingu'], conf: 'low',
  }),
  P({
    id: 'kas', name: 'Sultanat du Cachemire', short: 'Cachemire', adj: 'cachemiri', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'kashmiri', faith: 'sunni', color: '#5a7ab0', cap: [74.8, 34.08, 'Srinagar'], at: [[75.3, 33.7]], reach: 110,
    house: 'Shah Mir', ruler: ['Sikandar', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'high',
  }),
  P({
    id: 'snd', name: 'Sind des Samma', short: 'Sind', adj: 'sindhi', rank: 'duchy', gov: 'iqta_realm',
    culture: 'punjabi', faith: 'sunni', color: '#9a8a5a', cap: [67.92, 24.75, 'Thatta'], at: [[68.4, 25.4], [68.8, 27.7]], reach: 140,
    house: 'Samma', ruler: ['Salah ud-Din', 1360, 'M'], title: ['Jam', 'Jam'], conf: 'low',
  }),
  P({
    id: 'mew', name: 'Royaume de Mewar', short: 'Mewar', adj: 'mewari', rank: 'duchy', gov: 'clan_realm',
    culture: 'rajput', faith: 'hindu', color: '#e08a2a', cap: [74.64, 24.88, 'Chittor'], at: [[73.7, 24.58], [74.3, 25.5]], reach: 90,
    house: 'Sisodia', ruler: ['Lakha', 1350, 'M'], title: ['Rana', 'Rani'], conf: 'medium',
  }),
  P({
    id: 'mwr', name: 'Royaume de Marwar', short: 'Marwar', adj: 'marwari', rank: 'duchy', gov: 'clan_realm',
    culture: 'rajput', faith: 'hindu', color: '#c0602a', cap: [73.05, 26.35, 'Mandore'], at: [[72.0, 26.0], [73.3, 27.2]], reach: 110,
    house: 'Rathore', ruler: ['Chunda', 1350, 'M'], title: ['Rao', 'Rani'], conf: 'medium',
  }),
  P({
    id: 'jsl', name: 'Royaume de Jaisalmer', short: 'Jaisalmer', adj: 'bhati', rank: 'county', gov: 'clan_realm',
    culture: 'rajput', faith: 'hindu', color: '#d8b060', cap: [70.91, 26.91, 'Jaisalmer'], reach: 120,
    house: 'Bhati', ruler: ['Kehar', 1350, 'M'], title: ['Rawal', 'Rani'], conf: 'low',
  }),
  P({
    id: 'gwa', name: 'Royaume de Gwalior', short: 'Gwalior', adj: 'tomara', rank: 'duchy', gov: 'clan_realm',
    culture: 'rajput', faith: 'hindu', color: '#a04a2a', cap: [78.17, 26.22, 'Gwalior'], at: [[78.6, 25.4]], reach: 80,
    house: 'Tomara', ruler: ['Virasimha', 1350, 'M'], title: ['Raja', 'Rani'], conf: 'medium',
  }),
  P({
    id: 'nep', name: 'Royaume malla de Népal', short: 'Népal', adj: 'népalais', rank: 'duchy', gov: 'feudal_monarchy',
    culture: 'nepali', faith: 'hindu', color: '#b03a5a', cap: [85.43, 27.67, 'Bhaktapur'], at: [[84.4, 27.9]], reach: 80,
    house: 'Malla', ruler: ['Dharma', 1370, 'M'], title: ['Raja', 'Rani'], conf: 'low',
    note: 'Les fils de Jayasthiti Malla gouvernent ensemble la vallée de Katmandou.',
  }),
  P({
    id: 'phg', name: 'Tibet de Phagmodrupa', short: 'Tibet', adj: 'tibétain', rank: 'kingdom', gov: 'theocracy',
    culture: 'tibetan', faith: 'vajrayana', color: '#b04a6a', cap: [91.76, 29.23, 'Nêdong'], at: [[91.13, 29.65], [88.88, 29.27], [89.6, 28.92], [94.0, 29.6], [86.5, 29.0], [92.5, 31.5]],
    reach: 250, house: 'Lang', ruler: ['Drakpa Gyaltsen', 1374, 'M'], title: ['Gongma', 'Gongma'], conf: 'high',
    note: 'Règne de paix et de prospérité ; les grands monastères et les seigneurs de Tsang gagnent en autonomie.',
  }),
  P({
    id: 'gug', name: 'Royaume de Guge', short: 'Guge', adj: 'gugéen', rank: 'county', gov: 'theocracy',
    culture: 'tibetan', faith: 'vajrayana', color: '#c07a8a', cap: [79.8, 31.5, 'Tsaparang'], at: [[81.3, 30.3]], reach: 180,
    house: 'Guge', ruler: ['Namgyal De', 1370, 'M'], title: ['Roi', 'Reine'], conf: 'low',
  }),
  P({
    id: 'lad', name: 'Royaume de Ladakh', short: 'Ladakh', adj: 'ladakhi', rank: 'county', gov: 'feudal_monarchy',
    culture: 'tibetan', faith: 'vajrayana', color: '#9a6a8a', cap: [77.58, 34.16, 'Leh'], reach: 150,
    house: 'Lhachen', ruler: ['Drakpa Bum', 1370, 'M'], title: ['Gyalpo', 'Gyalmo'], conf: 'low',
  }),
  P({
    id: 'jaf', name: 'Royaume de Jaffna', short: 'Jaffna', adj: 'jaffnais', rank: 'county', gov: 'feudal_monarchy',
    culture: 'tamil', faith: 'hindu', color: '#d05a3a', cap: [80.03, 9.67, 'Nallur'], at: [[80.4, 8.8]], reach: 80,
    house: 'Aryacakravarti', ruler: ['Jeyaveera Cinkaiariyan', 1360, 'M'], title: ['Raja', 'Rani'], conf: 'medium',
  }),
  P({
    id: 'gam', name: 'Royaume de Gampola', short: 'Gampola', adj: 'cinghalais', rank: 'duchy', gov: 'feudal_monarchy',
    culture: 'sinhala', faith: 'theravada', color: '#e0b03a', cap: [80.57, 7.16, 'Gampola'], at: [[79.9, 6.89], [81.2, 6.5], [80.4, 8.3]], reach: 90,
    house: 'Alakesvara', ruler: ['Vira Alakesvara', 1360, 'M'], title: ['Roi', 'Reine'], conf: 'medium',
    note: 'Le ministre Alakesvara domine la cour ; le royaume sera razzié par l’amiral Zheng He en 1411.',
  }),
  P({
    id: 'cal', name: 'Royaume de Calicut', short: 'Calicut', adj: 'calicutien', rank: 'duchy', gov: 'merchant_republic',
    culture: 'malayali', faith: 'hindu', color: '#3a8a8a', cap: [75.78, 11.25, 'Calicut'], at: [[76.2, 10.5]], reach: 70,
    house: 'Nediyiruppu', ruler: ['Manavikraman', 1360, 'M'], title: ['Samoothiri', 'Samoothiri'], conf: 'low',
    note: 'Grand port du poivre ; le souverain porte le titre de Samoothiri (zamorin).',
  }),
  P({
    id: 'vnd', name: 'Royaume de Venad', short: 'Venad', adj: 'venadi', rank: 'county', gov: 'feudal_monarchy',
    culture: 'malayali', faith: 'hindu', color: '#5ab0a0', cap: [76.95, 8.5, 'Kollam'], at: [[76.6, 9.3]], reach: 60,
    house: 'Chera', ruler: ['Chera Udaya Martanda', 1370, 'M'], title: ['Raja', 'Rani'], conf: 'low',
  }),
  P({
    id: 'kol', name: 'Royaume de Kolathunadu', short: 'Kolathunadu', adj: 'kolathiri', rank: 'county', gov: 'feudal_monarchy',
    culture: 'malayali', faith: 'hindu', color: '#6a9a7a', cap: [75.4, 11.9, 'Kannur'], reach: 50,
    house: 'Mushika', ruler: ['Udaya Varman', 1360, 'M'], title: ['Kolathiri', 'Kolathiri'], conf: 'low',
  }),
] satisfies ReturnType<typeof P>[];
