#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';

/**
 * Stop hook: when code files changed, `pnpm check` must pass before the agent may finish.
 * A failure blocks the stop once and hands the output back. If the hook is already active
 * (`stop_hook_active`) it lets the agent stop, so a check that cannot be fixed never loops forever.
 */

const CODE_FILE = /\.(ts|tsx|mjs|cjs|js)$/;
const MAX_REASON_CHARS = 3000;
const CHECK_TIMEOUT_MS = 100_000;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

try {
  const raw = await readStdin();
  const payload = raw.trim() ? JSON.parse(raw) : {};
  if (payload.stop_hook_active) process.exit(0);

  const cwd = process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd();

  let status;
  try {
    status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
  } catch (error) {
    process.stderr.write(`guard-stop: git status failed, not gating (${error.message})\n`);
    process.exit(0);
  }

  const hasCodeChanges = status.split('\n').some((line) => CODE_FILE.test(line.trim()));
  if (!hasCodeChanges) process.exit(0);

  const result = spawnSync('pnpm', ['check'], {
    cwd,
    encoding: 'utf8',
    timeout: CHECK_TIMEOUT_MS,
  });
  if (result.status === 0) process.exit(0);

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(ANSI, '');
  process.stdout.write(
    `${JSON.stringify({
      decision: 'block',
      reason: `pnpm check failed. Fix these errors before finishing:\n\n${output.slice(-MAX_REASON_CHARS)}`,
    })}\n`
  );
} catch (error) {
  process.stderr.write(`guard-stop failed, not gating: ${error.message}\n`);
  process.exit(0);
}
