import { describe, expect, it } from 'vitest';

import { GuestStartSchema } from './guest';

describe('GuestStartSchema', () => {
  it('names the example notebook the guest lands in', () => {
    const body = { notebookId: '3ec20799-05d5-464f-aeb8-060500436a17' };

    expect(GuestStartSchema.parse(body)).toEqual(body);
  });

  it('rejects an answer without a notebook or with an ID that is no UUID', () => {
    expect(GuestStartSchema.safeParse({}).success).toBe(false);
    expect(GuestStartSchema.safeParse({ notebookId: 'beispiel' }).success).toBe(false);
  });
});
