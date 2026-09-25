/**
 * Asie orientale et du Sud-Est au 1er janvier 1400. La Chine est en pleine
 * guerre du Jingnan : le prince de Yan (Zhu Di) marche contre son neveu
 * l'empereur Jianwen.
 */
import { P } from './polity-types';

export const POLITIES_EAST_ASIA = [
  P({
    id: 'ming', name: 'Empire des Ming', short: 'Ming', adj: 'chinois', rank: 'empire', gov: 'imperial_bureaucracy',
    culture: 'han', faith: 'sanjiao', color: '#c8323a', cap: [118.78, 32.06, 'Yingtian'],
    at: [[120.15, 30.27], [120.62, 31.3], [114.3, 30.55], [112.94, 28.23], [115.86, 28.68], [119.3, 26.08], [113.26, 23.13], [110.29, 25.27], [104.07, 30.67], [106.55, 29.56], [102.83, 24.88], [106.71, 26.58], [108.94, 34.26], [103.83, 36.06], [114.31, 34.8], [117.0, 36.67], [112.55, 37.87], [112.45, 34.62], [117.28, 31.86], [112.14, 32.04], [114.93, 25.83], [110.35, 20.02, 120], [106.27, 38.47], [98.5, 39.74], [100.0, 36.5], [123.17, 41.27], [109.5, 22.8], [116.7, 23.4], [121.0, 28.5], [117.5, 27.3], [111.0, 30.5], [105.5, 32.5], [101.5, 30.0], [99.0, 25.5], [103.5, 27.0], [110.0, 27.5], [104.5, 23.5], [108.0, 24.5], [119.5, 34.5], [116.0, 33.0], [113.5, 36.0], [111.0, 36.0], [107.0, 37.5], [118.5, 29.5]],
    w: 1.3, reach: 400, house: 'Zhu', ruler: ['Yunwen', 1377, 'M', 'Jianwen'], spouse: ['Ma', 1378, 'F'], kids: [['Wenkui', 1396]],
    title: ['Empereur', 'Impératrice'], conf: 'high',
    note: 'Le jeune empereur Jianwen a voulu réduire les apanages de ses oncles ; le prince de Yan s’est révolté en 1399.',
  }),
  P({
    id: 'yan', name: 'Principauté de Yan', short: 'Yan', adj: 'de Yan', rank: 'kingdom', gov: 'imperial_bureaucracy',
    culture: 'han', faith: 'sanjiao', color: '#8a1e2e', cap: [116.4, 39.9, 'Beiping'], at: [[118.9, 39.9], [115.04, 40.61], [115.46, 38.87], [117.2, 39.1], [116.9, 40.9]], reach: 140,
    house: 'Zhu', ruler: ['Di', 1360, 'M'], spouse: ['Xu', 1362, 'F'], kids: [['Gaochi', 1378], ['Gaoxu', 1380], ['Gaosui', 1383]],
    title: ['Prince', 'Princesse'], conf: 'high',
    note: 'Zhu Di, quatrième fils de l’empereur Hongwu, conteste le trône de son neveu ; il le prendra en 1402 (empereur Yongle).',
  }),
  P({
    id: 'nyu', name: 'Yuan du Nord', short: 'Yuan du Nord', adj: 'mongol', rank: 'empire', gov: 'steppe_confederation',
    culture: 'mongol', faith: 'vajrayana', color: '#5a6a9a', cap: [102.83, 47.2, 'Karakorum'],
    at: [[115.0, 47.5], [106.9, 47.9], [116.2, 42.35], [111.0, 44.5], [120.0, 45.0], [110.0, 47.5], [104.0, 44.0], [118.0, 49.5], [98.5, 50.0], [108.0, 42.0]],
    w: 1.1, reach: 500, house: 'Borjigin', ruler: ['Gün Temür', 1377, 'M'], title: ['Khagan', 'Khatun'], conf: 'medium',
    note: 'Les khagans gengiskhanides sont contestés par les Oïrats, qui ont tué Elbeg en 1399.',
  }),
  P({
    id: 'oir', name: 'Quatre Oïrats', short: 'Oïrats', adj: 'oïrat', rank: 'kingdom', gov: 'steppe_confederation',
    culture: 'oirat', faith: 'tengri', color: '#7a8ab0', cap: [92.0, 48.0, 'Khovd'], at: [[88.0, 49.5], [95.5, 49.8], [90.0, 46.5], [85.0, 47.5]], reach: 400,
    house: 'Choros', ruler: ['Ugetchi Khashikha', 1370, 'M'], title: ['Taïchi', 'Taïchi'], conf: 'medium',
  }),
  P({
    id: 'kml', name: 'Principauté de Kumul', short: 'Kumul', adj: 'kumuli', rank: 'county', gov: 'steppe_confederation',
    culture: 'uyghur', faith: 'sunni', color: '#a09ac0', cap: [93.51, 42.82, 'Kumul'], reach: 150,
    house: 'Tchaghataïdes', ruler: ['Engke Temür', 1360, 'M'], title: ['Prince', 'Princesse'], liege: 'ming', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'jur', name: 'Tribus jurchens', short: 'Jurchens', adj: 'jurchen', rank: 'duchy', gov: 'tribal_confederation',
    culture: 'jurchen', faith: 'tengri', color: '#4a8a6a', cap: [127.0, 43.5, 'Jianzhou'], at: [[126.5, 45.8], [129.5, 44.5], [125.0, 47.5], [131.0, 46.0], [128.0, 42.5]], reach: 250,
    house: 'Gioro', ruler: ['Ahacu', 1360, 'M'], title: ['Beile', 'Beile'], conf: 'low',
    note: 'Tribus de Jianzhou, Haixi et des « Jurchens sauvages » ; chef de jeu.',
  }),
  P({
    id: 'jos', name: 'Royaume de Joseon', short: 'Joseon', adj: 'coréen', rank: 'kingdom', gov: 'centralized_monarchy',
    culture: 'korean', faith: 'sanjiao', color: '#3a5ab8', cap: [126.55, 37.97, 'Kaesong'], at: [[126.98, 37.57], [125.75, 39.03], [127.54, 39.92], [129.22, 35.86], [127.15, 35.82], [126.85, 35.16], [127.93, 36.99], [128.6, 38.2], [129.7, 41.5], [126.5, 40.9]],
    w: 1.1, reach: 200, house: 'Yi', ruler: ['Banggwa', 1357, 'M', 'Jeongjong'], spouse: ['Jeongan', 1355, 'F'], title: ['Roi', 'Reine'], liege: 'ming', subject: 'tributary', conf: 'high',
    note: 'Jeongjong règne à l’ombre de son frère Yi Bang-won, qui l’obligera à abdiquer en novembre 1400.',
  }),
  P({
    id: 'jpn', name: 'Shogunat Ashikaga', short: 'Japon', adj: 'japonais', rank: 'empire', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#c84a6a', cap: [135.77, 35.01, 'Kyōto'], at: [[135.8, 34.68], [135.5, 34.7], [136.2, 34.7], [134.2, 35.0]], reach: 120,
    house: 'Ashikaga', ruler: ['Yoshimitsu', 1358, 'M'], kids: [['Yoshimochi', 1386], ['Yoshinori', 1394]], title: ['Shōgun', 'Shōgun'], conf: 'high',
    note: 'Shōgun retiré mais maître du pays ; son fils Yoshimochi porte le titre. Il vient d’écraser la révolte d’Ōuchi Yoshihiro (Ōei, décembre 1399).',
  }),
  P({
    id: 'kan', name: 'Kantō-fu (Kamakura)', short: 'Kantō', adj: 'du Kantō', rank: 'kingdom', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#e07a8a', cap: [139.55, 35.32, 'Kamakura'], at: [[139.7, 35.7], [139.9, 36.4], [140.3, 35.6], [138.9, 36.4], [140.2, 36.6]], reach: 120,
    house: 'Ashikaga', ruler: ['Mitsukane', 1378, 'M'], title: ['Kubō', 'Kubō'], liege: 'jpn', subject: 'autonomous_vassal', conf: 'high',
  }),
  P({
    id: 'ouc', name: 'Clan Ōuchi', short: 'Ōuchi', adj: 'ōuchi', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#8a3a4a', cap: [131.47, 34.18, 'Yamaguchi'], at: [[131.0, 34.4], [130.4, 33.6]], reach: 90,
    house: 'Ōuchi', ruler: ['Moriharu', 1377, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'autonomous_vassal', conf: 'medium',
  }),
  P({
    id: 'szu', name: 'Clan Shimazu', short: 'Shimazu', adj: 'shimazu', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#5a5a8a', cap: [130.55, 31.6, 'Kagoshima'], at: [[131.0, 32.0]], reach: 90,
    house: 'Shimazu', ruler: ['Motohisa', 1363, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'autonomous_vassal', conf: 'medium',
  }),
  P({
    id: 'kyu', name: 'Kyūshū tandai', short: 'Kyūshū', adj: 'kyūshūen', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#7a6a9a', cap: [130.7, 32.8, 'Kumamoto'], at: [[131.6, 33.2], [129.9, 33.2]], reach: 90,
    house: 'Shibukawa', ruler: ['Mitsuyori', 1372, 'M'], title: ['Tandai', 'Tandai'], liege: 'jpn', subject: 'direct_vassal', conf: 'medium',
  }),
  P({
    id: 'hos', name: 'Clan Hosokawa', short: 'Hosokawa', adj: 'hosokawa', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#3a7a5a', cap: [134.0, 34.3, 'Sanuki'], at: [[134.5, 34.0], [133.5, 33.5], [132.8, 33.8]], reach: 90,
    house: 'Hosokawa', ruler: ['Mitsumoto', 1378, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'direct_vassal', conf: 'medium',
  }),
  P({
    id: 'shb', name: 'Clan Shiba', short: 'Shiba', adj: 'shiba', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#6a8a3a', cap: [136.2, 36.06, 'Echizen'], at: [[136.9, 35.2], [137.2, 36.7]], reach: 90,
    house: 'Shiba', ruler: ['Yoshimasa', 1350, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'direct_vassal', conf: 'medium',
  }),
  P({
    id: 'hat', name: 'Clan Hatakeyama', short: 'Hatakeyama', adj: 'hatakeyama', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#9a7a3a', cap: [135.6, 34.5, 'Kawachi'], at: [[135.4, 33.9], [136.8, 36.6]], reach: 70,
    house: 'Hatakeyama', ruler: ['Motokuni', 1352, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'direct_vassal', conf: 'medium',
  }),
  P({
    id: 'ymn', name: 'Clan Yamana', short: 'Yamana', adj: 'yamana', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#aa5a3a', cap: [134.8, 35.4, 'Tajima'], at: [[133.5, 35.4], [132.5, 34.9]], reach: 80,
    house: 'Yamana', ruler: ['Tokihiro', 1367, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'direct_vassal', conf: 'medium',
  }),
  P({
    id: 'aka', name: 'Clan Akamatsu', short: 'Akamatsu', adj: 'akamatsu', rank: 'county', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#d0603a', cap: [134.69, 34.83, 'Harima'], reach: 60,
    house: 'Akamatsu', ruler: ['Yoshinori', 1358, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'direct_vassal', conf: 'medium',
  }),
  P({
    id: 'ima', name: 'Clan Imagawa', short: 'Imagawa', adj: 'imagawa', rank: 'county', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#5a9ab0', cap: [138.38, 34.97, 'Suruga'], at: [[137.7, 34.8]], reach: 70,
    house: 'Imagawa', ruler: ['Yasunori', 1333, 'M'], title: ['Shugo', 'Shugo'], liege: 'jpn', subject: 'direct_vassal', conf: 'medium',
  }),
  P({
    id: 'dat', name: 'Clan Date', short: 'Date', adj: 'date', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#3a3a6a', cap: [140.47, 37.75, 'Mutsu'], at: [[140.9, 38.3], [140.1, 38.9], [141.1, 39.7]], reach: 120,
    house: 'Date', ruler: ['Masamune', 1353, 'M'], title: ['Seigneur', 'Dame'], liege: 'kan', subject: 'autonomous_vassal', conf: 'medium',
  }),
  P({
    id: 'nan', name: 'Clans du Nord (Nanbu et Andō)', short: 'Nanbu', adj: 'nanbu', rank: 'duchy', gov: 'warrior_shogunate',
    culture: 'japanese', faith: 'shinbutsu', color: '#6a5a4a', cap: [141.15, 40.5, 'Sannohe'], at: [[140.47, 40.82], [141.5, 39.7]], reach: 100,
    house: 'Nanbu', ruler: ['Moriyuki', 1359, 'M'], title: ['Seigneur', 'Dame'], liege: 'jpn', subject: 'autonomous_vassal', conf: 'low',
  }),
  P({
    id: 'ain', name: 'Pays aïnous (Ezo)', short: 'Ezo', adj: 'aïnou', rank: 'duchy', gov: 'chiefdom',
    culture: 'ainu', faith: 'siberian', color: '#8aa0a0', cap: [141.35, 43.06, 'Ishikari'], at: [[143.2, 42.9], [144.4, 43.6], [140.7, 41.8], [142.5, 44.6], [142.8, 47.0]], reach: 250,
    house: 'Ishikari', ruler: ['Kotan', 1360, 'M'], title: ['Kotan-koro-kur', 'Kotan-koro-kur'], conf: 'gameplayApproximation',
  }),
  P({
    id: 'chz', name: 'Royaume de Chūzan', short: 'Chūzan', adj: 'ryūkyūan', rank: 'county', gov: 'feudal_monarchy',
    culture: 'ryukyuan', faith: 'shinbutsu', color: '#d85a8a', cap: [127.72, 26.25, 'Urasoe'], at: [[124.2, 24.4, 120]], reach: 80,
    house: 'Satto', ruler: ['Bunei', 1356, 'M'], title: ['Roi', 'Reine'], liege: 'ming', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'hkz', name: 'Royaume de Hokuzan', short: 'Hokuzan', adj: 'ryūkyūan', rank: 'county', gov: 'feudal_monarchy',
    culture: 'ryukyuan', faith: 'shinbutsu', color: '#a85a8a', cap: [127.93, 26.69, 'Nakijin'], at: [[129.4, 28.3, 80]], reach: 50,
    house: 'Hananchi', ruler: ['Hananchi', 1360, 'M'], title: ['Roi', 'Reine'], liege: 'ming', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'dvt', name: 'Royaume de Đại Việt', short: 'Đại Việt', adj: 'viêt', rank: 'kingdom', gov: 'centralized_monarchy',
    culture: 'viet', faith: 'mahayana', color: '#d8a03a', cap: [105.6, 20.08, 'Tây Đô'], at: [[105.85, 21.03], [105.68, 18.67], [107.58, 16.46], [106.76, 21.85], [104.9, 21.7], [106.3, 17.5]], reach: 130,
    house: 'Hồ', ruler: ['Quý Ly', 1336, 'M'], kids: [['Nguyên Trừng', 1374], ['Hán Thương', 1375]], title: ['Régent', 'Régente'], conf: 'high',
    note: 'Hồ Quý Ly, régent du jeune roi Trần Thiếu Đế, s’emparera du trône en mars 1400.',
  }),
  P({
    id: 'cha', name: 'Royaume du Champa', short: 'Champa', adj: 'cham', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'cham', faith: 'hindu', color: '#3a9ab0', cap: [109.0, 13.9, 'Vijaya'], at: [[108.98, 11.56], [109.19, 12.24], [108.3, 15.88], [108.0, 13.5]], reach: 110,
    house: 'Vijaya', ruler: ['Jaya Simhavarman', 1340, 'M', 'VI'], title: ['Roi', 'Reine'], conf: 'medium',
  }),
  P({
    id: 'khm', name: 'Royaume khmer', short: 'Cambodge', adj: 'khmer', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'khmer', faith: 'theravada', color: '#a05a3a', cap: [103.86, 13.41, 'Yasodharapura'], at: [[105.1, 11.9], [103.2, 13.1], [106.66, 10.78], [104.9, 12.6], [105.6, 10.3], [106.0, 14.0]], reach: 160,
    house: 'Varman', ruler: ['Barom Reachea', 1350, 'M'], title: ['Roi', 'Reine'], conf: 'low',
    note: 'Chronologie royale incertaine vers 1400 ; Angkor est menacée par Ayutthaya.',
  }),
  P({
    id: 'ayu', name: 'Royaume d’Ayutthaya', short: 'Ayutthaya', adj: 'siamois', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'thai', faith: 'theravada', color: '#c8603a', cap: [100.57, 14.35, 'Ayutthaya'], at: [[100.62, 14.8], [100.12, 14.47], [99.96, 8.43], [102.1, 12.6], [99.5, 13.5], [101.0, 13.3], [99.3, 10.5], [100.4, 7.0, 80]], reach: 180,
    house: 'Suphannaphum', ruler: ['Ramrachathirat', 1356, 'M'], title: ['Roi', 'Reine'], conf: 'medium',
  }),
  P({
    id: 'suk', name: 'Royaume de Sukhothaï', short: 'Sukhothaï', adj: 'sukhothaïen', rank: 'duchy', gov: 'mandala_kingdom',
    culture: 'thai', faith: 'theravada', color: '#e0903a', cap: [99.82, 17.01, 'Sukhothaï'], at: [[100.26, 16.82], [99.5, 16.5]], reach: 90,
    house: 'Phra Ruang', ruler: ['Maha Thammaracha', 1360, 'M', 'III'], title: ['Roi', 'Reine'], liege: 'ayu', subject: 'tributary', conf: 'medium',
  }),
  P({
    id: 'lna', name: 'Royaume de Lan Na', short: 'Lan Na', adj: 'yuan', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'lanna', faith: 'theravada', color: '#b07a3a', cap: [98.98, 18.79, 'Chiang Mai'], at: [[99.83, 19.91], [99.5, 18.3], [100.1, 20.3], [100.8, 18.8]], reach: 110,
    house: 'Mangrai', ruler: ['Saen Mueang Ma', 1362, 'M'], title: ['Roi', 'Reine'], conf: 'medium',
  }),
  P({
    id: 'lxg', name: 'Royaume de Lan Xang', short: 'Lan Xang', adj: 'lao', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'lao', faith: 'theravada', color: '#8a3a6a', cap: [102.13, 19.89, 'Xieng Dong Xieng Thong'], at: [[102.6, 17.97], [103.2, 19.45], [105.87, 14.88], [104.8, 16.5], [101.4, 20.6], [102.9, 16.4]], reach: 150,
    house: 'Khun Lo', ruler: ['Samsenthai', 1356, 'M'], title: ['Roi', 'Reine'], conf: 'medium',
  }),
  P({
    id: 'ava', name: 'Royaume d’Ava', short: 'Ava', adj: 'birman', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'burmese', faith: 'theravada', color: '#d0a040', cap: [95.99, 21.86, 'Ava'], at: [[94.86, 21.17], [95.22, 18.82], [96.43, 18.94], [95.5, 23.0], [94.4, 20.2], [96.1, 20.7]], reach: 130,
    house: 'Ava', ruler: ['Swa Saw Ke', 1330, 'M'], kids: [['Tarabya', 1368], ['Minkhaung', 1373]], title: ['Roi', 'Reine'], conf: 'high',
    note: 'Swa Saw Ke meurt en avril 1400 ; la guerre de Quarante Ans contre Hanthawaddy reprend.',
  }),
  P({
    id: 'peg', name: 'Royaume d’Hanthawaddy', short: 'Pégou', adj: 'môn', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'mon', faith: 'theravada', color: '#3a8ac0', cap: [96.48, 17.34, 'Pégou'], at: [[97.59, 16.53], [94.73, 16.78], [96.16, 16.8], [98.2, 15.0]], reach: 120,
    house: 'Wareru', ruler: ['Razadarit', 1368, 'M'], title: ['Roi', 'Reine'], conf: 'high',
  }),
  P({
    id: 'rkh', name: 'Royaume d’Arakan', short: 'Arakan', adj: 'arakanais', rank: 'duchy', gov: 'mandala_kingdom',
    culture: 'burmese', faith: 'theravada', color: '#6a9a3a', cap: [93.12, 20.62, 'Launggyet'], at: [[94.3, 18.5]], reach: 100,
    house: 'Launggyet', ruler: ['Min Saw Mon', 1380, 'M'], title: ['Roi', 'Reine'], conf: 'low',
  }),
  P({
    id: 'mmo', name: 'Principautés shan du Nord', short: 'Mong Mao', adj: 'shan', rank: 'duchy', gov: 'clan_realm',
    culture: 'shan', faith: 'theravada', color: '#7ab05a', cap: [98.58, 24.43, 'Mong Mao'], at: [[97.96, 23.3], [96.6, 24.9], [97.3, 22.6], [98.2, 21.2]], reach: 150,
    house: 'Si', ruler: ['Si Xingfa', 1370, 'M'], title: ['Saopha', 'Mahadevi'], liege: 'ming', subject: 'tributary', conf: 'low',
  }),
  P({
    id: 'maj', name: 'Empire de Majapahit', short: 'Majapahit', adj: 'javanais', rank: 'empire', gov: 'mandala_kingdom',
    culture: 'javanese', faith: 'hindu', color: '#b0302a', cap: [112.38, -7.55, 'Trowulan'], at: [[112.75, -7.25], [112.05, -6.9], [112.0, -7.82], [113.2, -7.05], [110.4, -7.0], [111.0, -7.6], [104.75, -2.99, 150], [114.59, -3.32, 150], [109.3, -7.4]],
    w: 1.1, reach: 150, house: 'Rajasa', ruler: ['Wikramawardhana', 1360, 'M'], spouse: ['Kusumawardhani', 1365, 'F'], title: ['Maharaja', 'Maharani'], conf: 'medium',
    note: 'L’empire tient Java et des comptoirs dans l’archipel ; la cour orientale de Wirabhumi prépare la guerre du Paregreg (1404).',
  }),
  P({
    id: 'wir', name: 'Cour orientale de Wirabhumi', short: 'Blambangan', adj: 'blambangan', rank: 'duchy', gov: 'mandala_kingdom',
    culture: 'javanese', faith: 'hindu', color: '#d05a4a', cap: [114.2, -8.3, 'Blambangan'], at: [[113.7, -8.2]], reach: 70,
    house: 'Rajasa', ruler: ['Wirabhumi', 1350, 'M'], title: ['Bhre', 'Bhre'], liege: 'maj', subject: 'autonomous_vassal', conf: 'medium',
  }),
  P({
    id: 'bal', name: 'Royaume de Bali', short: 'Bali', adj: 'balinais', rank: 'county', gov: 'mandala_kingdom',
    culture: 'javanese', faith: 'hindu', color: '#e07a5a', cap: [115.4, -8.53, 'Samprangan'], at: [[116.3, -8.6, 80]], reach: 60,
    house: 'Kepakisan', ruler: ['Ketut', 1370, 'M'], title: ['Dalem', 'Dalem'], liege: 'maj', subject: 'direct_vassal', conf: 'low',
  }),
  P({
    id: 'snd2', name: 'Royaume de Sunda', short: 'Sunda', adj: 'soundanais', rank: 'kingdom', gov: 'mandala_kingdom',
    culture: 'sundanese', faith: 'hindu', color: '#5a9a5a', cap: [106.8, -6.6, 'Pakuan'], at: [[106.15, -6.02], [106.81, -6.13], [107.6, -6.9], [108.3, -7.3]], reach: 110,
    house: 'Sunda', ruler: ['Niskala Wastu Kancana', 1348, 'M'], title: ['Prabu', 'Prabu'], conf: 'medium',
  }),
  P({
    id: 'pas', name: 'Sultanat de Samudera Pasai', short: 'Pasai', adj: 'pasai', rank: 'duchy', gov: 'merchant_republic',
    culture: 'malay', faith: 'sunni', color: '#2a8a5a', cap: [97.1, 5.17, 'Pasai'], at: [[95.32, 5.55], [98.7, 3.6]], reach: 150,
    house: 'Pasai', ruler: ['Zainal Abidin', 1360, 'M'], title: ['Sultan', 'Sultane'], conf: 'medium',
  }),
  P({
    id: 'mlk', name: 'Malacca', short: 'Malacca', adj: 'malacquais', rank: 'county', gov: 'merchant_republic',
    culture: 'malay', faith: 'hindu', color: '#6ab03a', cap: [102.25, 2.2, 'Malacca'], at: [[101.4, 3.0]], reach: 80,
    house: 'Parameswara', ruler: ['Parameswara', 1344, 'M'], title: ['Raja', 'Rani'], conf: 'medium',
    note: 'Prince de Singapura chassé vers 1398, il fonde Malacca vers 1400 ; il se convertira plus tard à l’islam.',
  }),
  P({
    id: 'pah', name: 'Royaume de Pahang', short: 'Pahang', adj: 'pahang', rank: 'county', gov: 'mandala_kingdom',
    culture: 'malay', faith: 'hindu', color: '#8ac05a', cap: [103.33, 3.8, 'Pahang'], at: [[102.5, 4.5], [103.9, 1.5]], reach: 120,
    house: 'Pahang', ruler: ['Maharaja Dewa Sura', 1360, 'M'], title: ['Maharaja', 'Maharani'], liege: 'ayu', subject: 'tributary', conf: 'low',
  }),
  P({
    id: 'ked', name: 'Kedah', short: 'Kedah', adj: 'kedahan', rank: 'county', gov: 'mandala_kingdom',
    culture: 'malay', faith: 'sunni', color: '#5ab08a', cap: [100.37, 6.12, 'Kedah'], at: [[101.3, 6.5]], reach: 90,
    house: 'Kedah', ruler: ['Sulaiman', 1360, 'M'], title: ['Sultan', 'Sultane'], liege: 'ayu', subject: 'tributary', conf: 'low',
  }),
  P({
    id: 'brn', name: 'Royaume de Brunei', short: 'Brunei', adj: 'brunéien', rank: 'duchy', gov: 'mandala_kingdom',
    culture: 'malay', faith: 'sunni', color: '#e0c03a', cap: [114.94, 4.89, 'Brunei'], at: [[116.07, 5.98], [113.0, 3.2], [110.3, 1.55]], reach: 150,
    house: 'Bolkiah', ruler: ['Muhammad Chah', 1350, 'M'], title: ['Sultan', 'Sultane'], conf: 'low',
  }),
  P({
    id: 'sul', name: 'Principauté de Soulou', short: 'Soulou', adj: 'tausug', rank: 'county', gov: 'mandala_kingdom',
    culture: 'philippine', faith: 'sunni', color: '#3ab08a', cap: [121.0, 6.05, 'Jolo'], at: [[122.08, 6.9, 60]], reach: 80,
    house: 'Baguinda', ruler: ['Baguinda', 1360, 'M'], title: ['Rajah', 'Rajah'], conf: 'low',
  }),
  P({
    id: 'tnd', name: 'Royaume de Tondo', short: 'Tondo', adj: 'tagalog', rank: 'county', gov: 'mandala_kingdom',
    culture: 'philippine', faith: 'polynesian', color: '#b0a05a', cap: [120.97, 14.62, 'Tondo'], at: [[121.2, 14.0], [120.6, 15.5]], reach: 120,
    house: 'Lakandula', ruler: ['Gambang', 1360, 'M'], title: ['Lakan', 'Dayang'], conf: 'low',
    note: 'Croyances anitistes des Tagalogs rattachées aux traditions austronésiennes du Pacifique pour le jeu.',
  }),
  P({
    id: 'but', name: 'Rajahnat de Butuan', short: 'Butuan', adj: 'butuanon', rank: 'county', gov: 'mandala_kingdom',
    culture: 'philippine', faith: 'hindu', color: '#c08a4a', cap: [125.54, 8.95, 'Butuan'], at: [[123.9, 10.3], [125.0, 11.2]], reach: 140,
    house: 'Butuan', ruler: ['Kiling', 1360, 'M'], title: ['Rajah', 'Rajah'], conf: 'low',
  }),
  P({
    id: 'ter', name: 'Royaume de Ternate', short: 'Ternate', adj: 'ternatais', rank: 'county', gov: 'mandala_kingdom',
    culture: 'bugis', faith: 'polynesian', color: '#d0703a', cap: [127.38, 0.79, 'Ternate'], at: [[127.9, 1.3, 90], [128.2, -3.6, 90]], reach: 60,
    house: 'Ternate', ruler: ['Komala', 1360, 'M'], title: ['Kolano', 'Kolano'], conf: 'low',
    note: 'Royaume des girofliers ; islamisation au cours du XVe siècle.',
  }),
  P({
    id: 'luw', name: 'Royaume de Luwu', short: 'Luwu', adj: 'bugis', rank: 'duchy', gov: 'mandala_kingdom',
    culture: 'bugis', faith: 'polynesian', color: '#a05a8a', cap: [120.2, -3.0, 'Luwu'], at: [[119.43, -5.2], [120.1, -4.5], [121.5, -3.9]], reach: 160,
    house: 'Luwu', ruler: ['Datu', 1360, 'M'], title: ['Datu', 'Datu'], conf: 'low',
  }),
  P({
    id: 'kut', name: 'Royaume de Kutai', short: 'Kutai', adj: 'kutai', rank: 'county', gov: 'mandala_kingdom',
    culture: 'malay', faith: 'hindu', color: '#b0b05a', cap: [116.99, -0.43, 'Kutai'], reach: 150,
    house: 'Kartanegara', ruler: ['Aji', 1360, 'M'], title: ['Aji', 'Aji'], conf: 'low',
  }),
] satisfies ReturnType<typeof P>[];
