/**
 * Schéma des entités politiques du scénario Monde 1400.
 *
 * Chaque entité est décrite par des données : capitale, points d'ancrage de
 * son territoire (le pipeline `tools/worldgen` en déduit les provinces par
 * propagation sur le graphe d'adjacence), dirigeant, lien de sujétion et
 * niveau de confiance historique. Aucune frontière moderne n'est utilisée.
 */
import type { TitleRank } from '@ttc/shared';
import type { GovernmentId } from './governments';

/** Fiabilité de la reconstitution. */
export type HistoricalConfidence = 'high' | 'medium' | 'low' | 'gameplayApproximation';

export type SubjectType =
  | 'direct_vassal'
  | 'autonomous_vassal'
  | 'tributary'
  | 'personal_union'
  | 'client_state'
  | 'confederate_member';

/** [prénom, année de naissance, sexe ('F' si femme), numéro/épithète de règne]. */
export type PersonSpec = [string, number, ('M' | 'F')?, string?];

export interface PolitySpec {
  id: string;
  /** Nom complet (« Royaume de France »). */
  name: string;
  /** Nom court (« France »). */
  short: string;
  /** Adjectif (« français »). */
  adj: string;
  rank: TitleRank;
  gov: GovernmentId;
  culture: string;
  faith: string;
  color: string;
  /** Capitale [lon, lat, nom de 1400]. */
  cap: [number, number, string];
  /** Points d'ancrage supplémentaires du territoire [lon, lat, portée locale km ?]. */
  at?: ([number, number] | [number, number, number])[];
  /** Portée maximale (km de graphe) depuis l'ancrage le plus proche. */
  reach?: number;
  /** Poids de propagation (> 1 : l'entité s'impose face à ses voisines). */
  w?: number;
  /** Maison régnante. */
  house: string;
  ruler: PersonSpec;
  spouse?: PersonSpec;
  /** Enfants connus (l'aîné est l'héritier présomptif si la loi le veut). */
  kids?: PersonSpec[];
  /** Intitulé du dirigeant propre à cette entité [masculin, féminin]. */
  title?: [string, string];
  liege?: string;
  subject?: SubjectType;
  /** Union personnelle : même dirigeant que l'entité indiquée (pas de personnage propre). */
  union?: string;
  conf: HistoricalConfidence;
  note?: string;
}

/** Aide à l'écriture : couleurs et coordonnées restent lisibles dans les listes. */
export function P(s: PolitySpec): PolitySpec {
  return s;
}
