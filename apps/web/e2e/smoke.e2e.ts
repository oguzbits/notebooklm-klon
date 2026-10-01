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
  await page.getByRole('button', { name: 'Neues Notizbuch' }).click();
  await page.getByLabel('Titel des Notizbuchs').fill('Smoke-Test');
  await page.getByRole('button', { name: 'Anlegen' }).click();
  await page.getByRole('link', { name: /Smoke-Test/ }).click();

  // A refused file explains itself; a text file is read.
  await page.getByRole('button', { name: 'Quellen hinzufügen' }).click();
  await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'unsupported.png'));
  await expect(page.getByText(/Dateiformat wird nicht unterstützt/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'nordlicht.txt'));
  await expect(page.getByRole('button', { name: 'nordlicht.txt', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /nordlicht.txt/ })).toBeEnabled();

  // A notebook with a source that is read leads its chat with an overview: the cover with the title
  // and the number of sources, and a summary of the sources.
  await expect(page.getByRole('heading', { name: 'Smoke-Test', level: 3 })).toBeVisible();
  await expect(page.getByText(/^1 Quelle · \d{2}\.\d{2}\.\d{4}$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zusammenfassung kopieren' })).toBeVisible();

  // Ask a question: the answer streams in with a numbered chip.
  await page.getByLabel('Deine Frage').fill('Wer leitet das Projekt Nordlicht?');
  await page.getByRole('button', { name: 'Frage senden' }).click();
  const chip = page.getByRole('button', { name: 'Quelle 1 anzeigen' });
  await expect(chip).toBeVisible();

  // Hover shows the passage, a click opens the source with the passage marked.
  await chip.hover();
  await expect(page.getByText('nordlicht.txt').last()).toBeVisible();
  await chip.click();
  await expect(page.getByRole('button', { name: 'Quellenansicht schließen' })).toBeVisible();
  await expect(page.locator('mark').first()).toContainText(
    'Dr. Brandt leitet das Projekt Nordlicht'
  );

  // Save the answer as a note and find it in the notes.
  // The overview has the same button; the one of the answer is the last.
  await page.getByRole('button', { name: 'In Notiz speichern' }).last().click();
  await expect(page.getByText('In Notiz gespeichert')).toBeVisible();
  await page.getByRole('button', { name: 'Quellenansicht schließen' }).click();
  const library = page.getByRole('region', { name: 'Erstellte Ausgaben' });
  await expect(
    library.getByRole('button', { name: /^Projekt Nordlicht Dr\. Brandt leitet das Projekt/ })
  ).toBeVisible();

  // The summary of the overview can be kept as a note of its own, too.
  await page.getByRole('button', { name: 'In Notiz speichern' }).click();
  await expect(library.getByRole('button', { name: /^Zusammenfassung/ })).toBeVisible();

  // The Studio makes flashcards from the source; every card has a passage behind it. The result
  // joins the list and is opened from there.
  await page.getByRole('button', { name: 'Karteikarten', exact: true }).click();
  await page.getByRole('button', { name: 'Generieren' }).click();
  await library.getByRole('button', { name: /^Ungelesen: / }).click();
  await expect(page.getByText(/1 von \d+/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quelle 1 anzeigen' }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Zurück zum Studio' }).click();
  await expect(
    library.getByRole('button', { name: /^Projekt Nordlicht Dr\., 1 Quelle/ })
  ).toBeVisible();

  // A note of your own: written in the editor, saved as it is typed.
  await page.getByRole('button', { name: 'Notiz hinzufügen' }).click();
  const editor = page.getByRole('textbox', { name: 'Text der Notiz' });
  await expect(editor).toBeFocused();
  await page.keyboard.type('# Eigene Idee');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Ein **fetter** Gedanke.');
  await expect(page.getByText('Gespeichert', { exact: true })).toBeVisible();

  // The conversation survives a reload.
  await page.reload();
  await expect(page.getByText('Wer leitet das Projekt Nordlicht?')).toBeVisible();

  // The note of your own survives it too, formatted.
  await library.getByRole('button', { name: /^Neue Notiz/ }).click();
  await expect(page.getByRole('heading', { name: 'Eigene Idee', level: 1 })).toBeVisible();
  await expect(editor.locator('strong')).toHaveText('fetter');
  await page.getByRole('button', { name: 'Notizansicht schließen' }).click();

  // Sign out.
  await page.getByRole('button', { name: 'Konto' }).click();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
});
