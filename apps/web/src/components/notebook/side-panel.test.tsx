import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { SidePanel } from './side-panel';

describe('SidePanel', () => {
  it('shows the sources first and the notes after a click on the tab', async () => {
    server.use(
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/sources`, () => HttpResponse.json([])),
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/notes`, () => HttpResponse.json([]))
    );
    renderWithProviders(
      <SidePanel notebookId={NOTEBOOK_ID} onOpenSource={() => {}} onOpenCitation={() => {}} />
    );

    expect(await screen.findByText('Noch keine Quellen')).toBeTruthy();
    expect(screen.queryByText('Noch keine Notizen')).toBeNull();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Notizen' }));

    expect(await screen.findByText('Noch keine Notizen')).toBeTruthy();
  });
});
