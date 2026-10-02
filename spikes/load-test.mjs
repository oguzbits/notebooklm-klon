// Throwaway spike (excluded from lint and check). Sizing check for the Hetzner CX23 (2 vCPU, 4 GB):
// starts the production image next to a fresh pgvector Postgres, each with a CPU cap, then lets
// USERS accounts add the whole corpus at once (real Gemini calls) and ask questions in parallel,
// while `docker stats` is sampled every second. Prints peak memory and CPU per container.
// Run: docker build -t nlm-app:loadtest . && node --env-file=.env.local spikes/load-test.mjs
// Prints no environment value: the key reaches the container by name (`-e NAME`) only.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const USERS = 2;
const QUESTIONS_PER_USER = 3;
const NET = 'nlm-lt';
const APP = 'nlm-lt-app';
const DB = 'nlm-lt-db';
const ORIGIN = 'http://localhost:3999';
const FILES = [
  '01-dpr-paper-en.pdf',
  '02-destatis-arbeitsmarkt-de.pdf',
  '03-projekt-nordlicht-de.docx',
  '04-grundgesetz-auszug-de.pdf',
  '05-nist-ai-rmf-scan-en.pdf',
  '06-bdsg-auszug-de.txt',
];
const QUESTIONS = [
  'Worum geht es in den Quellen insgesamt?',
  'Welche Aussagen zur Arbeitslosigkeit stehen in den Quellen?',
  'What is retrieval augmented generation?',
];

const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const needed = ['GEMINI_API_KEY', 'AI_MODEL', 'PARSE_MODEL', 'EMBEDDING_MODEL'];
for (const name of needed) if (!process.env[name]) throw new Error(`${name} missing in .env.local`);

function cleanup() {
  docker('rm', '-f', APP, DB);
  docker('network', 'rm', NET);
}

async function waitFor(check, what, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return;
    await sleep(1000);
  }
  throw new Error(`timeout: ${what}`);
}

function start() {
  cleanup();
  docker('network', 'create', NET);
  docker(
    'run',
    '-d',
    '--name',
    DB,
    '--network',
    NET,
    '--cpus=1',
    '-e',
    'POSTGRES_USER=nlm',
    '-e',
    'POSTGRES_PASSWORD=lt',
    '-e',
    'POSTGRES_DB=nlm',
    'pgvector/pgvector:pg18'
  );
  // The app does not retry its migration: wait until Postgres accepts connections.
  for (let i = 0; i < 60; i += 1) {
    if (docker('exec', DB, 'pg_isready', '-U', 'nlm', '-d', 'nlm').status === 0) break;
    spawnSync('sleep', ['1']);
  }
  const optional = process.env.PARSE_FALLBACK_MODEL ? ['-e', 'PARSE_FALLBACK_MODEL'] : [];
  const run = docker(
    'run',
    '-d',
    '--name',
    APP,
    '--network',
    NET,
    '--cpus=1',
    '-p',
    '3999:3000',
    '-e',
    'DATABASE_URL=postgresql://nlm:lt@' + DB + ':5432/nlm',
    '-e',
    'BETTER_AUTH_URL=' + ORIGIN,
    '-e',
    'BETTER_AUTH_SECRET=' + 'x'.repeat(40),
    '-e',
    'GEMINI_API_KEY',
    '-e',
    'AI_MODEL',
    '-e',
    'PARSE_MODEL',
    '-e',
    'EMBEDDING_MODEL',
    ...optional,
    'nlm-app:loadtest'
  );
  if (run.status !== 0) throw new Error('app container did not start: ' + run.stderr.slice(0, 300));
}

const stats = new Map();
function sample() {
  const out = docker('stats', '--no-stream', '--format', '{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}');
  for (const line of out.stdout.trim().split('\n')) {
    const [name, mem, cpu] = line.split('|');
    if (!name?.startsWith('nlm-lt')) continue;
    const used = mem.split('/')[0].trim();
    const mib = used.endsWith('GiB') ? parseFloat(used) * 1024 : parseFloat(used);
    const entry = stats.get(name) ?? { memMax: 0, cpuMax: 0 };
    entry.memMax = Math.max(entry.memMax, mib);
    entry.cpuMax = Math.max(entry.cpuMax, parseFloat(cpu));
    stats.set(name, entry);
  }
}

async function api(cookie, path, init = {}) {
  const res = await fetch(ORIGIN.replace('3999', '3999') + path, {
    ...init,
    headers: { Origin: ORIGIN, Cookie: cookie, ...init.headers },
  });
  return res;
}

async function signUp(i) {
  const res = await fetch(`${ORIGIN}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      name: `lt${i}`,
      email: `lt${i}-${Date.now()}@example.test`,
      password: 'lasttest-passwort',
    }),
  });
  if (!res.ok) throw new Error(`sign-up ${res.status}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

const statusOf = (list) => {
  const items = Array.isArray(list) ? list : (list.sources ?? list.items ?? []);
  return items.map((s) => s.status);
};

async function oneUser(i) {
  const cookie = await signUp(i);
  const created = await api(cookie, '/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Lasttest' }),
  });
  if (!created.ok) throw new Error(`create notebook ${created.status}`);
  const { id } = await created.json();

  const t0 = Date.now();
  await Promise.all(
    FILES.map(async (name) => {
      const form = new FormData();
      form.set(
        'file',
        new File([readFileSync(new URL(`./corpus/${name}`, import.meta.url))], name)
      );
      const res = await api(cookie, `/api/notebooks/${id}/sources/file`, {
        method: 'POST',
        body: form,
      });
      if (res.status !== 202) throw new Error(`upload ${name}: ${res.status}`);
    })
  );
  let final = [];
  await waitFor(
    async () => {
      final = statusOf(await (await api(cookie, `/api/notebooks/${id}/sources`)).json());
      return final.length === FILES.length && final.every((s) => s === 'READY' || s === 'FAILED');
    },
    `ingestion of user ${i}`,
    10 * 60_000
  );
  const ingestSeconds = Math.round((Date.now() - t0) / 1000);

  const t1 = Date.now();
  const answers = await Promise.all(
    QUESTIONS.slice(0, QUESTIONS_PER_USER).map(async (question) => {
      const res = await api(cookie, `/api/notebooks/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const body = await res.text();
      return { status: res.status, chars: body.length };
    })
  );
  return {
    user: i,
    ready: final.filter((s) => s === 'READY').length,
    failed: final.filter((s) => s === 'FAILED').length,
    ingestSeconds,
    chatSeconds: Math.round((Date.now() - t1) / 1000),
    answers,
  };
}

try {
  start();
  await waitFor(async () => (await fetch(`${ORIGIN}/health`)).ok, 'app health', 90_000);
  const sampler = setInterval(sample, 1000);
  sample();
  const results = await Promise.all(Array.from({ length: USERS }, (_, i) => oneUser(i)));
  await sleep(3000);
  clearInterval(sampler);
  console.log(JSON.stringify({ results, peaks: Object.fromEntries(stats) }, null, 2));
} catch (error) {
  console.error(
    docker('logs', '--tail', '20', APP).stdout.slice(-1500),
    docker('logs', '--tail', '20', APP).stderr.slice(-1500)
  );
  throw error;
} finally {
  cleanup();
}
