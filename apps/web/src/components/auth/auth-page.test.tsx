import { API_ERROR } from '@nlm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
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

  describe('guest', () => {
    const NOTEBOOK_ID = '3ec20799-05d5-464f-aeb8-060500436a17';
    const renderRoutes = () =>
      renderWithProviders(
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/notizbuecher/:notebookId" element={<p>Das Beispiel-Notebook</p>} />
        </Routes>
      );

    it('offers the example next to the form and opens the example notebook on click', async () => {
      let signedIn = false;
      server.use(
        http.get('*/api/auth/get-session', () =>
          HttpResponse.json(signedIn ? { user: { id: 'g', name: 'G', email: 'g@x.test' } } : null)
        ),
        http.post('*/api/guest', () => {
          signedIn = true;
          return HttpResponse.json({ notebookId: NOTEBOOK_ID });
        })
      );
      renderRoutes();

      await userEvent
        .setup()
        .click(await screen.findByRole('button', { name: 'Beispiel ausprobieren' }));

      expect(await screen.findByText('Das Beispiel-Notebook')).toBeTruthy();
    });

    it('says why it did not work when no guest can be started, and the sign-in stays usable', async () => {
      server.use(
        signedOut(),
        http.post('*/api/guest', () =>
          HttpResponse.json({ code: API_ERROR.GUEST_UNAVAILABLE }, { status: 503 })
        )
      );
      renderRoutes();

      await userEvent
        .setup()
        .click(await screen.findByRole('button', { name: 'Beispiel ausprobieren' }));

      expect((await screen.findByRole('alert')).textContent).toContain(
        'Das Beispiel ist gerade nicht verfügbar'
      );
      expect(screen.getByRole('button', { name: 'Anmelden' })).toHaveProperty('disabled', false);
    });

    it('cannot be started twice while it is on its way', async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let calls = 0;
      server.use(
        signedOut(),
        http.post('*/api/guest', async () => {
          calls += 1;
          await gate;
          return HttpResponse.json({ notebookId: NOTEBOOK_ID });
        })
      );
      renderRoutes();
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Beispiel ausprobieren' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Beispiel wird vorbereitet …' })).toHaveProperty(
          'disabled',
          true
        )
      );
      release();
      expect(calls).toBe(1);
    });
  });
});
