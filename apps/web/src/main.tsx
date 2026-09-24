import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { preloadCards } from './lib/cards';
import { initScale } from './lib/scale';
import './i18n';
import './index.css';

initScale();
preloadCards();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
