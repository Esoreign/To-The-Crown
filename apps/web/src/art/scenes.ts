/**
 * Illustrations d'événements procédurales (SVG) : compositions en
 * silhouettes superposées, éclairage chaud ou froid selon le lieu.
 * Aucune image externe.
 */
import type { IllustrationKey } from '@ttc/shared';

interface Palette {
  sky: [string, string];
  light: string;
  far: string;
  mid: string;
  near: string;
}

const WARM: Palette = { sky: ['#3b2413', '#120b07'], light: '#f0b35a', far: '#2a1a10', mid: '#1c120b', near: '#0d0806' };
const COLD: Palette = { sky: ['#1d2a3a', '#0a0e14'], light: '#a9c3e0', far: '#18222e', mid: '#10171f', near: '#07090c' };
const DUSK: Palette = { sky: ['#5a3322', '#1a0f0c'], light: '#ffb070', far: '#3a2219', mid: '#22140f', near: '#0e0806' };
const DAY: Palette = { sky: ['#8a9a8a', '#3b4636'], light: '#f6e2a8', far: '#4c5a44', mid: '#2e3829', near: '#171c14' };
const BLOOD: Palette = { sky: ['#4a1812', '#140605'], light: '#ff7a4a', far: '#2e110c', mid: '#1c0a07', near: '#0c0403' };
const GREEN: Palette = { sky: ['#2c3a24', '#0e140b'], light: '#d9e6a0', far: '#223019', mid: '#151f10', near: '#0a0f07' };

function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

const W = 600;
const H = 240;

function base(p: Palette, glowX = 300, glowY = 120, glowR = 260): string {
  return `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>
<radialGradient id="glow" cx="${glowX}" cy="${glowY}" r="${glowR}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.light}" stop-opacity="0.55"/><stop offset="0.45" stop-color="${p.light}" stop-opacity="0.12"/><stop offset="1" stop-color="${p.light}" stop-opacity="0"/></radialGradient>
<linearGradient id="vig" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="2"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>`;
}

const close = `<rect width="${W}" height="${H}" fill="url(#vig)"/>`;

function hills(r: () => number, color: string, baseY: number, amp: number, n = 6): string {
  let d = `M0 ${H} L0 ${baseY}`;
  for (let i = 1; i <= n; i++) {
    const x = (W / n) * i;
    const cx = x - W / n / 2;
    d += ` Q${cx.toFixed(0)} ${(baseY - amp * (0.4 + r())).toFixed(0)} ${x.toFixed(0)} ${(baseY - amp * r() * 0.4).toFixed(0)}`;
  }
  return `<path d="${d} L${W} ${H} Z" fill="${color}"/>`;
}

function trees(r: () => number, color: string, y: number, count: number, size: number): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = r() * W;
    const h = size * (0.6 + r() * 0.8);
    s += `<path d="M${x} ${y - h} L${x - h * 0.32} ${y} L${x + h * 0.32} ${y} Z" fill="${color}"/>`;
  }
  return s;
}

function castle(x: number, y: number, s: number, color: string, light?: string): string {
  const w = 120 * s;
  let g = `<g fill="${color}">`;
  g += `<rect x="${x - w / 2}" y="${y - 50 * s}" width="${w}" height="${50 * s}"/>`;
  for (const dx of [-w / 2, w / 2 - 22 * s, -11 * s]) {
    const th = dx === -11 * s ? 95 : 75;
    g += `<rect x="${x + dx}" y="${y - th * s}" width="${22 * s}" height="${th * s}"/>`;
    g += `<path d="M${x + dx - 3 * s} ${y - th * s} L${x + dx + 11 * s} ${y - (th + 18) * s} L${x + dx + 25 * s} ${y - th * s} Z"/>`;
  }
  for (let i = 0; i < 6; i++) g += `<rect x="${x - w / 2 + i * (w / 6)}" y="${y - 56 * s}" width="${(w / 12).toFixed(1)}" height="${6 * s}"/>`;
  g += '</g>';
  if (light) {
    for (const [dx, dy] of [
      [-30, -30],
      [8, -60],
      [34, -26],
    ] as const)
      g += `<rect x="${x + dx * s}" y="${y + dy * s}" width="${4 * s}" height="${7 * s}" fill="${light}" opacity="0.85"/>`;
  }
  return g;
}

