import type { FaithDef } from '@ttc/shared';

/** Six confessions fictives de Caldria. */
export const FAITHS: FaithDef[] = [
  {
    id: 'aube',
    color: '#e0c36a',
    symbol: 'sun',
    family: 'solaire',
    doctrines: { divorce: false, femaleRulers: 'allowed', holyWar: true, tolerance: -1 },
    modifiers: { monthly_fervor: 0.1 },
    virtues: ['just', 'humble', 'compassionate'],
    sins: ['cruel', 'arrogant', 'deceitful'],
  },
  {
    id: 'veilleurs',
    color: '#d68a3c',
    symbol: 'lantern',
    family: 'solaire',
    doctrines: { divorce: true, femaleRulers: 'equal', holyWar: false, tolerance: 1 },
    modifiers: { learning: 1 },
    virtues: ['patient', 'honest', 'scholarly'],
    sins: ['greedy', 'wrathful'],
  },
  {
    id: 'anciens_chemins',
    color: '#6f8f5a',
    symbol: 'standing_stone',
    family: 'ancienne',
    doctrines: { divorce: true, femaleRulers: 'equal', holyWar: true, tolerance: 0 },
    modifiers: { levy_mult: 0.05 },
    virtues: ['brave', 'loyal', 'generous'],
    sins: ['craven', 'deceitful'],
  },
  {
    id: 'marees',
    color: '#4aa0b0',
    symbol: 'wave',
    family: 'ancienne',
    doctrines: { divorce: true, femaleRulers: 'equal', holyWar: false, tolerance: 2 },
    modifiers: { monthly_gold: 0.2 },
    virtues: ['generous', 'sociable', 'patient'],
    sins: ['greedy', 'reclusive'],
  },
  {
    id: 'sceau_azar',
    color: '#8a6fd0',
    symbol: 'star',
    family: 'astrale',
    doctrines: { divorce: true, femaleRulers: 'allowed', holyWar: true, tolerance: 0 },
    modifiers: { stewardship: 1 },
    virtues: ['patient', 'just', 'scholarly'],
    sins: ['wrathful', 'lustful'],
  },
  {
    id: 'ciel_eternel',
    color: '#5f86c9',
    symbol: 'eagle',
    family: 'astrale',
    doctrines: { divorce: true, femaleRulers: 'allowed', holyWar: true, tolerance: 1 },
    modifiers: { commander_advantage: 1 },
    virtues: ['brave', 'honest', 'loyal'],
    sins: ['craven', 'lazy'],
  },
];

export const FAITH_BY_ID: Record<string, FaithDef> = Object.fromEntries(FAITHS.map((f) => [f.id, f]));
