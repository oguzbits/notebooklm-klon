import { expect, type Page, test } from '@playwright/test';

import { addFixture, createNotebook, signUp, uniqueEmail } from './helpers';

const BRANDT = 'Dr. Brandt leitet das Projekt Nordlicht';

const library = (page: Page) => page.getByRole('region', { name: 'Erstellte Ausgaben' });

/** Makes an output of one kind from the tile and opens it from the list. */
async function generateAndOpen(page: Page, tile: string): Promise<void> {
  await page.getByRole('button', { name: tile, exact: true }).click();
  await page.getByRole('button', { name: 'Generieren' }).click();
  await library(page)
    .getByRole('button', { name: /^Ungelesen: / })
    .click();
}

/** A click on the chip of a passage opens the source with that passage marked. */
async function expectCitationOpensSource(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Quelle 1 anzeigen' }).last().click();
  await expect(page.getByRole('button', { name: 'Quellenansicht schließen' })).toBeVisible();
  await expect(page.locator('mark').first()).toContainText(BRANDT);
}

test.beforeEach(async ({ page }) => {
  await signUp(page, uniqueEmail('studio'));
  await createNotebook(page);
  await addFixture(page, 'nordlicht.txt');
});

test('a quiz is answered question by question and ends with a score', async ({ page }) => {
  await generateAndOpen(page, 'Quiz');
  await expect(page.getByText(/^1 von \d+$/)).toBeVisible();

  // The tip is hidden until it is asked for.
  await page.getByRole('button', { name: 'Tipp anzeigen' }).click();
  await expect(page.getByRole('button', { name: 'Tipp verbergen' })).toBeVisible();

  // A wrong pick says so and shows the right option; the passage behind it opens the source.
  await page.getByRole('button', { name: /^B\. / }).click();
  await expect(page.getByText('Nicht ganz')).toBeVisible();
  await expect(page.getByText('Richtige Antwort')).toBeVisible();
  await expect(page.getByRole('button', { name: /^A\. / })).toBeDisabled();
  await expectCitationOpensSource(page);
  await page.getByRole('button', { name: 'Quellenansicht schließen' }).click();

  // The last question leads to the result, which can be started over.
  await page.getByRole('button', { name: 'Ergebnis anzeigen' }).click();
  await expect(page.getByRole('heading', { name: /^0 von \d+ richtig$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Noch einmal' }).click();
  await expect(page.getByText(/^1 von \d+$/)).toBeVisible();
});

test('a mindmap opens and closes its branches, zooms and keeps a passage behind every node', async ({
  page,
}) => {
  await generateAndOpen(page, 'Mindmap');
  const nodes = page.locator('[data-node]');
  const canvas = page.getByTestId('mindmap-canvas');
  await expect(nodes.first()).toBeVisible();
  const before = await nodes.count();

  // Open everything: more nodes; close everything: back to fewer.
  await page.getByRole('button', { name: 'Alle Knoten aufklappen' }).click();
  await expect(nodes).not.toHaveCount(before);
  const opened = await nodes.count();
  expect(opened).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Alle Knoten zuklappen' }).click();
  await expect(nodes).toHaveCount(before);

  // A single branch opens by its own toggle.
  await page
    .getByRole('button', { name: /„.*“ aufklappen/ })
    .first()
    .click();
  await expect(nodes).not.toHaveCount(before);

  // Zoom in and out changes the scale and returns to where it started.
  const zoom = Number(await canvas.getAttribute('data-zoom'));
  await page.getByRole('button', { name: 'Vergrößern' }).click();
  expect(Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(zoom);
  await page.getByRole('button', { name: 'Verkleinern' }).click();
  expect(Number(await canvas.getAttribute('data-zoom'))).toBeCloseTo(zoom, 5);

  await expectCitationOpensSource(page);
});

test('a mindmap can be saved as a picture', async ({ page }) => {
  await generateAndOpen(page, 'Mindmap');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Mindmap als Bild herunterladen' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});

test('a report from a template shows its sections, each statement cited', async ({ page }) => {
  await page.getByRole('button', { name: 'Berichte', exact: true }).click();
  await page.getByRole('radio', { name: /Überblick/ }).click();
  await page.getByRole('button', { name: 'Generieren' }).click();
  await library(page)
    .getByRole('button', { name: /^Ungelesen: / })
    .click();

  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 4 }).first()).toBeVisible();
  await expectCitationOpensSource(page);
  await page.getByRole('button', { name: 'Quellenansicht schließen' }).click();
  await page.getByRole('button', { name: 'Berichtsansicht schließen' }).click();
  await expect(library(page).getByRole('button', { name: /Überblick/ })).toBeVisible();
});

for (const tile of ['Karteikarten', 'Quiz']) {
  test(`every option of the ${tile} dialog is fully visible on a desktop screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: tile, exact: true }).click();
    const dialog = page.getByRole('dialog');
    const groups = dialog.getByRole('radiogroup');
    await expect(groups.first()).toBeVisible();

    // The width of the text depends on the loaded font; scrollWidth is in layout pixels, so the zoom-in
    // animation of the dialog does not distort it.
    await page.evaluate(() => document.fonts.ready);
    const bars = await groups.evaluateAll((elements) =>
      elements.map((group) => ({ scrollWidth: group.scrollWidth, clientWidth: group.clientWidth }))
    );
    expect(bars.length).toBeGreaterThan(0);
    // Nothing may be cut off: the options together are not wider than the bar that holds them.
    for (const bar of bars) {
      expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
    }
  });
}

const DIALOG_TILES = ['Berichte', 'Karteikarten', 'Quiz', 'Mindmap', 'Datentabelle'];
const NARROW = { width: 390, height: 800 };

for (const tile of DIALOG_TILES) {
  test(`the ideas in the ${tile} dialog stay inside the field, also on a narrow screen`, async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.getByRole('tab', { name: 'Studio' }).click();
    await page.getByRole('button', { name: tile, exact: true }).click();
    const dialog = page.getByRole('dialog');
    const field = dialog.getByRole('textbox');
    const ideas = dialog.locator('li').last();
    await expect(ideas).toBeVisible();

    const fieldBox = await field.boundingBox();
    const ideasBox = await ideas.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(ideasBox).not.toBeNull();
    // The list is longer than the minimum height of the field: the field grows to fit it.
    expect(ideasBox!.y + ideasBox!.height).toBeLessThanOrEqual(fieldBox!.y + fieldBox!.height + 1);
  });
}
