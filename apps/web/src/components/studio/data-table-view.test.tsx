import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CHUNK_ID, chunkDetail, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { DataTableView } from './data-table-view';

const TABLE = {
  title: 'Nordlicht',
  columns: ['Person', 'Aufgabe'],
  rows: [
    {
      cells: [
        { text: 'Dr. Brandt', chunkIds: [CHUNK_ID] },
        { text: 'Leitet das Projekt', chunkIds: [CHUNK_ID] },
      ],
    },
    {
      cells: [
        { text: 'Frau Weiß', chunkIds: [CHUNK_ID] },
        { text: '', chunkIds: [] },
      ],
    },
  ],
};

function renderTable(props: Partial<React.ComponentProps<typeof DataTableView>> = {}) {
  renderWithProviders(
    <DataTableView notebookId={NOTEBOOK_ID} table={TABLE} onOpenCitation={() => {}} {...props} />
  );
  return userEvent.setup();
}

describe('DataTableView', () => {
  it('shows the columns as headers and one row per entry', () => {
    renderTable();

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Person',
      'Aufgabe',
    ]);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: /Leitet das Projekt/ })).toBeTruthy();
  });

  it('marks a cell the sources do not answer with a dash', () => {
    renderTable();

    const row = screen.getByRole('cell', { name: /Frau Weiß/ }).closest('tr') as HTMLElement;
    expect(within(row).getByText('–')).toBeTruthy();
  });

  it('opens the passage behind a cell', async () => {
    server.use(
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json(chunkDetail())
      )
    );
    const onOpen = vi.fn();
    const user = renderTable({ onOpenCitation: onOpen });

    const cell = screen.getByRole('cell', { name: /Leitet das Projekt/ });
    await user.click(within(cell).getByRole('button', { name: 'Quelle 1 anzeigen' }));

    expect(onOpen).toHaveBeenCalledWith(CHUNK_ID);
  });
});
