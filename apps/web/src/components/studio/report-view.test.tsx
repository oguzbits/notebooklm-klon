import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CHUNK_ID, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { ReportView } from './report-view';

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
