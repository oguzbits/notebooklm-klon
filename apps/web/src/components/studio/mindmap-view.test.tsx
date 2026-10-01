import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CHUNK_ID, chunkDetail, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { MindmapView } from './mindmap-view';

const download = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/lib/mindmap-png', () => ({ downloadMindmapPng: download }));

const MAP = {
  title: 'Nordlicht',
  branches: [
    {
      label: 'Leitung',
      chunkIds: [CHUNK_ID],
      children: [
        {
          label: 'Dr. Brandt',
          chunkIds: [CHUNK_ID],
          children: [{ label: 'Seit 2024', chunkIds: [CHUNK_ID] }],
        },
      ],
    },
    { label: 'Budget', chunkIds: [CHUNK_ID], children: [] },
  ],
};

function renderMap(props: Partial<React.ComponentProps<typeof MindmapView>> = {}) {
  renderWithProviders(
    <MindmapView
      notebookId={NOTEBOOK_ID}
      title="Projekt-Mindmap"
      mindmap={MAP}
      onOpenCitation={() => {}}
      {...props}
    />
  );
  return userEvent.setup();
}

const zoom = () => Number(screen.getByTestId('mindmap-canvas').getAttribute('data-zoom'));

describe('MindmapView', () => {
  it('starts with the topic and its branches, and nothing deeper', () => {
    renderMap();

    expect(screen.getByText('Nordlicht')).toBeTruthy();
    expect(screen.getByText('Leitung')).toBeTruthy();
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.queryByText('Dr. Brandt')).toBeNull();
  });

  it('opens and closes a branch with its toggle', async () => {
    const user = renderMap();
    const toggle = screen.getByRole('button', { name: '„Leitung“ aufklappen' });
    expect(toggle).toHaveProperty('ariaExpanded', 'false');

    await user.click(toggle);
    expect(screen.getByText('Dr. Brandt')).toBeTruthy();
    expect(screen.getByRole('button', { name: '„Leitung“ zuklappen' })).toHaveProperty(
      'ariaExpanded',
      'true'
    );
    await user.click(screen.getByRole('button', { name: '„Leitung“ zuklappen' }));

    expect(screen.queryByText('Dr. Brandt')).toBeNull();
  });

  it('has no toggle on a node without children', () => {
    renderMap();

    expect(screen.queryByRole('button', { name: /„Budget“/ })).toBeNull();
  });

  it('closes the whole map at the topic', async () => {
    const user = renderMap();

    await user.click(screen.getByRole('button', { name: '„Nordlicht“ zuklappen' }));

    expect(screen.queryByText('Leitung')).toBeNull();
    expect(screen.getByRole('button', { name: '„Nordlicht“ aufklappen' })).toBeTruthy();
  });

  it('opens everything at once and goes back to the start with the same button', async () => {
    const user = renderMap();

    await user.click(screen.getByRole('button', { name: 'Alle Knoten aufklappen' }));
    expect(screen.getByText('Seit 2024')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Alle Knoten zuklappen' }));

    expect(screen.queryByText('Dr. Brandt')).toBeNull();
    expect(screen.getByText('Leitung')).toBeTruthy();
  });

  it('zooms in and out in steps and stops at both ends', async () => {
    const user = renderMap();
    const start = zoom();

    await user.click(screen.getByRole('button', { name: 'Vergrößern' }));
    expect(zoom()).toBeGreaterThan(start);
    await user.click(screen.getByRole('button', { name: 'Verkleinern' }));
    await user.click(screen.getByRole('button', { name: 'Verkleinern' }));
    expect(zoom()).toBeLessThan(start);
    for (let i = 0; i < 10; i += 1)
      await user.click(screen.getByRole('button', { name: 'Verkleinern' }));

    expect(screen.getByRole('button', { name: 'Verkleinern' })).toHaveProperty('disabled', true);
  });

  it('downloads the map as an image named like the output', async () => {
    const user = renderMap();

    await user.click(screen.getByRole('button', { name: 'Mindmap als Bild herunterladen' }));

    await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(download).toHaveBeenCalledWith(expect.stringContaining('<svg'), 'Projekt-Mindmap');
  });

  it('opens the passage behind a node', async () => {
    server.use(
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json(chunkDetail())
      )
    );
    const onOpen = vi.fn();
    const user = renderMap({ onOpenCitation: onOpen });

    const node = screen.getByText('Leitung').closest('[data-node]') as HTMLElement;
    await user.click(within(node).getByRole('button', { name: 'Quelle 1 anzeigen' }));

    expect(onOpen).toHaveBeenCalledWith(CHUNK_ID);
  });
});
