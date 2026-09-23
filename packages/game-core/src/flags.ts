import type { Character } from '@ttc/shared';

/** Drapeau permanent. */
export const PERMANENT = Number.MAX_SAFE_INTEGER;

export function setFlag(c: Character, name: string, date: number, months?: number): void {
  c.flags[name] = months ? date + Math.round(months * 30.4) : PERMANENT;
}

export function hasFlag(c: Character, name: string, date: number): boolean {
  const v = c.flags[name];
  return v !== undefined && v > date;
}

export function clearFlag(c: Character, name: string): void {
  delete c.flags[name];
}

export function pruneFlags(c: Character, date: number): void {
  for (const [k, v] of Object.entries(c.flags)) if (v <= date) delete c.flags[k];
  for (const [k, v] of Object.entries(c.cooldowns)) if (v <= date) delete c.cooldowns[k];
}
