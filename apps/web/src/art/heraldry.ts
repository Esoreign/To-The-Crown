/**
 * Générateur de blasons SVG déterministe (même graine ⇒ même blason).
 * Respecte la règle héraldique : métal sur couleur, couleur sur métal.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const METALS = ['#d6ad3f', '#ece6d6'];
const COLOURS = ['#9e2127', '#1f4a8a', '#2e6a3b', '#1f1c1b', '#5c2a6c', '#b0602a', '#7b1f3a', '#2b6f78'];

const SHIELDS: Record<string, string> = {
  heater: 'M6 6 H94 V46 C94 78 72 96 50 108 C28 96 6 78 6 46 Z',
  round: 'M6 6 H94 V58 C94 86 74 106 50 106 C26 106 6 86 6 58 Z',
  flat: 'M8 6 H92 V70 L50 108 L8 70 Z',
  notched: 'M6 6 H40 L50 14 L60 6 H94 V48 C94 78 72 96 50 108 C28 96 6 78 6 48 Z',
};

type Draw = (fg: string, bg: string) => string;

const DIVISIONS: Record<string, (a: string) => string> = {
  plain: () => '',
  pale: (a) => `<rect x="50" y="0" width="50" height="120" fill="${a}"/>`,
  fess: (a) => `<rect x="0" y="54" width="100" height="66" fill="${a}"/>`,
  bend: (a) => `<path d="M0 0 L100 120 L0 120 Z" fill="${a}"/>`,
  quarterly: (a) => `<rect x="50" y="0" width="50" height="54" fill="${a}"/><rect x="0" y="54" width="50" height="66" fill="${a}"/>`,
  saltire: (a) => `<path d="M0 0 L50 57 L100 0 Z M0 120 L50 57 L100 120 Z" fill="${a}"/>`,
  chevron: (a) => `<path d="M0 120 L0 90 L50 45 L100 90 L100 120 Z" fill="${a}"/>`,
  chief: (a) => `<rect x="0" y="0" width="100" height="32" fill="${a}"/>`,
  gyronny: (a) => `<path d="M50 57 L50 0 L100 0 Z M50 57 L100 57 L100 120 Z M50 57 L50 120 L0 120 Z M50 57 L0 57 L0 0 Z" fill="${a}"/>`,
};

const ORDINARIES: Record<string, Draw> = {
  none: () => '',
  fess: (fg) => `<rect x="0" y="44" width="100" height="22" fill="${fg}"/>`,
  pale: (fg) => `<rect x="39" y="0" width="22" height="120" fill="${fg}"/>`,
  bend: (fg) => `<path d="M-6 8 L10 -6 L106 106 L90 120 Z" fill="${fg}"/>`,
  chevron: (fg) => `<path d="M2 92 L50 46 L98 92 L98 110 L50 64 L2 110 Z" fill="${fg}"/>`,
  cross: (fg) => `<rect x="41" y="0" width="18" height="120" fill="${fg}"/><rect x="0" y="46" width="100" height="18" fill="${fg}"/>`,
  saltire: (fg) => `<path d="M0 8 L8 0 L100 112 L92 120 Z M100 8 L92 0 L0 112 L8 120 Z" fill="${fg}"/>`,
  bordure: (fg) => `<path d="${SHIELDS.heater}" fill="none" stroke="${fg}" stroke-width="14"/>`,
  chief: (fg) => `<rect x="0" y="0" width="100" height="30" fill="${fg}"/>`,
};

const CHARGES: Record<string, (c: string) => string> = {
  star: (c) => `<path d="M0 -14 L4 -4 L14 -4 L6 3 L9 13 L0 7 L-9 13 L-6 3 L-14 -4 L-4 -4 Z" fill="${c}"/>`,
  crescent: (c) => `<path d="M-12 -2 A12 12 0 1 0 12 -2 A10 9 0 1 1 -12 -2 Z" fill="${c}"/>`,
  roundel: (c) => `<circle r="10" fill="${c}"/>`,
  lozenge: (c) => `<path d="M0 -14 L10 0 L0 14 L-10 0 Z" fill="${c}"/>`,
  tower: (c) => `<path d="M-10 14 V-6 H-12 V-14 H-7 V-10 H-3 V-14 H3 V-10 H7 V-14 H12 V-6 H10 V14 Z M-3 14 V5 A3 3 0 0 1 3 5 V14 Z" fill="${c}" fill-rule="evenodd"/>`,
  crown: (c) => `<path d="M-14 8 L-12 -8 L-6 0 L0 -12 L6 0 L12 -8 L14 8 Z" fill="${c}"/><rect x="-14" y="8" width="28" height="4" fill="${c}"/>`,
  sword: (c) => `<path d="M-2 -16 L2 -16 L2 6 L8 6 L8 9 L2 9 L2 15 L-2 15 L-2 9 L-8 9 L-8 6 L-2 6 Z" fill="${c}"/>`,
  key: (c) => `<circle cx="0" cy="-8" r="6" fill="none" stroke="${c}" stroke-width="3"/><path d="M-1.5 -2 H1.5 V14 H6 V10 H1.5" fill="${c}" stroke="${c}" stroke-width="1"/>`,
  tree: (c) => `<path d="M0 -15 L11 2 H5 L12 10 H2 V15 H-2 V10 H-12 L-5 2 H-11 Z" fill="${c}"/>`,
  wheel: (c) => `<circle r="11" fill="none" stroke="${c}" stroke-width="3"/><path d="M0 -11 V11 M-11 0 H11 M-8 -8 L8 8 M8 -8 L-8 8" stroke="${c}" stroke-width="2"/>`,
  bird: (c) => `<path d="M-14 -2 Q-6 -10 0 -3 Q6 -10 14 -2 Q6 -4 2 2 L4 12 L0 8 L-4 12 L-2 2 Q-6 -4 -14 -2 Z" fill="${c}"/>`,
  sun: (c) => `<circle r="7" fill="${c}"/>${Array.from({ length: 8 }, (_, i) => `<path d="M0 -15 L3 -9 L-3 -9 Z" fill="${c}" transform="rotate(${i * 45})"/>`).join('')}`,
  anchor: (c) => `<path d="M-1.5 -10 H1.5 V10 Q8 9 10 2 L7 3 L10 -2 L13 4 L11 3 Q8 13 0 14 Q-8 13 -11 3 L-13 4 L-10 -2 L-7 3 L-10 2 Q-8 9 -1.5 10 Z" fill="${c}"/><circle cx="0" cy="-12" r="3" fill="none" stroke="${c}" stroke-width="2"/>`,
  hammer: (c) => `<path d="M-10 -12 H10 V-4 H3 V14 H-3 V-4 H-10 Z" fill="${c}"/>`,
};

const CROWNS: Record<number, (c: string) => string> = {
  2: (c) => `<path d="M24 0 L28 10 L36 4 L42 10 L50 2 L58 10 L64 4 L72 10 L76 0 L76 14 H24 Z" fill="${c}" stroke="#3a2a10" stroke-width="1"/>`,
  3: (c) =>
    `<path d="M20 2 L28 14 L34 0 L42 12 L50 -4 L58 12 L66 0 L72 14 L80 2 L80 16 H20 Z" fill="${c}" stroke="#3a2a10" stroke-width="1"/><circle cx="50" cy="-4" r="3" fill="#b8222a"/><circle cx="34" cy="0" r="2.4" fill="#1f4e8c"/><circle cx="66" cy="0" r="2.4" fill="#1f4e8c"/>`,
  4: (c) =>
    `<path d="M18 16 L20 -2 Q35 -14 50 -16 Q65 -14 80 -2 L82 16 Z" fill="${c}" stroke="#3a2a10" stroke-width="1"/><path d="M50 -16 V16 M22 0 Q50 -10 78 0" stroke="#3a2a10" stroke-width="1.5" fill="none"/><circle cx="50" cy="-19" r="4" fill="${c}" stroke="#3a2a10"/><path d="M50 -26 V-22 M48 -24 H52" stroke="#3a2a10" stroke-width="1.5"/>`,
};

export interface CoaOptions {
  /** Rang : 0 aucun, 1 comté, 2 duché, 3 royaume, 4 empire. */
  rank?: number;
  shield?: keyof typeof SHIELDS;
  /** Couleur imposée pour le champ (ex. couleur de titre). */
  tint?: string;
}

