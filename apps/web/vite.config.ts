import path from 'node:path';

import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_ORIGIN = 'http://localhost:3000';
const WEB_PORT = 5173;

// Source maps go to Sentry only where the token is set (the deploy build); everywhere else the build
// is as before. The maps are deleted after the upload, so the server never serves them.
const SENTRY_ORG = 'oguz-gd';
const SENTRY_PROJECT = 'notebooklm-react';
const sentryToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  build: { sourcemap: sentryToken ? 'hidden' : false },
  plugins: [
    react(),
    tailwindcss(),
    sentryVitePlugin({
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken: sentryToken,
      disable: !sentryToken,
      telemetry: false,
      // The same name as the release the browser reports (the commit).
      release: { name: process.env.VITE_SENTRY_RELEASE },
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
      // A failed upload must not stop a deploy: the errors then only show minified places.
      errorHandler: (error) => process.stderr.write(`Sentry source maps: ${error.message}\n`),
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: WEB_PORT,
    // One origin: the browser talks to Vite, Vite forwards the API. No CORS, no second origin list.
    proxy: { '/api': API_ORIGIN, '/health': API_ORIGIN },
  },
});
