/**
 * Portraits stylisés « enluminure » assemblés par couches SVG à partir de
 * la graine du personnage. Même graine + même âge ⇒ même portrait.
 * Variations : sexe, âge (enfant/adulte/âgé), culture (teint, cheveux,
 * vêtements), rang (fond, couronne), santé et traits visibles.
 */
import type { Character } from '@ttc/shared';
import { CULTURE_BY_ID } from '@ttc/content';

function rng(seed: number): () => number {
  let a = seed >>> 0 || 7;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIN = ['#f1d9c2', '#e6c2a0', '#d6a67f', '#b98460', '#94613f', '#6f4630'];
const HAIR = ['#e3cf8f', '#b68a4c', '#7a4f2a', '#3d2716', '#1b1512', '#a24a26', '#141212'];
const EYES = ['#4a6d8c', '#5a7a4a', '#6b4a2a', '#3b2a1a', '#7b8b95'];

const CLOTHING: Record<string, { main: string[]; trim: string }> = {
  imperial: { main: ['#6e1e2a', '#2a3a6e', '#4b2a5e'], trim: '#d6ad3f' },
  chivalric: { main: ['#27457e', '#7b2130', '#3c5a2e'], trim: '#e8e0c8' },
  northern: { main: ['#3f4a55', '#5a3b28', '#2d3f3a'], trim: '#b8b1a0' },
  southern: { main: ['#b5782a', '#8a2d2d', '#2d6a6a'], trim: '#e7c46a' },
  eastern: { main: ['#3e5a2e', '#6b3a22', '#2e4a5a'], trim: '#d0b070' },
  moorland: { main: ['#4a3a5e', '#3a5a3a', '#6a4a2a'], trim: '#c0a878' },
  maritime: { main: ['#1f5a6a', '#2a3a5a', '#6a5a3a'], trim: '#d8d0b0' },
  steppe: { main: ['#8a3a22', '#5a4a2a', '#2a4a6a'], trim: '#d6a84a' },
};

export interface PortraitOpts {
  age: number;
  /** 0 aucun titre … 4 empereur. */
  rank: number;
  houseColor?: string;
  dead?: boolean;
}

const cache = new Map<string, string>();

export function portraitSvg(c: Pick<Character, 'portraitSeed' | 'sex' | 'cultureId' | 'traits'>, o: PortraitOpts): string {
  const stage = o.age < 12 ? 'child' : o.age < 18 ? 'teen' : o.age < 55 ? 'adult' : 'old';
  const flags = ['ill', 'grey_fever', 'wounded', 'maimed', 'comely', 'homely', 'infirm'].filter((t) => c.traits.includes(t)).join(',');
  const key = `${c.portraitSeed}|${c.sex}|${c.cultureId}|${stage}|${o.rank}|${o.houseColor ?? ''}|${o.dead ? 1 : 0}|${flags}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(c.portraitSeed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;
  const app = CULTURE_BY_ID[c.cultureId]?.appearance ?? { skinTones: [1, 2], hairColors: [1, 2], clothing: 'imperial' };
  const skin = SKIN[pick(app.skinTones)] ?? SKIN[1]!;
  let hair = HAIR[pick(app.hairColors)] ?? HAIR[2]!;
  const eye = pick(EYES);
  const cloth = CLOTHING[app.clothing] ?? CLOTHING.imperial!;
  const main = pick(cloth.main);
  const female = c.sex === 'F';
  const child = stage === 'child';
  const old = stage === 'old';
  if (old) hair = r() < 0.5 ? '#c9c4bb' : '#9a958d';
  const faceW = child ? 30 : female ? 33 : 35;
  const faceH = child ? 34 : female ? 41 : 43;
  const faceShape = pick([0, 1, 2]);
  const cy = child ? 58 : 52;
  const jaw = faceShape === 0 ? 0.82 : faceShape === 1 ? 0.92 : 0.75;
  const face = `M${50 - faceW / 2} ${cy - faceH * 0.35} C${50 - faceW / 2} ${cy - faceH * 0.72} ${50 + faceW / 2} ${cy - faceH * 0.72} ${50 + faceW / 2} ${cy - faceH * 0.35} C${50 + faceW / 2} ${cy + faceH * 0.2} ${50 + (faceW / 2) * jaw} ${cy + faceH * 0.45} 50 ${cy + faceH * 0.52} C${50 - (faceW / 2) * jaw} ${cy + faceH * 0.45} ${50 - faceW / 2} ${cy + faceH * 0.2} ${50 - faceW / 2} ${cy - faceH * 0.35} Z`;

  // Fond selon le rang.
  const bgs = ['#2a2420', '#2f3a2c', '#2c3446', '#4a2228', '#3d2c52'];
  const bg = bgs[Math.min(4, o.rank)]!;
  const background = `<rect width="100" height="120" fill="${bg}"/><radialGradient id="pg${c.portraitSeed}" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></radialGradient><rect width="100" height="120" fill="url(#pg${c.portraitSeed})"/>${o.houseColor ? `<rect x="0" y="0" width="100" height="6" fill="${o.houseColor}" opacity="0.8"/>` : ''}`;

  // Buste et vêtements.
  const shoulder = child ? 26 : female ? 34 : 40;
  const neckY = cy + faceH * 0.45;
  const body = `<path d="M${50 - 7} ${neckY - 4} L${50 - 7} ${neckY + 6} C${50 - shoulder} ${neckY + 10} ${50 - shoulder - 6} ${neckY + 24} ${50 - shoulder - 8} 120 L${50 + shoulder + 8} 120 C${50 + shoulder + 6} ${neckY + 24} ${50 + shoulder} ${neckY + 10} ${50 + 7} ${neckY + 6} L${50 + 7} ${neckY - 4} Z" fill="${skin}"/>`;
  const collarStyle = pick([0, 1, 2]);
  const garment =
    collarStyle === 0
      ? `<path d="M${50 - shoulder - 8} 120 C${50 - shoulder - 6} ${neckY + 22} ${50 - shoulder} ${neckY + 9} ${50 - 9} ${neckY + 6} L50 ${neckY + 18} L${50 + 9} ${neckY + 6} C${50 + shoulder} ${neckY + 9} ${50 + shoulder + 6} ${neckY + 22} ${50 + shoulder + 8} 120 Z" fill="${main}"/><path d="M${50 - 9} ${neckY + 6} L50 ${neckY + 18} L${50 + 9} ${neckY + 6}" fill="none" stroke="${cloth.trim}" stroke-width="2"/>`
      : collarStyle === 1
        ? `<path d="M${50 - shoulder - 8} 120 C${50 - shoulder - 6} ${neckY + 22} ${50 - shoulder} ${neckY + 9} ${50 - 10} ${neckY + 5} Q50 ${neckY + 10} ${50 + 10} ${neckY + 5} C${50 + shoulder} ${neckY + 9} ${50 + shoulder + 6} ${neckY + 22} ${50 + shoulder + 8} 120 Z" fill="${main}"/><path d="M${50 - 10} ${neckY + 5} Q50 ${neckY + 10} ${50 + 10} ${neckY + 5}" fill="none" stroke="${cloth.trim}" stroke-width="2.4"/>`
        : `<path d="M${50 - shoulder - 8} 120 C${50 - shoulder - 6} ${neckY + 20} ${50 - shoulder} ${neckY + 8} ${50 - 12} ${neckY + 3} L${50 + 12} ${neckY + 3} C${50 + shoulder} ${neckY + 8} ${50 + shoulder + 6} ${neckY + 20} ${50 + shoulder + 8} 120 Z" fill="${main}"/><rect x="${50 - 13}" y="${neckY + 1}" width="26" height="5" rx="2" fill="${cloth.trim}"/>`;
  const cloak = o.rank >= 2 ? `<path d="M${50 - shoulder - 10} 120 C${50 - shoulder - 8} ${neckY + 18} ${50 - shoulder + 2} ${neckY + 10} ${50 - shoulder + 10} ${neckY + 12} L${50 - shoulder + 4} 120 Z M${50 + shoulder + 10} 120 C${50 + shoulder + 8} ${neckY + 18} ${50 + shoulder - 2} ${neckY + 10} ${50 + shoulder - 10} ${neckY + 12} L${50 + shoulder - 4} 120 Z" fill="${o.rank >= 3 ? '#7a1420' : '#3a2a4a'}"/>${o.rank >= 3 ? `<path d="M${50 - shoulder - 6} ${neckY + 16} q4 -3 8 0 q4 3 8 0" stroke="#f0ece0" stroke-width="3" fill="none" opacity="0.8"/>` : ''}` : '';
  const jewel = o.rank >= 1 && !child ? `<circle cx="50" cy="${neckY + 20}" r="${o.rank >= 3 ? 3.4 : 2.4}" fill="${cloth.trim}" stroke="#3a2a10" stroke-width="0.8"/>` : '';

  // Cheveux arrière.
  const long = female ? r() < 0.85 : r() < 0.25;
  const hairBack = long
    ? `<path d="M${50 - faceW / 2 - 5} ${cy - faceH * 0.3} C${50 - faceW / 2 - 9} ${cy + 18} ${50 - faceW / 2 - 4} ${cy + 34} ${50 - faceW / 2 + 2} ${cy + 40} L${50 + faceW / 2 - 2} ${cy + 40} C${50 + faceW / 2 + 4} ${cy + 34} ${50 + faceW / 2 + 9} ${cy + 18} ${50 + faceW / 2 + 5} ${cy - faceH * 0.3} Z" fill="${hair}"/>`
    : '';

  // Traits du visage.
  const eyeY = cy - faceH * 0.08;
  const eyeDx = faceW * 0.21;
  const eyeSize = child ? 3.2 : 2.5;
  const eyeStyle = pick([0, 1, 2]);
  const eyes = [-1, 1]
    .map((s) => {
      const x = 50 + s * eyeDx;
      const shape =
        eyeStyle === 0
          ? `<ellipse cx="${x}" cy="${eyeY}" rx="${eyeSize + 1.2}" ry="${eyeSize * 0.75}" fill="#f4efe6"/>`
          : eyeStyle === 1
            ? `<path d="M${x - eyeSize - 1.4} ${eyeY} Q${x} ${eyeY - eyeSize * 1.2} ${x + eyeSize + 1.4} ${eyeY} Q${x} ${eyeY + eyeSize * 0.8} ${x - eyeSize - 1.4} ${eyeY} Z" fill="#f4efe6"/>`
            : `<path d="M${x - eyeSize - 1.2} ${eyeY + 0.3} Q${x} ${eyeY - eyeSize} ${x + eyeSize + 1.2} ${eyeY - 0.4} Q${x} ${eyeY + eyeSize * 0.6} ${x - eyeSize - 1.2} ${eyeY + 0.3} Z" fill="#f4efe6"/>`;
      return `${shape}<circle cx="${x}" cy="${eyeY}" r="${eyeSize * 0.62}" fill="${eye}"/><circle cx="${x}" cy="${eyeY}" r="${eyeSize * 0.28}" fill="#141010"/><circle cx="${x + 0.6}" cy="${eyeY - 0.7}" r="0.5" fill="#fff"/>`;
    })
    .join('');
  const browTilt = pick([-1.2, 0, 1.2]);
  const browW = female || child ? 1.2 : 1.9;
  const brows = [-1, 1]
    .map((s) => {
      const x = 50 + s * eyeDx;
      return `<path d="M${x - 5 * s} ${eyeY - 5 + browTilt} Q${x} ${eyeY - 7} ${x + 5 * s} ${eyeY - 5.5 - browTilt * 0.5}" stroke="${old ? '#8a847c' : hair}" stroke-width="${browW}" fill="none" stroke-linecap="round"/>`;
    })
    .join('');
  const noseStyle = pick([0, 1, 2, 3]);
  const noseY = cy + faceH * 0.1;
  const nose =
    noseStyle === 0
      ? `<path d="M49 ${eyeY + 2} Q47.5 ${noseY} 48.5 ${noseY + 1.5} Q50 ${noseY + 2.5} 52 ${noseY + 1}" stroke="#00000044" stroke-width="1.1" fill="none"/>`
      : noseStyle === 1
        ? `<path d="M50 ${eyeY + 2} L47.5 ${noseY + 1.5} L52 ${noseY + 1.5}" stroke="#00000040" stroke-width="1.1" fill="none" stroke-linejoin="round"/>`
        : noseStyle === 2
          ? `<path d="M50.5 ${eyeY + 1} Q46 ${noseY - 1} 48 ${noseY + 2} Q50 ${noseY + 3} 52.5 ${noseY + 2}" stroke="#00000048" stroke-width="1.2" fill="none"/>`
          : `<path d="M47.5 ${noseY + 1.5} Q50 ${noseY + 3} 52.5 ${noseY + 1.5}" stroke="#00000044" stroke-width="1.1" fill="none"/>`;
  const mouthY = cy + faceH * 0.27;
  const mouthW = child ? 4 : female ? 5.2 : 5.8;
  const smile = pick([-0.8, 0, 0.6, 1.2]);
  const lip = female ? '#a34a4a' : '#8a4a40';
  const mouth = `<path d="M${50 - mouthW} ${mouthY} Q50 ${mouthY + smile + 1.4} ${50 + mouthW} ${mouthY}" stroke="${lip}" stroke-width="${female ? 1.8 : 1.4}" fill="none" stroke-linecap="round"/>`;
  const cheeks = female || child ? `<circle cx="${50 - eyeDx - 1}" cy="${eyeY + 8}" r="3.4" fill="#d46a5a" opacity="0.18"/><circle cx="${50 + eyeDx + 1}" cy="${eyeY + 8}" r="3.4" fill="#d46a5a" opacity="0.18"/>` : '';
  const wrinkles = old
    ? `<path d="M${50 - eyeDx - 6} ${eyeY + 1} l-2 1.5 M${50 + eyeDx + 6} ${eyeY + 1} l2 1.5 M${50 - 8} ${mouthY - 5} q-2 4 0 7 M${50 + 8} ${mouthY - 5} q2 4 0 7 M${50 - 8} ${eyeY - 11} q8 -2 16 0" stroke="#00000033" stroke-width="0.9" fill="none"/>`
    : '';

  // Cheveux avant.
  const hairStyle = female ? pick([0, 1, 2]) : pick([0, 1, 2, 3]);
  const top = cy - faceH * 0.62;
  let hairFront: string;
  if (!female && old && r() < 0.35) {
    hairFront = `<path d="M${50 - faceW / 2 - 1} ${cy - faceH * 0.18} Q${50 - faceW / 2} ${cy - faceH * 0.45} ${50 - faceW / 2 + 5} ${cy - faceH * 0.5}" stroke="${hair}" stroke-width="4" fill="none"/><path d="M${50 + faceW / 2 + 1} ${cy - faceH * 0.18} Q${50 + faceW / 2} ${cy - faceH * 0.45} ${50 + faceW / 2 - 5} ${cy - faceH * 0.5}" stroke="${hair}" stroke-width="4" fill="none"/>`;
  } else if (hairStyle === 0) {
    hairFront = `<path d="M${50 - faceW / 2 - 3} ${cy - faceH * 0.18} C${50 - faceW / 2 - 4} ${top - 2} ${50 + faceW / 2 + 4} ${top - 2} ${50 + faceW / 2 + 3} ${cy - faceH * 0.18} C${50 + faceW / 2 - 2} ${cy - faceH * 0.4} ${50 + 4} ${top + 7} 50 ${top + 8} C${50 - 6} ${top + 7} ${50 - faceW / 2 + 2} ${cy - faceH * 0.4} ${50 - faceW / 2 - 3} ${cy - faceH * 0.18} Z" fill="${hair}"/>`;
  } else if (hairStyle === 1) {
    hairFront = `<path d="M${50 - faceW / 2 - 3} ${cy - faceH * 0.1} C${50 - faceW / 2 - 5} ${top - 4} ${50 + faceW / 2 + 5} ${top - 4} ${50 + faceW / 2 + 3} ${cy - faceH * 0.1} L${50 + faceW / 2 - 1} ${cy - faceH * 0.34} Q${50 + 10} ${top + 10} ${50 - 4} ${top + 9} Q${50 - faceW / 2 + 4} ${top + 11} ${50 - faceW / 2 + 1} ${cy - faceH * 0.34} Z" fill="${hair}"/>`;
  } else if (hairStyle === 2) {
    hairFront = `<path d="M${50 - faceW / 2 - 2} ${cy - faceH * 0.25} C${50 - faceW / 2} ${top - 5} ${50 + faceW / 2} ${top - 5} ${50 + faceW / 2 + 2} ${cy - faceH * 0.25} Q${50 + faceW / 4} ${top + 4} 50 ${top + 2} Q${50 - faceW / 4} ${top + 4} ${50 - faceW / 2 - 2} ${cy - faceH * 0.25} Z" fill="${hair}"/><path d="M50 ${top + 1} V${top + 10}" stroke="#00000030" stroke-width="1"/>`;
  } else {
    hairFront = `<path d="M${50 - faceW / 2 - 1} ${cy - faceH * 0.3} C${50 - faceW / 2} ${top} ${50 + faceW / 2} ${top} ${50 + faceW / 2 + 1} ${cy - faceH * 0.3} Q50 ${top + 5} ${50 - faceW / 2 - 1} ${cy - faceH * 0.3} Z" fill="${hair}"/>`;
  }

  // Barbe.
  let beard = '';
  if (!female && (stage === 'adult' || stage === 'old') && r() < 0.62) {
    const beardStyle = pick([0, 1, 2]);
    beard =
      beardStyle === 0
        ? `<path d="M${50 - faceW / 2 + 1} ${cy} C${50 - faceW / 2 + 2} ${cy + faceH * 0.45} ${50 - 6} ${cy + faceH * 0.66} 50 ${cy + faceH * 0.68} C${50 + 6} ${cy + faceH * 0.66} ${50 + faceW / 2 - 2} ${cy + faceH * 0.45} ${50 + faceW / 2 - 1} ${cy} C${50 + faceW / 2 - 4} ${cy + faceH * 0.25} ${50 + 7} ${mouthY - 4} 50 ${mouthY - 3} C${50 - 7} ${mouthY - 4} ${50 - faceW / 2 + 4} ${cy + faceH * 0.25} ${50 - faceW / 2 + 1} ${cy} Z" fill="${hair}"/><path d="M${50 - mouthW} ${mouthY} Q50 ${mouthY + smile + 1.4} ${50 + mouthW} ${mouthY}" stroke="#00000055" stroke-width="1.2" fill="none"/>`
        : beardStyle === 1
          ? `<path d="M${50 - 9} ${mouthY - 3.5} Q50 ${mouthY - 6.5} ${50 + 9} ${mouthY - 3.5} Q50 ${mouthY - 2} ${50 - 9} ${mouthY - 3.5} Z" fill="${hair}"/><path d="M${50 - 5} ${mouthY + 3} Q50 ${cy + faceH * 0.62} ${50 + 5} ${mouthY + 3} Z" fill="${hair}"/>`
          : `<path d="M${50 - 9} ${mouthY - 3} Q50 ${mouthY - 6} ${50 + 9} ${mouthY - 3} L${50 + 10} ${mouthY + 2} Q50 ${mouthY - 2} ${50 - 10} ${mouthY + 2} Z" fill="${hair}"/>`;
  }

  // Couronne / diadème.
  let crown = '';
  const cTop = top - 4;
  if (o.rank >= 3) {
    crown = `<path d="M${50 - faceW / 2} ${cTop + 6} L${50 - faceW / 2 + 2} ${cTop - 6} L${50 - 8} ${cTop + 1} L50 ${cTop - 10} L${50 + 8} ${cTop + 1} L${50 + faceW / 2 - 2} ${cTop - 6} L${50 + faceW / 2} ${cTop + 6} Z" fill="#d6ad3f" stroke="#5a3e10" stroke-width="1"/><circle cx="50" cy="${cTop - 1}" r="2.2" fill="#b3202a"/><circle cx="${50 - 9}" cy="${cTop + 2}" r="1.5" fill="#2a58a0"/><circle cx="${50 + 9}" cy="${cTop + 2}" r="1.5" fill="#2a58a0"/>`;
    if (o.rank >= 4) crown += `<path d="M${50 - faceW / 2} ${cTop + 6} Q50 ${cTop - 22} ${50 + faceW / 2} ${cTop + 6}" fill="none" stroke="#d6ad3f" stroke-width="2"/><path d="M50 ${cTop - 16} v-6 m-3 3 h6" stroke="#d6ad3f" stroke-width="1.8"/>`;
  } else if (o.rank === 2) {
    crown = `<path d="M${50 - faceW / 2 + 1} ${cTop + 6} L${50 - faceW / 2 + 3} ${cTop - 1} L${50 - 6} ${cTop + 3} L50 ${cTop - 3} L${50 + 6} ${cTop + 3} L${50 + faceW / 2 - 3} ${cTop - 1} L${50 + faceW / 2 - 1} ${cTop + 6} Z" fill="#c9a24b" stroke="#5a3e10" stroke-width="0.8"/>`;
  } else if (o.rank === 1 && female) {
    crown = `<path d="M${50 - faceW / 2 + 3} ${cTop + 7} Q50 ${cTop - 1} ${50 + faceW / 2 - 3} ${cTop + 7}" fill="none" stroke="#c9a24b" stroke-width="2"/><circle cx="50" cy="${cTop + 3}" r="1.6" fill="#3a8a8a"/>`;
  }

  // Marques et santé.
  let marks = '';
  if (c.traits.includes('wounded') || c.traits.includes('maimed')) {
    marks += `<path d="M${50 + eyeDx - 3} ${eyeY - 9} L${50 + eyeDx + 4} ${eyeY + 9}" stroke="#7a2a2a" stroke-width="1.3" opacity="0.8"/>`;
  }
  const sickTint = c.traits.includes('ill') || c.traits.includes('grey_fever') ? `<path d="${face}" fill="#6a8a5a" opacity="0.2"/>` : '';
  const shade = `<path d="${face}" fill="url(#ps${c.portraitSeed})"/><linearGradient id="ps${c.portraitSeed}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.12"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>`;
  const ears = `<ellipse cx="${50 - faceW / 2}" cy="${eyeY + 3}" rx="2.6" ry="4.2" fill="${skin}"/><ellipse cx="${50 + faceW / 2}" cy="${eyeY + 3}" rx="2.6" ry="4.2" fill="${skin}"/>`;
  const deadFilter = o.dead ? '<rect width="100" height="120" fill="#000" opacity="0.35"/>' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"${o.dead ? ' style="filter:grayscale(1)"' : ''}>${background}${hairBack}${body}${cloak}${garment}${jewel}${ears}<path d="${face}" fill="${skin}"/>${shade}${sickTint}${cheeks}${eyes}${brows}${nose}${mouth}${wrinkles}${beard}${hairFront}${marks}${crown}${deadFilter}</svg>`;
  cache.set(key, svg);
  return svg;
}

export function portraitDataUrl(c: Parameters<typeof portraitSvg>[0], o: PortraitOpts): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(c, o))}`;
}
