import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The type scale and weights of `index.css`. Without them tailwind-merge takes `text-small` for a
// text color and drops it when a real color follows (`text-small text-muted-foreground`).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['ui', 'small'] }],
      'font-weight': [{ font: ['label', 'title'] }],
    },
  },
});

/** Joins class names and lets the last Tailwind utility win over an earlier conflicting one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
