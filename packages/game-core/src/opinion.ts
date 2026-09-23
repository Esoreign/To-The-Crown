/**
 * Opinion d'un personnage envers un autre, avec décomposition complète
 * (utilisée par les tooltips et par l'IA).
 */
import type { Character, GameView, RelationType } from '@ttc/shared';
import { BALANCE } from './balance';
import { ageOf, characterModifier } from './characters';
import { FAITH_BY_ID, TRAIT_BY_ID } from './content';
import { areSiblings, isParentOf, sameDynasty } from './family';
import { getIndex, relationTypesBetween } from './index-cache';

export interface OpinionRow {
  reason: string;
  value: number;
}

export interface OpinionBreakdown {
  total: number;
  rows: OpinionRow[];
}

type Indexed = Pick<GameView, 'characters' | 'relations' | 'alliances' | 'wars' | 'houses'>;

export function relationsBetween(state: Indexed, a: string, b: string): RelationType[] {
  return relationTypesBetween(state, a, b);
}

export function hasRelation(state: Indexed, a: string, b: string, type: RelationType): boolean {
  return relationsBetween(state, a, b).includes(type);
}

export function relationsOf(state: Indexed, id: string, type?: RelationType): string[] {
  const out: string[] = [];
  for (const r of getIndex(state).relationsByChar.get(id) ?? []) {
    if (type && r.type !== type) continue;
    out.push(r.a === id ? r.b : r.a);
  }
  return out;
}

export function areAllied(state: Indexed, a: string, b: string): boolean {
  return (getIndex(state).alliesByChar.get(a) ?? []).includes(b);
}

export function alliesOf(state: Indexed, id: string): string[] {
  return (getIndex(state).alliesByChar.get(id) ?? []).filter((o) => state.characters[o]?.death === null);
}

export function atWarWith(state: Indexed, a: string, b: string): boolean {
  for (const w of getIndex(state).warsByChar.get(a) ?? []) {
    if ((w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a))) return true;
  }
  return false;
}

export function faithOpinion(of: Character, towards: Character): OpinionRow | null {
  if (of.faithId === towards.faithId) return null;
  const f1 = FAITH_BY_ID[of.faithId];
  const f2 = FAITH_BY_ID[towards.faithId];
  if (!f1 || !f2) return null;
  if (f1.family === f2.family) return { reason: 'sister_faith', value: BALANCE.opinion.sisterFaith };
  const tolerance = f1.doctrines.tolerance;
  return { reason: 'different_faith', value: BALANCE.opinion.differentFaith + tolerance * 5 };
}

