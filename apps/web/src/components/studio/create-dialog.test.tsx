import {
  type CreateStudioBody,
  REPORT_FORMAT,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
} from '@nlm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { source } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { CreateDialog } from './create-dialog';

const FIRST = source({ id: '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22', title: 'projekt.pdf' });
const SECOND = source({ id: '8a1b6c5d-0e32-4b79-9a2a-4d6f7e9b0c11', title: 'budget.docx' });

function open(kind: CreateStudioBody['kind'], onCreate = vi.fn(), sources = [FIRST, SECOND]) {
  renderWithProviders(
    <CreateDialog kind={kind} sources={sources} onCreate={onCreate}>
      <button>Öffnen</button>
    </CreateDialog>
  );
  return { user: userEvent.setup(), onCreate };
}

const dialog = () => screen.getByRole('dialog');

describe('CreateDialog', () => {
  it('makes flashcards with the usual size and difficulty when nothing is changed', async () => {
    const { user, onCreate } = open(STUDIO_KIND.FLASHCARDS);

    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    expect(within(dialog()).getByText('Lernkarten')).toBeTruthy();
    expect(within(dialog()).getByRole('radio', { name: 'Standardeinstellung' })).toHaveProperty(
      'ariaChecked',
      'true'
    );
    expect(
      within(dialog()).getByRole('radio', { name: 'Mittel (Standardeinstellung)' })
    ).toHaveProperty('ariaChecked', 'true');
    await user.click(within(dialog()).getByRole('button', { name: 'Generieren' }));

    expect(onCreate).toHaveBeenCalledWith({
      kind: STUDIO_KIND.FLASHCARDS,
      size: STUDIO_SIZE.DEFAULT,
      difficulty: STUDIO_DIFFICULTY.MEDIUM,
    });
    // The dialog closes when the work begins.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends the size, the difficulty and the topic the reader chose', async () => {
    const { user, onCreate } = open(STUDIO_KIND.FLASHCARDS);

    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    await user.click(within(dialog()).getByRole('radio', { name: 'Mehr' }));
    await user.click(within(dialog()).getByRole('radio', { name: 'Schwierig' }));
    await user.type(
      within(dialog()).getByRole('textbox', { name: /Thema/ }),
      '  Nur die Architektur  '
    );
    await user.click(within(dialog()).getByRole('button', { name: 'Generieren' }));

    expect(onCreate).toHaveBeenCalledWith({
      kind: STUDIO_KIND.FLASHCARDS,
      size: STUDIO_SIZE.MORE,
      difficulty: STUDIO_DIFFICULTY.HARD,
      focus: 'Nur die Architektur',
    });
  });

  it('asks a mind map for nothing but the sources and the topic', async () => {
    const { user, onCreate } = open(STUDIO_KIND.MINDMAP);

    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    expect(within(dialog()).queryByRole('radiogroup')).toBeNull();
    await user.click(within(dialog()).getByRole('button', { name: 'Generieren' }));

    expect(onCreate).toHaveBeenCalledWith({ kind: STUDIO_KIND.MINDMAP });
  });

  it('asks a data table for nothing but the sources and the topic', async () => {
    const { user, onCreate } = open(STUDIO_KIND.DATA_TABLE);

    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    expect(within(dialog()).queryByRole('radiogroup')).toBeNull();
    await user.click(within(dialog()).getByRole('button', { name: 'Generieren' }));

    expect(onCreate).toHaveBeenCalledWith({ kind: STUDIO_KIND.DATA_TABLE });
  });

  it('can limit the output to some of the sources, and needs at least one', async () => {
    const { user, onCreate } = open(STUDIO_KIND.MINDMAP);

    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    await user.click(within(dialog()).getByRole('button', { name: /2 Quellen/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: /budget\.docx/ }));
    await user.keyboard('{Escape}');
    expect(within(dialog()).getByRole('button', { name: /1 Quelle/ })).toBeTruthy();
    await user.click(within(dialog()).getByRole('button', { name: 'Generieren' }));

    expect(onCreate).toHaveBeenCalledWith({ kind: STUDIO_KIND.MINDMAP, sourceIds: [FIRST.id] });
  });

  it('cannot start without a source', async () => {
    const { user } = open(STUDIO_KIND.MINDMAP);

    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    await user.click(within(dialog()).getByRole('button', { name: /2 Quellen/ }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Alle Quellen' }));
    await user.keyboard('{Escape}');

    expect(within(dialog()).getByRole('button', { name: 'Generieren' })).toHaveProperty(
      'disabled',
      true
    );
  });

  describe('a report', () => {
    it('needs a template before it can start, then makes that one', async () => {
      const { user, onCreate } = open(STUDIO_KIND.REPORT);

      await user.click(screen.getByRole('button', { name: 'Öffnen' }));
      const generate = within(dialog()).getByRole('button', { name: 'Generieren' });
      expect(generate).toHaveProperty('disabled', true);
      await user.click(within(dialog()).getByRole('radio', { name: /Blogpost/ }));
      expect(generate).toHaveProperty('disabled', false);
      await user.click(generate);

      expect(onCreate).toHaveBeenCalledWith({
        kind: STUDIO_KIND.REPORT,
        format: REPORT_FORMAT.BLOG,
      });
    });

    it('keeps the instruction when the reader writes the report, and needs it', async () => {
      const { user, onCreate } = open(STUDIO_KIND.REPORT);

      await user.click(screen.getByRole('button', { name: 'Öffnen' }));
      await user.click(within(dialog()).getByRole('radio', { name: /Eigenen Bericht erstellen/ }));
      const generate = within(dialog()).getByRole('button', { name: 'Generieren' });
      expect(generate).toHaveProperty('disabled', true);
      await user.type(
        within(dialog()).getByRole('textbox', { name: /Anweisung/ }),
        'Schreibe einen Brief an die Chefin.'
      );
      await user.click(generate);

      expect(onCreate).toHaveBeenCalledWith({
        kind: STUDIO_KIND.REPORT,
        format: REPORT_FORMAT.CUSTOM,
        focus: 'Schreibe einen Brief an die Chefin.',
      });
    });
  });
});
