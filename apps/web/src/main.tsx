import './index.css';

import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './App';
import { startErrorReporting } from './lib/error-reporting';
import { initTheme } from './lib/theme';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root-Element #root fehlt in index.html');
}

initTheme(document.documentElement);

startErrorReporting(
  {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
  },
  Sentry
);

// Errors are shown to the user, so a failed request is not repeated behind their back.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

// An error that breaks the page is reported (nothing happens while reporting is off).
createRoot(root, { onUncaughtError: Sentry.reactErrorHandler() }).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
