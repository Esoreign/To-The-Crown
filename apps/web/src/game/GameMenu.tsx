import { useRouter } from '../lib/router';
import { requestPause } from '../net/socket';
import { useGame } from '../state/game';
import { Modal } from '../ui/common';

export function GameMenu({ onClose, onSettings, devTools, onDev }: { onClose(): void; onSettings(): void; devTools: boolean; onDev(): void }) {
  const go = useRouter((s) => s.go);
  const clock = useGame((s) => s.clock);
  return (
    <Modal title="Menu" onClose={onClose} className="game-menu">
      <div className="col" style={{ gap: 8, minWidth: 280 }}>
        <button className="btn btn-lg" onClick={onClose}>
          Reprendre
        </button>
        <button className="btn btn-lg" onClick={onSettings}>
          Paramètres
        </button>
        {devTools && (
          <button className="btn btn-lg" onClick={onDev}>
            Outils de développement
          </button>
        )}
        <button
          className="btn btn-lg"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.();
          }}
        >
          Plein écran
        </button>
        <button
          className="btn btn-lg btn-primary"
          onClick={() => {
            if (clock && !clock.paused) requestPause(true);
            go({ name: 'title' });
          }}
          data-testid="save-quit"
        >
          Sauvegarder et quitter
        </button>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          La partie est sauvegardée automatiquement sur le serveur. Vous pourrez la reprendre depuis « Continuer ».
        </p>
      </div>
    </Modal>
  );
}
