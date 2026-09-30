import path from 'node:path';

import { expect, test } from '@playwright/test';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
const PASSWORD = 'smoke-test-passwort';

test('from sign-up to a cited passage, a note and back out', async ({ page }) => {
  const email = `smoke-${Date.now()}@example.test`;

  // Signed out, the app leads to the sign-in.
  await page.goto('/');
  await expect(page).toHaveURL(/\/anmelden$/);

  // Sign up.
  await page.getByRole('button', { name: /Jetzt registrieren/ }).click();
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Deine Notizbücher' })).toBeVisible();

  // Empty state, then a notebook.
  await expect(page.getByText('Noch kein Notizbuch')).toBeVisible();
  await page.getByLabel('Neues Notizbuch').fill('Smoke-Test');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await page.getByRole('link', { name: /Smoke-Test/ }).click();

  // A refused file explains itself; a text file is read.
  await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'unsupported.png'));
  await expect(page.getByText(/Dateiformat wird nicht unterstützt/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'nordlicht.txt'));
  await expect(page.getByRole('button', { name: 'nordlicht.txt', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /nordlicht.txt/ })).toBeEnabled();

  // Ask a question: the answer streams in with a numbered chip.
  await page.getByLabel('Deine Frage').fill('Wer leitet das Projekt Nordlicht?');
  await page.getByRole('button', { name: 'Frage senden' }).click();
  const chip = page.getByRole('button', { name: 'Quelle 1 anzeigen' });
  await expect(chip).toBeVisible();

  // Hover shows the passage, a click opens the source with the passage marked.
  await chip.hover();
  await expect(page.getByText('nordlicht.txt').last()).toBeVisible();
  await chip.click();
  await expect(page.getByRole('button', { name: /Zurück zu den Quellen/ })).toBeVisible();
  await expect(page.locator('mark').first()).toContainText(
    'Dr. Brandt leitet das Projekt Nordlicht'
  );

  // Save the answer as a note and find it in the notes.
  await page.getByRole('button', { name: 'Als Notiz speichern' }).click();
  await expect(page.getByText('Als Notiz gespeichert')).toBeVisible();
  await page.getByRole('button', { name: /Zurück zu den Quellen/ }).click();
  await page.getByRole('tab', { name: 'Notizen' }).click();
  await expect(page.getByRole('button', { name: 'Notiz löschen' })).toBeVisible();

  // The conversation survives a reload.
  await page.reload();
  await expect(page.getByText('Wer leitet das Projekt Nordlicht?')).toBeVisible();

  // Sign out.
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
});
