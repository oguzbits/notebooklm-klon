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
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};
// ProseMirror (the note editor) measures text with ranges and looks up the element under a click,
// which jsdom cannot lay out. No boxes and no element under the pointer is enough for it to work.
document.elementFromPoint = () => null;
Range.prototype.getClientRects = () => document.createElement('span').getClientRects();
Range.prototype.getBoundingClientRect = () =>
  document.createElement('span').getBoundingClientRect();

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
