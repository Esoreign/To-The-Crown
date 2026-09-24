import { useSettings } from '../state/settings';
import { Modal } from '../ui/common';

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05 }: { label: string; value: number; onChange(v: number): void; min?: number; max?: number; step?: number }) {
  const id = `s-${label.replace(/\W/g, '')}`;
  return (
    <div className="setting-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="num setting-value">{Math.round((value / max) * 100)} %</span>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <label className="setting-row toggle">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden="true" />
    </label>
  );
}

export function SettingsModal({ onClose }: { onClose(): void }) {
  const s = useSettings();
  return (
    <Modal title="Paramètres" onClose={onClose} className="settings-modal">
      <div className="settings-grid">
        <section>
          <h3 className="section-title">Audio</h3>
          <Slider label="Volume général" value={s.masterVolume} onChange={(v) => s.set({ masterVolume: v })} />
          <Slider label="Musique" value={s.musicVolume} onChange={(v) => s.set({ musicVolume: v })} />
          <Slider label="Effets" value={s.sfxVolume} onChange={(v) => s.set({ sfxVolume: v })} />
          <Slider label="Ambiance" value={s.ambientVolume} onChange={(v) => s.set({ ambientVolume: v })} />
        </section>
        <section>
          <h3 className="section-title">Carte</h3>
          <Slider label="Vitesse de la caméra" value={s.cameraSpeed} min={0.3} max={2} step={0.1} onChange={(v) => s.set({ cameraSpeed: v })} />
          <Slider label="Vitesse du zoom" value={s.zoomSpeed} min={0.3} max={2} step={0.1} onChange={(v) => s.set({ zoomSpeed: v })} />
          <div className="setting-row">
            <label htmlFor="quality">Qualité des effets</label>
            <select id="quality" className="input" value={s.effectsQuality} onChange={(e) => s.set({ effectsQuality: e.target.value as 'low' | 'high' })}>
              <option value="high">Élevée</option>
              <option value="low">Réduite</option>
            </select>
          </div>
        </section>
        <section>
          <h3 className="section-title">Interface</h3>
          <div className="setting-row">
            <label htmlFor="uiscale">Taille de l’interface</label>
            <select id="uiscale" className="input" value={s.uiScale} onChange={(e) => s.set({ uiScale: Number(e.target.value) })}>
              {[0.9, 1, 1.1, 1.25].map((v) => (
                <option key={v} value={v}>
                  {Math.round(v * 100)} %
                </option>
              ))}
            </select>
          </div>
          <Toggle label="Animations" value={s.animations} onChange={(v) => s.set({ animations: v })} />
          <Toggle label="Réduire les mouvements" value={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} />
          <Toggle label="Afficher les raccourcis" value={s.showShortcuts} onChange={(v) => s.set({ showShortcuts: v })} />
          <Toggle label="Tutoriel" value={s.tutorialEnabled} onChange={(v) => s.set({ tutorialEnabled: v })} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => s.set({ tutorialStep: 0, tutorialEnabled: true })}>
              Réinitialiser le tutoriel
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void document.documentElement.requestFullscreen?.();
              }}
            >
              Plein écran
            </button>
          </div>
          <div className="setting-row">
            <label htmlFor="lang">Langue</label>
            <select id="lang" className="input" value="fr" disabled>
              <option value="fr">Français</option>
            </select>
          </div>
        </section>
        {s.showShortcuts && (
          <section>
            <h3 className="section-title">Raccourcis</h3>
            <table className="shortcuts">
              <tbody>
                {[
                  ['Espace', 'Pause / reprise'],
                  ['1 · 2 · 3', 'Vitesse du temps'],
                  ['Échap', 'Fermer la fenêtre'],
                  ['F ou /', 'Recherche'],
                  ['M', 'Mode politique'],
                  ['Q W E R T Y U', 'Modes de carte'],
                  ['Origine', 'Centrer sur la capitale'],
                  ['Flèches / Z S', 'Déplacer la caméra'],
                  ['+ / −', 'Zoom'],
                  ['C · K · D · I · L', 'Conseil, royaume, dynastie, intrigue, armées'],
                  ['G · N · H', 'Mariages, décisions, chronique'],
                  ['Clic droit', 'Interagir / déplacer l’armée sélectionnée'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td>
                      <kbd>{k}</kbd>
                    </td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
      <div className="row spread" style={{ marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={() => s.reset()}>
          Valeurs par défaut
        </button>
        <button className="btn btn-primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </Modal>
  );
}
