import { expect, test } from '@playwright/test';

import { signUp, uniqueEmail } from './helpers';

const PHONE = { width: 360, height: 640 };

test('the look of the app can be chosen on a phone and is kept', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signUp(page, uniqueEmail('theme'));

  await page.getByRole('button', { name: 'Einstellungen' }).click();

  await page.getByRole('menuitemradio', { name: 'Dunkel' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  // The choice survives a reload.
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
