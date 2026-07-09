// MUST be first import - sets up Buffer before other modules
import './polyfills';

// Dev (preview.3speak.tv) is served live by the Vite dev server and registers
// NO service worker. But a stale SW from this origin's previous static (dist)
// deployment can still be installed in the browser — it serves its cached app
// shell on first load, so you see an old page and only the *next* refresh shows
// current code. Evict any leftover SW + caches here. Stripped from prod builds
// (import.meta.env.DEV === false), so 3speak.tv's real PWA is untouched.
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if (typeof caches !== 'undefined' && caches.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

// Pick the healthy Hive RPC node for this session as early as possible.
import { ensureHealthyNode } from './utils/hiveNode';
ensureHealthyNode();

import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux'; // Importing the Provider from react-redux
import App from './App';
import EmergencyScreen, { EMERGENCY_MODE } from './components/EmergencyScreen/EmergencyScreen';
import './index.css';
import store from '../src/redux/Store'; // Importing the Redux store (replace with your store file path)
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { AppProviders } from './context/Providers';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiohaProvider } from '@aioha/react-ui';
import aioha from './hive-api/aioha';
import { HelmetProvider } from 'react-helmet-async';

// import { Buffer } from 'buffer';
// window.Buffer = Buffer;
const queryClient = new QueryClient();
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AiohaProvider aioha={aioha}>
          <AppProviders>
            <QueryClientProvider client={queryClient}>
              <Provider store={store}> {/* Wrap the app with the Redux Provider */}
                {EMERGENCY_MODE ? <EmergencyScreen /> : <App />}
                <ToastContainer className="custom-toast-body"/>
              </Provider>
            </QueryClientProvider>
          </AppProviders>
        </AiohaProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
