/**
 * Anatolie, Caucase, Proche-Orient, Iran, Asie centrale et steppes au
 * 1er janvier 1400 : l'année où Tamerlan repart vers l'ouest.
 */
import { P } from './polity-types';

export const POLITIES_WEST_ASIA = [
  P({
    id: 'ott', name: 'Sultanat ottoman', short: 'Ottomans', adj: 'ottoman', rank: 'empire', gov: 'iqta_realm',
    culture: 'turkish', faith: 'sunni', color: '#3a7a3a', cap: [29.06, 40.19, 'Brousse'],
    at: [[26.56, 41.68], [26.67, 40.41], [24.75, 42.15], [23.32, 42.7], [25.63, 43.08], [22.88, 43.99], [21.43, 42.0], [22.94, 40.64], [23.55, 41.09], [22.42, 39.64], [32.86, 39.93], [32.48, 37.87], [29.98, 39.42], [27.35, 37.94], [27.43, 38.61], [28.36, 37.21], [30.7, 36.9], [33.78, 41.38], [37.02, 39.75], [36.55, 40.31], [35.83, 40.65], [38.31, 38.35], [35.48, 38.73], [27.26, 44.12], [24.9, 43.7], [34.0, 38.7], [31.0, 40.7], [21.9, 41.3], [24.4, 41.4], [27.0, 42.6], [33.0, 36.4]],
    w: 1.2, house: 'Osman', ruler: ['Bayezid', 1360, 'M', 'Ier'], spouse: ['Olivera', 1372, 'F'],
    kids: [['Süleyman', 1377], ['İsa', 1380], ['Musa', 1388], ['Mehmed', 1389], ['Mustafa', 1393]],
    title: ['Sultan', 'Sultane'], conf: 'high',
    note: 'Vainqueur de Nicopolis (1396), Bayezid « la Foudre » a annexé les beylicats anatoliens et assiège Constantinople. Tamerlan exige la restitution des beys chassés.',
  }),
  P({
    id: 'isf', name: 'Beylicat des Isfendiyarides', short: 'Sinope', adj: 'isfendiyaride', rank: 'county', gov: 'iqta_realm',
    culture: 'turkish', faith: 'sunni', color: '#6ab06a', cap: [35.15, 42.03, 'Sinope'], reach: 60,
    house: 'Isfendiyar', ruler: ['İsfendiyar', 1360, 'M'], title: ['Bey', 'Begüm'], liege: 'ott', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'trb', name: 'Empire de Trébizonde', short: 'Trébizonde', adj: 'trapézontin', rank: 'kingdom', gov: 'imperial_bureaucracy',
    culture: 'greek', faith: 'orthodox', color: '#b05ab0', cap: [39.72, 41.0, 'Trébizonde'], at: [[38.39, 40.92], [40.52, 41.02]], reach: 50,
    house: 'Grands Comnènes', ruler: ['Manuel', 1364, 'M', 'III'], title: ['Empereur', 'Impératrice'], conf: 'high',
  }),
  P({
    id: 'dul', name: 'Beylicat de Dulkadir', short: 'Dulkadir', adj: 'dulkadiride', rank: 'county', gov: 'tribal_confederation',
    culture: 'turkmen', faith: 'sunni', color: '#8ab03a', cap: [37.2, 38.2, 'Elbistan'], at: [[36.93, 37.58]], reach: 70,
    house: 'Dulkadir', ruler: ['Nasireddin Mehmed', 1370, 'M'], title: ['Bey', 'Begüm'], liege: 'mam', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'ram', name: 'Beylicat des Ramadanides', short: 'Adana', adj: 'ramadanide', rank: 'county', gov: 'tribal_confederation',
    culture: 'turkmen', faith: 'sunni', color: '#a0c05a', cap: [35.32, 37.0, 'Adana'], reach: 50,
    house: 'Ramadan', ruler: ['Ahmed', 1350, 'M'], title: ['Bey', 'Begüm'], liege: 'mam', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'aqq', name: 'Confédération Aq Qoyunlu', short: 'Aq Qoyunlu', adj: 'aq-qoyunlu', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'turkmen', faith: 'sunni', color: '#e0e0c0', cap: [40.23, 37.91, 'Amid'], at: [[39.2, 38.7], [41.0, 38.4]], reach: 90,
    house: 'Bayandur', ruler: ['Qara Yülük Osman', 1356, 'M'], title: ['Bey', 'Begüm'], liege: 'tim', subject: 'tributary', conf: 'medium',
    note: 'Allié de Tamerlan contre les Ottomans et les Qara Qoyunlu.',
  }),
  P({
    id: 'qqy', name: 'Confédération Qara Qoyunlu', short: 'Qara Qoyunlu', adj: 'qara-qoyunlu', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'turkmen', faith: 'shia', color: '#3a3a3a', cap: [43.38, 38.5, 'Van'], at: [[42.8, 39.0], [43.8, 37.6], [44.5, 39.4]], reach: 90,
    house: 'Baharlu', ruler: ['Qara Yusuf', 1356, 'M'], title: ['Bey', 'Begüm'], conf: 'medium',
    note: 'Qara Yusuf, chassé par Tamerlan, s’apprête à se réfugier chez Bayezid.',
  }),
  P({
    id: 'mrd', name: 'Émirat artukide de Mardin', short: 'Mardin', adj: 'artukide', rank: 'county', gov: 'iqta_realm',
    culture: 'turkmen', faith: 'sunni', color: '#c0a06a', cap: [40.74, 37.31, 'Mardin'], reach: 50,
    house: 'Artuk', ruler: ['Majd al-Din Isa', 1360, 'M'], title: ['Émir', 'Émira'], liege: 'tim', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'erz', name: 'Émirat d’Erzincan', short: 'Erzincan', adj: 'erzincanais', rank: 'county', gov: 'iqta_realm',
    culture: 'turkmen', faith: 'sunni', color: '#a08a5a', cap: [39.49, 39.75, 'Erzincan'], at: [[41.27, 39.9]], reach: 60,
    house: 'Mutahharten', ruler: ['Mutahharten', 1340, 'M'], title: ['Émir', 'Émira'], liege: 'tim', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'geo', name: 'Royaume de Géorgie', short: 'Géorgie', adj: 'géorgien', rank: 'kingdom', gov: 'feudal_monarchy',
    culture: 'georgian', faith: 'orthodox', color: '#c83a5a', cap: [44.79, 41.72, 'Tbilissi'], at: [[42.7, 42.27], [42.99, 41.64], [41.7, 42.0], [45.6, 42.0], [43.6, 42.4]], reach: 110,
    house: 'Bagration', ruler: ['Georges', 1360, 'M', 'VII'], conf: 'high', note: 'Le royaume résiste aux invasions répétées de Tamerlan (1399–1403).',
  }),
  P({
    id: 'shi', name: 'Chirvan', short: 'Chirvan', adj: 'chirvanais', rank: 'duchy', gov: 'iqta_realm',
    culture: 'persian', faith: 'sunni', color: '#5ab0b0', cap: [48.64, 40.63, 'Chamakhi'], at: [[48.29, 42.06], [49.87, 40.41]], reach: 80,
    house: 'Derbendi', ruler: ['Ibrahim', 1350, 'M', 'Ier'], title: ['Chirvanchah', 'Chirvanchah'], liege: 'tim', subject: 'tributary', conf: 'high',
  }),
  P({
    id: 'dag', name: 'Chamkhalat de Kazi-Koumoukh', short: 'Daghestan', adj: 'daghestanais', rank: 'county', gov: 'clan_realm',
    culture: 'circassian', faith: 'sunni', color: '#7a9a6a', cap: [47.1, 42.2, 'Kazi-Koumoukh'], at: [[46.6, 42.9]], reach: 80,
    house: 'Chamkhal', ruler: ['Muhammad', 1360, 'M'], title: ['Chamkhal', 'Chamkhal'], conf: 'low',
  }),
  P({
    id: 'cir', name: 'Pays circassiens', short: 'Circassie', adj: 'circassien', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'circassian', faith: 'orthodox', color: '#6a8a4a', cap: [39.0, 44.6, 'Kouban'], at: [[41.5, 43.9], [43.5, 43.5]], reach: 120,
    house: 'Inal', ruler: ['Inal', 1360, 'M'], title: ['Pchi', 'Pchi'], conf: 'gameplayApproximation',
    note: 'Princes adyguéens et kabardes regroupés ; christianisme ancien mêlé de croyances locales.',
  }),
  P({
    id: 'thd', name: 'Principauté de Théodoro', short: 'Théodoro', adj: 'théodorite', rank: 'county', gov: 'feudal_monarchy',
    culture: 'greek', faith: 'orthodox', color: '#9a6ab0', cap: [33.8, 44.59, 'Mangoup'], reach: 40,
    house: 'Gabras', ruler: ['Alexis', 1370, 'M', 'Ier'], title: ['Prince', 'Princesse'], liege: 'gh', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'gh', name: 'Horde d’Or', short: 'Horde d’Or', adj: 'de la Horde', rank: 'empire', gov: 'steppe_confederation',
    culture: 'kipchak', faith: 'sunni', color: '#d8a030', cap: [45.8, 48.5, 'Nouveau Saraï'],
    at: [[48.04, 46.35], [39.42, 47.1], [35.1, 45.04], [49.08, 54.98], [45.95, 51.53], [49.1, 55.8], [43.7, 53.9], [38.98, 45.04], [34.1, 45.6], [31.5, 47.2], [51.53, 47.5], [36.0, 47.5], [42.0, 49.5], [47.0, 50.5], [53.5, 52.0], [55.0, 49.0], [44.0, 46.0], [52.0, 54.5]],
    w: 1.1, reach: 500, house: 'Djötchides', ruler: ['Chadi Beg', 1370, 'M'], title: ['Khan', 'Khatun'], conf: 'medium',
    note: 'Le khan règne, mais l’émir Edigü, vainqueur de la Vorskla (1399), gouverne réellement la Horde.',
  }),
  P({
    id: 'sib', name: 'Oulous de Chaïban (Tioumen)', short: 'Tioumen', adj: 'chaïbanide', rank: 'duchy', gov: 'steppe_confederation',
    culture: 'kipchak', faith: 'sunni', color: '#b09060', cap: [65.53, 57.15, 'Tchimgi-Toura'], at: [[68.3, 58.2], [62.0, 55.5], [70.0, 56.0]], reach: 350,
    house: 'Chaïbanides', ruler: ['Hadji Muhammad', 1370, 'M'], title: ['Khan', 'Khatun'], liege: 'gh', subject: 'autonomous_vassal', conf: 'low',
  }),
  P({
    id: 'wh', name: 'Horde Blanche', short: 'Horde Blanche', adj: 'de la Horde Blanche', rank: 'kingdom', gov: 'steppe_confederation',
    culture: 'kazakh', faith: 'sunni', color: '#e8dcb0', cap: [68.1, 43.5, 'Sighnaq'], at: [[64.0, 47.5], [70.0, 47.0], [60.0, 49.5], [74.0, 46.0], [66.0, 51.0], [72.0, 50.5], [58.0, 46.5]],
    reach: 450, house: 'Djötchides', ruler: ['Koïritchak', 1375, 'M'], title: ['Khan', 'Khatun'], liege: 'tim', subject: 'tributary', conf: 'low',
    note: 'Steppe orientale de la Horde ; khans installés avec l’appui de Tamerlan (approximation de jeu).',
  }),
  P({
    id: 'tim', name: 'Empire timouride', short: 'Timourides', adj: 'timouride', rank: 'empire', gov: 'steppe_confederation',
    culture: 'chagatai', faith: 'sunni', color: '#2f6e8f', cap: [66.97, 39.65, 'Samarcande'],
    at: [[64.42, 39.77], [62.2, 34.35], [66.9, 36.76], [69.24, 41.3], [59.15, 42.33], [61.84, 37.66], [58.8, 36.21], [46.29, 38.08], [48.8, 36.43], [48.51, 34.8], [51.67, 32.65], [52.53, 29.59], [57.08, 30.28], [54.37, 31.9], [69.17, 34.53], [65.7, 31.61], [68.4, 33.55], [54.43, 36.84], [51.43, 35.59], [50.0, 36.27], [53.06, 36.56], [61.49, 31.03], [72.34, 40.78], [45.1, 37.5], [47.0, 36.3], [50.0, 32.0], [56.0, 34.0], [60.0, 33.0], [64.0, 35.0], [70.0, 38.5], [59.0, 39.0], [55.5, 27.5], [44.0, 40.2], [46.9, 39.8], [49.5, 29.5], [52.0, 36.5]],
    w: 1.35, reach: 450, house: 'Timourides', ruler: ['Timour', 1336, 'M'], spouse: ['Saray Mulk', 1343, 'F'],
    kids: [['Miran Chah', 1366], ['Chah Rukh', 1377]], title: ['Grand émir', 'Grande émira'], conf: 'high',
    note: 'Tamerlan revient de l’Inde (sac de Delhi, 1398) et lance sa campagne de sept ans vers l’ouest. Ses fils et petits-fils gouvernent les provinces.',
  }),
  P({
    id: 'mul', name: 'Gouvernement de Multan', short: 'Multan', adj: 'multani', rank: 'duchy', gov: 'iqta_realm',
    culture: 'punjabi', faith: 'sunni', color: '#5a9a8a', cap: [71.47, 30.2, 'Multan'], at: [[73.4, 30.8], [74.35, 31.55]], reach: 120,
    house: 'Sayyid', ruler: ['Khizr Khan', 1360, 'M'], title: ['Gouverneur', 'Gouverneure'], liege: 'tim', subject: 'direct_vassal', conf: 'high',
    note: 'Gouverneur du Pendjab pour Tamerlan, il fondera la dynastie Sayyid de Delhi (1414).',
  }),
  P({
    id: 'jal', name: 'Sultanat jalayiride', short: 'Jalayirides', adj: 'jalayiride', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'arab_iraqi', faith: 'sunni', color: '#b0703a', cap: [44.36, 33.31, 'Bagdad'], at: [[47.78, 30.51], [45.83, 32.5], [44.42, 32.47], [43.13, 36.34]], reach: 120,
    house: 'Jalayir', ruler: ['Ahmad', 1355, 'M'], title: ['Sultan', 'Sultane'], conf: 'medium',
    note: 'Ahmad Jalayir a repris Bagdad après le départ de Tamerlan ; la ville sera saccagée en juin 1401.',
  }),
  P({
    id: 'mam', name: 'Sultanat mamelouk', short: 'Mamelouks', adj: 'mamelouk', rank: 'empire', gov: 'mamluk_sultanate',
    culture: 'arab_levant', faith: 'sunni', color: '#d8c060', cap: [31.24, 30.04, 'Le Caire'],
    at: [[29.92, 31.2], [31.81, 31.42], [31.18, 27.18], [32.76, 25.91], [32.9, 24.09], [34.47, 31.5], [35.23, 31.78], [36.3, 33.51], [37.16, 36.2], [35.84, 34.44], [36.72, 34.73], [36.75, 35.13], [35.7, 31.18], [35.5, 32.96], [35.8, 37.45], [33.8, 29.0], [30.5, 29.3], [38.0, 35.5], [36.0, 36.5], [30.7, 28.5], [28.9, 25.5, 60], [34.8, 28.0]],
    w: 1.2, reach: 300, house: 'Barqouq', ruler: ['Faraj', 1386, 'M', 'an-Nasir'], title: ['Sultan', 'Sultane'], conf: 'high',
    note: 'Le jeune fils de Barqouq règne sur l’Égypte et la Syrie ; les émirs mamelouks circassiens se disputent la régence.',
  }),
  P({
    id: 'mka', name: 'Chérifat de La Mecque', short: 'La Mecque', adj: 'mecquois', rank: 'duchy', gov: 'theocracy',
    culture: 'arab_bedouin', faith: 'sunni', color: '#3a9a6a', cap: [39.83, 21.42, 'La Mecque'], at: [[39.19, 21.49], [39.61, 24.47], [38.06, 24.09], [40.4, 19.5]], reach: 160,
    house: 'Hachémites', ruler: ['Hasan', 1375, 'M', 'ibn Ajlan'], title: ['Chérif', 'Chérifa'], liege: 'mam', subject: 'client_state', conf: 'high',
  }),
  P({
    id: 'ras', name: 'Sultanat rassoulide', short: 'Yémen', adj: 'rassoulide', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'arab_bedouin', faith: 'sunni', color: '#5a8a3a', cap: [44.02, 13.58, 'Taëz'], at: [[43.33, 14.2], [45.03, 12.78], [43.3, 15.3]], reach: 120,
    house: 'Rassoulides', ruler: ['Ismaïl', 1360, 'M', 'al-Ashraf II'], title: ['Sultan', 'Sultane'], conf: 'high',
  }),
  P({
    id: 'zyd', name: 'Imamat zaydite', short: 'Imamat', adj: 'zaydite', rank: 'duchy', gov: 'theocracy',
    culture: 'arab_bedouin', faith: 'shia', color: '#2a6a4a', cap: [44.21, 15.35, 'Sanaa'], at: [[43.76, 16.94]], reach: 100,
    house: 'Rassides', ruler: ['Ali', 1370, 'M', 'al-Mansur'], title: ['Imam', 'Imam'], conf: 'high',
  }),
  P({
    id: 'hdr', name: 'Sultanat kathiri', short: 'Hadramaout', adj: 'hadrami', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'arab_bedouin', faith: 'sunni', color: '#a0a060', cap: [48.63, 15.93, 'Tarim'], at: [[49.1, 14.54], [52.0, 17.0]], reach: 200,
    house: 'Kathiri', ruler: ['Badr', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'low',
  }),
  P({
    id: 'oma', name: 'Imamat d’Oman', short: 'Oman', adj: 'omanais', rank: 'duchy', gov: 'theocracy',
    culture: 'arab_bedouin', faith: 'ibadi', color: '#b04a3a', cap: [57.53, 22.93, 'Nizwa'], at: [[56.3, 24.3], [58.0, 21.0]], reach: 180,
    house: 'Nabhani', ruler: ['Makhzum', 1360, 'M'], title: ['Malik', 'Malika'], conf: 'low',
    note: 'Les rois nabhanides dominent l’intérieur ; la côte relève d’Ormuz.',
  }),
  P({
    id: 'hor', name: 'Royaume d’Ormuz', short: 'Ormuz', adj: 'ormuzien', rank: 'duchy', gov: 'merchant_republic',
    culture: 'persian', faith: 'sunni', color: '#c0602a', cap: [56.46, 27.1, 'Ormuz'], at: [[58.59, 23.61, 60], [50.58, 26.1, 40], [56.27, 27.18, 40]], reach: 60,
    house: 'Ormuz', ruler: ['Muhammad Chah', 1360, 'M', 'II'], title: ['Malik', 'Malika'], conf: 'medium',
  }),
  P({
    id: 'jbr', name: 'Émirat jarwanide', short: 'Al-Hasa', adj: 'jarwanide', rank: 'county', gov: 'tribal_confederation',
    culture: 'arab_bedouin', faith: 'shia', color: '#8a7a3a', cap: [49.99, 26.56, 'Qatif'], at: [[49.6, 25.4]], reach: 160,
    house: 'Jarwan', ruler: ['Nasir', 1360, 'M'], title: ['Émir', 'Émira'], conf: 'low',
  }),
  P({
    id: 'mgh', name: 'Moghulistan', short: 'Moghulistan', adj: 'moghol', rank: 'kingdom', gov: 'steppe_confederation',
    culture: 'chagatai', faith: 'sunni', color: '#8a5a8a', cap: [80.26, 41.17, 'Aksou'], at: [[75.99, 39.47], [77.3, 42.5], [80.9, 43.9], [89.19, 42.95], [89.2, 44.1], [83.0, 44.5], [79.9, 37.1], [86.0, 41.7], [75.5, 42.8]],
    reach: 400, house: 'Tchaghataïdes', ruler: ['Chams-i Djahan', 1370, 'M'], title: ['Khan', 'Khatun'], conf: 'medium',
    note: 'Khanat tchaghataïde oriental ; les émirs Doughlat tiennent Kachgar.',
  }),
] satisfies ReturnType<typeof P>[];