export function opinionOf(state: GameView, ofId: string, towardsId: string): OpinionBreakdown {
  const of = state.characters[ofId];
  const towards = state.characters[towardsId];
  const rows: OpinionRow[] = [];
  if (!of || !towards || ofId === towardsId) return { total: 0, rows };

  // Réputation générale de la cible.
  const general = characterModifier(state, towards, 'general_opinion');
  if (general) rows.push({ reason: 'reputation', value: general });

  // Attraction (adultes, sexes opposés, non parents).
  if (of.sex !== towards.sex && ageOf(of, state.date) >= 16 && ageOf(towards, state.date) >= 16) {
    const attr = characterModifier(state, towards, 'attraction_opinion');
    if (attr && !isParentOf(of, towards) && !isParentOf(towards, of) && !areSiblings(of, towards)) {
      rows.push({ reason: 'attraction', value: attr });
    }
  }

  // Compatibilité des traits de personnalité.
  let compat = 0;
  for (const t of of.traits) {
    const def = TRAIT_BY_ID[t];
    if (!def || def.category !== 'personality') continue;
    if (towards.traits.includes(t)) compat += def.sameOpinion ?? 0;
    if (def.opposites?.some((o) => towards.traits.includes(o))) compat += def.oppositeOpinion ?? 0;
  }
  // Traits réprouvés (réputation) : les traits honnêtes/justes les réprouvent davantage.
  for (const t of towards.traits) {
    if (TRAIT_BY_ID[t]?.shunned && (of.traits.includes('just') || of.traits.includes('zealous'))) compat -= 10;
  }
  if (compat) rows.push({ reason: 'traits', value: compat });

  // Famille.
  if (isParentOf(towards, of)) rows.push({ reason: 'parent', value: BALANCE.opinion.parent });
  if (isParentOf(of, towards)) rows.push({ reason: 'child', value: BALANCE.opinion.child });
  if (areSiblings(of, towards)) rows.push({ reason: 'sibling', value: BALANCE.opinion.sibling });
  if (of.spouseId === towardsId) rows.push({ reason: 'spouse', value: BALANCE.opinion.spouse });
  if (sameDynasty(state, of, towards) && !isParentOf(of, towards) && !isParentOf(towards, of) && !areSiblings(of, towards)) {
    rows.push({ reason: 'same_dynasty', value: BALANCE.opinion.sameDynasty });
  }

  // Relations spéciales.
  for (const r of relationsBetween(state, ofId, towardsId)) {
    rows.push({ reason: `relation_${r}`, value: BALANCE.opinion.relation[r] });
  }

  // Suzerain : autorité royale, justice, culture.
  if (of.liegeId === towardsId) {
    const auth = BALANCE.authority.crownAuthorityOpinion[towards.crownAuthority] ?? 0;
    if (auth) rows.push({ reason: 'crown_authority', value: auth });
    const vo = characterModifier(state, towards, 'vassal_opinion');
    if (vo) rows.push({ reason: 'liege_traits', value: vo });
    if (of.cultureId !== towards.cultureId) rows.push({ reason: 'different_culture', value: BALANCE.opinion.differentCultureVassal });
    for (const f of Object.values(state.factions)) {
      if (f.targetId === towardsId && f.members.includes(ofId)) {
        rows.push({ reason: 'faction_member', value: -10 });
        break;
      }
    }
  }

  const faith = faithOpinion(of, towards);
  if (faith) rows.push(faith);

  if (areAllied(state, ofId, towardsId)) rows.push({ reason: 'ally', value: BALANCE.opinion.ally });
  if (atWarWith(state, ofId, towardsId)) rows.push({ reason: 'at_war', value: BALANCE.opinion.atWar });

  // Opinions mémorisées (cadeaux, événements…).
  const stored = of.opinions[towardsId];
  if (stored) {
    const agg = new Map<string, number>();
    for (const e of stored) {
      if (e.expires !== null && e.expires <= state.date) continue;
      agg.set(e.reason, (agg.get(e.reason) ?? 0) + e.value);
    }
    for (const [reason, value] of agg) if (value) rows.push({ reason, value });
  }

  const raw = rows.reduce((s, r) => s + r.value, 0);
  const total = Math.max(BALANCE.opinion.min, Math.min(BALANCE.opinion.max, Math.round(raw)));
  return { total, rows };
}

export function opinion(state: GameView, ofId: string, towardsId: string): number {
  return opinionOf(state, ofId, towardsId).total;
}

/** Ajoute une entrée d'opinion mémorisée. */
export function addOpinion(
  state: { characters: Record<string, Character>; date: number },
  ofId: string,
  towardsId: string,
  value: number,
  reason: string,
  months: number | null = 60,
): void {
  const of = state.characters[ofId];
  if (!of || ofId === towardsId) return;
  const list = (of.opinions[towardsId] ??= []);
  const expires = months === null ? null : state.date + Math.round(months * 30.4);
  const existing = list.find((e) => e.reason === reason);
  if (existing) {
    existing.value = Math.max(-100, Math.min(100, existing.value + value));
    existing.expires = expires;
  } else list.push({ reason, value, expires });
}

/** Retire les opinions expirées (tick mensuel). */
export function pruneOpinions(c: Character, date: number): void {
  for (const [k, list] of Object.entries(c.opinions)) {
    const kept = list.filter((e) => e.expires === null || e.expires > date);
    if (kept.length === 0) delete c.opinions[k];
    else if (kept.length !== list.length) c.opinions[k] = kept;
  }
}