const cache = new Map<string, string>();

export function coaSvg(seed: number, opts: CoaOptions = {}): string {
  const key = `${seed}|${opts.rank ?? 0}|${opts.shield ?? ''}|${opts.tint ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rng(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!;
  const metalField = r() < 0.4;
  const field = opts.tint ?? (metalField ? pick(METALS) : pick(COLOURS));
  const fieldIsMetal = METALS.includes(field) || (!opts.tint ? metalField : false);
  const contrast = fieldIsMetal ? pick(COLOURS) : pick(METALS);
  const second = fieldIsMetal ? pick(METALS.filter((m) => m !== field)) || contrast : pick(COLOURS.filter((c) => c !== field));
  const division = pick(Object.keys(DIVISIONS));
  const ordinary = division === 'plain' ? pick(['fess', 'pale', 'bend', 'chevron', 'cross', 'saltire', 'bordure', 'chief', 'none']) : pick(['none', 'none', 'bordure', 'fess']);
  const charge = pick(Object.keys(CHARGES));
  const chargeCount = ordinary === 'none' ? pick([1, 1, 3]) : pick([0, 1, 3]);
  const shieldName = opts.shield ?? pick(Object.keys(SHIELDS));
  const shield = SHIELDS[shieldName]!;
  const id = `coa${seed.toString(36)}${opts.rank ?? 0}`;
  const divColor = division === 'plain' ? '' : DIVISIONS[division]!(fieldIsMetal ? contrast : second === contrast ? pick(METALS) : contrast);
  const chargeColor = ordinary === 'none' || division !== 'plain' ? contrast : fieldIsMetal ? pick(COLOURS.filter((c) => c !== contrast)) : pick(METALS);
  const positions: [number, number][] =
    chargeCount === 3 ? [[28, 30], [72, 30], [50, 82]] : chargeCount === 1 ? [[50, 58]] : [];
  const scale = chargeCount === 3 ? 0.95 : 1.6;
  const charges = positions.map(([x, y]) => `<g transform="translate(${x} ${y}) scale(${scale})">${CHARGES[charge]!(chargeColor)}</g>`).join('');
  const rank = Math.min(4, opts.rank ?? 0);
  const crownShift = rank >= 2 ? -17 : 0;
  const crown = rank >= 2 ? `<g transform="translate(0 ${crownShift})">${CROWNS[rank]!('#d6ad3f')}</g>` : '';
  const topPad = rank >= 4 ? 46 : rank >= 3 ? 24 : rank >= 2 ? 20 : 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -${topPad} 100 ${112 + topPad}"><defs><clipPath id="${id}c"><path d="${shield}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient></defs>${crown}<g clip-path="url(#${id}c)"><rect x="0" y="0" width="100" height="120" fill="${field}"/>${divColor}${ORDINARIES[ordinary]!(contrast, field)}${charges}<rect x="0" y="0" width="100" height="120" fill="url(#${id}g)"/></g><path d="${shield}" fill="none" stroke="#21170c" stroke-width="3.2"/><path d="${shield}" fill="none" stroke="#c9a24b" stroke-width="1.2" stroke-opacity="0.8"/></svg>`;
  cache.set(key, svg);
  return svg;
}

export function coaDataUrl(seed: number, opts: CoaOptions = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coaSvg(seed, opts))}`;
}
