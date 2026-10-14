/**
 * What the model calls cost, per purpose and per user: `pnpm report:usage [--days 7]`. Reads the
 * table usage_events, which every call writes, and prints the average tokens of a call per purpose
 * and the users with the most tokens. This is the measurement the limits of plan 7 are set from.
 */
import { parseDatabaseEnv } from '../config/env';
import { formatUsageReport } from '../core/usage-report';
import { createDb } from '../db/client';
import { summarizeUsage } from '../db/usage-repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 7;

const args = process.argv.slice(2);
const daysAt = args.indexOf('--days');
const days = daysAt >= 0 ? Number(args[daysAt + 1]) : DEFAULT_DAYS;
if (!Number.isInteger(days) || days <= 0) throw new Error('--days needs a whole number above 0.');

const { db, pool } = createDb(parseDatabaseEnv(process.env).DATABASE_URL);
try {
  const rows = await summarizeUsage(db, new Date(Date.now() - days * DAY_MS));
  process.stdout.write(`Usage of the last ${days} days\n\n${formatUsageReport(rows)}\n`);
} finally {
  await pool.end();
}