function arches(color: string, count: number, light: string): string {
  let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="${color}" opacity="0.0"/>`;
  const w = W / count;
  for (let i = 0; i < count; i++) {
    const x = i * w;
    s += `<path d="M${x} ${H} L${x} 70 Q${x + w / 2} 10 ${x + w} 70 L${x + w} ${H} L${x + w - 14} ${H} L${x + w - 14} 76 Q${x + w / 2} 26 ${x + 14} 76 L${x + 14} ${H} Z" fill="${color}"/>`;
  }
  s += `<rect x="0" y="0" width="${W}" height="18" fill="${color}"/>`;
  s += `<rect x="0" y="${H - 26}" width="${W}" height="26" fill="${color}"/>`;
  s += `<ellipse cx="${W / 2}" cy="${H - 26}" rx="${W / 2.4}" ry="10" fill="${light}" opacity="0.12"/>`;
  return s;
}

function candles(r: () => number, n: number, y: number, light: string): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 40 + r() * (W - 80);
    s += `<rect x="${x - 2}" y="${y - 14}" width="4" height="14" fill="#d8c8a0" opacity="0.8"/><ellipse cx="${x}" cy="${y - 18}" rx="2.4" ry="5" fill="${light}"/><circle cx="${x}" cy="${y - 18}" r="14" fill="${light}" opacity="0.12"/>`;
  }
  return s;
}

function figure(x: number, y: number, s: number, color: string, crown = false): string {
  let g = `<g fill="${color}"><circle cx="${x}" cy="${y - 62 * s}" r="${9 * s}"/><path d="M${x - 16 * s} ${y} L${x - 12 * s} ${y - 48 * s} Q${x} ${y - 56 * s} ${x + 12 * s} ${y - 48 * s} L${x + 16 * s} ${y} Z"/>`;
  if (crown) g += `<path d="M${x - 8 * s} ${y - 70 * s} L${x - 8 * s} ${y - 78 * s} L${x - 4 * s} ${y - 73 * s} L${x} ${y - 80 * s} L${x + 4 * s} ${y - 73 * s} L${x + 8 * s} ${y - 78 * s} L${x + 8 * s} ${y - 70 * s} Z"/>`;
  return g + '</g>';
}

function moon(x: number, y: number, r: number, color: string): string {
  return `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${color}" opacity="0.08"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.9"/>`;
}

function banners(r: () => number, n: number, y: number, colors: string[]): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 60 + (i * (W - 120)) / Math.max(1, n - 1);
    const c = colors[Math.floor(r() * colors.length)]!;
    s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 110}" stroke="#0a0705" stroke-width="3"/><path d="M${x} ${y + 4} L${x + 30} ${y + 4} L${x + 30} ${y + 44} L${x + 15} ${y + 36} L${x} ${y + 44} Z" fill="${c}" opacity="0.85"/>`;
  }
  return s;
}

function tents(r: () => number, n: number, y: number, color: string, light: string): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 40 + r() * (W - 80);
    const w = 40 + r() * 40;
    s += `<path d="M${x - w / 2} ${y} L${x} ${y - w * 0.7} L${x + w / 2} ${y} Z" fill="${color}"/><path d="M${x - 4} ${y} L${x} ${y - 16} L${x + 4} ${y} Z" fill="${light}" opacity="0.5"/>`;
  }
  return s;
}

function water(y: number, color: string, light: string): string {
  let s = `<rect x="0" y="${y}" width="${W}" height="${H - y}" fill="${color}"/>`;
  for (let i = 0; i < 14; i++) s += `<line x1="${(i * 53) % W}" y1="${y + 8 + (i % 5) * 12}" x2="${((i * 53) % W) + 40}" y2="${y + 8 + (i % 5) * 12}" stroke="${light}" stroke-opacity="0.18" stroke-width="1.4"/>`;
  return s;
}

