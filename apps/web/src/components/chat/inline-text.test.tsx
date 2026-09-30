import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineText } from './inline-text';

describe('InlineText', () => {
  it('shows bold and italic words inside the line', () => {
    const { container } = render(
      <p>
        <InlineText text="Jev liefert **typisierte Werte**, *keinen* Text." />
      </p>
    );

    expect(container.querySelector('strong')?.textContent).toBe('typisierte Werte');
    expect(container.querySelector('em')?.textContent).toBe('keinen');
    expect(container.textContent).toBe('Jev liefert typisierte Werte, keinen Text.');
  });

  it('adds no block of its own, so the chips can follow in the same line', () => {
    const { container } = render(
      <p>
        <InlineText text="Ein Satz." />
      </p>
    );

    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('does not turn a line into a heading, a list or a link', () => {
    const { container } = render(
      <p>
        <InlineText text={'# Titel [x](https://example.org) <b>roh</b>'} />
      </p>
    );

    expect(container.querySelector('h1, li, a, b')).toBeNull();
    expect(container.textContent).toContain('Titel');
  });
});
