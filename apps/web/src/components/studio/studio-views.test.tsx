import { STUDIO_KIND } from '@nlm/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  CHUNK_ID,
  chunkDetail,
  flashcardsOutput,
  mindmapOutput,
  NOTEBOOK_ID,
  quizOutput,
} from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { FlashcardsView } from './flashcards-view';
import { MindmapView } from './mindmap-view';
import { QuizView } from './quiz-view';
import { ReportView } from './report-view';

function content<K extends (typeof STUDIO_KIND)[keyof typeof STUDIO_KIND]>(
  output: { kind: string; content: unknown },
  kind: K
) {
  if (output.kind !== kind) throw new Error('wrong fixture');
  return output.content;
}

describe('FlashcardsView', () => {
  it('shows the front, turns to the answer on a click and moves through the cards', async () => {
    const cards = content(flashcardsOutput(), STUDIO_KIND.FLASHCARDS) as Parameters<
      typeof FlashcardsView
    >[0]['flashcards'];
    renderWithProviders(
      <FlashcardsView notebookId={NOTEBOOK_ID} flashcards={cards} onOpenCitation={() => {}} />
    );
    const user = userEvent.setup();

    expect(screen.getByText('Wer leitet das Projekt?')).toBeTruthy();
    expect(screen.getByText('Karte 1 von 2')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Karte zur Antwort umdrehen' }));
    expect(screen.getByText('Dr. Brandt')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Nächste Karte' }));
    expect(screen.getByText('Wie hoch ist das Budget?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nächste Karte' })).toHaveProperty('disabled', true);
  });

  it('opens the passage behind a card', async () => {
    server.use(
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json(chunkDetail())
      )
    );
    const onOpen = vi.fn();
    const cards = content(flashcardsOutput(), STUDIO_KIND.FLASHCARDS) as Parameters<
      typeof FlashcardsView
    >[0]['flashcards'];
    renderWithProviders(
      <FlashcardsView notebookId={NOTEBOOK_ID} flashcards={cards} onOpenCitation={onOpen} />
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quelle 1 anzeigen' }));

    expect(onOpen).toHaveBeenCalledWith(CHUNK_ID);
  });
});

describe('QuizView', () => {
  const quiz = content(quizOutput(), STUDIO_KIND.QUIZ) as Parameters<typeof QuizView>[0]['quiz'];

  it('tells a right answer from a wrong one, explains it and ends with the score', async () => {
    renderWithProviders(
      <QuizView notebookId={NOTEBOOK_ID} quiz={quiz} onOpenCitation={() => {}} />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Frau Weiß' }));
    expect(screen.getByLabelText('falsch')).toBeTruthy();
    expect(screen.getByLabelText('richtig')).toBeTruthy();
    expect(screen.getByText(/Dr\. Brandt leitet das Projekt Nordlicht\./)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }));
    expect(screen.getByText('0 von 1 richtig')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Noch einmal' }));
    expect(screen.getByText('Frage 1 von 1')).toBeTruthy();
  });

  it('counts a right answer and does not let the answer be changed', async () => {
    renderWithProviders(
      <QuizView notebookId={NOTEBOOK_ID} quiz={quiz} onOpenCitation={() => {}} />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Dr. Brandt' }));
    await user.click(screen.getByRole('button', { name: 'Frau Weiß' }));
    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }));

    expect(screen.getByText('1 von 1 richtig')).toBeTruthy();
  });
});

describe('MindmapView', () => {
  it('shows the topic, its branches and their twigs', () => {
    const mindmap = content(mindmapOutput(), STUDIO_KIND.MINDMAP) as Parameters<
      typeof MindmapView
    >[0]['mindmap'];
    renderWithProviders(
      <MindmapView notebookId={NOTEBOOK_ID} mindmap={mindmap} onOpenCitation={() => {}} />
    );

    expect(screen.getByText('Nordlicht')).toBeTruthy();
    expect(screen.getByText('Leitung')).toBeTruthy();
    expect(screen.getByText('Dr. Brandt')).toBeTruthy();
  });
});

describe('ReportView', () => {
  it('shows the title, the headings and the statements with their chips', () => {
    renderWithProviders(
      <ReportView
        notebookId={NOTEBOOK_ID}
        report={{
          title: 'Briefing',
          sections: [
            {
              heading: 'Lage',
              statements: [{ text: 'Dr. Brandt leitet es.', chunkIds: [CHUNK_ID] }],
            },
          ],
        }}
        onOpenCitation={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Briefing' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lage' })).toBeTruthy();
    expect(screen.getByText(/Dr\. Brandt leitet es\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quelle 1 anzeigen' })).toBeTruthy();
  });
});
