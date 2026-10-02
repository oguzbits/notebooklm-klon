import { describe, expect, it } from 'vitest';

import { youtubeVideoUrl } from './youtube-url';

const CANONICAL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

describe('youtubeVideoUrl', () => {
  it.each([
    ['a watch link', 'https://www.youtube.com/watch?v=jNQXAC9IVRw'],
    ['a watch link without www', 'https://youtube.com/watch?v=jNQXAC9IVRw'],
    ['a mobile link', 'https://m.youtube.com/watch?v=jNQXAC9IVRw'],
    [
      'a link with more parameters',
      'https://www.youtube.com/watch?feature=share&v=jNQXAC9IVRw&t=42s',
    ],
    ['a short link', 'https://youtu.be/jNQXAC9IVRw?si=abc'],
    ['a shorts link', 'https://www.youtube.com/shorts/jNQXAC9IVRw'],
    ['an embed link', 'https://www.youtube.com/embed/jNQXAC9IVRw'],
    ['a live link', 'https://www.youtube.com/live/jNQXAC9IVRw?feature=share'],
    ['a link over http', 'http://www.youtube.com/watch?v=jNQXAC9IVRw'],
    ['a link with spaces around it', '  https://youtu.be/jNQXAC9IVRw  '],
  ])('turns %s into the one canonical link', (_name, input) => {
    expect(youtubeVideoUrl(input)).toBe(CANONICAL);
  });

  it.each([
    ['another site', 'https://example.com/watch?v=jNQXAC9IVRw'],
    ['a host that only ends like YouTube', 'https://notyoutube.com/watch?v=jNQXAC9IVRw'],
    ['a host that starts like YouTube', 'https://youtube.com.evil.test/watch?v=jNQXAC9IVRw'],
    [
      'a link with a login in front of the host',
      'https://youtube.com@evil.test/watch?v=jNQXAC9IVRw',
    ],
    ['a channel page', 'https://www.youtube.com/@someone'],
    ['a playlist', 'https://www.youtube.com/playlist?list=PL1234567890'],
    ['a watch link without an ID', 'https://www.youtube.com/watch'],
    ['an ID that is too short', 'https://www.youtube.com/watch?v=abc'],
    ['an ID one character too short', 'https://www.youtube.com/watch?v=jNQXAC9IVR'],
    ['an ID one character too long', 'https://www.youtube.com/watch?v=jNQXAC9IVRwx'],
    ['a link with only a user name', 'https://someone@www.youtube.com/watch?v=jNQXAC9IVRw'],
    ['a link with only a password', 'https://:secret@www.youtube.com/watch?v=jNQXAC9IVRw'],
    ['an ID that is too long', 'https://www.youtube.com/watch?v=jNQXAC9IVRwXX'],
    ['an ID with a foreign character', 'https://www.youtube.com/watch?v=jNQXAC9IVR%2F'],
    ['another scheme', 'ftp://www.youtube.com/watch?v=jNQXAC9IVRw'],
    ['text that is no link', 'jNQXAC9IVRw'],
  ])('rejects %s', (_name, input) => {
    expect(youtubeVideoUrl(input)).toBeNull();
  });
});
