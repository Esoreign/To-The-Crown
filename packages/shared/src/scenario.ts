import type {
  Alliance,
  Character,
  Claim,
  Dynasty,
  Faction,
  Hook,
  House,
  ProvinceState,
  Relation,
  Secret,
  Title,
  War,
} from './state';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'very_hard';

export interface RecommendedStart {
  characterId: string;
  difficulty: Difficulty;
  /** Accroche courte. */
  tagline: string;
  description: string;
  problems: string[];
  objective: string;
}

export interface ScenarioData {
  id: string;
  name: string;
  startDate: number;
  intro: string;
  characters: Record<string, Character>;
  houses: Record<string, House>;
  dynasties: Record<string, Dynasty>;
  titles: Record<string, Title>;
  provinces: Record<string, ProvinceState>;
  relations: Record<string, Relation>;
  claims: Record<string, Claim>;
  alliances: Record<string, Alliance>;
  wars: Record<string, War>;
  secrets: Record<string, Secret>;
  hooks: Record<string, Hook>;
  factions: Record<string, Faction>;
  recommended: RecommendedStart[];
  nextId: number;
}
