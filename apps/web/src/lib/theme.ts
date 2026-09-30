const DARK_CLASS = 'dark';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Uses the dark theme whenever the system does, now and when the setting changes. */
export function followColorScheme(root: HTMLElement): void {
  const query = window.matchMedia(DARK_QUERY);
  root.classList.toggle(DARK_CLASS, query.matches);
  query.addEventListener('change', (event) => root.classList.toggle(DARK_CLASS, event.matches));
}
