import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CHUNK_ID, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { QuizView } from './quiz-view';

const QUESTION = {
  question: 'Wer leitet das Projekt?',
  options: ['Dr. Brandt', 'Frau Weiß', 'Herr Kaya', 'Frau Lund'],
  correctIndex: 0,
  explanation: 'Dr. Brandt leitet das Projekt Nordlicht.',
  chunkIds: [CHUNK_ID],
};
const WITH_REASONS = {
  ...QUESTION,
  hint: 'Der Name steht im ersten Satz.',
  rationales: [
    'Das steht so in der Quelle.',
    'Frau Weiß wird nicht genannt.',
    'Herr Kaya wird nicht genannt.',
    'Frau Lund wird nicht genannt.',
  ],
};
const SECOND = {
  ...WITH_REASONS,
  question: 'Wie hoch ist das Budget?',
  options: ['1 Mio.', '1,25 Mio.', '2 Mio.', '3 Mio.'],
  correctIndex: 1,
};

function renderQuiz(
  questions: object[],
  props: Partial<React.ComponentProps<typeof QuizView>> = {}
) {
  const onAsk = vi.fn();
  renderWithProviders(
    <QuizView
      notebookId={NOTEBOOK_ID}
      quiz={{ questions } as React.ComponentProps<typeof QuizView>['quiz']}
      onOpenCitation={() => {}}
      onAsk={onAsk}
      {...props}
    />
  );
  return { onAsk, user: userEvent.setup() };
}

const option = (name: RegExp) => screen.getByRole('button', { name });

describe('QuizView', () => {
  it('shows the question and the position, and the options with letters', () => {
    renderQuiz([WITH_REASONS, SECOND]);

    expect(screen.getByText('1 von 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Wer leitet das Projekt?' })).toBeTruthy();
    expect(option(/^A\. Dr\. Brandt/)).toBeTruthy();
    expect(option(/^D\. Frau Lund/)).toBeTruthy();
  });

  it('says why an option is right or wrong once one was chosen, and locks the options', async () => {
    const { user } = renderQuiz([WITH_REASONS, SECOND]);

    await user.click(option(/^B\. Frau Weiß/));

    const wrong = option(/^B\. Frau Weiß/);
    expect(within(wrong).getByText('Nicht ganz')).toBeTruthy();
    expect(within(wrong).getByText('Frau Weiß wird nicht genannt.')).toBeTruthy();
    const right = option(/^A\. Dr\. Brandt/);
    expect(within(right).getByText('Richtige Antwort')).toBeTruthy();
    expect(within(right).getByText('Das steht so in der Quelle.')).toBeTruthy();
    // The others give their reason too, without a verdict.
    expect(
      within(option(/^C\. Herr Kaya/)).getByText('Herr Kaya wird nicht genannt.')
    ).toBeTruthy();
    expect(wrong).toHaveProperty('disabled', true);
  });

  it('keeps the one explanation for a quiz from before there was a reason for each option', async () => {
    const { user } = renderQuiz([QUESTION]);
    expect(screen.queryByRole('button', { name: 'Tipp anzeigen' })).toBeNull();

    await user.click(option(/^B\. Frau Weiß/));

    expect(screen.getByText('Dr. Brandt leitet das Projekt Nordlicht.')).toBeTruthy();
    expect(within(option(/^B\. Frau Weiß/)).getByText('Nicht ganz')).toBeTruthy();
    expect(within(option(/^A\. Dr\. Brandt/)).getByText('Richtige Antwort')).toBeTruthy();
  });

  it('shows the hint on request, before an answer', async () => {
    const { user } = renderQuiz([WITH_REASONS]);
    expect(screen.queryByText('Der Name steht im ersten Satz.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Tipp anzeigen' }));

    expect(screen.getByText('Der Name steht im ersten Satz.')).toBeTruthy();
  });

  it('goes on with "Weiter" and ends with the score and a way to start again', async () => {
    const { user } = renderQuiz([WITH_REASONS, SECOND]);

    await user.click(option(/^B\. Frau Weiß/));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByText('2 von 2')).toBeTruthy();
    await user.click(option(/^B\. 1,25 Mio\./));
    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }));

    expect(screen.getByText('1 von 2 richtig')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Noch einmal' }));
    expect(screen.getByText('1 von 2')).toBeTruthy();
    expect(option(/^A\. Dr\. Brandt/)).toHaveProperty('disabled', false);
  });

  it('lets a question be skipped with "Weiter", counting it as not answered', async () => {
    const { user } = renderQuiz([WITH_REASONS, SECOND]);

    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByText('2 von 2')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ergebnis anzeigen' }));

    expect(screen.getByText('0 von 2 richtig')).toBeTruthy();
  });

  it('asks the chat to explain the question once it was answered', async () => {
    const { onAsk, user } = renderQuiz([WITH_REASONS]);
    expect(screen.queryByRole('button', { name: 'Erklären' })).toBeNull();

    await user.click(option(/^B\. Frau Weiß/));
    await user.click(screen.getByRole('button', { name: 'Erklären' }));

    const question = onAsk.mock.calls[0]?.[0] as string;
    expect(question).toContain('Wer leitet das Projekt?');
    expect(question).toContain('Dr. Brandt');
  });

  it('starts over from the menu', async () => {
    const { user } = renderQuiz([WITH_REASONS, SECOND]);
    await user.click(option(/^A\. Dr\. Brandt/));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));

    await user.click(screen.getByRole('button', { name: 'Weitere Optionen' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quiz neu starten' }));

    expect(screen.getByText('1 von 2')).toBeTruthy();
    expect(option(/^A\. Dr\. Brandt/)).toHaveProperty('disabled', false);
  });

  it('names the passages behind the answer after it was given', async () => {
    const { user } = renderQuiz([WITH_REASONS]);
    expect(screen.queryByRole('button', { name: 'Quelle 1 anzeigen' })).toBeNull();

    await user.click(option(/^A\. Dr\. Brandt/));

    expect(screen.getByRole('button', { name: 'Quelle 1 anzeigen' })).toBeTruthy();
  });
});
