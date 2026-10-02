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

  describe('deleting the account', () => {
    async function openDialog() {
      server.use(http.get('*/api/auth/get-session', () => HttpResponse.json({ user: USER })));
      renderHeader();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Konto' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Konto löschen' }));
      return user;
    }

    it('asks for the password and sends it', async () => {
      let body: unknown;
      server.use(
        http.post('*/api/auth/delete-user', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ success: true });
        })
      );
      const user = await openDialog();

      await user.type(await screen.findByLabelText('Passwort'), 'geheim123');
      await user.click(screen.getByRole('button', { name: 'Konto endgültig löschen' }));

      await vi.waitFor(() => expect(body).toEqual({ password: 'geheim123' }));
    });

    it('does not send anything without a password', async () => {
      const user = await openDialog();

      await screen.findByLabelText('Passwort');
      await user.click(screen.getByRole('button', { name: 'Konto endgültig löschen' }));

      expect(screen.getByRole('button', { name: 'Konto endgültig löschen' })).toHaveProperty(
        'disabled',
        true
      );
    });

    it('tells that the password was wrong and stays open for another try', async () => {
      server.use(
        http.post('*/api/auth/delete-user', () =>
          HttpResponse.json({ code: 'INVALID_PASSWORD' }, { status: 400 })
        )
      );
      const user = await openDialog();

      await user.type(await screen.findByLabelText('Passwort'), 'falsch');
      await user.click(screen.getByRole('button', { name: 'Konto endgültig löschen' }));

      expect(await screen.findByText('Das Passwort stimmt nicht.')).toBeTruthy();
      expect(screen.getByLabelText('Passwort')).toBeTruthy();
    });

    it('is not offered to a guest, whose data goes away by itself', async () => {
      server.use(
        http.get('*/api/auth/get-session', () =>
          HttpResponse.json({
            user: { id: 'g', name: 'Anonymous', email: 'x@y.invalid', isAnonymous: true },
          })
        )
      );
      renderHeader();

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Konto' }));

      expect(await screen.findByText('Gast-Zugang')).toBeTruthy();
      expect(screen.queryByRole('menuitem', { name: 'Konto löschen' })).toBeNull();
    });
  });

  it('calls a guest a guest and says that the data does not stay', async () => {
    server.use(
      http.get('*/api/auth/get-session', () =>
        HttpResponse.json({
          user: {
            id: 'g',
            name: 'Anonymous',
            email: 'temp@anonymous.placeholder.invalid',
            isAnonymous: true,
          },
        })
      )
    );
    renderHeader();

    const account = await screen.findByRole('button', { name: 'Konto' });
    await vi.waitFor(() => expect(account.textContent).toBe('G'));
    await userEvent.setup().click(account);

    expect(await screen.findByText('Gast-Zugang')).toBeTruthy();
    expect(screen.getByText('Deine Daten werden nach 7 Tagen gelöscht.')).toBeTruthy();
    expect(screen.queryByText(/anonymous/)).toBeNull();
  });
});
