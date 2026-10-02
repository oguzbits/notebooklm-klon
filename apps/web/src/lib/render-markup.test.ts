import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { renderMarkup } from './render-markup';

describe('renderMarkup', () => {
  it('turns an element into markup without React bookkeeping attributes', async () => {
    const markup = await renderMarkup(
      createElement('p', { className: 'x' }, 'Hallo ', createElement('b', null, 'Welt'))
    );

    expect(markup).toBe('<p class="x">Hallo <b>Welt</b></p>');
  });

  it('escapes the text of an element, so nothing has to be escaped by hand', async () => {
    const markup = await renderMarkup(
      createElement('p', null, '<script>alert("x")</script> & mehr')
    );

    expect(markup).toBe('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; mehr</p>');
  });
});
