import { expect, test } from '@playwright/test';

import { createNotebook, signUp, uniqueEmail } from './helpers';

const PHONE = { width: 360, height: 640 };
const TOUCH_TARGET = 44;

test('on a phone the tabs switch the column and are big enough for a finger', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signUp(page, uniqueEmail('tabs'));
  await createNotebook(page);

  const tabs = page.getByRole('tablist', { name: 'Bereiche' });
  await expect(tabs).toBeVisible();
  for (const name of ['Quellen', 'Chat', 'Studio']) {
    const box = await tabs.getByRole('tab', { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(TOUCH_TARGET);
  }

  await tabs.getByRole('tab', { name: 'Studio' }).click();
  await expect(page.getByRole('region', { name: 'Studio' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chat' })).toBeHidden();

  await tabs.getByRole('tab', { name: 'Studio' }).press('ArrowLeft');
  await expect(page.getByRole('region', { name: 'Chat' })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Chat' })).toBeFocused();

  // A tablet in landscape keeps the three columns.
  await page.setViewportSize({ width: 1100, height: 700 });
  await expect(tabs).toBeHidden();
});
