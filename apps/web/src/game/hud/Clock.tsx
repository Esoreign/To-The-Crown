import { useRef } from 'react';
import { fromDay, type Speed } from '@ttc/shared';
import { useGame } from '../../state/game';
import { requestPause, setSpeed } from '../../net/socket';
import { playSound } from '../../audio/audio';
import { t, tOr } from '../../lib/i18n';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function useClockControls() {
  const clock = useGame((s) => s.clock);
  const you = useGame((s) => s.youUserId);
  const last = useRef<Speed>(1);
  if (clock && clock.speed > 0) last.current = clock.speed;
  const isHost = !!clock && clock.hostId === you;
  return {
    clock,
    isHost,
    toggle() {
      if (!clock) return;
      playSound('click');
      if (clock.paused) {
        if (isHost) setSpeed(last.current);
      } else requestPause(true);
    },
    speed(s: Speed) {
      if (!isHost || !clock) return;
      playSound('click');
      setSpeed(Math.min(s, clock.maxSpeed) as Speed);
    },
  };
}

export function Clock() {
  const { clock, isHost, toggle, speed } = useClockControls();
  const date = useGame((s) => s.world?.date ?? 0);
  const status = useGame((s) => s.status);
  const latency = useGame((s) => s.latencyMs);
  if (!clock) return null;
  const d = fromDay(date);
  const paused = clock.paused;
  return (
    <div className={`clock panel${paused ? ' paused' : ''}`} data-testid="clock">
      <div className="clock-date">
        <span className="clock-day num">{d.day}</span>
        <span className="clock-month">{MONTHS[d.month - 1]}</span>
        <span className="clock-year num" data-testid="clock-year">
          {d.year}
        </span>
      </div>
      <div className="clock-controls">
        <button
          className={`icon-btn clock-pause${paused ? ' active' : ''}`}
          onClick={toggle}
          disabled={paused && !isHost}
          aria-label={paused ? 'Reprendre (Espace)' : 'Pause (Espace)'}
          title={paused ? 'Reprendre (Espace)' : 'Pause (Espace)'}
          data-testid="clock-toggle"
        >
          {paused ? '▶' : '❚❚'}
        </button>
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            className={`clock-speed${!paused && clock.speed >= s ? ' on' : ''}`}
            onClick={() => speed(s as Speed)}
            disabled={!isHost || s > clock.maxSpeed}
            aria-label={`Vitesse ${s}`}
            title={isHost ? `Vitesse ${s} (${s})` : 'Seul l’hôte règle la vitesse'}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="clock-status">
        {paused ? tOr(`pause.${clock.pauseReason ?? 'player'}`, t('pause.player')) : 'Le temps s’écoule'}
        {status !== 'connected' && <span className="neg"> · {status === 'reconnecting' ? 'Reconnexion…' : 'Connexion…'}</span>}
        {latency !== null && status === 'connected' && <span className="muted"> · {latency} ms</span>}
      </div>
    </div>
  );
}
