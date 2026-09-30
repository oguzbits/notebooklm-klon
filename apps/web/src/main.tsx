import './index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root-Element #root fehlt in index.html');
}

// Errors are shown to the user, so a failed request is not repeated behind their back.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
