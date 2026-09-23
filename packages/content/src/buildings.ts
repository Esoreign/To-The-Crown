import type { BuildingDef } from '@ttc/shared';

/**
 * Bâtiments data-driven. Les effets `perLevel` sont multipliés par le niveau
 * construit. Clés de province : tax_mult, levy_mult, development_growth,
 * control_growth, fort_level, garrison_size, monthly_gold, defender_advantage,
 * supply_limit. Clés de détenteur (agrégées sur le domaine) :
 * monthly_prestige, monthly_fervor, monthly_authority, maa_upkeep_mult.
 */
export const BUILDINGS: BuildingDef[] = [
  // Économie
  {
    id: 'farms', category: 'economy', icon: 'wheat', maxLevel: 3,
    cost: [60, 110, 180], days: [120, 180, 240],
    requires: { notTerrain: ['mountains', 'marsh'] },
    perLevel: { tax_mult: 0.08, supply_limit: 1 }, leviesPerLevel: 40,
  },
  {
    id: 'market', category: 'economy', icon: 'stall', maxLevel: 3,
    cost: [90, 160, 260], days: [150, 210, 300],
    requires: { minDevelopment: 8 },
    perLevel: { monthly_gold: 0.35, development_growth: 0.03 },
  },
  {
    id: 'workshops', category: 'economy', icon: 'anvil', maxLevel: 3,
    cost: [80, 140, 230], days: [150, 210, 280],
    perLevel: { tax_mult: 0.1 },
  },
  {
    id: 'mills', category: 'economy', icon: 'mill', maxLevel: 2,
    cost: [70, 140], days: [120, 200],
    requires: { terrain: ['plains', 'farmlands', 'hills', 'steppe'] },
    perLevel: { tax_mult: 0.06, development_growth: 0.04 },
  },
  {
    id: 'mines', category: 'economy', icon: 'pickaxe', maxLevel: 3,
    cost: [100, 170, 260], days: [180, 240, 300],
    requires: { terrain: ['hills', 'mountains'] },
    perLevel: { monthly_gold: 0.5 },
  },
  {
    id: 'lumber_camp', category: 'economy', icon: 'axe', maxLevel: 2,
    cost: [60, 120], days: [120, 180],
    requires: { terrain: ['forest', 'marsh'] },
    perLevel: { monthly_gold: 0.3, control_growth: 0.05 },
  },
  {
    id: 'pastures', category: 'economy', icon: 'horse-head', maxLevel: 2,
    cost: [60, 120], days: [120, 180],
    requires: { terrain: ['steppe', 'plains', 'hills'] },
    perLevel: { monthly_gold: 0.2, levy_mult: 0.05 },
  },
  {
    id: 'port', category: 'economy', icon: 'anchor', maxLevel: 3,
    cost: [110, 190, 300], days: [180, 240, 300],
    requires: { coastal: true },
    perLevel: { monthly_gold: 0.45, development_growth: 0.04 },
  },
  {
    id: 'roads', category: 'economy', icon: 'milestone', maxLevel: 2,
    cost: [70, 130], days: [150, 210],
    perLevel: { control_growth: 0.15, development_growth: 0.03, supply_limit: 1 },
  },
  // Militaire
  {
    id: 'barracks', category: 'military', icon: 'crossed-spears', maxLevel: 3,
    cost: [80, 140, 220], days: [150, 210, 270],
    perLevel: { levy_mult: 0.12 }, leviesPerLevel: 60,
  },
  {
    id: 'training_grounds', category: 'military', icon: 'target', maxLevel: 2,
    cost: [110, 200], days: [180, 260],
    requires: { building: { id: 'barracks', level: 1 } },
    perLevel: { maa_upkeep_mult: -0.08, garrison_size: 0.1 },
  },
  {
    id: 'stables', category: 'military', icon: 'horseshoe', maxLevel: 2,
    cost: [100, 180], days: [180, 240],
    requires: { terrain: ['plains', 'farmlands', 'steppe', 'hills'] },
    perLevel: { levy_mult: 0.08, supply_limit: 1 }, leviesPerLevel: 40,
  },
  // Défense
  {
    id: 'watchtowers', category: 'defense', icon: 'watchtower', maxLevel: 2,
    cost: [60, 110], days: [100, 160],
    perLevel: { defender_advantage: 3, control_growth: 0.05 },
  },
  {
    id: 'walls', category: 'defense', icon: 'wall', maxLevel: 3,
    cost: [110, 190, 280], days: [200, 270, 340],
    perLevel: { fort_level: 1, garrison_size: 0.25 },
  },
  {
    id: 'fortress', category: 'defense', icon: 'keep', maxLevel: 2,
    cost: [250, 400], days: [360, 480],
    requires: { building: { id: 'walls', level: 2 } },
    perLevel: { fort_level: 2, garrison_size: 0.5, defender_advantage: 4 },
  },
  // Prestige / développement
  {
    id: 'chancery', category: 'prestige', icon: 'seal', maxLevel: 2,
    cost: [140, 240], days: [210, 300],
    requires: { minDevelopment: 12 },
    perLevel: { control_growth: 0.1, tax_mult: 0.05, monthly_authority: 0.15 },
  },
  {
    id: 'temple', category: 'prestige', icon: 'temple', maxLevel: 3,
    cost: [90, 160, 250], days: [180, 240, 300],
    perLevel: { monthly_fervor: 0.4, development_growth: 0.02 },
  },
  {
    id: 'college', category: 'prestige', icon: 'scroll', maxLevel: 2,
    cost: [150, 260], days: [240, 330],
    requires: { minDevelopment: 15 },
    perLevel: { development_growth: 0.08, monthly_prestige: 0.2 },
  },
  {
    id: 'great_hall', category: 'prestige', icon: 'banner-hall', maxLevel: 2,
    cost: [160, 280], days: [240, 330],
    perLevel: { monthly_prestige: 0.4, control_growth: 0.05 },
  },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
