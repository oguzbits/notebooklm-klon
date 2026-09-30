import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_ORIGIN = 'http://localhost:3000';
const WEB_PORT = 5173;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: WEB_PORT,
    // One origin: the browser talks to Vite, Vite forwards the API. No CORS, no second origin list.
    proxy: { '/api': API_ORIGIN, '/health': API_ORIGIN },
  },
});
