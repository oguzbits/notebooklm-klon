import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { systemDeps } from './system-deps';

// A local server stands in for the "checked address". The URL uses a host name that does not exist
// in DNS: the request can only succeed if it connects to the pinned address instead of resolving.
let server: Server;
let port: number;
let seenHost: string | undefined;

beforeAll(async () => {
  server = createServer((request, response) => {
    seenHost = request.headers.host;
    if (request.url === '/redirect') {
      response.writeHead(302, { location: 'http://elsewhere.invalid/' });
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('gepinnt');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('systemDeps.request', () => {
  it('connects to the given address regardless of the host name in the URL', async () => {
    const response = await systemDeps.request(
      new URL(`http://pinned.invalid:${port}/`),
      '127.0.0.1',
      AbortSignal.timeout(5000)
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('gepinnt');
    expect(seenHost).toBe(`pinned.invalid:${port}`);
  });

  it('does not follow redirects itself', async () => {
    const response = await systemDeps.request(
      new URL(`http://pinned.invalid:${port}/redirect`),
      '127.0.0.1',
      AbortSignal.timeout(5000)
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://elsewhere.invalid/');
  });
});

describe('systemDeps.lookup', () => {
  it('returns the address of an IP literal without asking DNS', async () => {
    expect(await systemDeps.lookup('127.0.0.1')).toEqual(['127.0.0.1']);
  });
});
