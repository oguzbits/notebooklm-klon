import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { AppHeader } from './app-header';

const USER = { id: 'u1', name: 'Anna', email: 'anna@example.test' };

function renderHeader() {
  return renderWithProviders(<AppHeader title={<h1>Steuerrecht</h1>} />);
}

describe('AppHeader', () => {
  it('shows the title and, in the account menu, the email address of the user', async () => {
    server.use(http.get('*/api/auth/get-session', () => HttpResponse.json({ user: USER })));
    renderHeader();

    expect(screen.getByRole('heading', { name: 'Steuerrecht' })).toBeTruthy();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Konto' }));

    expect(await screen.findByText('anna@example.test')).toBeTruthy();
  });

  it('signs out from the account menu', async () => {
    let signedOut = false;
    server.use(
      http.get('*/api/auth/get-session', () => HttpResponse.json({ user: USER })),
      http.post('*/api/auth/sign-out', () => {
        signedOut = true;
        return HttpResponse.json({ success: true });
      })
    );
    renderHeader();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Konto' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Abmelden' }));

    await vi.waitFor(() => expect(signedOut).toBe(true));
  });
});
