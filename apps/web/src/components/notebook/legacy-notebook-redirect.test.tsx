import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/lib/routes';
import { NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { LegacyNotebookRedirect } from './legacy-notebook-redirect';

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p>{`${pathname}${search}${hash}`}</p>;
}

describe('LegacyNotebookRedirect', () => {
  it('sends a saved link of the old address to the notebook at the new one', () => {
    renderWithProviders(
      <Routes>
        <Route path={ROUTES.LEGACY_NOTEBOOK_PATTERN} element={<LegacyNotebookRedirect />} />
        <Route path={ROUTES.NOTEBOOK_PATTERN} element={<Where />} />
      </Routes>,
      `/notizbuecher/${NOTEBOOK_ID}?quelle=1#anfang`
    );

    expect(screen.getByText(`${ROUTES.notebook(NOTEBOOK_ID)}?quelle=1#anfang`)).toBeTruthy();
  });
});
