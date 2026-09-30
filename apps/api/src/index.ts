import { serve } from '@hono/node-server';

import { app } from './app';

const DEFAULT_PORT = 3000;

serve({ fetch: app.fetch, port: DEFAULT_PORT }, (info) => {
  process.stdout.write(`${JSON.stringify({ level: 'info', msg: 'listening', port: info.port })}\n`);
});
