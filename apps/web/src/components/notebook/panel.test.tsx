import { screen, within } from '@testing-library/react';
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

  it('lets the content write the header itself, like a path back', () => {
    renderWithProviders(
      <Panel title="Studio" side="right" onToggle={() => {}} header={<nav>Studio › Notiz</nav>}>
        Inhalt
      </Panel>
    );

    expect(screen.getByText('Studio › Notiz')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Studio' })).toBeNull();
    // The class is the feature: a path back must stay reachable below the wide layout.
    expect(screen.getByRole('banner', { hidden: true }).className).not.toContain('max-wide:hidden');
  });

  // jsdom applies no CSS, so the class that hides the header below the wide layout is the feature here.
  it('hides the plain header below the wide layout, where the switch above names the panel', () => {
    renderWithProviders(
      <Panel title="Quellen" side="left" onToggle={() => {}}>
        Inhalt
      </Panel>
    );

    expect(screen.getByRole('banner', { hidden: true }).className).toContain('max-wide:hidden');
  });

  it('keeps the header below the wide layout when the content brings a button, so the reader can be closed', () => {
    renderWithProviders(
      <Panel title="Quellen" side="left" onToggle={() => {}} action={<button>Schließen</button>}>
        Inhalt
      </Panel>
    );

    expect(screen.getByRole('banner', { hidden: true }).className).not.toContain('max-wide:hidden');
  });

  it('keeps its content when it folds, so nothing is lost and the move can be animated', () => {
    renderWithProviders(
      <Panel title="Studio" side="right" collapsed onToggle={() => {}}>
        <button>Inhalt</button>
      </Panel>
    );

    // The content is still there, but nobody can reach it while the rail is shown.
    expect(screen.queryByRole('button', { name: 'Inhalt' })).toBeNull();
    expect(screen.getByText('Inhalt').closest('[inert]')).toBeTruthy();
  });

  it('shows a rail with the button to open it again and what the panel wants on it', async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <Panel
        title="Studio"
        side="right"
        collapsed
        onToggle={onToggle}
        rail={<button>Auf der Leiste</button>}
      >
        Inhalt
      </Panel>
    );

    const rail = screen.getByRole('button', { name: 'Studio einblenden' }).closest('div');
    expect(rail).toBeTruthy();
    expect(
      within(rail as HTMLElement).getByRole('button', { name: 'Auf der Leiste' })
    ).toBeTruthy();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Studio einblenden' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('keeps the rail out of reach while the panel is open', () => {
    renderWithProviders(
      <Panel title="Studio" side="right" onToggle={() => {}} rail={<button>Auf der Leiste</button>}>
        Inhalt
      </Panel>
    );

    expect(screen.queryByRole('button', { name: 'Auf der Leiste' })).toBeNull();
    expect(screen.getByText('Auf der Leiste').closest('[inert]')).toBeTruthy();
    expect(screen.getByText('Inhalt').closest('[inert]')).toBeNull();
  });
});
