import { expect, type Page, test } from '@playwright/test';

import { addFixture, createNotebook, signUp, uniqueEmail } from './helpers';

const FINANCE_TEXT =
  'Die Bilanz zeigt einen Gewinn von drei Millionen Euro. Die Rücklagen wurden im Herbst erhöht.';

async function submitPastedText(page: Page, title: string, text: string): Promise<void> {
  await page
    .getByRole('button', { name: /Quellen? hinzufügen/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Kopierter Text' }).click();
  await page.getByLabel('Titel des Textes').fill(title);
  await page.getByLabel('Kopierter Text', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Text hinzufügen' }).click();
}

async function addPastedText(page: Page, title: string, text: string): Promise<void> {
  await submitPastedText(page, title, text);
  await expect(page.getByRole('checkbox', { name: new RegExp(title) })).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await signUp(page, uniqueEmail('sources'));
  await createNotebook(page);
});

test('the selected sources decide what an answer is made from', async ({ page }) => {
  await addFixture(page, 'nordlicht.txt');
  await addPastedText(page, 'Finanzbericht', FINANCE_TEXT);

  // Only the finance text is selected: the answer cites it and nothing else.
  await page.getByRole('checkbox', { name: /nordlicht\.txt/ }).click();
  await expect(page.getByRole('checkbox', { name: /nordlicht\.txt/ })).not.toBeChecked();
  await page.getByLabel('Deine Frage').fill('Was zeigt die Bilanz?');
  await page.getByRole('button', { name: 'Frage senden' }).click();
  const chip = page.getByRole('button', { name: 'Quelle 1 anzeigen' });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.locator('mark').first()).toContainText('Die Bilanz zeigt einen Gewinn');
  await page.getByRole('button', { name: 'Quellenansicht schließen' }).click();

  // With no source selected, a question cannot be sent.
  await page.getByRole('checkbox', { name: /Finanzbericht/ }).click();
  await expect(page.getByRole('checkbox', { name: /Finanzbericht/ })).not.toBeChecked();
  await page.getByLabel('Deine Frage').fill('Und jetzt?');
  await expect(page.getByRole('button', { name: 'Frage senden' })).toBeDisabled();

  // "Alle auswählen" brings both back.
  await page.getByRole('checkbox', { name: 'Alle Quellen auswählen' }).click();
  await expect(page.getByRole('checkbox', { name: /nordlicht\.txt/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Finanzbericht/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Frage senden' })).toBeEnabled();
});

test('a source is renamed and removed, and the same content is not added twice', async ({
  page,
}) => {
  await addPastedText(page, 'Finanzbericht', FINANCE_TEXT);

  // The same text under another title is the same source.
  await submitPastedText(page, 'Finanzbericht zwei', FINANCE_TEXT);
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Finanzbericht/ })).toHaveCount(1);

  // Rename.
  await page.getByRole('button', { name: /Weitere Aktionen für „Finanzbericht/ }).click();
  await page.getByRole('menuitem', { name: 'Quelle umbenennen' }).click();
  await page.getByLabel('Name der Quelle').fill('Jahresabschluss');
  await page.getByLabel('Name der Quelle').press('Enter');
  await expect(page.getByRole('checkbox', { name: /Jahresabschluss/ })).toBeVisible();

  // Remove.
  await page.getByRole('button', { name: /Weitere Aktionen für „Jahresabschluss/ }).click();
  await page.getByRole('menuitem', { name: 'Quelle entfernen' }).click();
  await expect(page.getByRole('checkbox', { name: /Jahresabschluss/ })).toHaveCount(0);
});

test('an address that points into the private network is refused', async ({ page }) => {
  await page
    .getByRole('button', { name: /Quellen? hinzufügen/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Webseite' }).click();
  await page.getByLabel('Webadresse').fill('http://127.0.0.1:9/geheim');
  await page.getByRole('button', { name: 'Link hinzufügen' }).click();

  await expect(
    page.getByText('Diese Adresse kann nicht geladen werden. Prüfe den Link.')
  ).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /für Antworten verwenden/ })).toHaveCount(0);
});
