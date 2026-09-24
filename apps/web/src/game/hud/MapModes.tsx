import { useMemo } from 'react';
import type { GameView } from '@ttc/shared';
import { computeColors } from '../../map/colors';
import { useUi, type MapMode } from '../../state/ui';
import { t } from '../../lib/i18n';
import { playSound } from '../../audio/audio';

export const MAP_MODES: { id: MapMode; icon: string; key: string }[] = [
  { id: 'political', icon: '♛', key: 'M' },
  { id: 'terrain', icon: '⛰', key: 'Q' },
  { id: 'culture', icon: '❦', key: 'W' },
  { id: 'faith', icon: '✺', key: 'E' },
  { id: 'economy', icon: '⛁', key: 'R' },
  { id: 'development', icon: '⚒', key: 'T' },
  { id: 'control', icon: '⚑', key: 'Y' },
  { id: 'diplomacy', icon: '✉', key: 'U' },
];

export function MapModes({ view, playerId }: { view: GameView; playerId: string | null }) {
  const mode = useUi((s) => s.mapMode);
  const setMode = useUi((s) => s.setMapMode);
  // La légende dépend du mode, pas de chaque jour : on la calcule sur changement de mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const legend = useMemo(() => computeColors(view, mode, playerId).legend, [mode, playerId]);
  return (
    <div className="mapmodes" data-testid="mapmodes">
      {mode !== 'political' && legend.length > 0 && (
        <div className="legend panel">
          <div className="legend-title">{t(`mapmode.${mode}`)}</div>
          {legend.map((l) => (
            <div key={l.label} className="legend-row">
              <span className="legend-swatch" style={{ background: l.color }} />
              {t(l.label)}
            </div>
          ))}
        </div>
      )}
      <div className="mapmode-bar panel" role="toolbar" aria-label="Modes de carte">
        {MAP_MODES.map((m) => (
          <button
            key={m.id}
            className={`icon-btn${mode === m.id ? ' active' : ''}`}
            onClick={() => {
              playSound('click');
              setMode(m.id);
            }}
            aria-pressed={mode === m.id}
            aria-label={`${t(`mapmode.${m.id}`)} (${m.key})`}
            title={`${t(`mapmode.${m.id}`)} (${m.key})`}
            data-testid={`mapmode-${m.id}`}
          >
            {m.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
