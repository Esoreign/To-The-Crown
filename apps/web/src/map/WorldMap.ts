/**
 * Carte du monde (MapLibre GL, projection de Mercator, copies du monde de
 * part et d'autre de l'antiméridien). Couches, de bas en haut :
 *
 *   relief (tuiles raster pré-rendues) · zones maritimes · provinces (teinte
 *   du mode de carte via feature-state) · lacs · fleuves · littoral ·
 *   frontières de provinces · de vassaux · de royaumes · contour du royaume
 *   du joueur (or) · survol / sélection · capitales · itinéraire
 *   + marqueurs HTML (armées, batailles, sièges) et canevas d'étiquettes.
 *
 * Les géométries ne sont jamais reconstruites pour un changement de mode :
 * seules les feature-states changent. Les frontières politiques sont
 * recalculées (maillage topologique) quand la carte politique change.
 */
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Worker empaqueté par Vite en un seul module (le fichier brut importe maplibre-gl-shared.mjs).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection, Geometry } from 'geojson';
import { WORLD } from '@ttc/content';
import {
  PROVINCE_GEO,
  TITLE_DEFS,
  areAllied,
  atWarWith,
  isInRealmOf,
  realmProvinceIds,
  topLiegeId,
} from '@ttc/game-core';
import type { Army, GameView } from '@ttc/shared';
import {
  boundsCenter,
  fitFeatureSafely,
  getWrappedBounds,
  inverseMercator,
  mercator,
  mergeBounds,
  nearestLongitude,
  unwrapBounds,
  type Bounds,
  type LngLat,
} from './geo';
import { LabelOverlay, type PlaceLabel, type RealmLabel } from './labels';
import {
  WORLD_BASE,
  asFeature,
  bordersBy,
  loadWorldGeometry,
  outlineOf,
  type WorldGeometry,
} from './worldData';
import type { ProvinceColor } from './colors';

maplibregl.setWorkerUrl(workerUrl);

export type MapStyle = 'game' | 'ambient' | 'parchment';

export interface MapCallbacks {
  onHover?(provinceId: string | null): void;
  onClick?(provinceId: string | null, ev: MouseEvent): void;
  onRightClick?(provinceId: string | null, ev: MouseEvent): void;
  onArmyClick?(armyId: string, ev: MouseEvent): void;
  onBattleClick?(battleId: string): void;
  onZoom?(zoom: number): void;
  onError?(message: string): void;
}

export interface CameraState {
  center: LngLat;
  zoom: number;
}

const byIndex = new Map(WORLD.provinces.map((p) => [p.index, p]));
const pid = (index: number) => `p${index}`;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Emprise déroulée d'une liste de provinces. */
export function provincesBounds(ids: string[]): Bounds | null {
  return mergeBounds(ids.map((id) => PROVINCE_GEO[id]?.bbox).filter((b): b is Bounds => !!b));
}

export class WorldMap {
  private map!: MlMap;
  private geo!: WorldGeometry;
  private labels!: LabelOverlay;
  private container!: HTMLElement;
  private destroyed = false;
  private ready = false;
  private view: GameView | null = null;
  private playerId: string | null = null;
  private colorCache = new Map<number, string>();
  private hovered: number | null = null;
  private selected: number | null = null;
  private highlighted = new Set<number>();
  private structureSig = '';
  private selectedArmy: string | null = null;
  private markers = new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>();
  private minimap: HTMLCanvasElement | null = null;
  private minimapImg: HTMLImageElement | null = null;
  private offscreen: HTMLButtonElement | null = null;
  private history: CameraState[] = [];
  private historyIndex = -1;
  private historyLock = false;
  private realmBoundsCache: Bounds | null = null;
  private pendingFocus: (() => void) | null = null;

  constructor(
    private readonly style: MapStyle,
    private readonly cb: MapCallbacks = {},
  ) {}

