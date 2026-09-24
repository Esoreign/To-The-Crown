/**
 * Rendu PixiJS de Caldria. Hiérarchie :
 *
 *   world
 *     SeaLayer (tuile animée)
 *     TerrainLayer (texture pré-rendue)
 *     ProvinceFillLayer (un Graphics blanc par province, teinté selon le mode)
 *     WaterLayer (lacs) · RiversLayer · FeatureLayer (reliefs, forêts)
 *     BorderLayer (comtés / duchés / royaumes) · CoastLayer
 *     HoldingLayer (capitales) · CoatOfArmsLayer
 *     SelectionLayer · ArmyLayer · EffectLayer (batailles, sièges)
 *     LabelLayer (royaumes / duchés / comtés selon le zoom)
 *
 * Le rendu ne recrée jamais les géométries statiques : un changement de
 * mode ne modifie que des teintes. Les frontières politiques sont
 * reconstruites uniquement lorsque la structure des royaumes change.
 */
// Variante sans eval() : compatible avec une politique CSP stricte (script-src 'self').
import 'pixi.js/unsafe-eval';
import {
  Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  TilingSprite,
} from 'pixi.js';
import { WORLD } from '@ttc/content';
import { PROVINCE_GEO, TITLE_DEFS, topLiegeId } from '@ttc/game-core';
import type { Army, GameView, Point, ProvinceGeo } from '@ttc/shared';
import { coaSvg } from '../art/heraldry';
import { TERRAIN_COLORS, hexToNum, type ProvinceColor } from './colors';

export type MapStyle = 'game' | 'ambient' | 'parchment';

export interface MapCallbacks {
  onHover?(provinceId: string | null): void;
  onClick?(provinceId: string | null, ev: PointerEvent): void;
  onRightClick?(provinceId: string | null, ev: PointerEvent): void;
  onArmyClick?(armyId: string, ev: PointerEvent): void;
  onBattleClick?(battleId: string): void;
  onZoom?(zoom: number): void;
}

const W = WORLD.width;
const H = WORLD.height;
const GRID = 100;
const GRID_W = Math.ceil(W / GRID);
const GRID_H = Math.ceil(H / GRID);

// ---------------------------------------------------------------------------
// Index spatial pour la sélection
// ---------------------------------------------------------------------------
interface HitEntry {
  id: string;
  poly: Point[];
  holes: Point[][];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const HIT: HitEntry[] = WORLD.provinces.map((p) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of p.polygon) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { id: p.id, poly: p.polygon, holes: p.holes ?? [], minX, minY, maxX, maxY };
});
const GRID_CELLS: HitEntry[][] = Array.from({ length: GRID_W * GRID_H }, () => []);
for (const e of HIT) {
  for (let gx = Math.floor(e.minX / GRID); gx <= Math.floor(e.maxX / GRID); gx++) {
    for (let gy = Math.floor(e.minY / GRID); gy <= Math.floor(e.maxY / GRID); gy++) {
      if (gx >= 0 && gy >= 0 && gx < GRID_W && gy < GRID_H) GRID_CELLS[gy * GRID_W + gx]!.push(e);
    }
  }
}

function inPoly(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function provinceAt(x: number, y: number): string | null {
  const gx = Math.floor(x / GRID);
  const gy = Math.floor(y / GRID);
  if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return null;
  for (const e of GRID_CELLS[gy * GRID_W + gx]!) {
    if (x < e.minX || x > e.maxX || y < e.minY || y > e.maxY) continue;
    if (inPoly(x, y, e.poly) && !e.holes.some((h) => inPoly(x, y, h))) return e.id;
  }
  return null;
}

const flat = (pts: Point[]): number[] => pts.flatMap((p) => [p[0], p[1]]);

// ---------------------------------------------------------------------------
// Textures procédurales
// ---------------------------------------------------------------------------
function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function seaTexture(): Texture {
  const [c, g] = makeCanvas(512, 512);
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#1b3245');
  grad.addColorStop(1, '#162a3b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  let s = 12345;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  g.strokeStyle = 'rgba(160, 200, 220, 0.07)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 90; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const w = 10 + rand() * 26;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
    g.stroke();
  }
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    img.data[i] = img.data[i]! + n;
    img.data[i + 1] = img.data[i + 1]! + n;
    img.data[i + 2] = img.data[i + 2]! + n;
  }
  g.putImageData(img, 0, 0);
  return Texture.from(c);
}

/** Texture de terrain pré-rendue (couleurs de terrain, grain, ombrage). */
function terrainTexture(style: MapStyle): Texture {
  const scale = 0.55;
  const [c, g] = makeCanvas(Math.round(W * scale), Math.round(H * scale));
  g.scale(scale, scale);
  for (const p of WORLD.provinces) {
    g.fillStyle = TERRAIN_COLORS[p.terrain];
    g.beginPath();
    p.polygon.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.strokeStyle = TERRAIN_COLORS[p.terrain];
    g.lineWidth = 3;
    g.stroke();
  }
  // Ombrage côtier intérieur.
  g.save();
  g.lineWidth = 26;
  g.strokeStyle = 'rgba(40, 32, 20, 0.16)';
  for (const ring of WORLD.landmasses) {
    g.beginPath();
    ring.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.stroke();
  }
  g.restore();
  // Grain.
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  let s = 987;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    s = (s * 16807) % 2147483647;
    const n = ((s / 2147483647) - 0.5) * (style === 'parchment' ? 16 : 22);
    img.data[i] = img.data[i]! + n;
    img.data[i + 1] = img.data[i + 1]! + n;
    img.data[i + 2] = img.data[i + 2]! + n * 0.8;
  }
  g.putImageData(img, 0, 0);
  return Texture.from(c);
}