function ship(x: number, y: number, s: number, color: string): string {
  return `<g fill="${color}"><path d="M${x - 50 * s} ${y} Q${x} ${y + 18 * s} ${x + 50 * s} ${y} L${x + 40 * s} ${y + 14 * s} L${x - 40 * s} ${y + 14 * s} Z"/><rect x="${x - 2 * s}" y="${y - 70 * s}" width="${4 * s}" height="${70 * s}"/><path d="M${x + 3 * s} ${y - 66 * s} Q${x + 40 * s} ${y - 40 * s} ${x + 3 * s} ${y - 12 * s} Z"/></g>`;
}

function houses(r: () => number, n: number, y: number, color: string, light: string): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (W / n) + (r() - 0.5) * 20;
    const w = 34 + r() * 20;
    const h = 24 + r() * 16;
    s += `<path d="M${x - w / 2} ${y} L${x - w / 2} ${y - h} L${x} ${y - h - w * 0.45} L${x + w / 2} ${y - h} L${x + w / 2} ${y} Z" fill="${color}"/>`;
    if (r() > 0.4) s += `<rect x="${x - 3}" y="${y - h + 6}" width="6" height="8" fill="${light}" opacity="0.7"/>`;
  }
  return s;
}

function build(key: IllustrationKey, seed: number): string {
  const r = rnd(seed * 7919 + key.length * 131);
  switch (key) {
    case 'throne_room':
      return base(WARM, 300, 90) + arches(WARM.mid, 5, WARM.light) + `<rect x="270" y="120" width="60" height="94" fill="${WARM.near}"/><path d="M262 120 L300 70 L338 120 Z" fill="${WARM.near}"/>` + figure(300, 214, 0.9, '#050302', true) + banners(r, 4, 30, ['#6e2a22', '#2c3e64', '#c9a24b']) + close;
    case 'council_chamber':
      return base(WARM, 300, 110) + arches(WARM.mid, 4, WARM.light) + `<ellipse cx="300" cy="206" rx="170" ry="22" fill="${WARM.near}"/>` + candles(r, 6, 196, WARM.light) + figure(170, 214, 0.7, '#060403') + figure(430, 214, 0.7, '#060403') + figure(300, 214, 0.75, '#060403', true) + close;
    case 'bedchamber':
      return base(DUSK, 460, 80, 200) + `<rect x="0" y="0" width="${W}" height="${H}" fill="${DUSK.mid}" opacity="0.5"/><rect x="420" y="30" width="80" height="110" fill="${DUSK.light}" opacity="0.18"/><line x1="460" y1="30" x2="460" y2="140" stroke="${DUSK.near}" stroke-width="4"/><path d="M80 170 L380 170 L380 230 L80 230 Z" fill="${DUSK.near}"/><path d="M80 170 L80 70 L100 70 L100 170 Z M360 170 L360 70 L380 70 L380 170 Z" fill="${DUSK.near}"/><path d="M70 70 Q230 40 390 70 L390 84 Q230 56 70 84 Z" fill="#4a1a18"/>` + candles(r, 2, 170, DUSK.light) + close;
    case 'feast':
      return base(WARM, 300, 120, 300) + arches(WARM.mid, 6, WARM.light) + `<rect x="60" y="176" width="480" height="12" fill="#2a180c"/><rect x="60" y="188" width="480" height="30" fill="${WARM.near}"/>` + candles(r, 9, 176, WARM.light) + [110, 190, 270, 350, 430, 500].map((x) => figure(x, 180, 0.55, '#070403')).join('') + close;
    case 'garden':
      return base(GREEN, 420, 60, 240) + hills(r, GREEN.far, 150, 30) + `<path d="M0 ${H} L0 170 L${W} 170 L${W} ${H} Z" fill="${GREEN.mid}"/>` + trees(r, GREEN.near, 190, 10, 60) + `<ellipse cx="300" cy="200" rx="60" ry="10" fill="${GREEN.light}" opacity="0.2"/><rect x="292" y="150" width="16" height="48" fill="${GREEN.near}"/>` + figure(250, 214, 0.6, '#060805') + figure(350, 214, 0.6, '#060805') + close;
    case 'chapel':
      return base(COLD, 300, 60, 220) + arches(COLD.mid, 3, COLD.light) + `<path d="M270 20 L300 0 L330 20 L330 110 L270 110 Z" fill="${COLD.light}" opacity="0.22"/><circle cx="300" cy="46" r="20" fill="${COLD.light}" opacity="0.25"/>` + candles(r, 5, 200, WARM.light) + figure(300, 214, 0.7, '#040506') + close;
    case 'library':
      return base(WARM, 300, 140, 200) + Array.from({ length: 7 }, (_, i) => `<rect x="${i * 88 + 4}" y="20" width="80" height="200" fill="${WARM.mid}"/>` + Array.from({ length: 5 }, (_, j) => `<rect x="${i * 88 + 8}" y="${36 + j * 36}" width="72" height="4" fill="${WARM.near}"/>` + Array.from({ length: 8 }, (_, k) => `<rect x="${i * 88 + 10 + k * 9}" y="${16 + j * 36}" width="6" height="${16 + (k % 3) * 2}" fill="${['#4a2a18', '#2c3e40', '#5a3a1a', '#3a1a1a'][(i + j + k) % 4]}"/>`).join('')).join('')).join('') + candles(r, 2, 214, WARM.light) + figure(300, 230, 0.8, '#050302') + close;
    case 'battlefield':
      return base(BLOOD, 300, 150, 320) + hills(r, BLOOD.far, 140, 40) + hills(r, BLOOD.mid, 180, 30) + banners(r, 6, 90, ['#6e2a22', '#2c3e64', '#6a5a2a']) + Array.from({ length: 22 }, () => figure(r() * W, 200 + r() * 40, 0.35 + r() * 0.2, '#060202')).join('') + `<rect width="${W}" height="${H}" fill="${BLOOD.light}" opacity="0.05"/>` + close;
    case 'war_camp':
      return base(DUSK, 300, 170, 240) + hills(r, DUSK.far, 150, 40) + tents(r, 9, 200, DUSK.near, DUSK.light) + `<circle cx="300" cy="206" r="8" fill="${DUSK.light}"/><circle cx="300" cy="206" r="40" fill="${DUSK.light}" opacity="0.15"/>` + banners(r, 3, 100, ['#6e2a22', '#c9a24b']) + close;
    case 'castle_walls':
      return base(COLD, 460, 50, 260) + moon(460, 50, 16, COLD.light) + hills(r, COLD.far, 170, 30) + castle(300, 196, 1.6, COLD.near, WARM.light) + close;
    case 'market':
      return base(DAY, 300, 60, 320) + houses(r, 8, 160, DAY.mid, WARM.light) + Array.from({ length: 5 }, (_, i) => `<path d="M${40 + i * 116} 190 L${60 + i * 116} 160 L${130 + i * 116} 160 L${150 + i * 116} 190 Z" fill="${['#7a3a22', '#2c4a5a', '#6a5a22'][i % 3]}"/><rect x="${50 + i * 116}" y="190" width="90" height="24" fill="${DAY.near}"/>`).join('') + Array.from({ length: 9 }, () => figure(r() * W, 236, 0.45, '#11140f')).join('') + close;
    case 'fields':
      return base(DAY, 460, 50, 300) + hills(r, DAY.far, 120, 30) + Array.from({ length: 9 }, (_, i) => `<path d="M0 ${140 + i * 12} Q300 ${130 + i * 13} ${W} ${140 + i * 12}" stroke="#8a7a3a" stroke-opacity="${0.2 + i * 0.05}" stroke-width="6" fill="none"/>`).join('') + houses(r, 3, 150, DAY.mid, WARM.light) + figure(200, 230, 0.6, '#1a1c12') + close;
    case 'forest':
      return base(GREEN, 300, 40, 200) + trees(r, GREEN.far, 170, 26, 90) + trees(r, GREEN.mid, 200, 18, 120) + trees(r, GREEN.near, 250, 12, 160) + close;
    case 'dungeon':
      return base(COLD, 120, 40, 140) + `<rect width="${W}" height="${H}" fill="${COLD.mid}"/>` + Array.from({ length: 30 }, (_, i) => `<rect x="${(i % 10) * 62 + (Math.floor(i / 10) % 2) * 31}" y="${Math.floor(i / 10) * 34 + 60}" width="58" height="30" fill="${COLD.far}"/>`).join('') + `<rect x="90" y="20" width="60" height="40" fill="${COLD.light}" opacity="0.25"/>` + Array.from({ length: 5 }, (_, i) => `<rect x="${96 + i * 12}" y="20" width="3" height="40" fill="${COLD.near}"/>`).join('') + `<path d="M90 60 L30 ${H} L260 ${H} L150 60 Z" fill="${COLD.light}" opacity="0.07"/>` + figure(160, 230, 0.7, '#030405') + close;
    case 'crypt':
      return base(COLD, 300, 110, 180) + arches(COLD.mid, 5, COLD.light) + `<rect x="200" y="170" width="200" height="40" fill="${COLD.near}"/><rect x="190" y="164" width="220" height="10" fill="${COLD.far}"/>` + candles(r, 3, 164, WARM.light) + close;
    case 'nursery':
      return base(WARM, 440, 80, 240) + `<rect width="${W}" height="${H}" fill="${WARM.mid}" opacity="0.6"/><rect x="400" y="40" width="80" height="100" fill="${WARM.light}" opacity="0.2"/><path d="M200 200 Q260 150 320 200 Z" fill="${WARM.near}"/><rect x="196" y="198" width="128" height="10" fill="${WARM.near}"/>` + figure(360, 226, 0.75, '#070403') + candles(r, 1, 200, WARM.light) + close;
    case 'tournament':
      return base(DAY, 300, 40, 320) + hills(r, DAY.far, 130, 20) + `<rect x="0" y="170" width="${W}" height="6" fill="#4a3a22"/>` + banners(r, 7, 60, ['#6e2a22', '#2c3e64', '#c9a24b', '#3f6b3a']) + `<g fill="#15130e"><path d="M140 200 L200 160 L230 160 L240 200 Z"/><path d="M460 200 L400 160 L370 160 L360 200 Z"/><line x1="200" y1="150" x2="300" y2="140" stroke="#15130e" stroke-width="4"/><line x1="400" y1="150" x2="300" y2="140" stroke="#15130e" stroke-width="4"/></g>` + close;
    case 'harbor':
      return base(DUSK, 440, 120, 260) + water(170, DUSK.far, DUSK.light) + ship(180, 176, 1.2, DUSK.near) + ship(420, 186, 0.8, DUSK.mid) + houses(r, 4, 170, DUSK.near, DUSK.light).replace(/fill="[^"]+"/, `fill="${DUSK.near}"`) + close;
    case 'village':
      return base(DUSK, 480, 90, 260) + hills(r, DUSK.far, 150, 40) + houses(r, 7, 200, DUSK.near, DUSK.light) + trees(r, DUSK.mid, 206, 5, 50) + close;
    case 'night_alley':
      return base(COLD, 300, 30, 160) + moon(300, 30, 12, COLD.light) + `<path d="M0 0 L200 0 L220 ${H} L0 ${H} Z" fill="${COLD.near}"/><path d="M${W} 0 L400 0 L380 ${H} L${W} ${H} Z" fill="${COLD.near}"/><rect x="150" y="90" width="10" height="14" fill="${WARM.light}" opacity="0.7"/><circle cx="155" cy="97" r="20" fill="${WARM.light}" opacity="0.1"/>` + figure(300, 226, 0.7, '#020304') + close;
    default:
      return base(WARM) + close;
  }
}

const cache = new Map<string, string>();

export function sceneSvg(key: IllustrationKey, seed = 1): string {
  const k = `${key}:${seed}`;
  let s = cache.get(k);
  if (!s) {
    const uid = `${key}${seed}`.replace(/\W/g, '');
    const body = build(key, seed).replace(/(id="|url\(#)(sky|glow|vig|blur)/g, `$1$2-${uid}`);
    s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
    cache.set(k, s);
  }
  return s;
}
