import { SOURCE_KIND } from '@nlm/shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SourceKindIcon } from './kind-icon';

describe('SourceKindIcon', () => {
  it.each([
    [SOURCE_KIND.PDF, SOURCE_KIND.PDF],
    [SOURCE_KIND.DOCX, 'DOC'],
    [SOURCE_KIND.PPTX, 'PPT'],
    [SOURCE_KIND.MD, SOURCE_KIND.MD],
  ])('marks %s with %s so the name fits into the symbol', (kind, mark) => {
    const { container } = render(<SourceKindIcon kind={kind} />);

    expect(container.querySelector('text')?.textContent).toBe(mark);
  });
});
