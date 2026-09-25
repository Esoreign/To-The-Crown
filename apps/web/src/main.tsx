import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/hud.css';
import './styles/panels.css';
import './styles/map.css';
import { applyDocumentSettings } from './state/settings';
import { App } from './App';

applyDocumentSettings();

// Diagnostic : pile de composants de toute erreur React (visible dans la console).
createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) =>
    console.error('[To The Crown] Erreur non rattrapée', error, info.componentStack),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
