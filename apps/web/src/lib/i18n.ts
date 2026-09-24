import { LOCALE_FR } from '@ttc/content';
import { createTranslator, formatNumber, formatSigned } from '@ttc/shared';

export const t = createTranslator(LOCALE_FR);

/** Traduction avec repli lisible si la clé est absente. */
export function tOr(key: string, fallback: string, vars?: Record<string, string | number>): string {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

export function traitName(id: string, sex: 'M' | 'F' = 'M'): string {
  if (sex === 'F') {
    const f = t(`trait.F.${id}`);
    if (f !== `trait.F.${id}`) return f;
  }
  return tOr(`trait.${id}`, id);
}

export function opinionReason(reason: string): string {
  if (reason.startsWith('opinion.reason.')) return tOr(reason, 'Souvenir');
  const direct = t(`opinion.${reason}`);
  if (direct !== `opinion.${reason}`) return direct;
  return tOr(`opinion.reason.${reason}`, 'Souvenir d’un événement');
}

export function modifierName(id: string): string {
  return tOr(`modifier.${id}`, id.replace(/_/g, ' '));
}

export const fmt = (n: number, d = 0) => formatNumber(n, d);
export const fmtSigned = (n: number, d = 1) => formatSigned(n, d);

export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 10000) return `${formatNumber(n / 1000, 0)} k`;
  if (a >= 1000) return `${formatNumber(n / 1000, 1)} k`;
  return formatNumber(n, a < 10 && n % 1 !== 0 ? 1 : 0);
}

export function errorMessage(code: string | undefined, fallback?: string): string {
  if (!code) return fallback ?? t('error.INTERNAL');
  return tOr(`error.${code}`, fallback ?? code);
}
