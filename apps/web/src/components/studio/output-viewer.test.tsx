import {
  API_ERROR,
  REPORT_FORMAT,
  STUDIO_FEEDBACK,
  STUDIO_KIND,
  type StudioOutput,
} from '@nlm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHUNK_ID,
  flashcardsOutput,
  mindmapOutput,
  NOTEBOOK_ID,
  OUTPUT_ID,
  quizOutput,
  source,
} from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { OutputViewer } from './output-viewer';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;

const reportOutput = (): StudioOutput =>
  ({
    ...flashcardsOutput(),
    kind: STUDIO_KIND.REPORT,
    format: REPORT_FORMAT.BRIEFING,
    title: 'Überblick',
    content: {
      title: 'Überblick',
      sections: [
        {
          heading: 'Lage',
          statements: [{ text: 'Dr. Brandt leitet **es**.', chunkIds: [CHUNK_ID] }],
        },
      ],
    },
  }) as StudioOutput;

function renderViewer(output: StudioOutput) {
  server.use(http.get(`${base}/sources`, () => HttpResponse.json([source()])));
  const handlers = { onDelete: vi.fn(), onOpenCitation: vi.fn(), onAsk: vi.fn() };
  renderWithProviders(
    <OutputViewer notebookId={NOTEBOOK_ID} output={output} deleting={false} {...handlers} />
  );
  return { ...handlers, user: userEvent.setup() };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OutputViewer', () => {
  it('shows each kind in its own view', () => {
    const kinds: [StudioOutput, RegExp][] = [
      [reportOutput(), /Dr\. Brandt leitet/],
      [flashcardsOutput(), /Wer leitet das Projekt\?/],
      [quizOutput(), /Wer leitet das Projekt\?/],
      [mindmapOutput(), /Leitung/],
    ];
    for (const [output, text] of kinds) {
      const { unmount } = renderWithProviders(
        <OutputViewer
          notebookId={NOTEBOOK_ID}
          output={output}
          deleting={false}
          onDelete={() => {}}
          onOpenCitation={() => {}}
          onAsk={() => {}}
        />
      );
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('renames the output, and takes the old title back when that fails', async () => {
    let sent: unknown;
    server.use(
      http.patch(`${base}/studio/${OUTPUT_ID}`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 });
      })
    );
    const { user } = renderViewer(flashcardsOutput());

    const field = screen.getByRole('textbox', { name: 'Titel der Ausgabe' });
    await user.clear(field);
    await user.type(field, 'Neu{Enter}');

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(sent).toEqual({ title: 'Neu' });
    await vi.waitFor(() => expect(field).toHaveProperty('value', 'Karteikarten'));
  });

  it('sends what the reader thought of the output', async () => {
    let sent: unknown;
    server.use(
      http.patch(`${base}/studio/${OUTPUT_ID}`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...flashcardsOutput(), feedback: STUDIO_FEEDBACK.GOOD });
      })
    );
    const { user } = renderViewer(flashcardsOutput());

    await user.click(screen.getByRole('button', { name: 'Guter Inhalt' }));

    await vi.waitFor(() => expect(sent).toEqual({ feedback: STUDIO_FEEDBACK.GOOD }));
  });

  it('calls the feedback of a report "Bericht"', () => {
    renderViewer(reportOutput());

    expect(screen.getByRole('button', { name: 'Guter Bericht' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schlechter Bericht' })).toBeTruthy();
  });

  it('copies a report with its formatting and as plain text', async () => {
    const made: Record<string, Blob>[] = [];
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(data: Record<string, Blob>) {
          made.push(data);
        }
      }
    );
    // The user-event session puts its own clipboard in place, so the spy comes after it.
    const { user } = renderViewer(reportOutput());
    const write = vi.spyOn(navigator.clipboard, 'write').mockResolvedValue(undefined);

    await user.click(screen.getByRole('button', { name: 'Inhalt mit Formatierung kopieren' }));

    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    const html = await made[0]?.['text/html']?.text();
    const text = await made[0]?.['text/plain']?.text();
    expect(html).toContain('<h2>Lage</h2>');
    expect(html).toContain('<strong>es</strong>');
    expect(text).toContain('Dr. Brandt leitet es.');
  });

  it('enlarges cards, quiz and mind map in a dialog, but not a report', async () => {
    const { user } = renderViewer(quizOutput());

    await user.click(screen.getByRole('button', { name: 'Maximieren' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Wer leitet das Projekt?')).toBeTruthy();
  });

  it('has nothing to enlarge for a report, which is only text', () => {
    renderViewer(reportOutput());

    expect(screen.queryByRole('button', { name: 'Maximieren' })).toBeNull();
  });

  it('names the sources behind the output', async () => {
    const { user } = renderViewer(flashcardsOutput());

    await user.click(screen.getByRole('button', { name: '1 Quelle ansehen' }));

    expect(await screen.findByText('projekt.pdf')).toBeTruthy();
  });
});
