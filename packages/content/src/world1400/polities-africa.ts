/**
 * Afrique au 1er janvier 1400. Beaucoup de listes royales de cette époque
 * reposent sur des traditions orales ou des chroniques postérieures : les
 * dirigeants marqués « low » sont plausibles, pas attestés à l'année près.
 */
import { P } from './polity-types';

export const POLITIES_AFRICA = [
  P({
    id: 'mar', name: 'Sultanat mérinide', short: 'Mérinides', adj: 'mérinide', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'berber', faith: 'sunni', color: '#b0302e', cap: [-5.0, 34.03, 'Fès'],
    at: [[-7.99, 31.63], [-5.55, 33.89], [-5.8, 35.77], [-5.32, 35.89], [-6.83, 34.02], [-4.01, 34.21], [-4.27, 31.28], [-9.6, 30.4], [-8.5, 33.2], [-7.0, 32.5], [-2.9, 35.0]],
    reach: 200, house: 'Mérinides', ruler: ['Othman', 1380, 'M', 'Abou Saïd III'], title: ['Sultan', 'Sultane'], conf: 'medium',
    note: 'Pouvoir affaibli par les vizirs et les Nasrides ; les Portugais prendront Ceuta en 1415.',
  }),
  P({
    id: 'zay', name: 'Royaume zianide de Tlemcen', short: 'Tlemcen', adj: 'zianide', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'maghrebi', faith: 'sunni', color: '#d8a05a', cap: [-1.32, 34.88, 'Tlemcen'], at: [[-0.64, 35.7], [2.75, 36.26], [0.3, 35.4], [1.3, 34.8]], reach: 130,
    house: 'Zianides', ruler: ['Abdallah', 1370, 'M', 'Abou Mohammed Ier'], title: ['Sultan', 'Sultane'], conf: 'medium',
  }),
  P({
    id: 'haf', name: 'Sultanat hafside', short: 'Hafsides', adj: 'hafside', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'maghrebi', faith: 'sunni', color: '#3a8a8a', cap: [10.17, 36.8, 'Tunis'],
    at: [[6.61, 36.37], [5.08, 36.75], [13.18, 32.89], [10.1, 35.68], [7.75, 36.9], [10.1, 33.88], [3.06, 36.75], [8.1, 35.4], [11.1, 33.5], [5.4, 35.6], [15.0, 32.4], [20.07, 32.12, 120]],
    w: 1.1, reach: 200, house: 'Hafsides', ruler: ['Abd al-Aziz', 1361, 'M', 'Abou Farès II'], title: ['Sultan', 'Sultane'], conf: 'high',
    note: 'Abou Farès restaure l’unité de l’Ifriqiya ; ses corsaires disputent la mer aux Aragonais.',
  }),
  P({
    id: 'fez', name: 'Royaume du Fezzan', short: 'Fezzan', adj: 'fezzanais', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'tuareg', faith: 'sunni', color: '#b09a6a', cap: [15.1, 26.18, 'Zouila'], at: [[14.43, 27.04], [13.0, 25.0]], reach: 300,
    house: 'Banou Khattab', ruler: ['Mohammed', 1360, 'M'], title: ['Émir', 'Émira'], conf: 'low',
  }),
  P({
    id: 'mli', name: 'Empire du Mali', short: 'Mali', adj: 'malien', rank: 'empire', gov: 'tributary_empire',
    culture: 'mande', faith: 'sunni', color: '#d8a030', cap: [-8.72, 11.4, 'Niani'],
    at: [[-3.0, 16.77], [-4.55, 13.9], [-7.02, 17.3], [-8.2, 12.1], [-9.5, 13.0], [-15.5, 13.4], [-7.8, 15.7], [-11.4, 14.4], [-6.3, 13.2], [-5.5, 11.0], [-10.8, 11.8], [-12.5, 12.6], [-4.2, 15.2], [-9.8, 15.2]],
    w: 1.25, reach: 350, house: 'Keita', ruler: ['Mahmoud', 1360, 'M', 'Maghan III'], title: ['Mansa', 'Mansa'], conf: 'low',
    note: 'L’empire, encore vaste, perd sa périphérie ; la succession des mansas vers 1400 est mal connue.',
  }),
  P({
    id: 'son', name: 'Royaume de Gao', short: 'Songhaï', adj: 'songhaï', rank: 'kingdom', gov: 'tributary_empire',
    culture: 'songhai', faith: 'sunni', color: '#8a4a2e', cap: [-0.04, 16.27, 'Gao'], at: [[0.6, 15.0], [1.5, 14.0], [2.1, 13.5]], reach: 220,
    house: 'Sonni', ruler: ['Mohammed Dao', 1360, 'M'], title: ['Sonni', 'Sonni'], conf: 'low',
  }),
  P({
    id: 'jol', name: 'Empire du Djolof', short: 'Djolof', adj: 'wolof', rank: 'kingdom', gov: 'tributary_empire',
    culture: 'wolof', faith: 'west_african', color: '#5a8a3a', cap: [-15.1, 15.39, 'Linguère'], at: [[-16.2, 16.2], [-16.6, 15.0], [-16.4, 14.3], [-15.0, 16.5], [-14.0, 15.0]], reach: 170,
    house: 'Ndiaye', ruler: ['Birayma', 1360, 'M'], title: ['Bourba', 'Bourba'], conf: 'low',
  }),
  P({
    id: 'mos', name: 'Royaume mossi de Ouagadougou', short: 'Mossi', adj: 'mossi', rank: 'duchy', gov: 'clan_realm',
    culture: 'mossi', faith: 'west_african', color: '#c07a3a', cap: [-1.53, 12.37, 'Ouagadougou'], at: [[-0.4, 12.1], [-2.4, 13.4]], reach: 170,
    house: 'Ouédraogo', ruler: ['Naaba Koudoumié', 1360, 'M'], title: ['Mogho Naaba', 'Mogho Naaba'], conf: 'low',
  }),
  P({
    id: 'dgb', name: 'Royaume de Dagbon', short: 'Dagbon', adj: 'dagomba', rank: 'county', gov: 'clan_realm',
    culture: 'mossi', faith: 'west_african', color: '#a05a3a', cap: [-0.84, 9.4, 'Yendi'], reach: 150,
    house: 'Dagbon', ruler: ['Naa Gbewaa', 1360, 'M'], title: ['Ya Na', 'Ya Na'], conf: 'low',
  }),
  P({
    id: 'bon', name: 'Royaume de Bono', short: 'Bono', adj: 'bono', rank: 'county', gov: 'clan_realm',
    culture: 'akan', faith: 'west_african', color: '#d8b03a', cap: [-1.9, 7.9, 'Bono Manso'], at: [[-1.6, 6.7]], reach: 150,
    house: 'Bono', ruler: ['Asaman', 1360, 'M'], title: ['Bonohene', 'Bonohemaa'], conf: 'low', note: 'Route de l’or vers Djenné.',
  }),
  P({
    id: 'kno', name: 'Cité-État de Kano', short: 'Kano', adj: 'kanawa', rank: 'duchy', gov: 'city_state',
    culture: 'hausa', faith: 'west_african', color: '#3a6a3a', cap: [8.52, 12.0, 'Kano'], reach: 130,
    house: 'Bagauda', ruler: ['Kanajeji', 1370, 'M'], title: ['Sarki', 'Sarauniya'], conf: 'medium',
    note: 'L’islam de cour progresse parmi les élites haoussas ; la population suit les cultes locaux.',
  }),
  P({
    id: 'kat', name: 'Cité-État de Katsina', short: 'Katsina', adj: 'katsinawa', rank: 'county', gov: 'city_state',
    culture: 'hausa', faith: 'west_african', color: '#5a8a5a', cap: [7.6, 13.0, 'Katsina'], reach: 110,
    house: 'Korau', ruler: ['Ibrahim', 1370, 'M'], title: ['Sarki', 'Sarauniya'], conf: 'low',
  }),
  P({
    id: 'zaz', name: 'Cité-État de Zazzau', short: 'Zazzau', adj: 'zazzagawa', rank: 'county', gov: 'city_state',
    culture: 'hausa', faith: 'west_african', color: '#7aa05a', cap: [7.7, 11.1, 'Zaria'], reach: 130,
    house: 'Zazzau', ruler: ['Sarkin Zazzau', 1360, 'M'], title: ['Sarki', 'Sarauniya'], conf: 'low',
  }),
  P({
    id: 'gob', name: 'Cité-État de Gobir', short: 'Gobir', adj: 'gobirawa', rank: 'county', gov: 'city_state',
    culture: 'hausa', faith: 'west_african', color: '#9ab05a', cap: [5.5, 13.4, 'Gobir'], reach: 130,
    house: 'Gobir', ruler: ['Bawa', 1360, 'M'], title: ['Sarki', 'Sarauniya'], conf: 'low',
  }),
  P({
    id: 'aga', name: 'Confédérations touarègues de l’Aïr', short: 'Aïr', adj: 'touareg', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'tuareg', faith: 'sunni', color: '#c0b08a', cap: [7.99, 16.97, 'Agadez'], at: [[8.5, 19.0], [6.5, 18.0]], reach: 350,
    house: 'Kel Aïr', ruler: ['Younous', 1370, 'M'], title: ['Amenokal', 'Amenokal'], conf: 'low',
  }),
  P({
    id: 'bor', name: 'Royaume du Bornou', short: 'Bornou', adj: 'kanouri', rank: 'kingdom', gov: 'clan_realm',
    culture: 'kanuri', faith: 'sunni', color: '#8a6a2a', cap: [12.8, 12.4, 'Kaga'], at: [[13.5, 11.8], [12.0, 13.3], [14.1, 12.7]], reach: 200,
    house: 'Sayfawa', ruler: ['Othman', 1370, 'M'], title: ['Maï', 'Magira'], conf: 'low',
    note: 'Chassés du Kanem par les Boulala, les maï sayfawa se replient à l’ouest du lac Tchad.',
  }),
  P({
    id: 'bul', name: 'Royaume boulala du Kanem', short: 'Kanem', adj: 'boulala', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'kanuri', faith: 'sunni', color: '#a07a3a', cap: [16.0, 14.2, 'Njimi'], at: [[18.0, 13.5], [17.0, 16.0]], reach: 250,
    house: 'Boulala', ruler: ['Abd al-Djalil', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'low',
  }),
  P({
    id: 'oyo', name: 'Royaume d’Oyo', short: 'Oyo', adj: 'oyo', rank: 'duchy', gov: 'clan_realm',
    culture: 'yoruba', faith: 'west_african', color: '#b04a3a', cap: [4.2, 8.97, 'Oyo-Ilé'], at: [[3.5, 8.3]], reach: 130,
    house: 'Oranyan', ruler: ['Ofinran', 1370, 'M'], title: ['Alaafin', 'Alaafin'], conf: 'low',
  }),
  P({
    id: 'ife', name: 'Cité sacrée d’Ifè', short: 'Ifè', adj: 'ifè', rank: 'county', gov: 'theocracy',
    culture: 'yoruba', faith: 'west_african', color: '#d07a5a', cap: [4.56, 7.47, 'Ilé-Ifè'], at: [[3.9, 7.0]], reach: 90,
    house: 'Oduduwa', ruler: ['Oni', 1360, 'M'], title: ['Ooni', 'Ooni'], conf: 'low', note: 'Foyer d’un art de cour exceptionnel en laiton et en terre cuite.',
  }),
  P({
    id: 'bnn', name: 'Royaume du Bénin', short: 'Bénin', adj: 'edo', rank: 'duchy', gov: 'clan_realm',
    culture: 'edo', faith: 'west_african', color: '#8a2a2a', cap: [5.63, 6.34, 'Edo'], reach: 110,
    house: 'Eweka', ruler: ['Egbeka', 1360, 'M'], title: ['Oba', 'Iyoba'], conf: 'low',
  }),
  P({
    id: 'nup', name: 'Pays nupe', short: 'Nupe', adj: 'nupe', rank: 'county', gov: 'clan_realm',
    culture: 'yoruba', faith: 'west_african', color: '#9a6a4a', cap: [6.0, 9.0, 'Nupe'], reach: 120,
    house: 'Nupe', ruler: ['Etsu', 1360, 'M'], title: ['Etsu', 'Etsu'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'jkn', name: 'Confédération jukun (Kwararafa)', short: 'Kwararafa', adj: 'jukun', rank: 'duchy', gov: 'theocracy',
    culture: 'igbo', faith: 'west_african', color: '#6a4a3a', cap: [9.8, 8.1, 'Wukari'], at: [[11.0, 9.0]], reach: 170,
    house: 'Kwararafa', ruler: ['Aku', 1360, 'M'], title: ['Aku Uka', 'Aku Uka'], conf: 'low',
  }),
  P({
    id: 'nri', name: 'Royaume de Nri', short: 'Nri', adj: 'igbo', rank: 'county', gov: 'theocracy',
    culture: 'igbo', faith: 'west_african', color: '#4a6a3a', cap: [7.0, 6.2, 'Igbo-Ukwu'], reach: 100,
    house: 'Nri', ruler: ['Eze Nri', 1360, 'M'], title: ['Eze Nri', 'Eze Nri'], conf: 'low', note: 'Autorité rituelle plus que territoriale.',
  }),
  P({
    id: 'mak', name: 'Royaume de Dotawo (Makurie)', short: 'Makurie', adj: 'nubien', rank: 'duchy', gov: 'feudal_monarchy',
    culture: 'nubian', faith: 'miaphysite', color: '#8a6a9a', cap: [31.6, 22.6, 'Qasr Ibrim'], at: [[30.5, 18.6], [31.0, 20.5]], reach: 150,
    house: 'Dotawo', ruler: ['Joël', 1360, 'M'], title: ['Roi', 'Reine'], liege: 'mam', subject: 'tributary', conf: 'low',
    note: 'Dernier royaume chrétien de Nubie, réduit à la région de la deuxième cataracte.',
  }),
  P({
    id: 'alo', name: 'Royaume d’Alodie', short: 'Alodie', adj: 'alodien', rank: 'duchy', gov: 'feudal_monarchy',
    culture: 'nubian', faith: 'miaphysite', color: '#a07aa0', cap: [32.68, 15.52, 'Soba'], at: [[33.5, 13.5], [32.5, 17.5]], reach: 220,
    house: 'Soba', ruler: ['Georges', 1360, 'M'], title: ['Roi', 'Reine'], conf: 'low',
  }),
  P({
    id: 'daf', name: 'Royaume toundjour du Darfour', short: 'Darfour', adj: 'darfouri', rank: 'duchy', gov: 'clan_realm',
    culture: 'nilotic', faith: 'nilotic_trad', color: '#b07a3a', cap: [24.9, 13.6, 'Ain Farah'], at: [[23.5, 12.5], [22.0, 13.9]], reach: 250,
    house: 'Toundjour', ruler: ['Ahmad', 1360, 'M'], title: ['Roi', 'Reine'], conf: 'low',
  }),
  P({
    id: 'eth', name: 'Empire d’Éthiopie', short: 'Éthiopie', adj: 'éthiopien', rank: 'empire', gov: 'feudal_monarchy',
    culture: 'amhara', faith: 'miaphysite', color: '#3a8a3a', cap: [39.3, 9.9, 'Tegulet'],
    at: [[38.72, 14.13], [39.05, 12.03], [37.6, 10.5], [37.47, 12.6], [39.0, 9.3], [37.5, 8.3], [37.9, 7.6], [39.0, 15.3], [39.6, 13.5], [36.8, 11.2], [38.5, 11.2]],
    w: 1.2, reach: 220, house: 'Salomonide', ruler: ['Dawit', 1350, 'M', 'Ier'], kids: [['Tewodros', 1380], ['Yeshaq', 1390], ['Zara Yaqob', 1399]],
    title: ['Negusse Negest', 'Negiste Negest'], conf: 'high',
    note: 'Dawit Ier guerroie contre le sultanat d’Ifat et entretient des relations avec les Mamelouks et l’Europe.',
  }),
  P({
    id: 'ifa', name: 'Sultanat d’Ifat', short: 'Ifat', adj: 'ifatien', rank: 'kingdom', gov: 'iqta_realm',
    culture: 'somali', faith: 'sunni', color: '#5ab05a', cap: [40.0, 9.8, 'Ifat'], at: [[43.47, 11.35], [42.12, 9.31], [41.9, 10.5], [44.5, 10.0]], reach: 180,
    house: 'Walashma', ruler: ['Saad ad-Din', 1360, 'M', 'II'], title: ['Sultan', 'Sultane'], conf: 'high',
  }),
  P({
    id: 'mgd', name: 'Sultanat de Mogadiscio', short: 'Mogadiscio', adj: 'mogadiscien', rank: 'duchy', gov: 'merchant_republic',
    culture: 'somali', faith: 'sunni', color: '#3a7a9a', cap: [45.34, 2.04, 'Mogadiscio'], at: [[44.07, 1.72], [46.2, 4.7]], reach: 180,
    house: 'Fakhr ad-Din', ruler: ['Abou Bakr', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'low',
  }),
  P({
    id: 'pat', name: 'Cité-État de Pate', short: 'Pate', adj: 'swahili', rank: 'county', gov: 'city_state',
    culture: 'swahili', faith: 'sunni', color: '#5aa0b0', cap: [41.07, -2.1, 'Pate'], at: [[40.12, -3.22, 50]], reach: 70,
    house: 'Nabhani', ruler: ['Omar', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'low',
  }),
  P({
    id: 'mom', name: 'Cité-État de Mombasa', short: 'Mombasa', adj: 'swahili', rank: 'county', gov: 'city_state',
    culture: 'swahili', faith: 'sunni', color: '#7ab0c0', cap: [39.66, -4.04, 'Mombasa'], reach: 70,
    house: 'Shirazi', ruler: ['Shehe', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'kil', name: 'Sultanat de Kilwa', short: 'Kilwa', adj: 'kilwan', rank: 'kingdom', gov: 'merchant_republic',
    culture: 'swahili', faith: 'sunni', color: '#2a8a8a', cap: [39.51, -8.96, 'Kilwa Kisiwani'], at: [[39.19, -6.16, 60], [39.7, -7.9, 40], [34.8, -20.15, 90], [40.5, -10.8, 60], [40.7, -14.5, 60]], reach: 80,
    house: 'Mahdali', ruler: ['Mohammed', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'low',
    note: 'Maîtresse du commerce de l’or de Sofala ; la chronologie des sultans vers 1400 est incertaine.',
  }),
  P({
    id: 'kit', name: 'Royaume de Kitara', short: 'Kitara', adj: 'kitara', rank: 'kingdom', gov: 'clan_realm',
    culture: 'great_lakes', faith: 'bantu_trad', color: '#6a8a2a', cap: [31.3, 1.4, 'Bigo'], at: [[32.4, 0.3], [30.3, -1.9], [30.8, 0.0], [31.5, -0.8]], reach: 220,
    house: 'Bachwezi', ruler: ['Wamara', 1360, 'M'], title: ['Mukama', 'Mukama'], conf: 'gameplayApproximation',
    note: 'Royaume des Grands Lacs connu par les traditions orales (Bachwezi) ; dirigeant de jeu.',
  }),
  P({
    id: 'kgo', name: 'Royaume du Kongo', short: 'Kongo', adj: 'kongo', rank: 'kingdom', gov: 'clan_realm',
    culture: 'kongo', faith: 'bantu_trad', color: '#b04a2a', cap: [14.25, -6.27, 'Mbanza Kongo'], at: [[14.9, -5.3], [15.6, -5.8], [12.37, -6.13], [14.0, -7.2]], reach: 160,
    house: 'Kilukeni', ruler: ['Lukeni lua Nimi', 1367, 'M'], title: ['Mani Kongo', 'Mani Kongo'], conf: 'low',
    note: 'Fondation traditionnellement datée de la fin du XIVe siècle.',
  }),
  P({
    id: 'loa', name: 'Royaume de Loango', short: 'Loango', adj: 'vili', rank: 'duchy', gov: 'clan_realm',
    culture: 'kongo', faith: 'bantu_trad', color: '#c07a3a', cap: [11.85, -4.65, 'Buali'], at: [[12.5, -3.5]], reach: 150,
    house: 'Loango', ruler: ['Maloango', 1360, 'M'], title: ['Maloango', 'Maloango'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'tek', name: 'Royaume téké (Anziku)', short: 'Téké', adj: 'téké', rank: 'duchy', gov: 'clan_realm',
    culture: 'kongo', faith: 'bantu_trad', color: '#9a5a2a', cap: [15.3, -3.8, 'Mbe'], at: [[15.8, -2.5]], reach: 180,
    house: 'Makoko', ruler: ['Makoko', 1360, 'M'], title: ['Makoko', 'Makoko'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'lba', name: 'Chefferies luba', short: 'Luba', adj: 'luba', rank: 'duchy', gov: 'chiefdom',
    culture: 'luba', faith: 'bantu_trad', color: '#7a5a2a', cap: [26.0, -8.0, 'Upemba'], at: [[25.0, -6.5], [27.2, -9.2]], reach: 250,
    house: 'Luba', ruler: ['Kongolo', 1360, 'M'], title: ['Mulopwe', 'Mulopwe'], conf: 'gameplayApproximation',
    note: 'Sociétés de la dépression de l’Upemba, avant la formation du royaume luba.',
  }),
  P({
    id: 'zim', name: 'Royaume du Zimbabwe', short: 'Zimbabwe', adj: 'shona', rank: 'kingdom', gov: 'clan_realm',
    culture: 'shona', faith: 'bantu_trad', color: '#8a5a3a', cap: [30.93, -20.27, 'Grand Zimbabwe'], at: [[28.5, -20.1], [31.0, -17.5], [32.5, -19.5], [29.5, -18.5]], reach: 220,
    house: 'Mambo', ruler: ['Mambo', 1360, 'M'], title: ['Mambo', 'Mambo'], conf: 'low',
    note: 'L’apogée du Grand Zimbabwe touche à sa fin ; le commerce de l’or passe par Sofala et Kilwa.',
  }),
  P({
    id: 'can', name: 'Menceyats guanches', short: 'Canaries', adj: 'guanche', rank: 'county', gov: 'chiefdom',
    culture: 'berber', faith: 'west_african', color: '#c0a07a', cap: [-16.5, 28.3, 'Tenerife'], at: [[-15.6, 28.0, 60], [-13.6, 28.9, 60], [-17.9, 28.6, 40]], reach: 40,
    house: 'Guanche', ruler: ['Tinerfe', 1360, 'M'], title: ['Mencey', 'Mencey'], conf: 'gameplayApproximation',
    note: 'Religion guanche propre ; rattachée aux cultes africains pour le jeu. La conquête castillane commence en 1402.',
  }),
] satisfies ReturnType<typeof P>[];
