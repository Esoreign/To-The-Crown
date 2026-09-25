/**
 * Couleurs de la carte selon le mode (politique, culture, économie…).
 * Pure : dépend uniquement de la vue de jeu et du joueur.
 */
import { CULTURE_BY_ID, FAITH_BY_ID, WORLD } from '@ttc/content';
import { PROVINCE_GEO, areAllied, atWarWith, isInRealmOf, provinceTax, topLiegeId } from '@ttc/game-core';
import type { GameView, Terrain } from '@ttc/shared';
import type { MapMode } from '../state/ui';

export interface ProvinceColor {
  color: number;
  alpha: number;
}

export interface LegendEntry {
  label: string;
  color: string;
}

export const TERRAIN_COLORS: Record<Terrain, string> = {
  plains: '#a7a268',
  farmlands: '#b9a95a',
  hills: '#8f7d56',
  mountains: '#7c7266',
  forest: '#4e6a3c',
  marsh: '#5f7263',
  steppe: '#b99d6a',
  coast_cliffs: '#9a9282',
  jungle: '#2f5a32',
  desert: '#d8c28a',
  savanna: '#b8a45c',
  tundra: '#9aa294',
  ice: '#e6ecef',
};

export const hexToNum = (hex: string): number => parseInt(hex.replace('#', ''), 16);
export const rgbToNum = (c: [number, number, number]): number => (c[0] << 16) | (c[1] << 8) | c[2];
export const numToHex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

const TITLE_COLOR: Record<string, number> = Object.fromEntries(WORLD.titles.map((t) => [t.id, rgbToNum(t.color)]));

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function ramp(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? lerpColor(0x6e2a22, 0xc9a24b, c * 2) : lerpColor(0xc9a24b, 0x4f8a3c, (c - 0.5) * 2);
}

/** Couleur politique : titre principal du souverain indépendant. */
export function realmColor(view: Pick<GameView, 'characters' | 'titles'>, provinceId: string): number {
  const geo = PROVINCE_GEO[provinceId];
  if (!geo) return 0x777777;
  const holder = view.titles[geo.countyTitleId]?.holderId;
  if (!holder) return 0x666666;
  const top = topLiegeId(view, holder);
  const primary = view.characters[top]?.titleIds[0];
  return primary ? TITLE_COLOR[primary] ?? 0x777777 : 0x777777;
}

const PROVINCES = WORLD.provinces;

export function computeColors(view: GameView, mode: MapMode, playerId: string | null): { colors: Map<string, ProvinceColor>; legend: LegendEntry[] } {
  const colors = new Map<string, ProvinceColor>();
  const legend: LegendEntry[] = [];
  switch (mode) {
    case 'political':
    case 'terrain': {
      for (const p of PROVINCES) colors.set(p.id, { color: realmColor(view, p.id), alpha: mode === 'terrain' ? 0.08 : 0.62 });
      if (mode === 'terrain') for (const [k, v] of Object.entries(TERRAIN_COLORS)) legend.push({ label: `terrain.${k}`, color: v });
      break;
    }
    case 'culture': {
      for (const p of PROVINCES) {
        const c = CULTURE_BY_ID[view.provinces[p.id]?.cultureId ?? p.cultureId];
        colors.set(p.id, { color: hexToNum(c?.color ?? '#777777'), alpha: 0.72 });
      }
      for (const c of Object.values(CULTURE_BY_ID)) legend.push({ label: `culture.${c.id}`, color: c.color });
      break;
    }
    case 'faith': {
      for (const p of PROVINCES) {
        const f = FAITH_BY_ID[view.provinces[p.id]?.faithId ?? p.faithId];
        colors.set(p.id, { color: hexToNum(f?.color ?? '#777777'), alpha: 0.72 });
      }
      for (const f of Object.values(FAITH_BY_ID)) legend.push({ label: `faith.${f.id}`, color: f.color });
      break;
    }
    case 'economy': {
      const taxes = PROVINCES.map((p) => provinceTax(view, p.id));
      const max = Math.max(...taxes, 1);
      PROVINCES.forEach((p, i) => colors.set(p.id, { color: ramp(taxes[i]! / max), alpha: 0.78 }));
      legend.push({ label: 'legend.low', color: '#6e2a22' }, { label: 'legend.mid', color: '#c9a24b' }, { label: 'legend.high', color: '#4f8a3c' });
      break;
    }
    case 'development': {
      for (const p of PROVINCES) colors.set(p.id, { color: ramp((view.provinces[p.id]?.development ?? 0) / 50), alpha: 0.78 });
      legend.push({ label: 'legend.low', color: '#6e2a22' }, { label: 'legend.mid', color: '#c9a24b' }, { label: 'legend.high', color: '#4f8a3c' });
      break;
    }
    case 'control': {
      for (const p of PROVINCES) {
        const occupied = !!view.titles[p.countyTitleId]?.occupiedBy;
        const c = view.provinces[p.id]?.control ?? 0;
        colors.set(p.id, { color: occupied ? 0x7a1a1a : ramp((c - 40) / 60), alpha: 0.78 });
      }
      legend.push({ label: 'legend.occupied', color: '#7a1a1a' }, { label: 'legend.low', color: '#6e2a22' }, { label: 'legend.high', color: '#4f8a3c' });
      break;
    }
    case 'diplomacy': {
      const me = playerId;
      const myTop = me ? topLiegeId(view, me) : null;
      for (const p of PROVINCES) {
        const holder = view.titles[p.countyTitleId]?.holderId;
        let color = 0x6b6258;
        if (me && holder) {
          const top = topLiegeId(view, holder);
          if (holder === me) color = 0xd9b865;
          else if (isInRealmOf(view, holder, me)) color = 0xa7883f;
          else if (myTop && top === myTop && holder !== me) color = 0x5f7fb0;
          else if (atWarWith(view, top, myTop ?? me) || atWarWith(view, holder, me)) color = 0xb03a2e;
          else if (areAllied(view, top, myTop ?? me) || areAllied(view, holder, me)) color = 0x4f9a5a;
        }
        colors.set(p.id, { color, alpha: 0.75 });
      }
      legend.push(
        { label: 'diplo.self', color: '#d9b865' },
        { label: 'diplo.vassal', color: '#a7883f' },
        { label: 'diplo.liege', color: '#5f7fb0' },
        { label: 'diplo.ally', color: '#4f9a5a' },
        { label: 'diplo.enemy', color: '#b03a2e' },
        { label: 'diplo.neutral', color: '#6b6258' },
      );
      break;
    }
  }
  return { colors, legend };
}
