import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { EditableTitle } from './editable-title';

const field = () => screen.getByRole('textbox', { name: 'Titel der Probe' });

function renderTitle(props: Partial<React.ComponentProps<typeof EditableTitle>> = {}) {
  const onSave = vi.fn();
  const view = renderWithProviders(
    <EditableTitle value="Alt" label="Titel der Probe" saving={false} onSave={onSave} {...props} />
  );
  return { onSave, user: userEvent.setup(), view };
}

describe('EditableTitle', () => {
  it('saves the trimmed title when the field is left', async () => {
    const { onSave, user } = renderTitle();

    await user.clear(field());
    await user.type(field(), '  Neu  ');
    await user.tab();

    expect(onSave).toHaveBeenCalledWith('Neu', expect.any(Function));
  });

  it('saves on Enter and takes the change back on Escape', async () => {
    const { onSave, user } = renderTitle();

    await user.clear(field());
    await user.type(field(), 'Mit Enter{Enter}');
    expect(onSave).toHaveBeenCalledWith('Mit Enter', expect.any(Function));

    // The parent has not taken the new title over (it is still "Alt"), which is what Escape returns to.
    onSave.mockClear();
    await user.click(field());
    await user.type(field(), ' mehr{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(field()).toHaveProperty('value', 'Alt');
  });

  it('does not save an empty or an unchanged title, and shows the old one again', async () => {
    const { onSave, user } = renderTitle();

    await user.clear(field());
    await user.tab();
    expect(onSave).not.toHaveBeenCalled();
    expect(field()).toHaveProperty('value', 'Alt');

    await user.click(field());
    await user.tab();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('can be told to put the old title back when saving failed', async () => {
    const { onSave, user } = renderTitle();
    await user.clear(field());
    await user.type(field(), 'Neu');
    await user.tab();

    const revert = onSave.mock.calls[0]?.[1] as () => void;
    await vi.waitFor(() => expect(field()).toHaveProperty('value', 'Neu'));
    revert();
    await vi.waitFor(() => expect(field()).toHaveProperty('value', 'Alt'));
  });

  it('takes over a title that changed elsewhere and shows an error under the field', () => {
    const { view } = renderTitle({ error: 'Das hat nicht geklappt.' });

    expect(screen.getByRole('alert').textContent).toBe('Das hat nicht geklappt.');
    view.rerender(
      <EditableTitle value="Anders" label="Titel der Probe" saving={false} onSave={() => {}} />
    );
    expect(field()).toHaveProperty('value', 'Anders');
  });

  it('is locked while it saves', () => {
    renderTitle({ saving: true });

    expect(field()).toHaveProperty('disabled', true);
  });
});
