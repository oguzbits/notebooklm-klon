import { describe, expect, it } from 'vitest';

describe('network guard', () => {
  it('fails any request without a mock handler', async () => {
    await expect(fetch('https://example.com/unmocked')).rejects.toThrow(/\[MSW\]/);
  });
});
