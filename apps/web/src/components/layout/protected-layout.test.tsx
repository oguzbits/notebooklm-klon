import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/lib/routes';

import { server } from '../../../../../vitest.setup';
import { ProtectedLayout } from './protected-layout';

const USER = { id: 'u1', name: 'Anna', email: 'anna@example.test' };

function renderLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ROUTES.HOME]}>
        <Routes>
          <Route path={ROUTES.SIGN_IN} element={<p>Anmeldeseite</p>} />
          <Route element={<ProtectedLayout />}>
            <Route path={ROUTES.HOME} element={<p>Geschützter Inhalt</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProtectedLayout', () => {
  it('sends a visitor without a session to the sign-in', async () => {
    server.use(http.get('*/api/auth/get-session', () => HttpResponse.json(null)));
    renderLayout();

    expect(await screen.findByText('Anmeldeseite')).toBeTruthy();
  });

  it('shows the content and the email address of the signed-in user', async () => {
    server.use(http.get('*/api/auth/get-session', () => HttpResponse.json({ user: USER })));
    renderLayout();

    expect(await screen.findByText('Geschützter Inhalt')).toBeTruthy();
    expect(screen.getByText('anna@example.test')).toBeTruthy();
  });

  it('leaves for the sign-in after signing out', async () => {
    server.use(
      http.get('*/api/auth/get-session', () => HttpResponse.json({ user: USER })),
      http.post('*/api/auth/sign-out', () => HttpResponse.json({ success: true }))
    );
    renderLayout();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Abmelden' }));

    expect(await screen.findByText('Anmeldeseite')).toBeTruthy();
  });
});
