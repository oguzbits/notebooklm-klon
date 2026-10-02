const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const SHORT_HOST = 'youtu.be';
const VIDEO_ID = /^[\w-]{11}$/;
const PATH_PREFIXES = ['/shorts/', '/embed/', '/live/'];

function idOf(url: URL): string | null {
  if (url.hostname === SHORT_HOST) return url.pathname.slice(1);
  if (!HOSTS.has(url.hostname)) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const prefix = PATH_PREFIXES.find((candidate) => url.pathname.startsWith(candidate));
  return prefix === undefined ? null : url.pathname.slice(prefix.length);
}

/**
 * The one canonical link of a public YouTube video, or null when the text is not a link to a
 * video on YouTube. The server never fetches this link: Gemini does, so the host must be exactly
 * YouTube and nothing else may reach the model as a link.
 */
export function youtubeVideoUrl(input: string): string | null {
  const url = URL.parse(input.trim());
  if (url === null || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
  if (url.username !== '' || url.password !== '') return null;
  const id = idOf(url);
  return id !== null && VIDEO_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}
