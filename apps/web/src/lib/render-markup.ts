import type { ReactElement } from 'react';

/**
 * A React element as a string of markup, for the places that need text and not a screen: a file to
 * download, a clipboard entry. React escapes every text on the way, so nothing here is escaped by
 * hand. The renderer is loaded when it is first needed, not with the page.
 */
export async function renderMarkup(element: ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(element);
}
