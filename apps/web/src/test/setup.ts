import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

afterEach(cleanup);

// jsdom has no layout engine. The pieces below are what Radix UI reads from the browser.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

// jsdom has no `matchMedia` either. The tests run on a wide, light screen unless a test says
// otherwise (the theme tests stub their own).
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: !query.includes('prefers-color-scheme'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