  async init(parent: HTMLElement): Promise<void> {
    this.container = parent;
    parent.classList.add('world-map', `world-map--${this.style}`);
    const interactive = this.style !== 'ambient';
    this.map = new maplibregl.Map({
      container: parent,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#16324a' } }],
      },
      center: [20, 35],
      zoom: 1.6,
      minZoom: 0.8,
      // Au-delà, une province occupe l'écran et la grille de 5 km du monde devient visible.
      maxZoom: 6.6,
      renderWorldCopies: true,
      interactive,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.keyboard.disable();
    this.labels = new LabelOverlay(this.map, this.style === 'parchment');
    try {
      [this.geo] = await Promise.all([
        loadWorldGeometry(),
        new Promise<void>((r) => this.map.once('load', () => r())),
      ]);
    } catch (e) {
      this.cb.onError?.(e instanceof Error ? e.message : String(e));
      return;
    }
    if (this.destroyed) return;
    this.addSourcesAndLayers();
    this.bindInput();
    this.ready = true;
    if (this.style === 'game') {
      this.buildMinimap();
      this.buildOffscreenIndicator();
    }
    if (this.style === 'ambient') this.startAmbientDrift();
    this.map.on('moveend', () => {
      this.recordHistory();
      // Position de la caméra exposée au DOM (tests de bout en bout, outils).
      const c = this.map.getCenter();
      const el = this.map.getContainer();
      el.dataset.center = `${c.lng.toFixed(2)},${c.lat.toFixed(2)}`;
      el.dataset.zoom = this.map.getZoom().toFixed(2);
    });
    this.map.on('move', () => {
      this.drawMinimap();
      this.updateOffscreen();
    });
    this.map.on('zoom', () => this.cb.onZoom?.(this.map.getZoom()));
    if (this.view) this.setView(this.view, this.playerId);
    this.pendingFocus?.();
    this.pendingFocus = null;
  }

  destroy(): void {
    this.destroyed = true;
    for (const { marker } of this.markers.values()) marker.remove();
    this.markers.clear();
    this.labels?.destroy();
    try {
      this.map?.remove();
    } catch {
      // Carte non initialisée.
    }
  }

  // ---------------------------------------------------------------------------
  // Couches
  // ---------------------------------------------------------------------------

  private addSourcesAndLayers(): void {
    const m = this.map;
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
    m.addSource('terrain', {
      type: 'raster',
      tiles: [`${location.origin}${WORLD_BASE}/terrain/{z}/{x}/{y}.webp`],
      tileSize: 256,
      maxzoom: 5,
      attribution: 'Relief : Terrain Tiles (AWS, Mapzen) ; données : Natural Earth',
    });
    m.addLayer({
      id: 'terrain',
      type: 'raster',
      source: 'terrain',
      paint: {
        'raster-fade-duration': 0,
        // Les tuiles de relief s'arrêtent au zoom 5 : on les estompe de près pour éviter le flou.
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 5, 1, 6.6, 0.8],
        'raster-saturation': this.style === 'parchment' ? -0.55 : -0.1,
        'raster-contrast': this.style === 'parchment' ? -0.15 : 0.05,
      },
    });
    m.addSource('seas', { type: 'geojson', data: this.geo.seas as FeatureCollection, tolerance: 0.6 });
    m.addLayer({
      id: 'sea-lines',
      type: 'line',
      source: 'seas',
      minzoom: 3,
      paint: {
        'line-color': '#9fc3d6',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 5, 0.25],
        'line-width': 0.6,
        'line-dasharray': [3, 3],
      },
    });
    m.addSource('prov', { type: 'geojson', data: this.geo.provinces as FeatureCollection, tolerance: 0.25 });
    m.addLayer({
      id: 'prov-fill',
      type: 'fill',
      source: 'prov',
      paint: {
        'fill-color': ['to-color', ['coalesce', ['feature-state', 'c'], '#8a8070']],
        'fill-opacity': ((base: unknown) => [
          'interpolate',
          ['linear'],
          ['zoom'],
          1,
          ['*', 1.15, base],
          4,
          ['*', 0.95, base],
          7,
          ['*', 1.05, base],
        ])([
          '*',
          ['coalesce', ['feature-state', 'a'], 0],
          ['case', ['boolean', ['feature-state', 'hover'], false], 1.25, 1],
        ]) as maplibregl.ExpressionSpecification,
        'fill-antialias': false,
      },
    });
    m.addSource('lakes', { type: 'geojson', data: this.geo.lakes as FeatureCollection, tolerance: 0.5 });
    m.addLayer({
      id: 'lakes',
      type: 'fill',
      source: 'lakes',
      paint: { 'fill-color': '#3f6f88', 'fill-opacity': 0.9 },
    });
    m.addSource('rivers', { type: 'geojson', data: this.geo.rivers as FeatureCollection, tolerance: 0.5 });
    m.addLayer({
      id: 'rivers',
      type: 'line',
      source: 'rivers',
      filter: ['<=', ['get', 'r'], ['interpolate', ['linear'], ['zoom'], 1, 3, 3, 5, 5, 7]],
      paint: {
        'line-color': '#4a7f99',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 5, 0.85],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1,
          ['-', 1.4, ['*', ['get', 'r'], 0.12]],
          7,
          ['-', 3.2, ['*', ['get', 'r'], 0.25]],
        ],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    m.addSource('coasts', { type: 'geojson', data: this.geo.coasts, tolerance: 0.3 });
    m.addLayer({
      id: 'coasts',
      type: 'line',
      source: 'coasts',
      paint: {
        'line-color': '#2a2419',
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 1.4],
      },
    });
    m.addSource('prov-borders', {
      type: 'geojson',
      data: asFeature(this.geo.provinceBorders),
      tolerance: 0.3,
    });
    m.addLayer({
      id: 'prov-borders',
      type: 'line',
      source: 'prov-borders',
      minzoom: 3,
      paint: {
        'line-color': '#1f180f',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.15, 4, 0.45, 6, 0.65],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 5, 0.9, 6.6, 1.3],
      },
    });
    m.addSource('vassal-borders', { type: 'geojson', data: empty, tolerance: 0.3 });
    m.addLayer({
      id: 'vassal-borders',
      type: 'line',
      source: 'vassal-borders',
      minzoom: 2.3,
      paint: {
        'line-color': '#1c160e',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 2.3, 0, 3.5, 0.75],
        'line-width': ['interpolate', ['linear'], ['zoom'], 2.3, 0.8, 5, 1.6, 8, 2.6],
      },
      layout: { 'line-join': 'round' },
    });
    m.addSource('realm-borders', { type: 'geojson', data: empty, tolerance: 0.3 });
    m.addLayer({
      id: 'realm-borders',
      type: 'line',
      source: 'realm-borders',
      paint: {
        'line-color': '#140f09',
        'line-opacity': 0.85,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 4, 2, 8, 4.2],
      },
      layout: { 'line-join': 'round' },
    });
    m.addSource('mine', { type: 'geojson', data: empty, tolerance: 0.3 });
    m.addLayer({
      id: 'mine-glow',
      type: 'line',
      source: 'mine',
      paint: {
        'line-color': '#f4cf6a',
        'line-opacity': 0.45,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 5, 6, 10],
        'line-blur': 4,
      },
      layout: { 'line-join': 'round' },
    });
    m.addLayer({
      id: 'mine',
      type: 'line',
      source: 'mine',
      paint: {
        'line-color': '#f2c95b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 6, 3, 8, 4],
      },
      layout: { 'line-join': 'round' },
    });
    m.addLayer({
      id: 'prov-state',
      type: 'line',
      source: 'prov',
      paint: {
        'line-color': ['case', ['boolean', ['feature-state', 'sel'], false], '#fff3c4', '#f2c95b'],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'sel'], false],
          3,
          ['boolean', ['feature-state', 'hl'], false],
          2,
          1.5,
        ],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'sel'], false],
          1,
          ['boolean', ['feature-state', 'hl'], false],
          0.9,
          ['boolean', ['feature-state', 'hover'], false],
          0.7,
          0,
        ],
      },
    });
    m.addSource('route', { type: 'geojson', data: empty });
    m.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      paint: {
        'line-color': '#f6e3a8',
        'line-width': 2.5,
        'line-dasharray': [1.5, 1.2],
        'line-opacity': 0.95,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    m.addSource('capitals', { type: 'geojson', data: empty });
    m.addLayer({
      id: 'capitals',
      type: 'circle',
      source: 'capitals',
      minzoom: 2.5,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2.5,
          ['*', 1.2, ['get', 'r']],
          7,
          ['*', 3, ['get', 'r']],
        ],
        'circle-color': ['case', ['get', 'mine'], '#f2c95b', '#efe4c8'],
        'circle-stroke-color': '#1a130d',
        'circle-stroke-width': 1.2,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // État de jeu
  // ---------------------------------------------------------------------------

  setView(view: GameView, playerId: string | null): void {
    this.view = view;
    this.playerId = playerId;
    if (!this.ready) return;
    this.syncPolitics(view);
    this.syncMarkers(view);
    this.drawRoute();
  }

  /** Recalcule frontières, contours et étiquettes quand la carte politique change. */
  private syncPolitics(view: GameView): void {
    const top = new Map<number, string | null>();
    const vassal = new Map<number, string | null>();
    let sig = this.playerId ?? '';
    for (const p of WORLD.provinces) {
      const holder = view.titles[p.countyTitleId]?.holderId ?? null;
      if (!holder) {
        top.set(p.index, null);
        vassal.set(p.index, null);
        continue;
      }
      const t = topLiegeId(view, holder);
      top.set(p.index, t);
      // Vassal de premier rang du souverain (ou le souverain lui-même).
      let v = holder;
      for (let guard = 0; guard < 12; guard++) {
        const l = view.characters[v]?.liegeId;
        if (!l || l === t) break;
        v = l;
      }
      vassal.set(p.index, v);
      sig += `${t}:${v}|`;
    }
    if (sig === this.structureSig) return;
    this.structureSig = sig;
    const m = this.map;
    (m.getSource('realm-borders') as GeoJSONSource).setData(
      asFeature(bordersBy(this.geo, (i) => top.get(i) ?? null)),
    );
    (m.getSource('vassal-borders') as GeoJSONSource).setData(
      asFeature(bordersBy(this.geo, (i) => vassal.get(i) ?? null)),
    );
    const myTop = this.playerId ? topLiegeId(view, this.playerId) : null;
    const mine = this.playerId ? outlineOf(this.geo, (i) => top.get(i) === myTop) : null;
    (m.getSource('mine') as GeoJSONSource).setData(
      mine ? asFeature(mine) : { type: 'FeatureCollection', features: [] },
    );
    this.realmBoundsCache = myTop ? provincesBounds(realmProvinceIds(view, myTop)) : null;
    this.buildLabels(view, top, myTop);
    this.updateOffscreen();
  }

  private buildLabels(view: GameView, top: Map<number, string | null>, myTop: string | null): void {
    const groups = new Map<string, number[]>();
    for (const [i, t] of top) if (t) (groups.get(t) ?? groups.set(t, []).get(t)!).push(i);
    const realms: RealmLabel[] = [];
    const capitals: GeoJSON.Feature[] = [];
    for (const [ruler, list] of groups) {
      const c = view.characters[ruler];
      const primary = c?.titleIds[0];
      const def = primary ? TITLE_DEFS[primary] : undefined;
      if (!def) continue;
      // Plus grand morceau contigu du territoire.
      const inSet = new Set(list);
      const seen = new Set<number>();
      let best: number[] = [];
      let bestArea = -1;
      for (const start of list) {
        if (seen.has(start)) continue;
        const comp: number[] = [];
        const stack = [start];
        seen.add(start);
        let area = 0;
        while (stack.length) {
          const u = stack.pop()!;
          comp.push(u);
          const g = byIndex.get(u)!;
          area += g.area;
          for (const n of [...g.neighbors, ...g.straits]) {
            const ni = PROVINCE_GEO[n]!.index;
            if (inSet.has(ni) && !seen.has(ni)) {
              seen.add(ni);
              stack.push(ni);
            }
          }
        }
        if (area > bestArea) {
          bestArea = area;
          best = comp;
        }
      }
      const bounds = mergeBounds(best.map((i) => byIndex.get(i)!.bbox));
      if (!bounds) continue;
      const ub = unwrapBounds(bounds);
      // Centre pondéré par la superficie, longitudes rapprochées du centre de l'emprise.
      const ref = (ub[0] + ub[2]) / 2;
      let sx = 0;
      let sy = 0;
      let sw = 0;
      for (const i of best) {
        const g = byIndex.get(i)!;
        const w = Math.sqrt(g.area);
        sx += nearestLongitude(g.centroid[0], ref) * w;
        sy += g.centroid[1] * w;
        sw += w;
      }
      const at: LngLat = [sx / sw, sy / sw];
      const minor = !!def.polityId && /^f\d+$/.test(def.polityId);
      realms.push({ key: ruler, text: def.short ?? def.name, at, bounds: ub, mine: ruler === myTop, minor });
      const capId = def.capitalProvinceId;
      const cap = PROVINCE_GEO[capId];
      if (cap && top.get(cap.index) === ruler) {
        const rank =
          def.rank === 'empire' ? 2.2 : def.rank === 'kingdom' ? 1.7 : def.rank === 'duchy' ? 1.3 : 1;
        capitals.push({
          type: 'Feature',
          properties: { r: rank, mine: ruler === myTop },
          geometry: { type: 'Point', coordinates: cap.capital },
        });
      }
    }
    this.labels.setRealms(realms);
    (this.map.getSource('capitals') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: capitals,
    });
    const places: PlaceLabel[] = WORLD.provinces.map((p) => ({
      text: p.name,
      at: p.centroid,
      bounds: unwrapBounds(p.bbox),
      capital: p.baseFort >= 2,
    }));
    this.labels.setPlaces(places);
  }

  setColors(colors: Map<string, ProvinceColor>): void {
    if (!this.ready) return;
    for (const [id, c] of colors) {
      const g = PROVINCE_GEO[id];
      if (!g) continue;
      const key = `${hex(c.color)}${c.alpha.toFixed(2)}`;
      if (this.colorCache.get(g.index) === key) continue;
      this.colorCache.set(g.index, key);
      this.map.setFeatureState({ source: 'prov', id: g.index }, { c: hex(c.color), a: c.alpha });
    }
  }

  setSelection(provinceId: string | null, highlight: string[] = []): void {
    if (!this.ready) {
      this.pendingFocus = null;
      return;
    }
    const idx = provinceId ? (PROVINCE_GEO[provinceId]?.index ?? null) : null;
    if (this.selected !== null && this.selected !== idx)
      this.map.setFeatureState({ source: 'prov', id: this.selected }, { sel: false });
    if (idx !== null) this.map.setFeatureState({ source: 'prov', id: idx }, { sel: true });
    this.selected = idx;
    const next = new Set(
      highlight.map((h) => PROVINCE_GEO[h]?.index).filter((x): x is number => x !== undefined),
    );
    for (const i of this.highlighted)
      if (!next.has(i)) this.map.setFeatureState({ source: 'prov', id: i }, { hl: false });
    for (const i of next)
      if (!this.highlighted.has(i)) this.map.setFeatureState({ source: 'prov', id: i }, { hl: true });
    this.highlighted = next;
  }

  setSelectedArmy(armyId: string | null): void {
    this.selectedArmy = armyId;
    for (const [id, { el }] of this.markers) el.classList.toggle('is-selected', id === `army:${armyId}`);
    this.drawRoute();
  }

  // ---------------------------------------------------------------------------
  // Armées, batailles, sièges
  // ---------------------------------------------------------------------------

  private armyRelation(a: Army): 'mine' | 'ally' | 'enemy' | 'neutral' {
    const v = this.view;
    const me = this.playerId;
    if (!v || !me) return 'neutral';
    if (a.ownerId === me || isInRealmOf(v, a.ownerId, me)) return 'mine';
    const myTop = topLiegeId(v, me);
    const top = topLiegeId(v, a.ownerId);
    if (atWarWith(v, top, myTop) || atWarWith(v, a.ownerId, me)) return 'enemy';
    if (top === myTop || areAllied(v, top, myTop)) return 'ally';
    return 'neutral';
  }

  private armyPos(a: Army): LngLat {
    const from = PROVINCE_GEO[a.location]!.centroid;
    if ((a.status === 'moving' || a.status === 'retreating') && a.path.length && a.moveTotal > 0) {
      const to = PROVINCE_GEO[a.path[0]!]!.centroid;
      const t = Math.min(1, a.moveProgress / a.moveTotal);
      const tl = nearestLongitude(to[0], from[0]);
      return [from[0] + (tl - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    }
    return from;
  }

  private upsertMarker(
    key: string,
    at: LngLat,
    build: () => HTMLElement,
    update: (el: HTMLElement) => void,
  ): void {
    let entry = this.markers.get(key);
    if (!entry) {
      const el = build();
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(at).addTo(this.map);
      entry = { marker, el };
      this.markers.set(key, entry);
    } else entry.marker.setLngLat(at);
    update(entry.el);
  }

  private syncMarkers(view: GameView): void {
    const seen = new Set<string>();
    const stacks = new Map<string, number>();
    for (const a of Object.values(view.armies)) {
      const key = `army:${a.id}`;
      seen.add(key);
      const men = Object.values(a.units).reduce<number>((s, m) => s + (m ?? 0), 0);
      const n = stacks.get(a.location) ?? 0;
      stacks.set(a.location, n + 1);
      const at = this.armyPos(a);
      this.upsertMarker(
        key,
        [at[0], at[1] - n * 0.15],
        () => {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'army-marker';
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cb.onArmyClick?.(a.id, e);
          });
          return el;
        },
        (el) => {
          const owner = view.characters[a.ownerId];
          const house = owner?.houseId ? view.houses[owner.houseId] : undefined;
          el.dataset.rel = this.armyRelation(a);
          el.style.setProperty('--banner', house?.color ?? '#6b5a3a');
          el.classList.toggle('is-shattered', a.shattered > 0);
          el.classList.toggle('is-selected', a.id === this.selectedArmy);
          el.textContent = men >= 1000 ? `${(men / 1000).toFixed(1)}k` : String(Math.round(men));
          el.setAttribute('aria-label', `Armée de ${owner?.firstName ?? '?'} : ${Math.round(men)} hommes`);
        },
      );
    }
    for (const b of Object.values(view.battles)) {
      if (b.phase === 'ended') continue;
      const key = `battle:${b.id}`;
      seen.add(key);
      const c = PROVINCE_GEO[b.provinceId]!.centroid;
      this.upsertMarker(
        key,
        [c[0], c[1] + 0.25],
        () => {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'battle-marker';
          el.textContent = '⚔';
          el.setAttribute('aria-label', `Bataille : ${b.name}`);
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cb.onBattleClick?.(b.id);
          });
          return el;
        },
        () => undefined,
      );
    }
    for (const s of Object.values(view.sieges)) {
      const key = `siege:${s.id}`;
      seen.add(key);
      const c = PROVINCE_GEO[s.provinceId]!.capital;
      this.upsertMarker(
        key,
        c,
        () => {
          const el = document.createElement('div');
          el.className = 'siege-marker';
          return el;
        },
        (el) => el.style.setProperty('--p', `${Math.round(s.progress)}%`),
      );
    }
    for (const [key, { marker }] of this.markers) {
      if (!seen.has(key)) {
        marker.remove();
        this.markers.delete(key);
      }
    }
  }

  private drawRoute(): void {
    if (!this.ready) return;
    const v = this.view;
    const a = this.selectedArmy && v ? v.armies[this.selectedArmy] : undefined;
    const src = this.map.getSource('route') as GeoJSONSource | undefined;
    if (!src) return;
    if (!a || !a.path.length) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const pts: LngLat[] = [this.armyPos(a), ...a.path.map((p) => PROVINCE_GEO[p]!.centroid)];
    const line: LngLat[] = [];
    for (const p of pts)
      line.push(line.length ? [nearestLongitude(p[0], line[line.length - 1]![0]), p[1]] : p);
    src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } });
  }

  // ---------------------------------------------------------------------------
  // Entrées
  // ---------------------------------------------------------------------------

  private featureAt(point: maplibregl.PointLike): number | null {
    const f = this.map.queryRenderedFeatures(point, { layers: ['prov-fill'] })[0] as
      MapGeoJSONFeature | undefined;
    return f && typeof f.id === 'number' ? f.id : null;
  }

  private bindInput(): void {
    const m = this.map;
    m.on('mousemove', (e) => {
      const idx = this.featureAt(e.point);
      if (idx === this.hovered) return;
      if (this.hovered !== null) m.setFeatureState({ source: 'prov', id: this.hovered }, { hover: false });
      if (idx !== null) m.setFeatureState({ source: 'prov', id: idx }, { hover: true });
      this.hovered = idx;
      m.getCanvas().style.cursor = idx !== null ? 'pointer' : '';
      this.cb.onHover?.(idx !== null ? pid(idx) : null);
    });
    m.on('mouseout', () => {
      if (this.hovered !== null) m.setFeatureState({ source: 'prov', id: this.hovered }, { hover: false });
      this.hovered = null;
      this.cb.onHover?.(null);
    });
    m.on('click', (e) => {
      const idx = this.featureAt(e.point);
      this.cb.onClick?.(idx !== null ? pid(idx) : null, e.originalEvent);
    });
    m.on('contextmenu', (e) => {
      e.preventDefault();
      const idx = this.featureAt(e.point);
      this.cb.onRightClick?.(idx !== null ? pid(idx) : null, e.originalEvent);
    });
  }

  // ---------------------------------------------------------------------------
  // Caméra
  // ---------------------------------------------------------------------------

  private whenReady(fn: () => void): void {
    if (this.ready) fn();
    else this.pendingFocus = fn;
  }

  /** Cadre une emprise (déroulée) sans zoom excessif ; gère l'antiméridien. */
  fitBounds(b: Bounds, opts: { animate?: boolean; maxZoom?: number } = {}): void {
    this.whenReady(() => {
      const [w, s, e, n] = fitFeatureSafely(b);
      const c = this.map.getCenter().lng;
      const shift = nearestLongitude((w + e) / 2, c) - (w + e) / 2;
      this.map.fitBounds(
        [
          [w + shift, s],
          [e + shift, n],
        ],
        { padding: 70, maxZoom: opts.maxZoom ?? 6.2, duration: opts.animate === false ? 0 : 900 },
      );
    });
  }

  centerOn(provinceId: string, zoom?: number): void {
    const g = PROVINCE_GEO[provinceId];
    if (!g) return;
    this.whenReady(() => {
      const c = this.map.getCenter().lng;
      this.map.flyTo({
        center: [nearestLongitude(g.centroid[0], c), g.centroid[1]],
        zoom: zoom ? 2.5 + zoom * 1.6 : Math.max(this.map.getZoom(), 5),
        duration: 900,
        essential: true,
      });
    });
  }

  flyToProvince(provinceId: string): void {
    this.centerOn(provinceId);
  }

  /** Cadre tout le royaume d'un souverain (touche H). */
  focusRealm(characterId: string): void {
    const v = this.view;
    if (!v) return;
    const top = topLiegeId(v, characterId);
    const b = provincesBounds(realmProvinceIds(v, top));
    if (b) this.fitBounds(b);
  }

  /** Centre sur la capitale d'un souverain (Maj+H). */
  focusCapital(characterId: string): void {
    const v = this.view;
    const c = v?.characters[characterId];
    const primary = c?.titleIds[0];
    const cap = primary ? TITLE_DEFS[primary]?.capitalProvinceId : undefined;
    if (cap) this.centerOn(cap, 2.4);
  }

  focusArmy(armyId: string): void {
    const a = this.view?.armies[armyId];
    if (!a) return;
    const [lon, lat] = this.armyPos(a);
    this.whenReady(() =>
      this.map.flyTo({
        center: [nearestLongitude(lon, this.map.getCenter().lng), lat],
        zoom: Math.max(this.map.getZoom(), 5),
        duration: 800,
      }),
    );
  }

  panBy(dx: number, dy: number): void {
    this.whenReady(() => this.map.panBy([-dx, -dy], { duration: 0 }));
  }

  zoomBy(factor: number): void {
    this.whenReady(() => this.map.zoomTo(this.map.getZoom() + Math.log2(factor), { duration: 180 }));
  }

  getZoom(): number {
    return this.ready ? this.map.getZoom() : 1.6;
  }

  getCamera(): CameraState {
    const c = this.map.getCenter();
    return { center: [c.lng, c.lat], zoom: this.map.getZoom() };
  }

  setCamera(cam: CameraState, animate = true): void {
    this.whenReady(() => {
      this.historyLock = true;
      this.map.flyTo({ center: cam.center, zoom: cam.zoom, duration: animate ? 700 : 0 });
    });
  }

  private recordHistory(): void {
    if (this.historyLock) {
      this.historyLock = false;
      return;
    }
    const cam = this.getCamera();
    const last = this.history[this.historyIndex];
    if (
      last &&
      Math.abs(last.zoom - cam.zoom) < 0.3 &&
      Math.hypot(last.center[0] - cam.center[0], last.center[1] - cam.center[1]) < 2 / 2 ** cam.zoom
    )
      return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(cam);
    if (this.history.length > 40) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  /** Historique de caméra (Alt+← / Alt+→). */
  historyStep(delta: -1 | 1): void {
    const i = this.historyIndex + delta;
    const cam = this.history[i];
    if (!cam) return;
    this.historyIndex = i;
    this.setCamera(cam);
  }

  // ---------------------------------------------------------------------------
  // Mini-carte et indicateur du royaume hors écran
  // ---------------------------------------------------------------------------

  private buildMinimap(): void {
    const c = document.createElement('canvas');
    c.className = 'minimap';
    c.width = 200;
    c.height = 200;
    c.title = 'Mini-carte : cliquer pour s’y rendre';
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', 'Mini-carte du monde');
    const img = new Image();
    img.src = `${WORLD_BASE}/minimap.webp`;
    img.onload = () => this.drawMinimap();
    this.minimapImg = img;
    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      const [lon, lat] = inverseMercator((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      this.map.flyTo({ center: [nearestLongitude(lon, this.map.getCenter().lng), lat], duration: 600 });
    });
    this.container.appendChild(c);
    this.minimap = c;
  }

  private drawMinimap(): void {
    const c = this.minimap;
    const img = this.minimapImg;
    if (!c || !img?.complete) return;
    const ctx = c.getContext('2d')!;
    const S = c.width;
    ctx.drawImage(img, 0, 0, S, S);
    const b = this.map.getBounds();
    const [x0, y0] = mercator([b.getWest(), b.getNorth()]);
    const [x1, y1] = mercator([b.getEast(), b.getSouth()]);
    const span = b.getEast() - b.getWest();
    ctx.strokeStyle = '#f2c95b';
    ctx.lineWidth = 1.5;
    const w = span >= 360 ? S : (span / 360) * S;
    const draw = (x: number) => ctx.strokeRect(x, y0 * S, w, (y1 - y0) * S);
    draw(x0 * S);
    if (x0 * S + w > S) draw(x0 * S - S);
    void x1;
    const rb = this.realmBoundsCache;
    if (rb) {
      const [cx, cy] = mercator(boundsCenter(rb));
      ctx.fillStyle = '#f2c95b';
      ctx.beginPath();
      ctx.arc(cx * S, cy * S, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private buildOffscreenIndicator(): void {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'offscreen-realm';
    b.hidden = true;
    b.textContent = '➤';
    b.title = 'Votre royaume est hors de l’écran (H pour y revenir)';
    b.setAttribute('aria-label', 'Revenir à mon royaume');
    b.addEventListener('click', () => this.playerId && this.focusRealm(this.playerId));
    this.container.appendChild(b);
    this.offscreen = b;
  }

  private updateOffscreen(): void {
    const el = this.offscreen;
    const rb = this.realmBoundsCache;
    if (!el) return;
    if (!rb || !this.ready) {
      el.hidden = true;
      return;
    }
    const center = boundsCenter(rb);
    const p = this.map.project([nearestLongitude(center[0], this.map.getCenter().lng), center[1]]);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const visible = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
    const b = this.map.getBounds();
    const ub = unwrapBounds(rb);
    const overlaps = !(ub[2] < b.getWest() || ub[0] > b.getEast()) || b.getEast() - b.getWest() >= 300;
    if (visible || (overlaps && ub[1] < b.getNorth() && ub[3] > b.getSouth())) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const cx = w / 2;
    const cy = h / 2;
    const ang = Math.atan2(p.y - cy, p.x - cx);
    const r = Math.min(w, h) / 2 - 34;
    el.style.transform = `translate(${cx + Math.cos(ang) * r - 18}px, ${cy + Math.sin(ang) * r - 18}px) rotate(${ang}rad)`;
  }

  // ---------------------------------------------------------------------------
  // Écran titre : lente dérive
  // ---------------------------------------------------------------------------

  private startAmbientDrift(): void {
    this.map.jumpTo({ center: [12, 38], zoom: 2.3 });
    let lon = 12;
    const step = () => {
      if (this.destroyed) return;
      lon += 0.012;
      this.map.jumpTo({ center: [lon, 38 + Math.sin(lon / 20) * 6] });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

export { getWrappedBounds };
export type { Geometry };
