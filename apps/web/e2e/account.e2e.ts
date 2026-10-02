import { expect, test } from '@playwright/test';

import { PASSWORD, signOut, signUp, uniqueEmail } from './helpers';

test.describe('account', () => {
  test('a returning user signs in again and a wrong password is refused', async ({ page }) => {
    const email = uniqueEmail('account');
    await signUp(page, email);
    await signOut(page);

    // A wrong password says so and stays on the form.
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Passwort').fill(`${PASSWORD}-falsch`);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByText('E-Mail-Adresse oder Passwort stimmen nicht.')).toBeVisible();
    await expect(page).toHaveURL(/\/anmelden$/);

    // The right one leads back to the list.
    await page.getByLabel('Passwort').fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deine Notebooks' })).toBeVisible();

    // The session survives a reload.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Deine Notebooks' })).toBeVisible();
  });

  test('an address that has an account cannot sign up twice', async ({ page }) => {
    const email = uniqueEmail('twice');
    await signUp(page, email);
    await signOut(page);

    await page.getByRole('button', { name: /Jetzt registrieren/ }).click();
    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Passwort').fill(PASSWORD);
    await page.getByRole('button', { name: 'Konto erstellen' }).click();

    await expect(
      page.getByText('Mit dieser E-Mail-Adresse gibt es schon ein Konto.')
    ).toBeVisible();
    await expect(page).toHaveURL(/\/anmelden$/);
  });

  test('a deleted account is gone: wrong password refused, right one signs out for good', async ({
    page,
  }) => {
    const email = uniqueEmail('delete');
    await signUp(page, email);

    await page.getByRole('button', { name: 'Konto' }).click();
    await page.getByRole('menuitem', { name: 'Konto löschen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Konto löschen' });
    await dialog.getByLabel('Passwort').fill(`${PASSWORD}-falsch`);
    await dialog.getByRole('button', { name: 'Konto endgültig löschen' }).click();
    await expect(dialog.getByText('Das Passwort stimmt nicht.')).toBeVisible();

    await dialog.getByLabel('Passwort').fill(PASSWORD);
    await dialog.getByRole('button', { name: 'Konto endgültig löschen' }).click();
    await expect(page).toHaveURL(/\/anmelden$/);

    await page.getByLabel('E-Mail-Adresse').fill(email);
    await page.getByLabel('Passwort').fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.getByText('E-Mail-Adresse oder Passwort stimmen nicht.')).toBeVisible();
  });

  test('a signed-out visitor cannot open a notebook page', async ({ page }) => {
    await page.goto('/notebook/00000000-0000-4000-8000-000000000000');

    await expect(page).toHaveURL(/\/anmelden$/);
  });
});
