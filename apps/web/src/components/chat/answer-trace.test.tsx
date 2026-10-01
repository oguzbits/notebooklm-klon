import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { AnswerTraceView } from './answer-trace';

const trace = {
  sourcesSearched: 2,
  passagesFound: 7,
  droppedStatements: 0,
  strippedCitations: 0,
};

describe('AnswerTraceView', () => {
  it('is closed at first and shows the steps when opened', async () => {
    renderWithProviders(<AnswerTraceView trace={trace} statements={3} />);
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: 'Vorgehen' });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Deine Quellen wurden durchsucht')).toBeNull();

    await user.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Deine Quellen wurden durchsucht')).toBeTruthy();
    expect(screen.getByText('2 Quellen · 7 Textstellen gefunden')).toBeTruthy();
    expect(screen.getByText('Antwort geschrieben und geprüft')).toBeTruthy();
    expect(screen.getByText('3 Aussagen, jede mit Quellenangabe')).toBeTruthy();
  });

  it('closes again', async () => {
    renderWithProviders(<AnswerTraceView trace={trace} statements={1} />);
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: 'Vorgehen' });

    await user.click(toggle);
    await user.click(toggle);

    expect(screen.queryByText('Deine Quellen wurden durchsucht')).toBeNull();
  });

  it('uses the singular for one source, one passage and one statement', async () => {
    renderWithProviders(
      <AnswerTraceView trace={{ ...trace, sourcesSearched: 1, passagesFound: 1 }} statements={1} />
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Vorgehen' }));

    expect(screen.getByText('1 Quelle · 1 Textstelle gefunden')).toBeTruthy();
    expect(screen.getByText('1 Aussage, jede mit Quellenangabe')).toBeTruthy();
  });

  it('tells what the check left out, because that is part of how the answer came about', async () => {
    renderWithProviders(
      <AnswerTraceView
        trace={{ ...trace, droppedStatements: 2, strippedCitations: 1 }}
        statements={3}
      />
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Vorgehen' }));

    expect(screen.getByText('2 Aussagen ohne Beleg wurden weggelassen')).toBeTruthy();
    expect(screen.getByText('1 ungültige Quellenangabe wurde entfernt')).toBeTruthy();
  });

  it('says plainly that nothing fitting was found', async () => {
    renderWithProviders(<AnswerTraceView trace={{ ...trace, passagesFound: 0 }} statements={0} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Vorgehen' }));

    expect(screen.getByText('2 Quellen · keine passende Textstelle gefunden')).toBeTruthy();
  });
});
