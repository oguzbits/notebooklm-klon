import { STUDIO_FEEDBACK, type StudioFeedback, type StudioRequest } from '@nlm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { NOTEBOOK_ID, source, SOURCE_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { ViewerFrame } from './viewer-frame';

const REQUEST: StudioRequest = {
  prompt: 'Erstelle ein Briefing über die Quellen.',
  sources: [
    { id: SOURCE_ID, title: 'projekt.pdf' },
    { id: '8a1b6c5d-0e32-4b79-9a2a-4d6f7e9b0c11', title: 'gelöscht.pdf' },
  ],
};

interface FrameOverrides {
  request?: StudioRequest | null;
  withPrompt?: boolean;
  feedback?: StudioFeedback | null;
  actions?: React.ReactNode;
  onMaximize?: () => void;
}

function renderFrame({
  request = REQUEST,
  withPrompt = true,
  feedback = null,
  ...rest
}: FrameOverrides = {}) {
  server.use(
    http.get(`*/api/notebooks/${NOTEBOOK_ID}/sources`, () => HttpResponse.json([source()]))
  );
  const handlers = {
    onRename: vi.fn(),
    onFeedback: vi.fn(),
    onDelete: vi.fn(),
  };
  renderWithProviders(
    <ViewerFrame
      notebookId={NOTEBOOK_ID}
      title={{
        text: 'Mein Bericht',
        label: 'Titel der Ausgabe',
        saving: false,
        error: null,
        onSave: handlers.onRename,
      }}
      prompt={{ request, withPrompt }}
      feedback={{ value: feedback, noun: 'Bericht', onChange: handlers.onFeedback }}
      deletion={{ pending: false, onDelete: handlers.onDelete }}
      {...rest}
    >
      Inhalt
    </ViewerFrame>
  );
  return { ...handlers, user: userEvent.setup() };
}

describe('ViewerFrame', () => {
  it('shows the title as a field that renames, and the content under it', async () => {
    const { onRename, user } = renderFrame();

    const field = screen.getByRole('textbox', { name: 'Titel der Ausgabe' });
    expect(screen.getByText('Inhalt')).toBeTruthy();
    await user.clear(field);
    await user.type(field, 'Neuer Name{Enter}');

    expect(onRename).toHaveBeenCalledWith('Neuer Name', expect.any(Function));
  });

  it('opens the prompt and the sources behind a chip that counts them', async () => {
    const { user } = renderFrame();

    await user.click(screen.getByRole('button', { name: 'Prompt und 2 Quellen ansehen' }));

    const popup = await screen.findByRole('dialog');
    expect(within(popup).getByText('Erstelle ein Briefing über die Quellen.')).toBeTruthy();
    expect(within(popup).getByText('projekt.pdf')).toBeTruthy();
    // A source that is gone from the notebook is still named, like it was when the output was made.
    expect(within(popup).getByText('gelöscht.pdf')).toBeTruthy();
  });

  it('names only the sources where the original shows no prompt', async () => {
    const { user } = renderFrame({ withPrompt: false });

    await user.click(screen.getByRole('button', { name: '2 Quellen ansehen' }));

    const popup = await screen.findByRole('dialog');
    expect(within(popup).queryByText('Erstelle ein Briefing über die Quellen.')).toBeNull();
    expect(within(popup).getByText('projekt.pdf')).toBeTruthy();
  });

  it('has no chip for an output from before the request was kept', () => {
    renderFrame({ request: null });

    expect(screen.queryByRole('button', { name: /Quellen ansehen/ })).toBeNull();
  });

  it('rates the output, marks the rating that was given and clears it when it is pressed again', async () => {
    const { onFeedback, user } = renderFrame({ feedback: STUDIO_FEEDBACK.GOOD });

    await user.click(screen.getByRole('button', { name: 'Schlechter Bericht' }));
    expect(onFeedback).toHaveBeenLastCalledWith(STUDIO_FEEDBACK.BAD);

    const good = screen.getByRole('button', { name: 'Guter Bericht' });
    expect(good).toHaveProperty('ariaPressed', 'true');
    await user.click(good);

    expect(onFeedback).toHaveBeenCalledWith(null);
  });

  it('offers copying and enlarging only when the view has them', async () => {
    renderFrame();
    expect(screen.queryByRole('button', { name: 'Inhalt mit Formatierung kopieren' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Maximieren' })).toBeNull();
  });

  it('shows a copy button and an enlarge button when the view brings them', async () => {
    renderFrame({
      actions: <button>Kopieren</button>,
      onMaximize: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Maximieren' })).toBeTruthy();
  });

  it('deletes from its menu', async () => {
    const { onDelete, user } = renderFrame();

    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
