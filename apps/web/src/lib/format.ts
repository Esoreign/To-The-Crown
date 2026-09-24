/**
 * Mise en forme des noms, titres et dates pour l'interface.
 */
import { CONTENT } from '@ttc/content';
import { TITLE_DEFS, ageOf, fullName, primaryTitleId, rankName } from '@ttc/game-core';
import { formatDateFr, type Character, type GameView } from '@ttc/shared';
import { t } from './i18n';

const VOWEL = /^[aeiouyàâäéèêëîïôöûüœ]/i;

/** « de Valorie » / « d’Aurevanne ». */
export function deName(name: string): string {
  return VOWEL.test(name) ? `d’${name}` : `de ${name}`;
}

export function titleName(titleId: string | null | undefined): string {
  if (!titleId) return '—';
  return TITLE_DEFS[titleId]?.name ?? titleId;
}

/** Nom du territoire sans la forme de gouvernement (« Empire de Hrovmark » → « Hrovmark »). */
export function titleLandName(titleId: string): string {
  const name = titleName(titleId);
  return name.replace(/^(Empire|Hégémonie|Haute-Couronne|Royaume|Duché|Comté) (de |d’|d')/, '');
}

/** « Royaume de Valorie ». */
export function titleFullName(titleId: string | null | undefined): string {
  if (!titleId) return '—';
  const def = TITLE_DEFS[titleId];
  if (!def) return titleId;
  if (titleLandName(titleId) !== def.name) return def.name;
  return `${t(`rank.${def.rank}`)} ${deName(def.name)}`;
}

/** « Reine de Valorie », « Comte d’Ardan », « Seigneur » pour un non-titré. */
export function rulerTitle(c: Character): string {
  const rank = rankName(c);
  const pt = primaryTitleId(c);
  if (!rank || !pt) return '';
  return `${t(`rank.holder.${c.sex}.${rank}`)} ${deName(titleLandName(pt))}`;
}

/** « Reine Aélis de Valorie » ; nom complet pour un non-titré. */
export function styledName(view: Pick<GameView, 'houses'>, c: Character | undefined): string {
  if (!c) return '—';
  const rank = rankName(c);
  const pt = primaryTitleId(c);
  if (!rank || !pt) return fullName(view, c);
  return `${t(`rank.holder.${c.sex}.${rank}`)} ${c.firstName} ${deName(titleLandName(pt))}`;
}

export function charName(view: Pick<GameView, 'houses'>, c: Character | undefined): string {
  if (!c) return '—';
  return fullName(view, c);
}

/** Nom avec titre : « Aélis de Valorie, Reine de Valorie ». */
export function charNameWithTitle(view: Pick<GameView, 'houses'>, c: Character | undefined): string {
  if (!c) return '—';
  const title = rulerTitle(c);
  return title ? `${title} ${c.firstName}` : fullName(view, c);
}

export function ageText(c: Character, date: number): string {
  const age = ageOf(c, date);
  if (c.death !== null) return `† ${formatDateFr(c.death)} (${age} ans)`;
  return `${age} an${age > 1 ? 's' : ''}`;
}

export const TRAIT_BY_ID = Object.fromEntries(CONTENT.traits.map((tr) => [tr.id, tr]));

/** Polarité d'un trait pour l'affichage (vert/rouge/neutre). */
export function traitTone(id: string): 'pos' | 'neg' | '' {
  const def = TRAIT_BY_ID[id];
  if (!def) return '';
  if (def.disease || def.shunned) return 'neg';
  const m = def.modifiers ?? {};
  const skills = Object.values(def.skills ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);
  const score = (m.general_opinion ?? 0) / 5 + skills + (m.health ?? 0) * 2 + (m.fertility ?? 0) * 5 + (m.domain_limit ?? 0);
  if (def.category === 'personality') return '';
  if (score >= 1) return 'pos';
  if (score <= -1) return 'neg';
  return '';
}

export { formatDateFr };
