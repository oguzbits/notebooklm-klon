import { expect, test } from '@playwright/test';

test('a guest tries the example notebook with one click, asks a question and leaves', async ({
  page,
}) => {
  await page.goto('/anmelden');
  await page.getByRole('button', { name: 'Demo ausprobieren' }).click();

  // The guest lands in a copy of the example, which already has its overview.
  await expect(page).toHaveURL(/\/notebook\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('heading', { name: 'Demo: Projekt Nordlicht', level: 3 })
  ).toBeVisible();
  await expect(page.getByText(/^3 Quellen · \d{2}\.\d{2}\.\d{4}$/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'projekt-nordlicht.md', exact: true })
  ).toBeVisible();

  // The sources can be asked about at once.
  await page.getByLabel('Deine Frage').fill('Wer leitet das Projekt?');
  await page.getByRole('button', { name: 'Frage senden' }).click();
  await expect(page.getByRole('button', { name: /Quelle \d anzeigen/ }).first()).toBeVisible();

  // The account menu says that this is a guest.
  await page.getByRole('button', { name: 'Konto' }).click();
  await expect(page.getByText('Gast-Zugang')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
});
