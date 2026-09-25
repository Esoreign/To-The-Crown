import { useEffect, useRef } from 'react';
import type { GameView } from '@ttc/shared';
import { computeColors } from './colors';
import { WorldMap, type MapCallbacks, type MapStyle } from './WorldMap';
import type { MapMode } from '../state/ui';

interface Props extends MapCallbacks {
  styleMode: MapStyle;
  view: GameView | null;
  mapMode?: MapMode;
  playerId?: string | null;
  selectedProvince?: string | null;
  highlight?: string[];
  selectedArmy?: string | null;
  /** Cadrage demandé : province, ou royaume entier d'un souverain (`realmOf`). */
  focus?: { provinceId: string; at: number; zoom?: number; realmOf?: string } | null;
  onReady?(r: WorldMap): void;
  className?: string;
}

function applyFocus(r: WorldMap, f: NonNullable<Props['focus']>): void {
  if (f.realmOf) r.focusRealm(f.realmOf);
  else r.centerOn(f.provinceId, f.zoom);
}

/** Monte la carte du monde (MapLibre) et relaie les changements d'état (sans re-render React par frame). */
export function MapView(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<WorldMap | null>(null);
  const cbs = useRef<Props>(props);
  cbs.current = props;
  const lastColorAt = useRef(0);
  const pendingColor = useRef<number | null>(null);

  useEffect(() => {
    const el = host.current!;
    const r = new WorldMap(props.styleMode, {
      onHover: (id) => cbs.current.onHover?.(id),
      onClick: (id, e) => cbs.current.onClick?.(id, e),
      onRightClick: (id, e) => cbs.current.onRightClick?.(id, e),
      onArmyClick: (id, e) => cbs.current.onArmyClick?.(id, e),
      onBattleClick: (id) => cbs.current.onBattleClick?.(id),
      onZoom: (z) => cbs.current.onZoom?.(z),
    });
    let cancelled = false;
    void r.init(el).then(() => {
      if (cancelled) return;
      renderer.current = r;
      props.onReady?.(r);
      apply(true);
      const cur = cbs.current;
      r.setSelection(cur.selectedProvince ?? null, cur.highlight ?? []);
      r.setSelectedArmy(cur.selectedArmy ?? null);
      if (cur.focus) applyFocus(r, cur.focus);
    });
    return () => {
      cancelled = true;
      renderer.current = null;
      r.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.styleMode]);

  function apply(force = false) {
    const r = renderer.current;
    const v = cbs.current.view;
    if (!r || !v) return;
    r.setView(v, cbs.current.playerId ?? null);
    const now = performance.now();
    if (force || now - lastColorAt.current > 250) {
      lastColorAt.current = now;
      r.setColors(computeColors(v, cbs.current.mapMode ?? 'political', cbs.current.playerId ?? null).colors);
    } else if (pendingColor.current === null) {
      pendingColor.current = window.setTimeout(() => {
        pendingColor.current = null;
        apply(true);
      }, 260);
    }
  }

  // apply() lit l'état courant via des refs : seules ces dépendances déclenchent un rendu.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => apply(), [props.view]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => apply(true), [props.mapMode, props.playerId]);
  useEffect(() => {
    renderer.current?.setSelection(props.selectedProvince ?? null, props.highlight ?? []);
  }, [props.selectedProvince, props.highlight]);
  useEffect(() => {
    renderer.current?.setSelectedArmy(props.selectedArmy ?? null);
  }, [props.selectedArmy]);
  useEffect(() => {
    if (props.focus && renderer.current) applyFocus(renderer.current, props.focus);
  }, [props.focus]);

  return <div ref={host} className={props.className ?? 'map-host'} />;
}
