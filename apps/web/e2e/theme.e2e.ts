import { expect, test } from '@playwright/test';

import { signUp, uniqueEmail } from './helpers';

const PHONE = { width: 360, height: 640 };

test('the look of the app can be chosen on a phone without the menu leaving the screen', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await signUp(page, uniqueEmail('theme'));

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  const box = await page.getByRole('menu').boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(PHONE.width);

  await page.getByRole('menuitemradio', { name: 'Dunkel' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  // The choice survives a reload.
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
