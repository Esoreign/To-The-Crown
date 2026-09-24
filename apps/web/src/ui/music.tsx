/**
 * Contrôles de la musique de fond : activation, source, piste, ordre
 * aléatoire (paramètres) et bouton rapide (barre du jeu, écran titre).
 */
import { TRACKS } from '../audio/playlist';
import { nextTrack, previousTrack, selectTrack, startMusic, toggleMusic, unlockAudio, useMusic } from '../audio/audio';
import { useSettings } from '../state/settings';
import { Tip } from './common';

export function NowPlaying() {
  const index = useMusic((m) => m.index);
  const playing = useMusic((m) => m.playing);
  const blocked = useMusic((m) => m.blocked);
  const enabled = useSettings((s) => s.musicEnabled);
  const source = useSettings((s) => s.musicSource);
  const track = TRACKS[index];
  if (!enabled) return <span className="muted">Musique coupée</span>;
  if (source === 'procedural') return <span className="soft">Musique générée</span>;
  if (blocked) return <span className="muted">Cliquez n’importe où pour lancer la musique</span>;
  return (
    <span className="soft">
      {playing ? '♪ ' : ''}
      {track ? `${track.title} — ${track.artist}` : '—'}
    </span>
  );
}

/** Bloc de réglages musicaux (fenêtre des paramètres). */
export function MusicSettings() {
  const s = useSettings();
  const index = useMusic((m) => m.index);
  const tracks = s.musicSource === 'tracks';
  const kick = () => {
    unlockAudio();
    startMusic();
  };
  return (
    <div className="music-settings">
      <label className="setting-row toggle">
        <span>Musique de fond</span>
        <input
          type="checkbox"
          checked={s.musicEnabled}
          onChange={(e) => {
            s.set({ musicEnabled: e.target.checked });
            kick();
          }}
          data-testid="music-enabled"
        />
        <span className="toggle-ui" aria-hidden="true" />
      </label>
      <div className="setting-row">
        <label htmlFor="music-source">Source</label>
        <select
          id="music-source"
          className="input"
          value={s.musicSource}
          disabled={!s.musicEnabled}
          onChange={(e) => {
            s.set({ musicSource: e.target.value as 'tracks' | 'procedural' });
            kick();
          }}
        >
          <option value="tracks">Ballades ({TRACKS.length} pistes)</option>
          <option value="procedural">Musique générée</option>
        </select>
      </div>
      {tracks && (
        <>
          <div className="setting-row">
            <label htmlFor="music-track">Piste</label>
            <select
              id="music-track"
              className="input"
              value={index}
              disabled={!s.musicEnabled}
              onChange={(e) => {
                kick();
                selectTrack(Number(e.target.value));
              }}
            >
              {TRACKS.map((t, i) => (
                <option key={t.id} value={i}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div className="music-transport">
            <button className="icon-btn" disabled={!s.musicEnabled} onClick={() => (kick(), previousTrack())} aria-label="Piste précédente" title="Piste précédente">
              ⏮
            </button>
            <button className="icon-btn" disabled={!s.musicEnabled} onClick={() => (kick(), nextTrack())} aria-label="Piste suivante" title="Piste suivante">
              ⏭
            </button>
            <label className="music-shuffle">
              <input type="checkbox" checked={s.musicShuffle} onChange={(e) => s.set({ musicShuffle: e.target.checked })} /> Ordre aléatoire
            </label>
          </div>
        </>
      )}
      <div className="music-now">
        <NowPlaying />
      </div>
    </div>
  );
}

/** Bouton rapide : clic = couper/rétablir, molette = volume. */
export function MusicButton({ className }: { className?: string }) {
  const enabled = useSettings((s) => s.musicEnabled);
  const volume = useSettings((s) => s.musicVolume);
  const set = useSettings((s) => s.set);
  return (
    <Tip
      content={() => (
        <div>
          <div className="tooltip-title">Musique</div>
          <NowPlaying />
          <div className="muted">Volume : {Math.round(volume * 100)} %</div>
          <div className="muted">Clic : couper / rétablir · molette : volume</div>
        </div>
      )}
    >
      <button
        className={`icon-btn music-btn${enabled ? ' active' : ''} ${className ?? ''}`}
        aria-label={enabled ? 'Couper la musique' : 'Activer la musique'}
        aria-pressed={enabled}
        data-testid="music-toggle"
        onClick={() => {
          unlockAudio();
          startMusic();
          toggleMusic();
        }}
        onWheel={(e) => {
          const v = Math.max(0, Math.min(1, Math.round((volume + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100));
          set(v > 0 ? { musicVolume: v, musicEnabled: true } : { musicVolume: v });
        }}
      >
        ♫
      </button>
    </Tip>
  );
}
