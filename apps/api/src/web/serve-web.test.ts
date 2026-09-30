import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { serveWeb } from './serve-web';

let dir: string;
let app: Hono;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'nlm-web-'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Klon</title>');
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log("app")');
  app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/api/notebooks', (c) => c.json([]));
  serveWeb(app, dir);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('serveWeb', () => {
  it('serves the app at the root and a built file with its type', async () => {
    const root = await app.request('/');
    const script = await app.request('/assets/app.js');

    expect(await root.text()).toContain('<title>Klon</title>');
    expect(script.headers.get('content-type')).toMatch(/javascript/);
    expect(await script.text()).toBe('console.log("app")');
  });

  it('answers a page route of the app with the app, so a reload keeps working', async () => {
    const response = await app.request('/notizbuecher/3f0f4a4e');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Klon</title>');
  });

  it('leaves the API and the health check to their own routes', async () => {
    expect(await (await app.request('/health')).json()).toEqual({ status: 'ok' });
    expect(await (await app.request('/api/notebooks')).json()).toEqual([]);
  });

  it('answers 404 as JSON for an unknown API path, not with the app', async () => {
    const response = await app.request('/api/gibt-es-nicht');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/json/);
  });

  it('answers 404 for a missing file with an extension instead of the app', async () => {
    const response = await app.request('/assets/fehlt.js');

    expect(response.status).toBe(404);
  });
});
