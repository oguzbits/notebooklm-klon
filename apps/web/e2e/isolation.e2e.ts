import { expect, test } from '@playwright/test';

import {
  addFixture,
  createNotebook,
  renameOpenNotebook,
  signOut,
  signUp,
  uniqueEmail,
} from './helpers';

test('one user never sees or opens the notebook of another', async ({ page }) => {
  // Anna has a notebook with a source.
  await signUp(page, uniqueEmail('anna'));
  await createNotebook(page);
  await renameOpenNotebook(page, 'Annas Geheimnis');
  await addFixture(page, 'nordlicht.txt');
  const annasPage = page.url();
  await signOut(page);

  // Ben's list is empty, and Anna's address leads him nowhere.
  await signUp(page, uniqueEmail('ben'));
  await expect(page.getByText('Noch kein Notizbuch')).toBeVisible();
  await expect(page.getByText('Annas Geheimnis')).toHaveCount(0);

  await page.goto(annasPage);
  await expect(page.getByRole('heading', { name: 'Notizbuch nicht gefunden' })).toBeVisible();
  await expect(page.getByText('nordlicht.txt')).toHaveCount(0);
});
