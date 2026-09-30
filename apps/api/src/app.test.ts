import { HealthSchema } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { app } from './app';

describe('GET /health', () => {
  it('returns a body that satisfies the shared contract', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(HealthSchema.safeParse(await response.json()).success).toBe(true);
  });
});
