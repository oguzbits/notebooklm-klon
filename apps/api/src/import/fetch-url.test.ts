import { describe, expect, it } from 'vitest';

import { LIMITS } from '../config/limits';
import { fetchPublicUrl, IMPORT_ERROR, ImportError, PDF_CONTENT_TYPE } from './fetch-url';

const PUBLIC = '93.184.216.34';

function html(body = '<html><body>Hallo</body></html>', init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  });
}

function redirect(location: string, status = 302) {
  return new Response(null, { status, headers: { location } });
}

/** Deps that serve the given responses in order and record every request. */
function fakeDeps(responses: Response[], lookup: (host: string) => string[] = () => [PUBLIC]) {
  const requests: { url: string; address: string }[] = [];
  const queue = [...responses];
  return {
    requests,
    deps: {
      lookup: async (host: string) => lookup(host),
      request: async (url: URL, address: string) => {
        requests.push({ url: url.href, address });
        const next = queue.shift();
        if (!next) throw new Error('no response queued');
        return next;
      },
    },
  };
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(ImportError);
  return (error as ImportError).code;
}

describe('fetchPublicUrl', () => {
  it('returns the body, content type and final URL of a public page', async () => {
    const { deps, requests } = fakeDeps([html('<p>Text</p>')]);

    const page = await fetchPublicUrl('https://example.com/a', deps);

    expect(page.finalUrl).toBe('https://example.com/a');
    expect(page.contentType).toBe('text/html');
    expect(new TextDecoder().decode(page.body)).toBe('<p>Text</p>');
    expect(requests).toEqual([{ url: 'https://example.com/a', address: PUBLIC }]);
  });

  it('rejects a URL that fails the syntax check without any lookup', async () => {
    const { deps, requests } = fakeDeps([]);

    expect(await codeOf(fetchPublicUrl('file:///etc/passwd', deps))).toBe(IMPORT_ERROR.INVALID_URL);
    expect(requests).toEqual([]);
  });

  it('rejects a host that resolves to a private address', async () => {
    const { deps, requests } = fakeDeps([html()], () => ['10.0.0.5']);

    expect(await codeOf(fetchPublicUrl('https://internal.example.com', deps))).toBe(
      IMPORT_ERROR.PRIVATE_ADDRESS
    );
    expect(requests).toEqual([]);
  });

  it('rejects a host when any one of its addresses is private', async () => {
    const { deps } = fakeDeps([html()], () => [PUBLIC, '127.0.0.1']);

    expect(await codeOf(fetchPublicUrl('https://mixed.example.com', deps))).toBe(
      IMPORT_ERROR.PRIVATE_ADDRESS
    );
  });

  it('fails when the host does not resolve', async () => {
    const { deps } = fakeDeps([html()], () => []);

    expect(await codeOf(fetchPublicUrl('https://nowhere.example.com', deps))).toBe(
      IMPORT_ERROR.DNS_FAILED
    );
  });

  it('follows a redirect and checks the new host again', async () => {
    const { deps, requests } = fakeDeps(
      [redirect('https://other.example.org/b'), html()],
      (host) => (host === 'other.example.org' ? ['203.0.114.7'] : [PUBLIC])
    );

    const page = await fetchPublicUrl('https://example.com/a', deps);

    expect(page.finalUrl).toBe('https://other.example.org/b');
    expect(requests.map((r) => r.address)).toEqual([PUBLIC, '203.0.114.7']);
  });

  it('resolves a relative redirect against the current URL', async () => {
    const { deps, requests } = fakeDeps([redirect('/next'), html()]);

    await fetchPublicUrl('https://example.com/a/b', deps);

    expect(requests[1]?.url).toBe('https://example.com/next');
  });

  it('rejects a redirect to a private address', async () => {
    const { deps } = fakeDeps([redirect('http://169.254.169.254/latest/meta-data')]);

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(
      IMPORT_ERROR.PRIVATE_ADDRESS
    );
  });

  it('rejects a redirect to a host that resolves to a private address', async () => {
    const { deps } = fakeDeps([redirect('https://evil.example.net/')], (host) =>
      host === 'evil.example.net' ? ['192.168.0.10'] : [PUBLIC]
    );

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(
      IMPORT_ERROR.PRIVATE_ADDRESS
    );
  });

  it('gives up after too many redirects', async () => {
    const loop = Array.from({ length: LIMITS.URL_IMPORT_MAX_REDIRECTS + 1 }, () =>
      redirect('https://example.com/again')
    );
    const { deps } = fakeDeps(loop);

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(
      IMPORT_ERROR.TOO_MANY_REDIRECTS
    );
  });

  it('rejects a redirect without a location', async () => {
    const { deps } = fakeDeps([new Response(null, { status: 302 })]);

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(
      IMPORT_ERROR.HTTP_STATUS
    );
  });

  it('rejects an error status', async () => {
    const { deps } = fakeDeps([new Response('nope', { status: 404 })]);

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(
      IMPORT_ERROR.HTTP_STATUS
    );
  });

  it('rejects a content type that is neither text nor a PDF', async () => {
    const { deps } = fakeDeps([
      new Response('PNG', { status: 200, headers: { 'content-type': 'image/png' } }),
    ]);

    expect(await codeOf(fetchPublicUrl('https://example.com/a.png', deps))).toBe(
      IMPORT_ERROR.UNSUPPORTED_CONTENT_TYPE
    );
  });

  it('accepts a PDF and returns its bytes', async () => {
    const { deps } = fakeDeps([
      new Response('%PDF-1.7', {
        status: 200,
        headers: { 'content-type': `${PDF_CONTENT_TYPE}; qs=0.9` },
      }),
    ]);

    const page = await fetchPublicUrl('https://example.com/a.pdf', deps);

    expect(page.contentType).toBe(PDF_CONTENT_TYPE);
    expect(new TextDecoder().decode(page.body)).toBe('%PDF-1.7');
  });

  it('lets a PDF be as large as an upload, a web page only as large as the page limit', async () => {
    const size = LIMITS.URL_IMPORT_MAX_BYTES + 1;
    const declared = (type: string, length: number) => ({
      'content-type': type,
      'content-length': String(length),
    });
    const pdfWithinUpload = fakeDeps([
      new Response(new Uint8Array(size), {
        status: 200,
        headers: declared(PDF_CONTENT_TYPE, size),
      }),
    ]);
    const pdfBeyondUpload = fakeDeps([
      new Response('x', {
        status: 200,
        headers: declared(PDF_CONTENT_TYPE, LIMITS.UPLOAD_MAX_BYTES + 1),
      }),
    ]);

    const page = await fetchPublicUrl('https://example.com/a.pdf', pdfWithinUpload.deps);

    expect(page.body.byteLength).toBe(size);
    expect(await codeOf(fetchPublicUrl('https://example.com/b.pdf', pdfBeyondUpload.deps))).toBe(
      IMPORT_ERROR.TOO_LARGE
    );
  });

  it('accepts plain text', async () => {
    const { deps } = fakeDeps([
      new Response('Nur Text', { status: 200, headers: { 'content-type': 'text/plain' } }),
    ]);

    const page = await fetchPublicUrl('https://example.com/a.txt', deps);

    expect(page.contentType).toBe('text/plain');
  });

  it('rejects a body larger than the limit by its declared length', async () => {
    const { deps } = fakeDeps([
      html('x', {
        headers: {
          'content-type': 'text/html',
          'content-length': String(LIMITS.URL_IMPORT_MAX_BYTES + 1),
        },
      }),
    ]);

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(IMPORT_ERROR.TOO_LARGE);
  });

  it('rejects a body larger than the limit while streaming, whatever it declares', async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(97);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
        if (sent > 10) controller.close();
      },
    });
    const { deps } = fakeDeps([
      new Response(stream, { status: 200, headers: { 'content-type': 'text/html' } }),
    ]);

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(IMPORT_ERROR.TOO_LARGE);
    expect(sent).toBeLessThan(10);
  });

  it('maps an aborted request to a timeout', async () => {
    const deps = {
      lookup: async () => [PUBLIC],
      request: async () => {
        throw new DOMException('The operation timed out', 'TimeoutError');
      },
    };

    expect(await codeOf(fetchPublicUrl('https://example.com', deps))).toBe(IMPORT_ERROR.TIMEOUT);
  });
});
