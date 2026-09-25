/**
 * Étiquettes de la carte, dessinées sur un canevas superposé à MapLibre
 * (aucun serveur de glyphes n'est nécessaire). La taille de chaque nom de
 * royaume suit l'étendue de son territoire à l'écran : les grands empires
 * restent lisibles dézoomés, les petits domaines apparaissent en zoomant.
 */
import type { Map as MlMap } from 'maplibre-gl';
import { nearestLongitude, type Bounds, type LngLat } from './geo';

export interface RealmLabel {
  key: string;
  text: string;
  at: LngLat;
  /** Emprise déroulée (est ≥ ouest) du plus grand morceau de territoire. */
  bounds: Bounds;
  mine: boolean;
  /** Entité regroupée pour le jeu (peuples non listés) : étiquette discrète. */
  minor?: boolean;
}

export interface PlaceLabel {
  text: string;
  at: LngLat;
  bounds: Bounds;
  capital: boolean;
}

const REALM_FONT = '600 {size}px Cinzel, "Cormorant Garamond", Georgia, serif';
const PLACE_FONT = '600 {size}px "Cormorant Garamond", Georgia, serif';

export class LabelOverlay {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private realms: RealmLabel[] = [];
  private places: PlaceLabel[] = [];
  private raf = 0;

  constructor(private readonly map: MlMap, private readonly parchment: boolean) {
    this.canvas.className = 'map-labels';
    this.canvas.setAttribute('aria-hidden', 'true');
    map.getContainer().appendChild(this.canvas);
    map.on('move', this.schedule);
    map.on('resize', this.schedule);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.map.off('move', this.schedule);
    this.map.off('resize', this.schedule);
    this.canvas.remove();
  }

  setRealms(list: RealmLabel[]): void {
    this.realms = list;
    this.schedule();
  }

  setPlaces(list: PlaceLabel[]): void {
    this.places = list;
    this.schedule();
  }

  schedule = (): void => {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  };

  private project(lon: number, lat: number, refLon: number): [number, number] {
    const p = this.map.project([nearestLongitude(lon, refLon), lat]);
    return [p.x, p.y];
  }

  private draw(): void {
    const el = this.map.getContainer();
    const w = el.clientWidth;
    const h = el.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const center = this.map.getCenter().lng;
    const zoom = this.map.getZoom();
    const placed: [number, number, number, number][] = [];
    const collides = (x0: number, y0: number, x1: number, y1: number) => {
      for (const [a, b, c, d] of placed) if (x0 < c && x1 > a && y0 < d && y1 > b) return true;
      return false;
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Royaumes.
    const realms = this.realms
      .map((r) => {
        const [x0, y0] = this.project(r.bounds[0], r.bounds[3], center);
        const [x1, y1] = this.project(r.bounds[2], r.bounds[1], center);
        const [x, y] = this.project(r.at[0], r.at[1], center);
        return { r, x, y, width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
      })
      .filter((o) => o.x > -300 && o.x < w + 300 && o.y > -100 && o.y < h + 100)
      .sort((a, b) => Number(!!a.r.minor) - Number(!!b.r.minor) || b.width - a.width);
    for (const o of realms) {
      const minor = !!o.r.minor;
      const text = minor ? o.r.text : o.r.text.toUpperCase();
      const size = Math.min(minor ? 14 : 34, (o.width * 0.8) / Math.max(4, text.length * 0.78), o.height * 0.45 + 6);
      if (size < (minor ? 10 : 8.5)) continue;
      ctx.font = minor ? `italic ${PLACE_FONT.replace('{size}', size.toFixed(1))}` : REALM_FONT.replace('{size}', size.toFixed(1));
      const spacing = minor ? 0 : Math.min(size * 0.35, 8);
      const tw = ctx.measureText(text).width + spacing * text.length;
      const box: [number, number, number, number] = [o.x - tw / 2, o.y - size / 2, o.x + tw / 2, o.y + size / 2];
      if (collides(...box)) continue;
      placed.push(box);
      ctx.letterSpacing = `${spacing}px`;
      ctx.lineWidth = Math.max(2, size / 6);
      ctx.strokeStyle = this.parchment ? 'rgba(250, 240, 214, 0.75)' : 'rgba(18, 16, 12, 0.72)';
      ctx.fillStyle = o.r.mine ? '#f3d27a' : this.parchment ? '#3a2a18' : minor ? 'rgba(232, 222, 198, 0.78)' : 'rgba(246, 236, 212, 0.94)';
      ctx.strokeText(text, o.x, o.y);
      ctx.fillText(text, o.x, o.y);
    }
    ctx.letterSpacing = '0px';

    // Lieux (provinces) : seulement de près.
    if (zoom >= 4.2) {
      let drawn = 0;
      for (const p of this.places) {
        const [x, y] = this.project(p.at[0], p.at[1], center);
        if (x < -50 || x > w + 50 || y < -20 || y > h + 20) continue;
        const [bx0] = this.project(p.bounds[0], p.bounds[1], center);
        const [bx1] = this.project(p.bounds[2], p.bounds[1], center);
        const span = Math.abs(bx1 - bx0);
        const size = Math.min(15, Math.max(9, span / Math.max(6, p.text.length)));
        if (span < p.text.length * 5 && !p.capital) continue;
        ctx.font = PLACE_FONT.replace('{size}', size.toFixed(1));
        const tw = ctx.measureText(p.text).width;
        const box: [number, number, number, number] = [x - tw / 2 - 2, y + 4, x + tw / 2 + 2, y + 6 + size];
        if (collides(...box)) continue;
        placed.push(box);
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.parchment ? 'rgba(250, 240, 214, 0.8)' : 'rgba(15, 13, 10, 0.75)';
        ctx.fillStyle = this.parchment ? '#2a1e10' : '#efe4c8';
        ctx.strokeText(p.text, x, y + 5 + size / 2);
        ctx.fillText(p.text, x, y + 5 + size / 2);
        if (++drawn > 260) break;
      }
    }
  }
}
