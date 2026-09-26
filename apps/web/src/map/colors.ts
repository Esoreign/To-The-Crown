/**
 * Couleurs de la carte selon le mode (politique, culture, économie…).
 * Pure : dépend uniquement de la vue de jeu et du joueur.
 */
import { CULTURE_BY_ID, FAITH_BY_ID, GOVERNMENTS, WORLD } from '@ttc/content';
import {
  PROVINCE_GEO,
  areAllied,
  atWarWith,
  isInRealmOf,
  pactsAsOverlord,
  pactsAsSubject,
  provinceTax,
  topLiegeId,
} from '@ttc/game-core';
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

const TITLE_COLOR: Record<string, number> = Object.fromEntries(
  WORLD.titles.map((t) => [t.id, rgbToNum(t.color)]),
);

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
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
  return primary ? (TITLE_COLOR[primary] ?? 0x777777) : 0x777777;
}

const PROVINCES = WORLD.provinces;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Couleurs politiques : couleur du royaume indépendant ; les terres tenues par
 * un vassal sont éclaircies (nuance propre à chaque grand vassal), si bien que
 * le domaine personnel du souverain se distingue d'un coup d'œil.
 */
function politicalColors(view: GameView): Map<string, number> {
  const out = new Map<string, number>();
  const branchOf = new Map<string, { top: string; branch: string }>();
  const resolve = (holder: string) => {
    const known = branchOf.get(holder);
    if (known) return known;
    let branch = holder;
    let cur = view.characters[holder];
    let guard = 0;
    while (cur?.liegeId && guard++ < 12) {
      const liege = view.characters[cur.liegeId];
      if (!liege) break;
      if (!liege.liegeId) break;
      branch = liege.id;
      cur = liege;
    }
    const top = cur?.liegeId ?? holder;
    const r = { top: view.characters[top] ? top : holder, branch: cur?.liegeId ? branch : holder };
    branchOf.set(holder, r);
    return r;
  };
  for (const p of PROVINCES) {
    const holder = view.titles[p.countyTitleId]?.holderId;
    if (!holder) {
      out.set(p.id, 0x666666);
      continue;
    }
    const { top, branch } = resolve(holder);
    const primary = view.characters[top]?.titleIds[0];
    const base = primary ? (TITLE_COLOR[primary] ?? 0x777777) : 0x777777;
    out.set(p.id, branch === top ? base : lerpColor(base, 0xf4ecd8, 0.16 + (hashId(branch) % 3) * 0.07));
  }
  return out;
}

/** Teintes des formes de gouvernement (regroupées par familles voisines). */
const GOVERNMENT_COLORS: Record<string, string> = {
  feudal_monarchy: '#8a5a3c',
  centralized_monarchy: '#b0703a',
  elective_monarchy: '#c9955a',
  imperial_bureaucracy: '#c8a23c',
  mamluk_sultanate: '#9c3a2e',
  iqta_realm: '#b85a44',
  steppe_confederation: '#7c8a3a',
  tribal_confederation: '#5f7a4a',
  chiefdom: '#4a6a58',
  clan_realm: '#6a8a7a',
  warrior_shogunate: '#7a3a5a',
  city_republic: '#3a6a9a',
  merchant_republic: '#2f86a0',
  city_state: '#5a8ab8',
  theocracy: '#e0d8b8',
  holy_order: '#b8b0a0',
  tributary_empire: '#a0508a',
  mandala_kingdom: '#6a4aa0',
};

/** Statut d'un royaume vis-à-vis des contrats de sujétion. */
const SUBJECT_COLORS: Record<string, string> = {
  sovereign: '#6b6258',
  overlord: '#d9b865',
  tributary: '#c0622e',
  client_state: '#9a4aa0',
  personal_union: '#4f7fc0',
  autonomous_vassal: '#3f9a8a',
  confederate_member: '#5a9a4a',
  direct_vassal: '#8a7a5a',
};

/** Garde les entrées de légende les plus représentées (la carte en compte des centaines). */
function topLegend(
  counts: Map<string, number>,
  label: (id: string) => string,
  color: (id: string) => string,
  max = 14,
): LegendEntry[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([id]) => ({ label: label(id), color: color(id) }));
}

