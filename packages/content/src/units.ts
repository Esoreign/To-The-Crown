import type { UnitDef, UnitType } from '@ttc/shared';

/**
 * Types d'unités. Valeurs par tranche de 100 hommes. Les levées sont
 * gratuites mais faibles ; les hommes d'armes coûtent à recruter et à
 * entretenir en permanence.
 */
export const UNITS: UnitDef[] = [
  { id: 'levy', icon: 'pitchfork', damage: 10, toughness: 10, pursuit: 0, screen: 0, siege: 0, cost: 0, upkeep: 0.25 },
  {
    id: 'footmen', icon: 'sword-shield', damage: 24, toughness: 24, pursuit: 5, screen: 10, siege: 0, cost: 45, upkeep: 0.9,
    counters: ['levy'], goodTerrain: ['hills', 'forest'],
  },
  {
    id: 'archers', icon: 'bow', damage: 30, toughness: 10, pursuit: 0, screen: 10, siege: 0, cost: 45, upkeep: 0.9,
    counters: ['footmen', 'levy'], goodTerrain: ['hills', 'forest', 'mountains'], badTerrain: ['marsh'],
  },
  {
    id: 'pikemen', icon: 'pike', damage: 22, toughness: 26, pursuit: 0, screen: 20, siege: 0, cost: 50, upkeep: 1,
    counters: ['heavy_cavalry', 'light_cavalry'],
  },
  {
    id: 'light_cavalry', icon: 'light-horse', damage: 20, toughness: 12, pursuit: 30, screen: 25, siege: 0, cost: 55, upkeep: 1.1,
    counters: ['archers'], goodTerrain: ['plains', 'steppe', 'farmlands'], badTerrain: ['forest', 'mountains', 'marsh'],
  },
  {
    id: 'heavy_cavalry', icon: 'heavy-horse', damage: 55, toughness: 30, pursuit: 15, screen: 10, siege: 0, cost: 130, upkeep: 2.6,
    counters: ['footmen', 'levy', 'archers'], goodTerrain: ['plains', 'farmlands', 'steppe'],
    badTerrain: ['forest', 'mountains', 'marsh', 'hills'],
  },
  {
    id: 'horse_archers', icon: 'horse-archer', damage: 34, toughness: 14, pursuit: 35, screen: 30, siege: 0, cost: 70, upkeep: 1.3,
    counters: ['footmen', 'levy', 'heavy_cavalry'], goodTerrain: ['steppe', 'plains', 'desert', 'savanna'], badTerrain: ['forest', 'jungle', 'mountains', 'marsh'],
  },
  {
    id: 'war_elephants', icon: 'elephant', damage: 60, toughness: 40, pursuit: 5, screen: 5, siege: 0.3, cost: 150, upkeep: 3,
    counters: ['footmen', 'levy', 'light_cavalry', 'heavy_cavalry'], goodTerrain: ['plains', 'farmlands', 'savanna', 'jungle'], badTerrain: ['mountains', 'marsh', 'hills'],
  },
  {
    id: 'siege_engines', icon: 'trebuchet', damage: 4, toughness: 6, pursuit: 0, screen: 0, siege: 1, cost: 80, upkeep: 1.2,
  },
];

export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u])) as Record<UnitType, UnitDef>;
