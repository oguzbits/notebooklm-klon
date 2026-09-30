import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { Agent, fetch } from 'undici';

import type { FetchDeps } from './fetch-url';

const IPV4 = 4;
const IPV6 = 6;
const ACCEPT = 'text/html,application/xhtml+xml,text/plain;q=0.9';

/** The real network for {@link fetchPublicUrl}: system DNS and a request pinned to one address. */
export const systemDeps: FetchDeps = {
  async lookup(hostname) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.map((entry) => entry.address);
  },

  async request(url, address, signal) {
    const family = isIP(address) === IPV6 ? IPV6 : IPV4;
    // Connect to the address that was checked, whatever DNS would answer now (DNS rebinding).
    // TLS still validates the certificate against the host name in the URL.
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [{ address, family }]);
          } else {
            callback(null, address, family);
          }
        },
      },
    });
    try {
      return await fetch(url, {
        dispatcher,
        signal,
        redirect: 'manual',
        headers: { accept: ACCEPT },
      });
    } finally {
      // Graceful: lets the body of this response finish streaming, then frees the sockets.
      void dispatcher.close();
    }
  },
};
