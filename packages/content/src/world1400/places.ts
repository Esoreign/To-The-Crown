/**
 * Toponymes de 1400.
 *
 * HISTORIC_PLACES : lieux attestés vers 1400 (ou sites majeurs occupés à cette
 * date) qui nomment en priorité la province qui les contient, surtout là où
 * les noms de villes modernes seraient anachroniques (Amériques, Afrique
 * subsaharienne, Sibérie, Océanie).
 *
 * PLACE_RENAMES : noms modernes (Natural Earth) remplacés par leur forme de
 * 1400 ; `null` écarte un lieu fondé après 1400.
 */

/** [nom, lon, lat, importance 1..3]. */
export type HistoricPlace = [string, number, number, number];

export const HISTORIC_PLACES: HistoricPlace[] = [
  // Europe et Méditerranée (formes de 1400)
  ['Constantinople', 28.98, 41.01, 3], ['Andrinople', 26.56, 41.68, 3], ['Brousse', 29.06, 40.19, 3], ['Smyrne', 27.14, 38.42, 2], ['Trébizonde', 39.72, 41.0, 2],
  ['Thessalonique', 22.94, 40.64, 3], ['Mistra', 22.37, 37.07, 2], ['Candie', 25.13, 35.34, 2], ['Nègrepont', 23.6, 38.46, 2], ['Raguse', 18.09, 42.65, 2],
  ['Zara', 15.23, 44.12, 2], ['Spalato', 16.44, 43.51, 1], ['Presbourg', 17.11, 48.15, 2], ['Laibach', 14.51, 46.05, 1], ['Dantzig', 18.65, 54.35, 2],
  ['Königsberg', 20.51, 54.71, 2], ['Marienbourg', 19.03, 54.04, 2], ['Breslau', 17.04, 51.11, 2], ['Reval', 24.75, 59.44, 2], ['Dorpat', 26.72, 58.38, 1],
  ['Wenden', 25.27, 57.31, 1], ['Lemberg', 24.03, 49.84, 2], ['Wilno', 25.28, 54.69, 3], ['Kiev', 30.52, 50.45, 2], ['Caffa', 35.38, 45.03, 2],
  ['Saraï', 45.8, 48.5, 3], ['Hajji Tarkhan', 48.04, 46.35, 2], ['Bolghar', 49.08, 54.98, 2], ['Tana', 39.42, 47.1, 1], ['Solkhat', 35.1, 45.04, 1],
  ['Alger', 3.06, 36.75, 2], ['Béjaïa', 5.08, 36.75, 2], ['Kairouan', 10.1, 35.68, 2], ['Sijilmassa', -4.27, 31.28, 2], ['Ceuta', -5.32, 35.89, 2],
  ['Tolède', -4.02, 39.86, 3], ['Séville', -5.98, 37.39, 3], ['Grenade', -3.6, 37.18, 3], ['Saint-Jacques-de-Compostelle', -8.54, 42.88, 2], ['Avignon', 4.81, 43.95, 3],
  // Proche-Orient, Iran, Asie centrale
  ['Le Caire', 31.24, 30.04, 3], ['Alexandrie', 29.92, 31.2, 3], ['Damas', 36.3, 33.51, 3], ['Alep', 37.16, 36.2, 3], ['Jérusalem', 35.23, 31.78, 3],
  ['Bagdad', 44.36, 33.31, 3], ['Tabriz', 46.29, 38.08, 3], ['Sultaniyya', 48.8, 36.43, 2], ['Ispahan', 51.67, 32.65, 3], ['Chiraz', 52.53, 29.59, 3],
  ['Hérat', 62.2, 34.35, 3], ['Samarcande', 66.97, 39.65, 3], ['Boukhara', 64.42, 39.77, 3], ['Ourguentch', 59.15, 42.33, 2], ['Merv', 61.84, 37.66, 2],
  ['Rey', 51.43, 35.59, 2], ['Otrar', 68.3, 42.85, 2], ['Sighnaq', 68.1, 43.5, 1], ['Almaliq', 80.9, 43.9, 1], ['Kachgar', 75.99, 39.47, 2],
  ['Tourfan', 89.19, 42.95, 2], ['Kumul', 93.51, 42.82, 1], ['Karakorum', 102.83, 47.2, 2], ['La Mecque', 39.83, 21.42, 3], ['Médine', 39.61, 24.47, 2],
  ['Ormuz', 56.46, 27.1, 2], ['Qalhat', 58.87, 22.69, 1], ['Aden', 45.03, 12.78, 2], ['Zabid', 43.33, 14.2, 2], ['Sanaa', 44.21, 15.35, 2], ['Isker', 68.4, 58.2, 1],
  // Asie du Sud
  ['Delhi', 77.21, 28.64, 3], ['Jaunpur', 82.68, 25.75, 2], ['Patan', 72.12, 23.85, 2], ['Cambay', 72.62, 22.3, 2], ['Mandu', 75.39, 22.35, 2],
  ['Gulbarga', 76.83, 17.33, 3], ['Bidar', 77.52, 17.91, 2], ['Daulatabad', 75.21, 19.94, 2], ['Vijayanagara', 76.46, 15.33, 3], ['Madurai', 78.12, 9.93, 2],
  ['Kanchipuram', 79.7, 12.83, 2], ['Pandua', 88.17, 25.13, 3], ['Sonargaon', 90.6, 23.65, 2], ['Satgaon', 88.38, 22.95, 1], ['Chittor', 74.64, 24.88, 2],
  ['Mandore', 73.05, 26.35, 1], ['Srinagar', 74.8, 34.08, 2], ['Thatta', 67.92, 24.75, 2], ['Multan', 71.47, 30.2, 2], ['Lahore', 74.35, 31.55, 2],
  ['Calicut', 75.78, 11.25, 2], ['Kollam', 76.6, 8.88, 1], ['Mylapore', 80.27, 13.03, 1], ['Nallur', 80.03, 9.67, 1], ['Gampola', 80.57, 7.16, 1],
  ['Kotte', 79.9, 6.89, 1], ['Charaideo', 94.8, 26.95, 1], ['Kamatapur', 89.4, 26.4, 1], ['Nêdong', 91.76, 29.23, 1], ['Lhassa', 91.13, 29.65, 2], ['Cuttack', 85.88, 20.46, 2],
  // Asie orientale et du Sud-Est
  ['Yingtian', 118.78, 32.06, 3], ['Beiping', 116.4, 39.9, 3], ['Hangzhou', 120.15, 30.27, 3], ['Suzhou', 120.62, 31.3, 3], ['Quanzhou', 118.59, 24.91, 2],
  ['Guangzhou', 113.26, 23.13, 3], ['Kaesong', 126.55, 37.97, 3], ['Hanyang', 126.98, 37.57, 2], ['Kyōto', 135.77, 35.01, 3], ['Kamakura', 139.55, 35.32, 2],
  ['Hakata', 130.4, 33.6, 2], ['Sakai', 135.48, 34.57, 2], ['Yamaguchi', 131.47, 34.18, 1], ['Edo', 139.77, 35.68, 1], ['Urasoe', 127.72, 26.25, 1],
  ['Thăng Long', 105.85, 21.03, 3], ['Tây Đô', 105.6, 20.08, 2], ['Vijaya', 109.0, 13.9, 2], ['Yasodharapura', 103.86, 13.41, 3], ['Prey Nokor', 106.66, 10.78, 1],
  ['Ayutthaya', 100.57, 14.35, 3], ['Sukhothaï', 99.82, 17.01, 2], ['Chiang Mai', 98.98, 18.79, 2], ['Xieng Dong Xieng Thong', 102.13, 19.89, 2], ['Ava', 95.99, 21.86, 3],
  ['Pagan', 94.86, 21.17, 2], ['Pégou', 96.48, 17.34, 3], ['Martaban', 97.59, 16.53, 2], ['Dagon', 96.16, 16.8, 1], ['Launggyet', 93.12, 20.62, 1],
  ['Trowulan', 112.38, -7.55, 3], ['Tuban', 112.05, -6.9, 2], ['Pakuan', 106.8, -6.6, 2], ['Sunda Kalapa', 106.81, -6.13, 1], ['Palembang', 104.75, -2.99, 2],
  ['Malacca', 102.25, 2.2, 2], ['Pasai', 97.1, 5.17, 2], ['Temasek', 103.85, 1.29, 1], ['Brunei', 114.94, 4.89, 2], ['Maynila', 120.98, 14.6, 1], ['Tondo', 120.97, 14.62, 1],
  ['Butuan', 125.54, 8.95, 1], ['Sugbu', 123.9, 10.3, 1], ['Ternate', 127.38, 0.79, 1],
  // Afrique
  ['Niani', -8.72, 11.4, 3], ['Tombouctou', -3.0, 16.77, 3], ['Djenné', -4.55, 13.9, 3], ['Gao', -0.04, 16.27, 3], ['Oualata', -7.02, 17.3, 2], ['Koumbi Saleh', -7.98, 15.77, 1],
  ['Linguère', -15.1, 15.39, 1], ['Ouagadougou', -1.53, 12.37, 2], ['Yendi', -0.01, 9.44, 1], ['Bono Manso', -1.9, 7.9, 1], ['Begho', -2.47, 8.02, 1], ['Kano', 8.52, 12.0, 2],
  ['Katsina', 7.6, 13.0, 2], ['Zaria', 7.7, 11.1, 1], ['Birnin Lalle', 5.5, 13.4, 1], ['Agadez', 7.99, 16.97, 1], ['Njimi', 16.0, 14.2, 1], ['Kaga', 12.8, 12.4, 1],
  ['Oyo-Ilé', 4.2, 8.97, 2], ['Ilé-Ifè', 4.56, 7.47, 2], ['Edo', 5.63, 6.34, 2], ['Igbo-Ukwu', 7.0, 6.2, 1], ['Wukari', 9.8, 8.1, 1], ['Zouila', 15.1, 26.18, 1],
  ['Qasr Ibrim', 31.6, 22.6, 1], ['Dongola', 30.47, 18.2, 1], ['Soba', 32.68, 15.52, 1], ['Souakin', 37.33, 19.1, 1], ['Aïn Farah', 24.9, 13.6, 1], ['Aksoum', 38.72, 14.13, 2],
  ['Lalibela', 39.05, 12.03, 2], ['Tegoulet', 39.3, 9.9, 2], ['Zeila', 43.47, 11.35, 2], ['Harar', 42.12, 9.31, 1], ['Mogadiscio', 45.34, 2.04, 2], ['Barawa', 44.07, 1.11, 1],
  ['Pate', 41.07, -2.1, 1], ['Malindi', 40.12, -3.22, 1], ['Mombasa', 39.66, -4.04, 2], ['Unguja', 39.19, -6.16, 1], ['Kilwa Kisiwani', 39.51, -8.96, 3], ['Sofala', 34.8, -20.15, 2],
  ['Grand Zimbabwe', 30.93, -20.27, 3], ['Mbanza Kongo', 14.25, -6.27, 2], ['Mbanza Soyo', 12.37, -6.13, 1], ['Buali', 11.85, -4.65, 1], ['Mbe', 15.3, -3.8, 1], ['Bigo', 31.3, 1.4, 1],
  ['Ntusi', 31.23, -0.05, 1], ['Mahilaka', 48.0, -13.9, 1], ['Analamanga', 47.52, -18.91, 1], ['Upemba', 26.0, -8.0, 1],
  // Amériques
  ['Tenochtitlan', -99.13, 19.43, 3], ['Azcapotzalco', -99.18, 19.49, 2], ['Texcoco', -98.88, 19.51, 2], ['Tlaxcala', -98.24, 19.31, 2], ['Cholula', -98.3, 19.06, 2],
  ['Cuauhnahuac', -99.23, 18.92, 1], ['Tzintzuntzan', -101.58, 19.63, 2], ['Tututepec', -97.61, 16.13, 1], ['Zaachila', -96.75, 16.95, 1], ['Mitla', -96.36, 16.93, 1],
  ['Cempoala', -96.39, 19.44, 1], ['Mayapán', -89.46, 20.63, 2], ['Chichén Itzá', -88.57, 20.68, 1], ['Tulum', -87.43, 20.21, 1], ['Q’umarkaj', -91.16, 15.02, 2],
  ['Nojpetén', -89.89, 16.93, 1], ['Cuzcatlán', -89.19, 13.69, 1], ['Qusqu', -71.97, -13.53, 3], ['Andahuaylas', -73.38, -13.66, 1], ['Hatun Colla', -70.2, -15.2, 1],
  ['Chucuito', -69.89, -16.21, 1], ['Chan Chan', -79.07, -8.11, 3], ['Pachacamac', -76.9, -12.26, 2], ['Chincha', -76.13, -13.42, 1], ['Kuélap', -77.87, -6.23, 1],
  ['Quito', -78.5, -0.2, 1], ['Tumebamba', -78.99, -2.9, 1], ['Bacatá', -74.07, 4.71, 1], ['Hunza', -73.36, 5.53, 1], ['Teyuna', -73.93, 11.04, 1], ['Maguana', -71.0, 19.0, 1],
  ['Moundville', -87.63, 33.0, 1], ['Etowah', -84.8, 34.13, 1], ['Coosa', -84.8, 34.6, 1], ['Spiro', -94.57, 35.3, 1], ['Onondaga', -76.1, 43.0, 1], ['Hochelaga', -73.58, 45.5, 1],
  ['Stadaconé', -71.21, 46.81, 1], ['Hawikuh', -108.83, 34.96, 1], ['Oraibi', -110.64, 35.87, 1], ['Ako', -107.58, 34.9, 1], ['Paquimé', -107.95, 30.37, 1], ['Cicuye', -105.69, 35.55, 1],
  // Océanie
  ['Muʻa', -175.13, -21.18, 1], ['Nan Madol', 158.33, 6.84, 1], ['Rapa Nui', -109.35, -27.12, 1], ['Taputapuātea', -151.36, -16.83, 1],
];

