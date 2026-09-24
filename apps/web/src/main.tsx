import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { preloadCards } from './lib/cards';
import { initScale } from './lib/scale';
import { playSound } from './lib/sound';
import './i18n';
import './index.css';

initScale();
document.addEventListener(
  'click',
  (e) => {
    if ((e.target as HTMLElement).closest('button')) playSound('click');
  },
  true,
);
preloadCards();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
