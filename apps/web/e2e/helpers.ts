import path from 'node:path';

import { expect, type Page } from '@playwright/test';

export const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
export const PASSWORD = 'journey-test-passwort';

let counter = 0;

/** An address no other test uses; the database lives on between the specs of one run. */
export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.test`;
}

/** Signs up with the form and waits for the empty list of notebooks. */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/anmelden');
  await page.getByRole('button', { name: /Jetzt registrieren/ }).click();
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill(PASSWORD);
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Deine Notebooks' })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Konto' }).click();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
}

/** Makes a notebook with the button of the list and waits until it is open. */
export async function createNotebook(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Neues Notebook' }).click();
  await expect(page).toHaveURL(/\/notizbuecher\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel('Titel des Notebooks')).toBeVisible();
}

/** Names the open notebook through the title in its header. */
export async function renameOpenNotebook(page: Page, title: string): Promise<void> {
  const field = page.getByLabel('Titel des Notebooks');
  await field.fill(title);
  await field.press('Enter');
  await expect(field).toHaveValue(title);
}

/** Adds a file from the fixtures and waits until it can be asked about. */
export async function addFixture(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Quellen hinzufügen' }).click();
  await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, name));
  await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toBeEnabled();
}