export function computeColors(
  view: GameView,
  mode: MapMode,
  playerId: string | null,
): { colors: Map<string, ProvinceColor>; legend: LegendEntry[] } {
  const colors = new Map<string, ProvinceColor>();
  const legend: LegendEntry[] = [];
  switch (mode) {
    case 'political': {
      for (const [id, color] of politicalColors(view)) colors.set(id, { color, alpha: 0.62 });
      break;
    }
    case 'terrain': {
      for (const p of PROVINCES) colors.set(p.id, { color: realmColor(view, p.id), alpha: 0.08 });
      for (const [k, v] of Object.entries(TERRAIN_COLORS)) legend.push({ label: `terrain.${k}`, color: v });
      break;
    }
    case 'culture': {
      const counts = new Map<string, number>();
      for (const p of PROVINCES) {
        const id = view.provinces[p.id]?.cultureId ?? p.cultureId;
        const c = CULTURE_BY_ID[id];
        colors.set(p.id, { color: hexToNum(c?.color ?? '#777777'), alpha: 0.72 });
        if (c) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      legend.push(
        ...topLegend(
          counts,
          (id) => `culture.${id}`,
          (id) => CULTURE_BY_ID[id]!.color,
        ),
      );
      break;
    }
    case 'faith': {
      const counts = new Map<string, number>();
      for (const p of PROVINCES) {
        const id = view.provinces[p.id]?.faithId ?? p.faithId;
        const f = FAITH_BY_ID[id];
        colors.set(p.id, { color: hexToNum(f?.color ?? '#777777'), alpha: 0.72 });
        if (f) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      legend.push(
        ...topLegend(
          counts,
          (id) => `faith.${id}`,
          (id) => FAITH_BY_ID[id]!.color,
        ),
      );
      break;
    }
    case 'economy': {
      const taxes = PROVINCES.map((p) => provinceTax(view, p.id));
      const max = Math.max(...taxes, 1);
      PROVINCES.forEach((p, i) => colors.set(p.id, { color: ramp(taxes[i]! / max), alpha: 0.78 }));
      legend.push(
        { label: 'legend.low', color: '#6e2a22' },
        { label: 'legend.mid', color: '#c9a24b' },
        { label: 'legend.high', color: '#4f8a3c' },
      );
      break;
    }
    case 'development': {
      for (const p of PROVINCES)
        colors.set(p.id, { color: ramp((view.provinces[p.id]?.development ?? 0) / 50), alpha: 0.78 });
      legend.push(
        { label: 'legend.low', color: '#6e2a22' },
        { label: 'legend.mid', color: '#c9a24b' },
        { label: 'legend.high', color: '#4f8a3c' },
      );
      break;
    }
    case 'control': {
      for (const p of PROVINCES) {
        const occupied = !!view.titles[p.countyTitleId]?.occupiedBy;
        const c = view.provinces[p.id]?.control ?? 0;
        colors.set(p.id, { color: occupied ? 0x7a1a1a : ramp((c - 40) / 60), alpha: 0.78 });
      }
      legend.push(
        { label: 'legend.occupied', color: '#7a1a1a' },
        { label: 'legend.low', color: '#6e2a22' },
        { label: 'legend.high', color: '#4f8a3c' },
      );
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
    case 'government': {
      const counts = new Map<string, number>();
      const govOf = new Map<string, string>();
      for (const p of PROVINCES) {
        const holder = view.titles[p.countyTitleId]?.holderId;
        let gov = '';
        if (holder) {
          const top = topLiegeId(view, holder);
          if (!govOf.has(top)) govOf.set(top, view.characters[top]?.government ?? '');
          gov = govOf.get(top)!;
        }
        colors.set(p.id, { color: hexToNum(GOVERNMENT_COLORS[gov] ?? '#5a544c'), alpha: gov ? 0.75 : 0.35 });
        if (gov) counts.set(gov, (counts.get(gov) ?? 0) + 1);
      }
      legend.push(
        ...topLegend(
          counts,
          (id) => `government.${id}`,
          (id) => GOVERNMENT_COLORS[id] ?? '#5a544c',
          GOVERNMENTS.length,
        ),
      );
      break;
    }
    case 'subjects': {
      // Premier contrat rencontré en remontant la chaîne vassalique ; sinon
      // suzerain (s'il a des sujets externes) ou souverain.
      const statusOf = new Map<string, string>();
      const status = (id: string): string => {
        const known = statusOf.get(id);
        if (known) return known;
        let result = 'sovereign';
        const own = pactsAsSubject(view, id)[0];
        const c = view.characters[id];
        if (own) result = own.type;
        else if (c?.liegeId) result = status(c.liegeId);
        else if (pactsAsOverlord(view, id).length) result = 'overlord';
        statusOf.set(id, result);
        return result;
      };
      const counts = new Map<string, number>();
      for (const p of PROVINCES) {
        const holder = view.titles[p.countyTitleId]?.holderId;
        const st = holder ? status(holder) : 'sovereign';
        colors.set(p.id, {
          color: hexToNum(SUBJECT_COLORS[st] ?? SUBJECT_COLORS.sovereign!),
          alpha: holder ? 0.75 : 0.35,
        });
        counts.set(st, (counts.get(st) ?? 0) + 1);
      }
      for (const id of Object.keys(SUBJECT_COLORS))
        if (counts.has(id))
          legend.push({
            label:
              id === 'sovereign'
                ? 'legend.sovereign'
                : id === 'overlord'
                  ? 'legend.overlord'
                  : `subject.${id}`,
            color: SUBJECT_COLORS[id]!,
          });
      break;
    }
  }
  return { colors, legend };
}
