import { serve } from '@hono/node-server';

import { app } from './app';
import { parseEnv } from './config/env';

function log(entry: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

let env;
try {
  env = parseEnv(process.env);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  log({ level: 'info', msg: 'listening', port: info.port });
});
