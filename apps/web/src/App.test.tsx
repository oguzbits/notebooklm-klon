import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { App } from '@/App';
import { ROUTES } from '@/lib/routes';
import { notebook, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../vitest.setup';

const USER = { id: 'u1', name: 'Anna', email: 'anna@example.test' };
const base = `*/api/notebooks/${NOTEBOOK_ID}`;

describe('App', () => {
  it('loads the notebook page when its address is opened', async () => {
    server.use(
      http.get('*/api/auth/get-session', () => HttpResponse.json({ user: USER })),
      http.get('*/api/notebooks', () =>
        HttpResponse.json([notebook({ id: NOTEBOOK_ID, title: 'Forschung' })])
      ),
      http.get(`${base}/sources`, () => HttpResponse.json([])),
      http.get(`${base}/messages`, () => HttpResponse.json([])),
      http.get(`${base}/studio`, () => HttpResponse.json([])),
      http.get(`${base}/notes`, () => HttpResponse.json([]))
    );
    renderWithProviders(<App />, ROUTES.notebook(NOTEBOOK_ID));

    expect(await screen.findByRole('textbox', { name: 'Titel des Notebooks' })).toHaveProperty(
      'value',
      'Forschung'
    );
  });
});
