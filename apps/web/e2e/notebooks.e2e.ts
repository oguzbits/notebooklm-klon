import { expect, type Page, test } from '@playwright/test';

import { createNotebook, renameOpenNotebook, signUp, uniqueEmail } from './helpers';

const backToList = (page: Page) =>
  page.getByRole('link', { name: 'Zu deinen Notizbüchern' }).click();

test('notebooks are made, found, renamed, pinned and deleted from the list', async ({ page }) => {
  await signUp(page, uniqueEmail('list'));

  // Two notebooks, named in their header.
  await createNotebook(page);
  await renameOpenNotebook(page, 'Alpha Recherche');
  await backToList(page);
  await createNotebook(page);
  await renameOpenNotebook(page, 'Beta Planung');
  await backToList(page);
  const cards = page.getByRole('list').getByRole('link');
  await expect(cards).toHaveCount(2);

  // Search narrows the list; a miss says so; clearing brings everything back.
  const search = page.getByLabel('Notizbücher durchsuchen');
  await search.fill('alpha');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Alpha Recherche');
  await search.fill('gibt-es-nicht');
  await expect(page.getByText('Kein Notizbuch gefunden')).toBeVisible();
  await search.fill('');
  await expect(cards).toHaveCount(2);

  // Rename from the card menu.
  await page.getByRole('button', { name: 'Weitere Aktionen für Notizbuch „Beta Planung“' }).click();
  await page.getByRole('menuitem', { name: 'Titel bearbeiten' }).click();
  await page.getByLabel('Titel des Notizbuchs').fill('Gamma Ergebnis');
  await page.getByLabel('Titel des Notizbuchs').press('Enter');
  await expect(cards.filter({ hasText: 'Gamma Ergebnis' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Beta Planung' })).toHaveCount(0);

  // Pinned notebooks move to the top.
  await page
    .getByRole('button', { name: 'Weitere Aktionen für Notizbuch „Gamma Ergebnis“' })
    .click();
  await page.getByRole('menuitem', { name: 'Oben anpinnen' }).click();
  await expect(cards.first()).toContainText('Gamma Ergebnis');

  // Deleting asks first; cancelling keeps it, confirming removes it for good.
  await page
    .getByRole('button', { name: 'Weitere Aktionen für Notizbuch „Alpha Recherche“' })
    .click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await expect(page.getByText(/„Alpha Recherche“ wird mit allen Quellen/)).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(cards).toHaveCount(2);

  await page
    .getByRole('button', { name: 'Weitere Aktionen für Notizbuch „Alpha Recherche“' })
    .click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(cards).toHaveCount(1);

  // The list is what the server holds, not only what the page remembers.
  await page.reload();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Gamma Ergebnis');
});

test('an unknown notebook page says so instead of showing something', async ({ page }) => {
  await signUp(page, uniqueEmail('missing'));

  await page.goto('/notizbuecher/00000000-0000-4000-8000-000000000000');

  await expect(page.getByRole('heading', { name: 'Notizbuch nicht gefunden' })).toBeVisible();
});
