import { CHAT_LENGTH, CHAT_STYLE, type ChatConfig, DEFAULT_CHAT_CONFIG } from '@nlm/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { ChatSettingsDialog } from './chat-settings-dialog';

const url = `*/api/notebooks/${NOTEBOOK_ID}/chat-config`;

describe('ChatSettingsDialog', () => {
  it('loads the settings, sends the changed ones and closes', async () => {
    let saved: ChatConfig | undefined;
    server.use(
      http.get(url, () => HttpResponse.json(DEFAULT_CHAT_CONFIG)),
      http.put(url, async ({ request }) => {
        saved = (await request.json()) as ChatConfig;
        return HttpResponse.json(saved);
      })
    );
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ChatSettingsDialog notebookId={NOTEBOOK_ID} open onOpenChange={onOpenChange} />
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('radio', { name: 'Kürzer' }));
    await user.click(screen.getByRole('radio', { name: /Lernbegleiter/ }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(saved).toEqual({
      ...DEFAULT_CHAT_CONFIG,
      style: CHAT_STYLE.LEARNING_GUIDE,
      length: CHAT_LENGTH.SHORTER,
    });
  });

  it('asks for the instruction of the custom style before it can be saved', async () => {
    server.use(http.get(url, () => HttpResponse.json(DEFAULT_CHAT_CONFIG)));
    renderWithProviders(
      <ChatSettingsDialog notebookId={NOTEBOOK_ID} open onOpenChange={() => {}} />
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('radio', { name: /Eigene Anweisung/ }));

    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    await user.type(screen.getByLabelText('Eigene Anweisung'), 'Antworte knapp.');
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', false);
  });
});
