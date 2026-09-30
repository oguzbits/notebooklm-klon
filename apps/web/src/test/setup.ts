import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
