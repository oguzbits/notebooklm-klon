import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { Panel } from './panel';

describe('Panel', () => {
  it('names itself and folds away with its button', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <Panel title="Quellen" side="left" onToggle={onToggle}>
        Inhalt
      </Panel>
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quellen ausblenden' }));

    expect(screen.getByRole('heading', { name: 'Quellen' })).toBeTruthy();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('lets the content put its own button in the header instead of the fold button', () => {
    renderWithProviders(
      <Panel title="Quellen" side="left" onToggle={() => {}} action={<button>Schließen</button>}>
        Inhalt
      </Panel>
    );

    expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quellen ausblenden' })).toBeNull();
  });

  it('becomes a rail with nothing but the button to open it again', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <Panel title="Studio" side="right" collapsed onToggle={onToggle}>
        Inhalt
      </Panel>
    );

    expect(screen.queryByText('Inhalt')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Studio einblenden' }));

    expect(onToggle).toHaveBeenCalledOnce();
  });
});
