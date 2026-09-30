import { HealthSchema } from '@nlm/shared';
import { Hono } from 'hono';

export const app = new Hono().get('/health', (c) => c.json(HealthSchema.parse({ status: 'ok' })));

export type AppType = typeof app;
