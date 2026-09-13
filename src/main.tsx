import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { installerMiseAJour } from './lib/pwa/miseAJour';

// Met a jour le service worker tout seul, mais jamais pendant une analyse :
// recharger la page a ce moment-la ferait perdre a quelqu'un le resultat
// qu'il attendait.
installerMiseAJour();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
