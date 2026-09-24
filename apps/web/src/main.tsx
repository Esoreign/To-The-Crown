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
import { applyDocumentSettings } from './state/settings';
import { App } from './App';

applyDocumentSettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
