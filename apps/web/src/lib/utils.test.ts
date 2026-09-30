import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('keeps the own type sizes next to a text color', () => {
    expect(cn('text-small text-muted-foreground')).toBe('text-small text-muted-foreground');
    expect(cn('text-ui text-foreground')).toBe('text-ui text-foreground');
  });

  it('lets a later size win over an earlier one', () => {
    expect(cn('text-small', 'text-ui')).toBe('text-ui');
    expect(cn('text-ui', 'text-lg')).toBe('text-lg');
  });

  it('keeps the own weights apart from the sizes and lets the last weight win', () => {
    expect(cn('font-label text-ui')).toBe('font-label text-ui');
    expect(cn('font-label', 'font-title')).toBe('font-title');
    expect(cn('font-title', 'font-bold')).toBe('font-bold');
  });
});