/** Noms modernes → forme de 1400 (null : lieu postérieur à 1400, écarté). */
export const PLACE_RENAMES: Record<string, string | null> = {
  Istanbul: 'Constantinople', Edirne: 'Andrinople', Bursa: 'Brousse', Izmir: 'Smyrne', Trabzon: 'Trébizonde', Thessaloniki: 'Thessalonique', Iraklio: 'Candie',
  Dubrovnik: 'Raguse', Zadar: 'Zara', Split: 'Spalato', Bratislava: 'Presbourg', Ljubljana: 'Laibach', Gdansk: 'Dantzig', Kaliningrad: 'Königsberg',
  Wroclaw: 'Breslau', Tallinn: 'Reval', Tartu: 'Dorpat', Lviv: 'Lemberg', Vilnius: 'Wilno', Kyiv: 'Kiev', Feodosiya: 'Caffa', Szczecin: 'Stettin',
  Poznan: 'Poznań', Klaipeda: 'Memel', Sovetsk: 'Tilsit', Olsztyn: 'Allenstein', Bydgoszcz: 'Bromberg', Torun: 'Thorn', Elblag: 'Elbing', Malbork: 'Marienbourg',
  Chernivtsi: 'Czernowitz', 'Cluj-Napoca': 'Kolozsvár', Oradea: 'Várad', Timisoara: 'Temesvár', Brasov: 'Brassó', Sibiu: 'Nagyszeben', Kosice: 'Kassa',
  Helsinki: null, 'St. Petersburg': null, Petrozavodsk: null, Murmansk: null, Arkhangelsk: 'Kholmogory', Volgograd: null, Rostov: 'Tana', Odesa: 'Khadjibey',
  Sevastopol: null, Simferopol: null, Kaunas: 'Kaunas', Kirov: 'Khlynov', Samara: null, Saratov: null, Orenburg: null, Yekaterinburg: null, Chelyabinsk: null,
  Perm: null, Ufa: null, Izhevsk: null, Cheboksary: null, Ulyanovsk: null, Penza: null, Tambov: null, Voronezh: null, Kursk: 'Koursk', Kharkiv: null, Dnipro: null,
  Zaporizhzhya: null, Mykolayiv: null, Kherson: null, Donetsk: null, Luhansk: null, Tehran: 'Rey', Ankara: 'Angora', Riyadh: null, Kuwait: null, Doha: null,
  'Abu Dhabi': null, Dubai: null, Manama: null, Amman: null, 'Tel Aviv-Yafo': 'Jaffa', Beirut: 'Beyrouth', Algiers: 'Alger', Casablanca: 'Anfa', Rabat: 'Salé', Tangier: 'Tanger',
  Nouakchott: null, Dakar: null, Abidjan: null, Accra: null, Lome: null, Lagos: 'Eko', 'Port Harcourt': null, Kinshasa: null, Brazzaville: null, Luanda: null,
  Nairobi: null, Kampala: null, Kigali: null, Bujumbura: null, 'Addis Ababa': null, Asmara: null, Djibouti: null, Khartoum: null, 'Dar es Salaam': null, Maputo: null,
  Harare: null, Lusaka: null, Lilongwe: null, Blantyre: null, Gaborone: null, Windhoek: null, Johannesburg: null, Pretoria: null, 'Cape Town': null, Durban: null,
  Bangkok: null, 'Ho Chi Minh City': 'Prey Nokor', Hanoi: 'Thăng Long', Hue: 'Thuận Hóa', Yangon: 'Dagon', Mandalay: null, 'Phnom Penh': null, Vientiane: 'Vientiane',
  'Kuala Lumpur': null, Singapore: 'Temasek', Jakarta: 'Sunda Kalapa', Bandung: null, Surabaya: 'Hujung Galuh', Manila: 'Maynila', 'Quezon City': null, Cebu: 'Sugbu',
  Tokyo: 'Edo', Osaka: 'Naniwa', Yokohama: null, Kobe: null, Sapporo: null, Nagoya: null, Seoul: 'Hanyang', Busan: null, Incheon: null, Pyongyang: 'Pyongyang', Beijing: 'Beiping',
  Nanjing: 'Yingtian', Shanghai: null, Tianjin: null, Harbin: null, Changchun: null, Shenyang: 'Shenyang', Dalian: null, Qingdao: null, 'Hong Kong': null, Macau: null,
  Taipei: null, Kaohsiung: null, Urumqi: null, Hohhot: null, Ulaanbaatar: null, Karachi: null, Mumbai: null, Kolkata: null, Chennai: 'Mylapore', Bangalore: null,
  Hyderabad: null, Islamabad: null, Rawalpindi: null, Faisalabad: null, Dhaka: 'Dhaka', Colombo: 'Kolamba', Kathmandu: 'Kathmandu', Thimphu: null, Almaty: null,
  Astana: null, Bishkek: null, Dushanbe: null, Ashgabat: null, Baku: 'Bakou', Tbilisi: 'Tbilissi', Yerevan: 'Erevan', Kabul: 'Kaboul', 'Mexico City': 'Tenochtitlan',
};
