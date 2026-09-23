import type { SuccessionLaw } from '@ttc/shared';

/**
 * Définitions artisanales des grands titres. Le générateur de monde fait
 * croître chaque royaume autour de sa position préférée (coordonnées
 * normalisées 0..1) avec un poids proportionnel à son nombre de comtés.
 */
export interface EmpireDef {
  id: string;
  name: string;
  adjective: string;
  color: [number, number, number];
  law: SuccessionLaw;
}

export interface KingdomDef {
  id: string;
  name: string;
  adjective: string;
  empireId: string;
  cultureId: string;
  faithId: string;
  /** Confession minoritaire présente dans certains comtés. */
  minorityFaithId?: string;
  pos: [number, number];
  weight: number;
  color: [number, number, number];
  law: SuccessionLaw;
  /** Rayon relatif de la masse continentale autour du royaume. */
  landRadius: number;
}

export const EMPIRE_DEFS: EmpireDef[] = [
  { id: 'e_caldria', name: 'Haute-Couronne de Caldria', adjective: 'caldrienne', color: [176, 138, 62], law: 'elective' },
  { id: 'e_hrovmark', name: 'Empire de Hrovmark', adjective: 'hrovmarque', color: [96, 118, 140], law: 'primogeniture' },
  { id: 'e_azhar', name: 'Hégémonie d’Azhar', adjective: 'azhari', color: [196, 150, 64], law: 'partition' },
];

export const KINGDOM_DEFS: KingdomDef[] = [
  {
    id: 'k_valorie', name: 'Valorie', adjective: 'valorien', empireId: 'e_caldria', cultureId: 'valorien', faithId: 'aube',
    pos: [0.15, 0.43], weight: 20, color: [58, 92, 168], law: 'primogeniture', landRadius: 0.16,
  },
  {
    id: 'k_aurevanne', name: 'Aurevanne', adjective: 'aurevannais', empireId: 'e_caldria', cultureId: 'caldrien', faithId: 'aube',
    minorityFaithId: 'veilleurs', pos: [0.39, 0.4], weight: 20, color: [150, 38, 52], law: 'partition', landRadius: 0.16,
  },
  {
    id: 'k_castelmar', name: 'Castelmar', adjective: 'castelmarois', empireId: 'e_caldria', cultureId: 'caldrien', faithId: 'veilleurs',
    minorityFaithId: 'aube', pos: [0.35, 0.68], weight: 17, color: [204, 138, 46], law: 'partition', landRadius: 0.14,
  },
  {
    id: 'k_ardh', name: 'Ardh', adjective: 'ardhien', empireId: 'e_caldria', cultureId: 'ardhe', faithId: 'anciens_chemins',
    minorityFaithId: 'aube', pos: [0.2, 0.17], weight: 16, color: [112, 72, 142], law: 'elective', landRadius: 0.13,
  },
  {
    id: 'k_hrovmark', name: 'Hrovmark', adjective: 'hrovmarque', empireId: 'e_hrovmark', cultureId: 'hrovar', faithId: 'anciens_chemins',
    pos: [0.47, 0.13], weight: 20, color: [84, 116, 146], law: 'primogeniture', landRadius: 0.15,
  },
  {
    id: 'k_skarnholt', name: 'Skarnholt', adjective: 'skarnois', empireId: 'e_hrovmark', cultureId: 'hrovar', faithId: 'anciens_chemins',
    pos: [0.74, 0.15], weight: 16, color: [52, 96, 88], law: 'seniority', landRadius: 0.13,
  },
  {
    id: 'k_vesnagrad', name: 'Vesnagrad', adjective: 'vesnar', empireId: 'e_hrovmark', cultureId: 'vesnar', faithId: 'aube',
    minorityFaithId: 'anciens_chemins', pos: [0.64, 0.4], weight: 18, color: [88, 134, 58], law: 'partition', landRadius: 0.14,
  },
  {
    id: 'k_azhar', name: 'Azhar', adjective: 'azhari', empireId: 'e_azhar', cultureId: 'sarrhan', faithId: 'sceau_azar',
    pos: [0.62, 0.77], weight: 20, color: [214, 176, 76], law: 'partition', landRadius: 0.15,
  },
  {
    id: 'k_kharzul', name: 'Kharzul', adjective: 'kharzul', empireId: 'e_azhar', cultureId: 'kharzul', faithId: 'ciel_eternel',
    pos: [0.87, 0.5], weight: 18, color: [168, 74, 44], law: 'seniority', landRadius: 0.14,
  },
  {
    id: 'k_myrrh', name: 'Myrrh', adjective: 'myrrhain', empireId: 'e_azhar', cultureId: 'myrrhain', faithId: 'marees',
    pos: [0.13, 0.78], weight: 15, color: [44, 128, 132], law: 'primogeniture', landRadius: 0.11,
  },
];

export const SEA_NAMES = [
  { name: 'Océan des Brumes', pos: [0.03, 0.3] as [number, number], size: 64 },
  { name: 'Mer de Givre', pos: [0.6, 0.03] as [number, number], size: 52 },
  { name: 'Golfe d’Or', pos: [0.47, 0.6] as [number, number], size: 44 },
  { name: 'Mer des Ambres', pos: [0.42, 0.93] as [number, number], size: 56 },
  { name: 'Détroit de Myrrh', pos: [0.05, 0.9] as [number, number], size: 34 },
  { name: 'Mer d’Orient', pos: [0.97, 0.82] as [number, number], size: 50 },
];
