/**
 * Calendrier de Caldria : années de 365 jours (pas d'années bissextiles),
 * mois de longueurs réelles. Une date est un entier : nombre de jours depuis
 * le 1er janvier de l'an 0.
 */

export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
export const DAYS_PER_YEAR = 365;

const MONTH_OFFSETS: number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const len of MONTH_LENGTHS) {
    out.push(acc);
    acc += len;
  }
  return out;
})();

export const MONTH_NAMES_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

export interface CalendarDate {
  year: number;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
}

export function toDay(year: number, month: number, day: number): number {
  const offset = MONTH_OFFSETS[month - 1];
  if (offset === undefined) throw new Error(`Mois invalide: ${month}`);
  return year * DAYS_PER_YEAR + offset + (day - 1);
}

export function fromDay(dayIndex: number): CalendarDate {
  const year = Math.floor(dayIndex / DAYS_PER_YEAR);
  let rest = dayIndex - year * DAYS_PER_YEAR;
  let month = 0;
  while (month < 11 && rest >= (MONTH_LENGTHS[month] ?? 31)) {
    rest -= MONTH_LENGTHS[month] ?? 31;
    month++;
  }
  return { year, month: month + 1, day: rest + 1 };
}

export function isFirstOfMonth(dayIndex: number): boolean {
  return fromDay(dayIndex).day === 1;
}

export function isFirstOfYear(dayIndex: number): boolean {
  const d = fromDay(dayIndex);
  return d.day === 1 && d.month === 1;
}

/** Âge en années révolues. */
export function ageAt(birth: number, now: number): number {
  return Math.floor((now - birth) / DAYS_PER_YEAR);
}

export function formatDateFr(dayIndex: number): string {
  const d = fromDay(dayIndex);
  const day = d.day === 1 ? '1er' : String(d.day);
  return `${day} ${MONTH_NAMES_FR[d.month - 1]} ${d.year}`;
}

export function formatMonthYearFr(dayIndex: number): string {
  const d = fromDay(dayIndex);
  return `${MONTH_NAMES_FR[d.month - 1]} ${d.year}`;
}

export function yearsToDays(years: number): number {
  return Math.round(years * DAYS_PER_YEAR);
}
