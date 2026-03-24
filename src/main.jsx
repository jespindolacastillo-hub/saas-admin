import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './i18n/i18n'
import App from './App.jsx'

// Captura ?ref= y UTMs al entrar al app
(function () {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) localStorage.setItem('retelio_ref', ref.toUpperCase().trim());

  const utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  if (Object.keys(utm).length) {
    // Solo guarda si aún no hay UTMs (preserva la primera fuente)
    if (!localStorage.getItem('retelio_utm')) {
      localStorage.setItem('retelio_utm', JSON.stringify(utm));
    }
  }

  if (ref || Object.keys(utm).length) {
    const url = new URL(window.location.href);
    ['ref','utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => url.searchParams.delete(k));
    window.history.replaceState({}, '', url.toString());
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
