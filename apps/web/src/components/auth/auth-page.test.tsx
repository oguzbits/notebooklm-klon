import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { AuthPage } from './auth-page';

const signedOut = () => http.get('*/api/auth/get-session', () => HttpResponse.json(null));

async function fillIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('E-Mail-Adresse'), email);
  await user.type(screen.getByLabelText('Passwort'), password);
  return user;
}

describe('AuthPage', () => {
  it('signs in and shows a German message when the password is wrong', async () => {
    server.use(
      signedOut(),
      http.post('*/api/auth/sign-in/email', () =>
        HttpResponse.json({ code: 'INVALID_EMAIL_OR_PASSWORD' }, { status: 401 })
      )
    );
    renderWithProviders(<AuthPage />);

    const user = await fillIn('anna@example.test', 'falsches-passwort');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'E-Mail-Adresse oder Passwort stimmen nicht.'
    );
  });

  it('switches to sign-up and asks for at least 8 characters', async () => {
    server.use(signedOut());
    renderWithProviders(<AuthPage />);

    await userEvent.setup().click(screen.getByRole('button', { name: /Jetzt registrieren/ }));

    expect(screen.getByRole('heading', { name: 'Konto erstellen' })).toBeTruthy();
    expect(screen.getByText('Mindestens 8 Zeichen.')).toBeTruthy();
  });

  it('disables the button while the request is on its way, so it cannot be sent twice', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      signedOut(),
      http.post('*/api/auth/sign-in/email', async () => {
        await gate;
        return HttpResponse.json({ user: {} });
      })
    );
    renderWithProviders(<AuthPage />);

    const user = await fillIn('anna@example.test', 'geheim1234');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Einen Moment …' })).toHaveProperty(
        'disabled',
        true
      )
    );
    release();
  });
});