function svgToTexture(svg: string, w: number, h: number): Promise<Texture> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const [c, g] = makeCanvas(w, h);
      g.drawImage(img, 0, 0, w, h);
      resolve(Texture.from(c));
    };
    img.onerror = () => resolve(Texture.EMPTY);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

// ---------------------------------------------------------------------------
// Géométrie des royaumes (labels)
// ---------------------------------------------------------------------------
interface RealmLabel {
  id: string;
  at: Point;
  angle: number;
  size: number;
  name: string;
  coaSeed: number;
  rank: number;
}

function realmLabels(view: Pick<GameView, 'characters' | 'titles'>): RealmLabel[] {
  const groups = new Map<string, ProvinceGeo[]>();
  for (const p of WORLD.provinces) {
    const holder = view.titles[p.countyTitleId]?.holderId;
    if (!holder) continue;
    const top = topLiegeId(view, holder);
    const arr = groups.get(top);
    if (arr) arr.push(p);
    else groups.set(top, [p]);
  }
  const out: RealmLabel[] = [];
  for (const [ruler, provs] of groups) {
    const c = view.characters[ruler];
    const primary = c?.titleIds[0];
    if (!primary) continue;
    const def = TITLE_DEFS[primary]!;
    const area = provs.reduce((s, p) => s + p.area, 0);
    let cx = provs.reduce((s, p) => s + p.label.at[0] * p.area, 0) / area;
    let cy = provs.reduce((s, p) => s + p.label.at[1] * p.area, 0) / area;
    const inside = provs.some((p) => inPoly(cx, cy, p.polygon));
    if (!inside) {
      const nearest = [...provs].sort((a, b) => Math.hypot(a.label.at[0] - cx, a.label.at[1] - cy) - Math.hypot(b.label.at[0] - cx, b.label.at[1] - cy))[0]!;
      [cx, cy] = nearest.label.at;
    }
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const p of provs) {
      const dx = p.centroid[0] - cx;
      const dy = p.centroid[1] - cy;
      sxx += dx * dx * p.area;
      syy += dy * dy * p.area;
      sxy += dx * dy * p.area;
    }
    let angle = provs.length > 2 ? 0.5 * Math.atan2(2 * sxy, sxx - syy) : 0;
    angle = Math.max(-0.45, Math.min(0.45, angle));
    const rank = def.rank === 'empire' ? 4 : def.rank === 'kingdom' ? 3 : def.rank === 'duchy' ? 2 : 1;
    out.push({
      id: ruler,
      at: [cx, cy],
      angle,
      size: Math.max(22, Math.min(92, Math.sqrt(area) / 9)),
      name: def.name.toUpperCase(),
      coaSeed: def.coaSeed,
      rank,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Moteur
// ---------------------------------------------------------------------------
export class MapRenderer {
  app = new Application();
  private world = new Container();
  private sea!: TilingSprite;
  private fills = new Map<string, Graphics>();
  private fillLayer = new Container();
  private featureLayer = new Graphics();
  private riverLayer = new Graphics();
  private lakeLayer = new Graphics();
  private countyBorders = new Graphics();
  private duchyBorders = new Graphics();
  private realmBorders = new Graphics();
  private coastLayer = new Graphics();
  private holdingLayer = new Graphics();
  private coaLayer = new Container();
  private selectionLayer = new Graphics();
  private hoverLayer = new Graphics();
  private routeLayer = new Graphics();
  private armyLayer = new Container();
  private effectLayer = new Container();
  private labelLayer = new Container();
  private realmLabelLayer = new Container();
  private duchyLabelLayer = new Container();
  private countyLabelLayer = new Container();
  private seaLabelLayer = new Container();
  private particleLayer = new Graphics();
  private particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];

  private zoom = 0.3;
  private targetZoom = 0.3;
  private camX = W / 2;
  private camY = H / 2;
  private targetX = W / 2;
  private targetY = H / 2;
  private minZoom = 0.2;
  private maxZoom = 3.2;
  private dragging = false;
  private dragStart: { x: number; y: number; camX: number; camY: number } | null = null;
  private moved = false;
  private hovered: string | null = null;
  private selected: string | null = null;
  private highlightProvinces: string[] = [];
  private structureSig = '';
  private view: GameView | null = null;
  private armySprites = new Map<string, { root: Container; label: Text; x: number; y: number }>();
  private effectSprites = new Map<string, Container>();
  private coaTextures = new Map<string, Texture>();
  private destroyed = false;
  private time = 0;
  private selectedArmy: string | null = null;
  private playerId: string | null = null;
  private lastLod = -1;

  constructor(
    private readonly style: MapStyle,
    private readonly cb: MapCallbacks = {},
  ) {}

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: parent,
      antialias: true,
      background: this.style === 'parchment' ? '#2b2217' : '#132433',
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      preference: 'webgl',
    });
    if (this.destroyed) return;
    parent.appendChild(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.setAttribute('aria-label', 'Carte de Caldria');
    this.app.stage.addChild(this.world);

    this.sea = new TilingSprite({ texture: seaTexture(), width: W + 4000, height: H + 4000 });
    this.sea.position.set(-2000, -2000);
    this.world.addChild(this.sea);

    const terrain = new Sprite(terrainTexture(this.style));
    terrain.width = W;
    terrain.height = H;
    this.world.addChild(terrain);

    for (const p of WORLD.provinces) {
      const g = new Graphics();
      g.poly(flat(p.polygon), true).fill({ color: 0xffffff });
      for (const hole of p.holes ?? []) g.poly(flat(hole), true).cut();
      g.alpha = 0.6;
      this.fills.set(p.id, g);
      this.fillLayer.addChild(g);
    }
    this.world.addChild(this.fillLayer);

    this.drawStatic();
    this.world.addChild(this.lakeLayer, this.riverLayer, this.featureLayer, this.countyBorders, this.duchyBorders, this.realmBorders, this.coastLayer);
    this.world.addChild(this.holdingLayer, this.coaLayer, this.hoverLayer, this.selectionLayer, this.routeLayer, this.effectLayer, this.armyLayer);
    this.labelLayer.addChild(this.seaLabelLayer, this.countyLabelLayer, this.duchyLabelLayer, this.realmLabelLayer);
    this.world.addChild(this.labelLayer);
    this.buildStaticLabels();
    if (this.style === 'ambient') this.app.stage.addChild(this.particleLayer);

    if (this.style === 'parchment') {
      const f = new ColorMatrixFilter();
      f.sepia(false);
      const f2 = new ColorMatrixFilter();
      f2.saturate(-0.25, true);
      this.world.filters = [f, f2];
    }

    this.fitToScreen(true);
    this.bindInput();
    this.app.ticker.add((t) => this.update(t.deltaMS));
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.clampCamera();

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('resize', this.onResize);
    try {
      this.app.destroy(true, { children: true, texture: true });
    } catch {
      // Application non initialisée.
    }
  }

  // ---------------------------------------------------------------- statique
  private drawStatic(): void {
    // Lacs.
    for (const lake of WORLD.lakes) {
      this.lakeLayer.poly(flat(lake), true).fill({ color: 0x21415a }).stroke({ width: 2.5, color: 0x3a2e20, alpha: 0.6 });
    }
    // Rivières.
    for (const r of WORLD.rivers) {
      const pts = r.points;
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        this.riverLayer
          .moveTo(pts[i - 1]![0], pts[i - 1]![1])
          .lineTo(pts[i]![0], pts[i]![1])
          .stroke({ width: 1 + t * r.width, color: 0x2f5a78, alpha: 0.85, cap: 'round' });
      }
    }
    // Reliefs et végétation.
    const f = this.featureLayer;
    for (const ft of WORLD.features) {
      const [x, y] = ft.at;
      const s = ft.scale;
      switch (ft.kind) {
        case 'mountain': {
          const w = 20 * s;
          const h = 22 * s;
          f.poly([x - w, y + h * 0.4, x - w * 0.1, y - h, x + w, y + h * 0.4], true).fill({ color: 0x8c8378 });
          f.poly([x - w * 0.1, y - h, x + w, y + h * 0.4, x + w * 0.15, y + h * 0.4], true).fill({ color: 0x5e564e });
          f.poly([x - w * 0.1, y - h, x - w * 0.35, y - h * 0.45, x + w * 0.05, y - h * 0.55, x + w * 0.25, y - h * 0.45], true).fill({ color: 0xe8e4dc, alpha: 0.85 });
          f.poly([x - w, y + h * 0.4, x - w * 0.1, y - h, x + w, y + h * 0.4], true).stroke({ width: 1.2, color: 0x3a332c, alpha: 0.7 });
          break;
        }
        case 'hill': {
          const w = 16 * s;
          f.moveTo(x - w, y + 4).quadraticCurveTo(x, y - w * 0.9, x + w, y + 4).fill({ color: 0x847250, alpha: 0.9 });
          f.moveTo(x - w, y + 4).quadraticCurveTo(x, y - w * 0.9, x + w, y + 4).stroke({ width: 1.1, color: 0x4a3c26, alpha: 0.6 });
          break;
        }
        case 'tree': {
          const r = 5.5 * s;
          f.rect(x - 0.9, y, 1.8, r * 0.9).fill({ color: 0x3a2a18 });
          f.circle(x, y - r * 0.4, r).fill({ color: ft.variant % 2 ? 0x34502b : 0x3d5c31 });
          f.circle(x - r * 0.35, y - r * 0.7, r * 0.45).fill({ color: 0x4f7040, alpha: 0.8 });
          break;
        }
        case 'marsh': {
          for (let i = -1; i <= 1; i++) f.moveTo(x + i * 5, y + 3).lineTo(x + i * 5 + (i * 2), y - 6).stroke({ width: 1, color: 0x2f4a38 });
          f.moveTo(x - 8, y + 4).lineTo(x + 8, y + 4).stroke({ width: 1.2, color: 0x4a6a78, alpha: 0.8 });
          break;
        }
        case 'wheat': {
          f.moveTo(x - 7, y).lineTo(x + 7, y).stroke({ width: 1, color: 0x8a7430, alpha: 0.6 });
          f.moveTo(x - 7, y + 4).lineTo(x + 7, y + 4).stroke({ width: 1, color: 0x8a7430, alpha: 0.6 });
          break;
        }
        case 'dune': {
          f.moveTo(x - 9, y + 2).quadraticCurveTo(x, y - 6, x + 9, y + 2).stroke({ width: 1.2, color: 0x8a6e44, alpha: 0.7 });
          break;
        }
      }
    }
    // Côtes : liseré sombre + halo.
    for (const ring of WORLD.landmasses) {
      this.coastLayer.poly(flat(ring), true).stroke({ width: 9, color: 0x7fa5b8, alpha: 0.12 });
      this.coastLayer.poly(flat(ring), true).stroke({ width: 2.2, color: 0x2a2116, alpha: 0.85 });
    }
  }

  private makeLabel(text: string, size: number, color: number, opts: { spacing?: number; stroke?: number; italic?: boolean; font?: string } = {}): Text {
    const t = new Text({
      text,
      style: {
        fontFamily: opts.font ?? 'Cinzel, Georgia, serif',
        fontSize: size,
        fontWeight: '600',
        fontStyle: opts.italic ? 'italic' : 'normal',
        fill: color,
        letterSpacing: opts.spacing ?? 0,
        stroke: { color: 0x1a120a, width: opts.stroke ?? Math.max(2, size / 7), join: 'round' },
        align: 'center',
      },
      resolution: 2,
    });
    t.anchor.set(0.5);
    return t;
  }

  private buildStaticLabels(): void {
    for (const s of WORLD.seas) {
      const t = this.makeLabel(s.name, s.size, 0x9fc0d2, { spacing: s.size * 0.25, italic: true, font: 'Cormorant Garamond, Georgia, serif', stroke: 3 });
      t.position.set(s.at[0], s.at[1]);
      t.alpha = 0.75;
      this.seaLabelLayer.addChild(t);
    }
    for (const p of WORLD.provinces) {
      const t = this.makeLabel(p.name, Math.max(10, Math.min(20, p.label.size * 0.75)), 0xf0e2c0, { stroke: 3 });
      t.position.set(p.label.at[0], p.label.at[1]);
      t.rotation = p.label.angle;
      this.countyLabelLayer.addChild(t);
    }
    const duchies = WORLD.titles.filter((t) => t.rank === 'duchy');
    for (const d of duchies) {
      const provs = WORLD.provinces.filter((p) => p.duchyTitleId === d.id);
      const area = provs.reduce((s, p) => s + p.area, 0);
      const x = provs.reduce((s, p) => s + p.label.at[0] * p.area, 0) / area;
      const y = provs.reduce((s, p) => s + p.label.at[1] * p.area, 0) / area;
      const t = this.makeLabel(d.name.toUpperCase(), Math.max(16, Math.min(34, Math.sqrt(area) / 12)), 0xead9b0, { spacing: 4, stroke: 4 });
      t.position.set(x, y);
      this.duchyLabelLayer.addChild(t);
    }
  }

  // ---------------------------------------------------------------- dynamique
  setView(view: GameView, playerId: string | null): void {
    this.view = view;
    this.playerId = playerId;
    const sig = WORLD.provinces
      .map((p) => {
        const h = view.titles[p.countyTitleId]?.holderId ?? '';
        return h ? `${h}:${topLiegeId(view, h)}` : '-';
      })
      .join('|');
    if (sig !== this.structureSig) {
      this.structureSig = sig;
      this.rebuildBorders(view);
      this.rebuildRealmLabels(view);
      this.rebuildHoldings(view);
    }
    this.syncArmies(view);
    this.syncEffects(view);
    this.drawRoute();
  }

  setColors(colors: Map<string, ProvinceColor>): void {
    for (const [id, c] of colors) {
      const g = this.fills.get(id);
      if (!g) continue;
      g.tint = c.color;
      g.alpha = c.alpha;
    }
  }

  setSelection(provinceId: string | null, highlight: string[] = []): void {
    this.selected = provinceId;
    this.highlightProvinces = highlight;
    const g = this.selectionLayer;
    g.clear();
    const ink = this.style === 'parchment';
    for (const id of highlight) {
      const geo = PROVINCE_GEO[id];
      if (geo)
        g.poly(flat(geo.polygon), true)
          .fill({ color: ink ? 0x9a2a1a : 0xf2d98c, alpha: ink ? 0.22 : 0.1 })
          .stroke({ width: 2, color: ink ? 0x7a1a10 : 0xf2d98c, alpha: ink ? 0.6 : 0.55 });
    }
    if (provinceId) {
      const geo = PROVINCE_GEO[provinceId];
      if (geo) {
        g.poly(flat(geo.polygon), true).stroke({ width: 9, color: 0xf2d98c, alpha: 0.25 });
        g.poly(flat(geo.polygon), true).fill({ color: 0xffffff, alpha: 0.08 }).stroke({ width: 3, color: 0xf6e3a3, alpha: 1 });
      }
    }
  }

  setSelectedArmy(armyId: string | null): void {
    this.selectedArmy = armyId;
    for (const [id, sp] of this.armySprites) sp.root.scale.set(id === armyId ? 1.18 : 1);
    this.drawRoute();
  }

  private rebuildBorders(view: GameView): void {
    this.countyBorders.clear();
    this.duchyBorders.clear();
    this.realmBorders.clear();
    const top = new Map<string, string>();
    for (const p of WORLD.provinces) {
      const h = view.titles[p.countyTitleId]?.holderId;
      top.set(p.id, h ? topLiegeId(view, h) : '');
    }
    for (const b of WORLD.borders) {
      if (!b.b) continue;
      const pa = PROVINCE_GEO[b.a]!;
      const pb = PROVINCE_GEO[b.b]!;
      const pts = b.points;
      const target =
        top.get(b.a) !== top.get(b.b) ? this.realmBorders : pa.duchyTitleId !== pb.duchyTitleId ? this.duchyBorders : this.countyBorders;
      target.moveTo(pts[0]![0], pts[0]![1]);
      for (let i = 1; i < pts.length; i++) target.lineTo(pts[i]![0], pts[i]![1]);
    }
    this.countyBorders.stroke({ width: 1.1, color: 0x2a1f14, alpha: 0.45, join: 'round' });
    this.duchyBorders.stroke({ width: 2, color: 0x2a1f14, alpha: 0.6, join: 'round' });
    this.realmBorders.stroke({ width: 7, color: 0x120c07, alpha: 0.35, join: 'round' });
    // Second passage : liseré doré fin sur les frontières de royaume.
    for (const b of WORLD.borders) {
      if (!b.b || top.get(b.a) === top.get(b.b)) continue;
      const pts = b.points;
      this.realmBorders.moveTo(pts[0]![0], pts[0]![1]);
      for (let i = 1; i < pts.length; i++) this.realmBorders.lineTo(pts[i]![0], pts[i]![1]);
    }
    this.realmBorders.stroke({ width: 2.4, color: 0xd8bc74, alpha: 0.75, join: 'round' });
  }

  private rebuildRealmLabels(view: GameView): void {
    this.realmLabelLayer.removeChildren().forEach((c) => c.destroy());
    this.coaLayer.removeChildren().forEach((c) => c.destroy());
    for (const r of realmLabels(view)) {
      const t = this.makeLabel(r.name, r.size, 0xf6e7c1, { spacing: r.size * 0.35, stroke: Math.max(3, r.size / 8) });
      t.position.set(r.at[0], r.at[1]);
      t.rotation = r.angle;
      this.realmLabelLayer.addChild(t);
      if (r.rank >= 2) {
        const key = `${r.coaSeed}|${r.rank}`;
        const sprite = new Sprite(this.coaTextures.get(key) ?? Texture.EMPTY);
        sprite.anchor.set(0.5);
        sprite.width = 46;
        sprite.height = 46 * (r.rank >= 4 ? 1.5 : r.rank >= 3 ? 1.33 : 1.3);
        sprite.position.set(r.at[0], r.at[1] - r.size * 1.4);
        this.coaLayer.addChild(sprite);
        if (!this.coaTextures.has(key)) {
          void svgToTexture(coaSvg(r.coaSeed, { rank: r.rank }), 96, 128).then((tex) => {
            this.coaTextures.set(key, tex);
            if (!sprite.destroyed) sprite.texture = tex;
          });
        }
      }
    }
  }

  private rebuildHoldings(view: GameView): void {
    const g = this.holdingLayer;
    g.clear();
    for (const p of WORLD.provinces) {
      const [x, y] = p.capital;
      const holder = view.titles[p.countyTitleId]?.holderId;
      const holderChar = holder ? view.characters[holder] : undefined;
      const isSeat = holderChar && TITLE_DEFS[holderChar.titleIds[0] ?? '']?.capitalProvinceId === p.id;
      const s = isSeat ? 1.35 : 1;
      // Petit donjon stylisé.
      g.rect(x - 6 * s, y - 5 * s, 12 * s, 9 * s).fill({ color: 0xe6d6b0 }).stroke({ width: 1, color: 0x2a1f14 });
      g.rect(x - 7.5 * s, y - 8 * s, 4 * s, 4 * s).fill({ color: 0xe6d6b0 }).stroke({ width: 1, color: 0x2a1f14 });
      g.rect(x + 3.5 * s, y - 8 * s, 4 * s, 4 * s).fill({ color: 0xe6d6b0 }).stroke({ width: 1, color: 0x2a1f14 });
      g.rect(x - 1.5 * s, y - 1 * s, 3 * s, 5 * s).fill({ color: 0x3a2a18 });
      if (isSeat) g.poly([x - 2, y - 13 * s, x - 2, y - 20 * s, x + 6, y - 17 * s, x - 2, y - 14 * s], true).fill({ color: 0xb3202a });
    }
  }

  private armyColor(a: Army): number {
    const v = this.view;
    if (!v) return 0x888888;
    const owner = v.characters[a.ownerId];
    const house = owner?.houseId ? v.houses[owner.houseId] : undefined;
    return hexToNum(house?.color ?? '#6b5a3a');
  }

  private armyPos(a: Army): [number, number] {
    const from = PROVINCE_GEO[a.location]!.capital;
    if ((a.status === 'moving' || a.status === 'retreating') && a.path.length && a.moveTotal > 0) {
      const to = PROVINCE_GEO[a.path[0]!]!.capital;
      const t = Math.min(1, a.moveProgress / a.moveTotal);
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    }
    return [from[0] + 14, from[1] + 12];
  }

  private syncArmies(view: GameView): void {
    const seen = new Set<string>();
    const stacks = new Map<string, number>();
    for (const a of Object.values(view.armies)) {
      seen.add(a.id);
      const men = Object.values(a.units).reduce((s, m) => s + (m ?? 0), 0);
      let sp = this.armySprites.get(a.id);
      if (!sp) {
        const root = new Container();
        const body = new Graphics();
        const color = this.armyColor(a);
        body.roundRect(-24, -13, 48, 22, 3).fill({ color: 0x1a130d, alpha: 0.9 }).stroke({ width: 1.5, color: 0xc9a24b });
        body.poly([-24, -13, -12, -13, -12, 16, -18, 11, -24, 16], true).fill({ color }).stroke({ width: 1, color: 0x1a130d });
        body.rect(-23, -21, 1.6, 34).fill({ color: 0x8a6a3a });
        root.addChild(body);
        const label = new Text({ text: '', style: { fontFamily: 'Inter Variable, Inter, sans-serif', fontSize: 12, fontWeight: '700', fill: 0xf2e6c8 }, resolution: 2 });
        label.anchor.set(0.5);
        label.position.set(6, -2);
        root.addChild(label);
        root.eventMode = 'none';
        const [x, y] = this.armyPos(a);
        sp = { root, label, x, y };
        root.position.set(x, y);
        this.armyLayer.addChild(root);
        this.armySprites.set(a.id, sp);
      }
      sp.label.text = men >= 1000 ? `${(men / 1000).toFixed(1)}k` : String(Math.round(men));
      const [x, y] = this.armyPos(a);
      const n = stacks.get(a.location) ?? 0;
      stacks.set(a.location, n + 1);
      sp.x = x;
      sp.y = y + n * 26;
      sp.root.alpha = a.shattered > 0 ? 0.55 : 1;
    }
    for (const [id, sp] of this.armySprites) {
      if (!seen.has(id)) {
        sp.root.destroy({ children: true });
        this.armySprites.delete(id);
      }
    }
  }

  private syncEffects(view: GameView): void {
    const seen = new Set<string>();
    for (const b of Object.values(view.battles)) {
      if (b.phase === 'ended') continue;
      seen.add(b.id);
      if (!this.effectSprites.has(b.id)) {
        const c = new Container();
        const g = new Graphics();
        g.circle(0, 0, 16).fill({ color: 0x4a1010, alpha: 0.85 }).stroke({ width: 2, color: 0xe0a060 });
        g.moveTo(-8, -8).lineTo(8, 8).stroke({ width: 3, color: 0xf2e6c8, cap: 'round' });
        g.moveTo(8, -8).lineTo(-8, 8).stroke({ width: 3, color: 0xf2e6c8, cap: 'round' });
        c.addChild(g);
        const [x, y] = PROVINCE_GEO[b.provinceId]!.capital;
        c.position.set(x - 18, y - 26);
        this.effectLayer.addChild(c);
        this.effectSprites.set(b.id, c);
      }
    }
    for (const s of Object.values(view.sieges)) {
      const key = `siege:${s.id}`;
      seen.add(key);
      let c = this.effectSprites.get(key);
      if (!c) {
        c = new Container();
        c.addChild(new Graphics());
        const [x, y] = PROVINCE_GEO[s.provinceId]!.capital;
        c.position.set(x, y - 30);
        this.effectLayer.addChild(c);
        this.effectSprites.set(key, c);
      }
      const g = c.children[0] as Graphics;
      g.clear();
      g.circle(0, 0, 12).fill({ color: 0x1a130d, alpha: 0.85 }).stroke({ width: 1.5, color: 0x6b5a3a });
      const end = -Math.PI / 2 + (Math.PI * 2 * s.progress) / 100;
      g.moveTo(0, 0).arc(0, 0, 12, -Math.PI / 2, end).lineTo(0, 0).fill({ color: 0xc9a24b, alpha: 0.9 });
      g.rect(-4, -4, 8, 8).fill({ color: 0xe6d6b0 });
    }
    for (const [id, c] of this.effectSprites) {
      if (!seen.has(id)) {
        c.destroy({ children: true });
        this.effectSprites.delete(id);
      }
    }
  }

  private drawRoute(): void {
    const g = this.routeLayer;
    g.clear();
    const v = this.view;
    if (!v) return;
    const armies = Object.values(v.armies).filter((a) => a.path.length && (a.id === this.selectedArmy || a.ownerId === this.playerId));
    for (const a of armies) {
      const pts: [number, number][] = [this.armyPos(a), ...a.path.map((p) => PROVINCE_GEO[p]!.capital)];
      const selected = a.id === this.selectedArmy;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!;
        const [x1, y1] = pts[i]!;
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.floor(len / 14));
        for (let k = 0; k < steps; k += 2) {
          const ta = k / steps;
          const tb = Math.min(1, (k + 1) / steps);
          g.moveTo(x0 + (x1 - x0) * ta, y0 + (y1 - y0) * ta).lineTo(x0 + (x1 - x0) * tb, y0 + (y1 - y0) * tb);
        }
      }
      g.stroke({ width: selected ? 4 : 3, color: selected ? 0xf2d98c : 0xd8c79e, alpha: selected ? 0.95 : 0.6, cap: 'round' });
      const last = pts[pts.length - 1]!;
      g.circle(last[0], last[1], 6).fill({ color: 0xf2d98c, alpha: 0.9 });
    }
  }

  // ---------------------------------------------------------------- caméra
  private screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.app.screen.width / 2) / this.zoom + this.camX, (sy - this.app.screen.height / 2) / this.zoom + this.camY];
  }

  private fitToScreen(immediate: boolean): void {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const fit = Math.min(sw / W, sh / H);
    this.minZoom = fit * 0.92;
    const z = this.style === 'ambient' ? fit * 1.6 : fit * 1.02;
    this.targetZoom = z;
    this.targetX = W / 2;
    this.targetY = H / 2;
    if (immediate) {
      this.zoom = z;
      this.camX = this.targetX;
      this.camY = this.targetY;
    }
  }

  private clampCamera(): void {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    this.minZoom = Math.min(sw / W, sh / H) * 0.92;
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom));
    const halfW = sw / 2 / this.targetZoom;
    const halfH = sh / 2 / this.targetZoom;
    const marginX = Math.max(0, halfW - W / 2);
    const marginY = Math.max(0, halfH - H / 2);
    this.targetX = Math.max(halfW - marginX - 200, Math.min(W - halfW + marginX + 200, this.targetX));
    this.targetY = Math.max(halfH - marginY - 200, Math.min(H - halfH + marginY + 200, this.targetY));
  }

  centerOn(provinceId: string, zoom?: number): void {
    const geo = PROVINCE_GEO[provinceId];
    if (!geo) return;
    this.targetX = geo.centroid[0];
    this.targetY = geo.centroid[1];
    if (zoom) this.targetZoom = zoom;
    this.clampCamera();
  }

  panBy(dx: number, dy: number): void {
    this.targetX += dx / this.zoom;
    this.targetY += dy / this.zoom;
    this.clampCamera();
  }

  zoomBy(factor: number, sx?: number, sy?: number): void {
    const px = sx ?? this.app.screen.width / 2;
    const py = sy ?? this.app.screen.height / 2;
    const [wx, wy] = this.screenToWorld(px, py);
    const nz = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * factor));
    // Garder le point sous le curseur fixe.
    this.targetX = wx - (px - this.app.screen.width / 2) / nz;
    this.targetY = wy - (py - this.app.screen.height / 2) / nz;
    this.targetZoom = nz;
    this.clampCamera();
  }

  getZoom(): number {
    return this.zoom;
  }

  private bindInput(): void {
    if (this.style === 'ambient') return;
    const el = this.app.canvas;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 0 || e.button === 1) {
        this.dragging = true;
        this.moved = false;
        this.dragStart = { x: e.clientX, y: e.clientY, camX: this.targetX, camY: this.targetY };
        el.setPointerCapture(e.pointerId);
      }
    });
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      if (this.dragging && this.dragStart) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.moved = true;
        if (this.moved) {
          this.targetX = this.dragStart.camX - dx / this.zoom;
          this.targetY = this.dragStart.camY - dy / this.zoom;
          this.camX = this.targetX;
          this.camY = this.targetY;
          this.clampCamera();
          el.style.cursor = 'grabbing';
        }
        return;
      }
      const [wx, wy] = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const id = provinceAt(wx, wy);
      if (id !== this.hovered) {
        this.hovered = id;
        this.drawHover();
        this.cb.onHover?.(id);
      }
      el.style.cursor = this.armyAt(e.clientX - rect.left, e.clientY - rect.top) ? 'pointer' : id ? 'pointer' : 'default';
    });
    el.addEventListener('pointerup', (e) => {
      const rect = el.getBoundingClientRect();
      const wasDrag = this.moved;
      this.dragging = false;
      this.dragStart = null;
      el.style.cursor = 'default';
      if (wasDrag || e.button !== 0) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const army = this.armyAt(sx, sy);
      if (army) {
        this.cb.onArmyClick?.(army, e);
        return;
      }
      const battle = this.battleAt(sx, sy);
      if (battle) {
        this.cb.onBattleClick?.(battle);
        return;
      }
      const [wx, wy] = this.screenToWorld(sx, sy);
      this.cb.onClick?.(provinceAt(wx, wy), e);
    });
    el.addEventListener('pointerleave', () => {
      this.hovered = null;
      this.drawHover();
      this.cb.onHover?.(null);
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 2) return;
      const rect = el.getBoundingClientRect();
      const [wx, wy] = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.cb.onRightClick?.(provinceAt(wx, wy), e as unknown as PointerEvent);
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.0015);
        this.zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
      },
      { passive: false },
    );
  }

  private armyAt(sx: number, sy: number): string | null {
    for (const [id, sp] of this.armySprites) {
      const x = (sp.root.x - this.camX) * this.zoom + this.app.screen.width / 2;
      const y = (sp.root.y - this.camY) * this.zoom + this.app.screen.height / 2;
      const s = Math.max(0.6, this.zoom) * sp.root.scale.x;
      if (Math.abs(sx - x) < 26 * s && Math.abs(sy - y) < 16 * s) return id;
    }
    return null;
  }

  private battleAt(sx: number, sy: number): string | null {
    for (const [id, c] of this.effectSprites) {
      if (id.startsWith('siege:')) continue;
      const x = (c.x - this.camX) * this.zoom + this.app.screen.width / 2;
      const y = (c.y - this.camY) * this.zoom + this.app.screen.height / 2;
      if (Math.hypot(sx - x, sy - y) < 18 * Math.max(0.6, this.zoom)) return id;
    }
    return null;
  }

  private drawHover(): void {
    const g = this.hoverLayer;
    g.clear();
    if (!this.hovered || this.hovered === this.selected) return;
    const geo = PROVINCE_GEO[this.hovered];
    if (geo) g.poly(flat(geo.polygon), true).fill({ color: 0xffffff, alpha: 0.07 }).stroke({ width: 2, color: 0xf2e6c8, alpha: 0.7 });
  }

  // ---------------------------------------------------------------- boucle
  private update(dt: number): void {
    this.time += dt;
    if (this.style === 'ambient') {
      this.targetX = W / 2 + Math.sin(this.time / 21000) * 700;
      this.targetY = H / 2 + Math.cos(this.time / 27000) * 380;
      this.updateParticles(dt);
    }
    const k = 1 - Math.pow(0.001, dt / 1000);
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, k * 1.2);
    this.camX += (this.targetX - this.camX) * Math.min(1, k * 1.4);
    this.camY += (this.targetY - this.camY) * Math.min(1, k * 1.4);
    this.world.scale.set(this.zoom);
    this.world.position.set(this.app.screen.width / 2 - this.camX * this.zoom, this.app.screen.height / 2 - this.camY * this.zoom);
    this.sea.tilePosition.x = (this.time / 900) % 512;
    this.sea.tilePosition.y = (this.time / 1500) % 512;

    // Animation des armées vers leur position cible.
    for (const sp of this.armySprites.values()) {
      sp.root.x += (sp.x - sp.root.x) * Math.min(1, k * 1.8);
      sp.root.y += (sp.y - sp.root.y) * Math.min(1, k * 1.8);
      const inv = 1 / Math.max(0.55, Math.min(1.6, this.zoom));
      sp.root.scale.set(inv * (sp.root.children.length ? 1 : 1));
    }
    for (const [id, c] of this.effectSprites) {
      const inv = 1 / Math.max(0.55, Math.min(1.6, this.zoom));
      const pulse = id.startsWith('siege:') ? 1 : 1 + Math.sin(this.time / 180) * 0.08;
      c.scale.set(inv * pulse);
    }
    this.applyLod();
    this.cb.onZoom?.(this.zoom);
  }

  /** Zoom sémantique : transitions progressives d'opacité selon le niveau. */
  private applyLod(): void {
    const z = this.zoom;
    const fade = (from: number, to: number) => Math.max(0, Math.min(1, (z - from) / (to - from)));
    this.realmLabelLayer.alpha = 1 - fade(0.42, 0.62);
    this.coaLayer.alpha = fade(0.3, 0.42) * (1 - fade(0.9, 1.2));
    this.duchyLabelLayer.alpha = fade(0.45, 0.6) * (1 - fade(0.95, 1.15));
    this.countyLabelLayer.alpha = fade(0.95, 1.15);
    this.countyBorders.alpha = fade(0.38, 0.6);
    this.featureLayer.alpha = 0.35 + fade(0.4, 0.9) * 0.65;
    this.holdingLayer.alpha = fade(0.75, 1.0);
    this.riverLayer.alpha = 0.5 + fade(0.3, 0.6) * 0.5;
    this.seaLabelLayer.alpha = 0.75 * (1 - fade(0.9, 1.3));
    this.armyLayer.alpha = this.style === 'game' ? 1 : 0;
    const lod = z < 0.5 ? 0 : z < 1 ? 1 : 2;
    if (lod !== this.lastLod) {
      this.lastLod = lod;
      this.realmLabelLayer.visible = this.realmLabelLayer.alpha > 0.01 || lod === 0;
    }
    this.countyLabelLayer.visible = this.countyLabelLayer.alpha > 0.01;
    this.duchyLabelLayer.visible = this.duchyLabelLayer.alpha > 0.01;
  }

  private updateParticles(dt: number): void {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    while (this.particles.length < 70) {
      this.particles.push({ x: Math.random() * sw, y: Math.random() * sh, vx: (Math.random() - 0.3) * 0.012, vy: -0.004 - Math.random() * 0.01, r: 0.6 + Math.random() * 1.8, a: 0.15 + Math.random() * 0.35 });
    }
    const g = this.particleLayer;
    g.clear();
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < -5 || p.x > sw + 5 || p.x < -5) {
        p.x = Math.random() * sw;
        p.y = sh + 5;
      }
      g.circle(p.x, p.y, p.r).fill({ color: 0xf2d9a0, alpha: p.a });
    }
  }

  get hitArea(): Rectangle {
    return new Rectangle(0, 0, W, H);
  }
}
