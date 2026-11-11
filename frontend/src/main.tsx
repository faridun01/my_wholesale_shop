import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import ErrorBoundary from './components/common/ErrorBoundary.js';
// Served from our own origin: no third-party render-blocking stylesheet, and the CSP
// needs no font host. unicode-range makes the browser fetch only the subsets in use.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

// Register Service Worker for PWA installability & offline caching support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('PWA ServiceWorker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

