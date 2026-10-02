import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { captureDownloads } from '@/test/capture-downloads';
import { CHUNK_ID, chunkDetail, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { FlashcardsView } from './flashcards-view';

const FLASHCARDS = {
  cards: [
    { front: 'Wer leitet das Projekt?', back: 'Dr. Brandt', chunkIds: [CHUNK_ID] },
    { front: 'Wie hoch ist das Budget?', back: '1,25 Mio. Euro', chunkIds: [CHUNK_ID] },
    { front: 'Wann endet es?', back: 'Im Dezember 2027', chunkIds: [CHUNK_ID] },
  ],
};

function renderCards(props: Partial<React.ComponentProps<typeof FlashcardsView>> = {}) {
  const onAsk = vi.fn();
  renderWithProviders(
    <FlashcardsView
      notebookId={NOTEBOOK_ID}
      title="Projekt-Lernkarten"
      flashcards={FLASHCARDS}
      onOpenCitation={() => {}}
      onAsk={onAsk}
      {...props}
    />
  );
  return { onAsk, user: userEvent.setup() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FlashcardsView', () => {
  it('shows the front of the first card and where it is in the set', () => {
    renderCards();

    expect(screen.getByText('Wer leitet das Projekt?')).toBeTruthy();
    expect(screen.getByText('1 von 3')).toBeTruthy();
    expect(screen.getByText('Antwort ansehen')).toBeTruthy();
  });

  it('turns the card on a click and turns it back', async () => {
    const { user } = renderCards();

    await user.click(screen.getByRole('button', { name: 'Aktivieren, um die Antwort zu sehen' }));
    expect(screen.getByText('Dr. Brandt')).toBeTruthy();
    expect(screen.queryByText('Wer leitet das Projekt?')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Aktivieren, um die Frage zu sehen' }));

    expect(screen.getByText('Wer leitet das Projekt?')).toBeTruthy();
  });

  it('moves with the round buttons and stops at both ends', async () => {
    const { user } = renderCards();
    const previous = screen.getByRole('button', { name: 'Vorherige Karte' });
    const next = screen.getByRole('button', { name: 'Nächste Karte' });
    expect(previous).toHaveProperty('disabled', true);

    await user.click(next);
    expect(screen.getByText('Wie hoch ist das Budget?')).toBeTruthy();
    expect(screen.getByText('2 von 3')).toBeTruthy();
    await user.click(next);
    expect(next).toHaveProperty('disabled', true);
    await user.click(previous);

    expect(screen.getByText('2 von 3')).toBeTruthy();
  });

  it('always shows the front of the card that comes up', async () => {
    const { user } = renderCards();

    await user.click(screen.getByRole('button', { name: 'Aktivieren, um die Antwort zu sehen' }));
    await user.click(screen.getByRole('button', { name: 'Nächste Karte' }));

    expect(screen.getByText('Wie hoch ist das Budget?')).toBeTruthy();
  });

  it('counts what was understood and what was not, and goes on to the next card', async () => {
    const { user } = renderCards();

    await user.click(screen.getByRole('button', { name: 'Verstanden' }));
    await user.click(screen.getByRole('button', { name: 'Nicht verstanden' }));
    await user.click(screen.getByRole('button', { name: 'Nicht verstanden' }));

    expect(within(screen.getByRole('button', { name: 'Verstanden' })).getByText('1')).toBeTruthy();
    expect(
      within(screen.getByRole('button', { name: 'Nicht verstanden' })).getByText('2')
    ).toBeTruthy();
    // The third mark was on the last card: it stays there.
    expect(screen.getByText('3 von 3')).toBeTruthy();
  });

  it('can be handled from the keyboard', async () => {
    const { user } = renderCards();
    screen.getByRole('group', { name: 'Lernkarten' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2 von 3')).toBeTruthy();
    await user.keyboard(' ');
    expect(screen.getByText('1,25 Mio. Euro')).toBeTruthy();
    await user.keyboard('{ArrowLeft}');

    expect(screen.getByText('1 von 3')).toBeTruthy();
  });

  it('asks the chat to explain the answer of the card', async () => {
    const { onAsk, user } = renderCards();
    expect(screen.queryByRole('button', { name: 'Erklären' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Aktivieren, um die Antwort zu sehen' }));
    await user.click(screen.getByRole('button', { name: 'Erklären' }));

    expect(onAsk).toHaveBeenCalledOnce();
    const question = onAsk.mock.calls[0]?.[0] as string;
    expect(question).toContain('Wer leitet das Projekt?');
    expect(question).toContain('Dr. Brandt');
  });

  it('starts the set again and mixes it up from the menu of the card', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { user } = renderCards();
    await user.click(screen.getByRole('button', { name: 'Verstanden' }));

    await user.click(screen.getByRole('button', { name: 'Weitere Optionen' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set mischen' }));
    expect(screen.getByText('1 von 3')).toBeTruthy();
    // Math.random() = 0 moves every card one place back: the second card is first now.
    expect(screen.getByText('Wie hoch ist das Budget?')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Weitere Optionen' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Set neu starten' }));
    expect(within(screen.getByRole('button', { name: 'Verstanden' })).getByText('0')).toBeTruthy();
    expect(screen.getByText('Wer leitet das Projekt?')).toBeTruthy();
  });

  it('downloads the set as a CSV file named like the output', async () => {
    const downloads = captureDownloads();
    const { user } = renderCards();

    try {
      await user.click(screen.getByRole('button', { name: 'Weitere Optionen' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Set herunterladen' }));

      expect(downloads.files).toHaveLength(1);
      expect(await downloads.files[0]?.blob.text()).toContain('Wer leitet das Projekt?,Dr. Brandt');
      expect(downloads.files[0]?.blob.type).toBe('text/csv;charset=utf-8');
    } finally {
      downloads.restore();
    }
  });

  it('opens the passage behind a card', async () => {
    server.use(
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json(chunkDetail())
      )
    );
    const onOpen = vi.fn();
    const { user } = renderCards({ onOpenCitation: onOpen });

    await user.click(screen.getByRole('button', { name: 'Quelle 1 anzeigen' }));

    expect(onOpen).toHaveBeenCalledWith(CHUNK_ID);
  });
});
