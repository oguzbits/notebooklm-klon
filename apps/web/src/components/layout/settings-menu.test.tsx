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
    expect(await screen.findByRole('menuitemradio', { name: 'Gerätestandard' })).toHaveProperty(
      'ariaChecked',
      'true'
    );
    await user.click(screen.getByRole('menuitemradio', { name: 'Dunkel' }));

    expect(document.cookie).toContain('nlm-theme=DARK');
  });

  it('marks the current choice', async () => {
    document.cookie = 'nlm-theme=LIGHT; path=/';
    renderWithProviders(<SettingsMenu />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Einstellungen' }));

    expect(await screen.findByRole('menuitemradio', { name: 'Hell' })).toHaveProperty(
      'ariaChecked',
      'true'
    );
  });
});
