/**
 * Amériques et Océanie au 1er janvier 1400. Les sources sur les dirigeants
 * sont surtout postérieures (codex, chroniques coloniales, traditions
 * orales) : la plupart des entrées sont « low » ou « gameplayApproximation ».
 * Les peuples non listés sont regroupés par le générateur (voir WORLD_1400.md).
 */
import { P } from './polity-types';

export const POLITIES_AMERICAS = [
  P({
    id: 'aze', name: 'Seigneurie tépanèque d’Azcapotzalco', short: 'Azcapotzalco', adj: 'tépanèque', rank: 'kingdom', gov: 'tributary_empire',
    culture: 'nahua', faith: 'mesoamerican', color: '#3a8a8a', cap: [-99.18, 19.49, 'Azcapotzalco'], at: [[-99.66, 19.29], [-99.23, 18.92], [-99.3, 19.9], [-98.7, 20.1]], reach: 110,
    house: 'Tépanèque', ruler: ['Tezozomoc', 1320, 'M'], title: ['Huey tlatoani', 'Huey cihuatlatoani'], conf: 'medium',
    note: 'Hégémonie du bassin de Mexico ; Mexica et Tlatelolca combattent comme tributaires des Tépanèques.',
  }),
  P({
    id: 'tno', name: 'Altepetl de Mexico-Tenochtitlan', short: 'Tenochtitlan', adj: 'mexica', rank: 'county', gov: 'city_state',
    culture: 'nahua', faith: 'mesoamerican', color: '#2a6a6a', cap: [-99.13, 19.43, 'Tenochtitlan'], reach: 20,
    house: 'Acamapichtli', ruler: ['Huitzilihuitl', 1379, 'M'], title: ['Tlatoani', 'Cihuatlatoani'], liege: 'aze', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'txc', name: 'Altepetl de Texcoco', short: 'Texcoco', adj: 'acolhua', rank: 'county', gov: 'city_state',
    culture: 'nahua', faith: 'mesoamerican', color: '#5ab0b0', cap: [-98.88, 19.51, 'Texcoco'], at: [[-98.6, 19.8]], reach: 50,
    house: 'Acolhua', ruler: ['Techotlalatzin', 1350, 'M'], title: ['Tlatoani', 'Cihuatlatoani'], conf: 'medium',
  }),
  P({
    id: 'tlx', name: 'Confédération de Tlaxcala', short: 'Tlaxcala', adj: 'tlaxcaltèque', rank: 'county', gov: 'city_state',
    culture: 'nahua', faith: 'mesoamerican', color: '#b03a3a', cap: [-98.24, 19.31, 'Tlaxcala'], at: [[-98.3, 19.06]], reach: 50,
    house: 'Tizatlan', ruler: ['Xicotencatl', 1360, 'M'], title: ['Tlatoani', 'Cihuatlatoani'], conf: 'low',
  }),
  P({
    id: 'pur', name: 'Royaume purépecha', short: 'Purépecha', adj: 'purépecha', rank: 'kingdom', gov: 'centralized_monarchy',
    culture: 'purepecha', faith: 'mesoamerican', color: '#8a5ab0', cap: [-101.58, 19.63, 'Tzintzuntzan'], at: [[-101.6, 19.51], [-102.3, 19.4], [-100.9, 19.9], [-101.2, 18.9]], reach: 120,
    house: 'Uacúsecha', ruler: ['Hiripan', 1360, 'M'], title: ['Cazonci', 'Cazonci'], conf: 'low',
  }),
  P({
    id: 'mix', name: 'Seigneurie mixtèque de Tututepec', short: 'Tututepec', adj: 'mixtèque', rank: 'duchy', gov: 'tributary_empire',
    culture: 'oaxacan', faith: 'mesoamerican', color: '#c0703a', cap: [-97.61, 16.13, 'Tututepec'], at: [[-97.2, 17.3], [-97.9, 16.6]], reach: 100,
    house: 'Tututepec', ruler: ['Huicacuhtli', 1360, 'M'], title: ['Iya', 'Iyadzehe'], conf: 'low',
  }),
  P({
    id: 'zap', name: 'Seigneurie zapotèque de Zaachila', short: 'Zaachila', adj: 'zapotèque', rank: 'duchy', gov: 'city_state',
    culture: 'oaxacan', faith: 'mesoamerican', color: '#d8a05a', cap: [-96.75, 16.95, 'Zaachila'], at: [[-95.2, 16.3]], reach: 100,
    house: 'Zaachila', ruler: ['Zaachila', 1360, 'M'], title: ['Coquitao', 'Coquitao'], conf: 'low',
  }),
  P({
    id: 'tot', name: 'Seigneuries totonaques', short: 'Totonacapan', adj: 'totonaque', rank: 'duchy', gov: 'city_state',
    culture: 'nahua', faith: 'mesoamerican', color: '#5a9a5a', cap: [-96.39, 19.44, 'Cempoala'], at: [[-97.4, 20.3]], reach: 90,
    house: 'Cempoala', ruler: ['Chicomacatl', 1360, 'M'], title: ['Seigneur', 'Dame'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'myp', name: 'Ligue de Mayapán', short: 'Mayapán', adj: 'maya', rank: 'kingdom', gov: 'city_state',
    culture: 'maya', faith: 'mesoamerican', color: '#3a8a5a', cap: [-89.46, 20.63, 'Mayapán'], at: [[-88.57, 20.68], [-87.5, 20.2], [-90.3, 19.8], [-89.0, 21.2], [-88.3, 18.6]], reach: 150,
    house: 'Cocom', ruler: ['Kukulcan', 1360, 'M'], title: ['Halach uinic', 'Ix halach uinic'], conf: 'medium',
    note: 'Confédération des lignages du Yucatán autour de Mayapán, qui sera détruite vers 1441.',
  }),
  P({
    id: 'kch', name: 'Royaume k’iche’', short: 'K’iche’', adj: 'k’iche’', rank: 'kingdom', gov: 'city_state',
    culture: 'maya', faith: 'mesoamerican', color: '#6ab05a', cap: [-91.16, 15.02, 'Q’umarkaj'], at: [[-90.8, 14.7], [-91.6, 14.9], [-90.2, 15.3]], reach: 110,
    house: 'Kaweq', ruler: ['Q’otuja', 1360, 'M'], title: ['Ajpop', 'Ajpop'], conf: 'low',
  }),
  P({
    id: 'itz', name: 'Royaume itza du Petén', short: 'Itza', adj: 'itza', rank: 'duchy', gov: 'city_state',
    culture: 'maya', faith: 'mesoamerican', color: '#8ac05a', cap: [-89.89, 16.93, 'Nojpetén'], reach: 130,
    house: 'Kan Ek’', ruler: ['Kan Ek’', 1360, 'M'], title: ['Ajaw', 'Ixajaw'], conf: 'low',
  }),
  P({
    id: 'cuz', name: 'Royaume de Cuzco', short: 'Cuzco', adj: 'inca', rank: 'kingdom', gov: 'tributary_empire',
    culture: 'quechua', faith: 'andean', color: '#d8a030', cap: [-71.97, -13.53, 'Qusqu'], at: [[-72.4, -13.3], [-71.6, -13.9]], reach: 90,
    house: 'Hurin Qusqu', ruler: ['Yawar Waqaq', 1360, 'M'], title: ['Sapa Inka', 'Quya'], conf: 'low',
    note: 'Les Incas ne sont encore qu’une puissance régionale ; l’expansion commencera avec Pachacutec (vers 1438).',
  }),
  P({
    id: 'chk', name: 'Confédération chanka', short: 'Chanka', adj: 'chanka', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'quechua', faith: 'andean', color: '#8a3a3a', cap: [-73.38, -13.66, 'Andahuaylas'], at: [[-74.2, -13.2]], reach: 100,
    house: 'Chanka', ruler: ['Uscovilca', 1360, 'M'], title: ['Kuraka', 'Kuraka'], conf: 'low',
  }),
  P({
    id: 'cla', name: 'Royaume colla', short: 'Colla', adj: 'colla', rank: 'duchy', gov: 'clan_realm',
    culture: 'aymara', faith: 'andean', color: '#5a5ab0', cap: [-70.2, -15.2, 'Hatun Colla'], at: [[-69.5, -14.8]], reach: 110,
    house: 'Colla', ruler: ['Colla Capac', 1360, 'M'], title: ['Kuraka', 'Kuraka'], conf: 'low',
  }),
  P({
    id: 'lup', name: 'Royaume lupaca', short: 'Lupaca', adj: 'lupaca', rank: 'duchy', gov: 'clan_realm',
    culture: 'aymara', faith: 'andean', color: '#7a7ac0', cap: [-69.89, -16.21, 'Chucuito'], at: [[-68.7, -16.6], [-67.1, -17.97]], reach: 130,
    house: 'Cari', ruler: ['Cari', 1360, 'M'], title: ['Kuraka', 'Kuraka'], conf: 'low',
  }),
  P({
    id: 'chm', name: 'Royaume de Chimor', short: 'Chimor', adj: 'chimú', rank: 'kingdom', gov: 'centralized_monarchy',
    culture: 'chimu', faith: 'andean', color: '#3a6ab0', cap: [-79.07, -8.11, 'Chan Chan'], at: [[-79.9, -6.7], [-78.3, -9.47], [-77.8, -10.67], [-80.6, -5.2], [-78.5, -7.2]], reach: 130,
    house: 'Taycanamo', ruler: ['Nancenpinco', 1350, 'M'], title: ['Ciquic', 'Ciquic'], conf: 'medium',
    note: 'Royaume côtier le plus puissant des Andes ; canaux d’irrigation et ateliers d’orfèvrerie.',
  }),
  P({
    id: 'ych', name: 'Seigneurie d’Ychsma', short: 'Ychsma', adj: 'ychsma', rank: 'county', gov: 'theocracy',
    culture: 'chimu', faith: 'andean', color: '#6a9ad0', cap: [-76.9, -12.26, 'Pachacamac'], at: [[-77.0, -12.0]], reach: 70,
    house: 'Ychsma', ruler: ['Taulichusco', 1360, 'M'], title: ['Kuraka', 'Kuraka'], conf: 'low', note: 'Sanctuaire oraculaire de Pachacamac.',
  }),
  P({
    id: 'chn', name: 'Seigneurie de Chincha', short: 'Chincha', adj: 'chincha', rank: 'county', gov: 'merchant_republic',
    culture: 'chimu', faith: 'andean', color: '#9ab0e0', cap: [-76.13, -13.42, 'Chincha'], at: [[-75.7, -14.1]], reach: 80,
    house: 'Chincha', ruler: ['Guavia Rucana', 1360, 'M'], title: ['Kuraka', 'Kuraka'], conf: 'low', note: 'Marchands navigateurs de la côte.',
  }),
  P({
    id: 'hnc', name: 'Seigneuries huanca', short: 'Huanca', adj: 'huanca', rank: 'county', gov: 'clan_realm',
    culture: 'quechua', faith: 'andean', color: '#b07a5a', cap: [-75.2, -12.07, 'Hatun Xauxa'], reach: 90,
    house: 'Huanca', ruler: ['Apo', 1360, 'M'], title: ['Kuraka', 'Kuraka'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'cpy', name: 'Confédération chachapoya', short: 'Chachapoya', adj: 'chachapoya', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'quechua', faith: 'andean', color: '#4a8a4a', cap: [-77.87, -6.23, 'Kuélap'], at: [[-77.4, -7.0]], reach: 110,
    house: 'Chachapoya', ruler: ['Chuquimis', 1360, 'M'], title: ['Kuraka', 'Kuraka'], conf: 'low',
  }),
  P({
    id: 'qui', name: 'Confédération de Quito', short: 'Quito', adj: 'quitu', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'quechua', faith: 'andean', color: '#3a9a8a', cap: [-78.5, -0.2, 'Quito'], at: [[-78.9, -2.9], [-78.2, 0.8], [-79.9, -2.2]], reach: 130,
    house: 'Shyri', ruler: ['Hualcopo', 1360, 'M'], title: ['Shyri', 'Shyri'], conf: 'gameplayApproximation',
    note: 'Peuples cara, quitu et cañari regroupés ; les listes « shyri » sont d’une fiabilité très discutée.',
  }),
  P({
    id: 'zip', name: 'Zipazgo de Bacatá', short: 'Bacatá', adj: 'muisca', rank: 'duchy', gov: 'clan_realm',
    culture: 'muisca', faith: 'south_american', color: '#d0b03a', cap: [-74.07, 4.71, 'Bacatá'], at: [[-74.3, 5.2]], reach: 90,
    house: 'Zipa', ruler: ['Saguamanchica', 1360, 'M'], title: ['Zipa', 'Zipa'], conf: 'low',
  }),
  P({
    id: 'zaq', name: 'Zacazgo de Hunza', short: 'Hunza', adj: 'muisca', rank: 'county', gov: 'clan_realm',
    culture: 'muisca', faith: 'south_american', color: '#e0c05a', cap: [-73.36, 5.53, 'Hunza'], reach: 80,
    house: 'Zaque', ruler: ['Michuá', 1360, 'M'], title: ['Zaque', 'Zaque'], conf: 'low',
  }),
  P({
    id: 'tay', name: 'Chefferies tairona', short: 'Tairona', adj: 'tairona', rank: 'county', gov: 'chiefdom',
    culture: 'muisca', faith: 'south_american', color: '#8ab05a', cap: [-73.9, 11.1, 'Ciudad Perdida'], reach: 100,
    house: 'Tairona', ruler: ['Naoma', 1360, 'M'], title: ['Naoma', 'Naoma'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'hai', name: 'Cacicazgos d’Ayiti', short: 'Ayiti', adj: 'taïno', rank: 'duchy', gov: 'chiefdom',
    culture: 'taino', faith: 'south_american', color: '#3ab0a0', cap: [-71.0, 19.0, 'Maguana'], at: [[-72.3, 18.6], [-69.9, 18.5], [-70.7, 19.6]], reach: 150,
    house: 'Maguana', ruler: ['Cacique', 1360, 'M'], title: ['Cacique', 'Cacica'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'coo', name: 'Chefferie de Coosa', short: 'Coosa', adj: 'coosa', rank: 'duchy', gov: 'chiefdom',
    culture: 'mississippian', faith: 'north_american', color: '#b07a3a', cap: [-84.8, 34.6, 'Coosa'], at: [[-85.7, 34.0], [-84.0, 33.9]], reach: 140,
    house: 'Coosa', ruler: ['Coosa', 1360, 'M'], title: ['Mico', 'Mico'], conf: 'low',
  }),
  P({
    id: 'mdv', name: 'Chefferie de Moundville', short: 'Moundville', adj: 'mississippien', rank: 'duchy', gov: 'chiefdom',
    culture: 'mississippian', faith: 'north_american', color: '#9a6a3a', cap: [-87.63, 33.0, 'Moundville'], reach: 130,
    house: 'Moundville', ruler: ['Tascalusa', 1360, 'M'], title: ['Mico', 'Mico'], conf: 'low', note: 'Centre en déclin vers 1400.',
  }),
  P({
    id: 'apa', name: 'Chefferie apalachee', short: 'Apalachee', adj: 'apalachee', rank: 'county', gov: 'chiefdom',
    culture: 'mississippian', faith: 'north_american', color: '#c09a5a', cap: [-84.3, 30.5, 'Lac Jackson'], reach: 110,
    house: 'Apalachee', ruler: ['Anhaica', 1360, 'M'], title: ['Mico', 'Mico'], conf: 'low',
  }),
  P({
    id: 'nat', name: 'Chefferie natchez', short: 'Natchez', adj: 'natchez', rank: 'county', gov: 'theocracy',
    culture: 'mississippian', faith: 'north_american', color: '#8a5a2a', cap: [-91.4, 31.55, 'Émeraude'], reach: 110,
    house: 'Soleil', ruler: ['Grand Soleil', 1360, 'M'], title: ['Grand Soleil', 'Femme-Chef'], conf: 'low',
  }),
  P({
    id: 'cad', name: 'Confédération caddo', short: 'Caddo', adj: 'caddo', rank: 'duchy', gov: 'chiefdom',
    culture: 'mississippian', faith: 'north_american', color: '#a08a4a', cap: [-94.8, 32.0, 'Hasinai'], at: [[-94.57, 35.3], [-93.6, 33.4]], reach: 160,
    house: 'Hasinai', ruler: ['Xinesi', 1360, 'M'], title: ['Caddi', 'Caddi'], conf: 'low',
  }),
  P({
    id: 'hdn', name: 'Nations iroquoises des Finger Lakes', short: 'Haudenosaunee', adj: 'iroquois', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'iroquoian', faith: 'north_american', color: '#6a3a8a', cap: [-76.1, 43.0, 'Onondaga'], at: [[-75.0, 42.9], [-77.3, 42.8], [-78.0, 42.7]], reach: 120,
    house: 'Onondaga', ruler: ['Tadodaho', 1360, 'M'], title: ['Sachem', 'Mère de clan'], conf: 'low',
    note: 'La date de fondation de la Ligue des Cinq-Nations est débattue (XIIe–XVe siècle).',
  }),
  P({
    id: 'wen', name: 'Nations wendat', short: 'Wendat', adj: 'wendat', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'iroquoian', faith: 'north_american', color: '#8a5aaa', cap: [-79.7, 44.6, 'Wendake'], at: [[-78.5, 44.3]], reach: 110,
    house: 'Attignawantan', ruler: ['Atironta', 1360, 'M'], title: ['Sachem', 'Mère de clan'], conf: 'low',
  }),
  P({
    id: 'haw', name: 'Chefferies d’Hawaiʻi', short: 'Hawaiʻi', adj: 'hawaïen', rank: 'county', gov: 'chiefdom',
    culture: 'polynesian', faith: 'polynesian', color: '#d05a3a', cap: [-155.5, 19.6, 'Hawaiʻi'], at: [[-156.3, 20.8, 80], [-157.9, 21.4, 80], [-159.5, 22.0, 60]], reach: 80,
    house: 'Pili', ruler: ['Kalaunuiohua', 1360, 'M'], title: ['Aliʻi nui', 'Aliʻi nui wahine'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'ton', name: 'Chefferie maritime de Tonga', short: 'Tonga', adj: 'tongien', rank: 'duchy', gov: 'chiefdom',
    culture: 'polynesian', faith: 'polynesian', color: '#b03a5a', cap: [-175.13, -21.18, 'Muʻa'], at: [[-172.0, -13.8, 120], [178.0, -17.8, 150]], reach: 60,
    house: 'Tuʻi Tonga', ruler: ['Tuʻi Tonga', 1360, 'M'], title: ['Tuʻi Tonga', 'Tuʻi Tonga'], conf: 'low',
    note: 'Réseau d’influence maritime vers Samoa et les Fidji (approximation).',
  }),
] satisfies ReturnType<typeof P>[];
