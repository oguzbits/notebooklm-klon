// Run as a script: `pnpm --filter @nlm/api db:migrate`. Kept apart from migrate.ts so that the
// server bundle, which imports runMigrations, does not run this as a side effect.
import { parseDatabaseEnv } from '../config/env';
import { runMigrations } from './migrate';

try {
  const { DATABASE_URL } = parseDatabaseEnv(process.env);
  await runMigrations(DATABASE_URL);
  process.stdout.write(`${JSON.stringify({ level: 'info', msg: 'migrations applied' })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
