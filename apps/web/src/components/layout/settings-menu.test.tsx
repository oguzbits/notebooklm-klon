import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { SettingsMenu } from './settings-menu';

afterEach(() => {
  document.cookie = 'nlm-theme=; max-age=0; path=/';
});

describe('SettingsMenu', () => {
  it('offers the look of the app and remembers the choice', async () => {
    renderWithProviders(<SettingsMenu />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Einstellungen' }));
    // With the keyboard, because a submenu of Radix also closes when the pointer of a test jumps.
    (await screen.findByRole('menuitem', { name: 'Gerätestandard' })).focus();
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('menuitemradio', { name: 'Gerätestandard' })).toHaveProperty(
      'ariaChecked',
      'true'
    );
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(document.cookie).toContain('nlm-theme=DARK');
  });

  it('shows the current choice on the entry', async () => {
    document.cookie = 'nlm-theme=LIGHT; path=/';
    renderWithProviders(<SettingsMenu />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Einstellungen' }));

    expect(await screen.findByRole('menuitem', { name: 'Hell' })).toBeTruthy();
  });
});
