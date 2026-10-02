import { useEffect } from 'react';

/** Shows `title` in the browser tab while the component is mounted, then puts the old one back. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
