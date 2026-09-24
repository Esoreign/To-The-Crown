import { create } from 'zustand';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  /** Musique de fond activée. */
  musicEnabled: boolean;
  /** Source : pistes enregistrées (ballades) ou musique générée. */
  musicSource: 'tracks' | 'procedural';
  /** Ordre aléatoire des pistes. */
  musicShuffle: boolean;
  sfxVolume: number;
  ambientVolume: number;
  cameraSpeed: number;
  zoomSpeed: number;
  effectsQuality: 'low' | 'high';
  animations: boolean;
  reducedMotion: boolean;
  uiScale: number;
  showShortcuts: boolean;
  tutorialEnabled: boolean;
  tutorialStep: number;
  hiddenOutliner: string[];
  language: 'fr';
}

const DEFAULTS: Settings = {
  masterVolume: 0.7,
  musicVolume: 0.35,
  musicEnabled: true,
  musicSource: 'tracks',
  musicShuffle: false,
  sfxVolume: 0.8,
  ambientVolume: 0.4,
  cameraSpeed: 1,
  zoomSpeed: 1,
  effectsQuality: 'high',
  animations: true,
  reducedMotion: false,
  uiScale: 1,
  showShortcuts: true,
  tutorialEnabled: true,
  tutorialStep: 0,
  hiddenOutliner: [],
  language: 'fr',
};

const KEY = 'ttc.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

interface SettingsState extends Settings {
  set(patch: Partial<Settings>): void;
  reset(): void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  set(patch) {
    set(patch);
    try {
      const { set: _s, reset: _r, ...rest } = { ...get(), ...patch };
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      // Stockage indisponible : préférences non persistées.
    }
    applyDocumentSettings();
  },
  reset() {
    get().set(DEFAULTS);
  },
}));

export function applyDocumentSettings(): void {
  const s = useSettings.getState();
  const root = document.documentElement;
  root.style.setProperty('--ui-scale', String(s.uiScale));
  root.dataset.reducedMotion = String(s.reducedMotion || !s.animations);
}
