import type { Column } from '@/lib/columns';

// The columns of the original are flex items in a container as wide as the window minus 12px each
// side: 25 % / 48 % / 25 % of it with 8px between them (the 2 % that is left stays empty on the right).
// The chat always fills what the side columns leave, but never more than 48 % while both are open.
// While a Studio output is open the Studio asks for at least 37.5 % of the window (`min-width`) and
// the other two give way in proportion to their size, exactly the way the original does it. A column
// that is folded away becomes a rail of 56px. Everything that changes between these states is a
// length, so the browser can move it smoothly in both directions (nothing flips at the start or the
// end, which is what made the earlier version jump).
const MOTION =
  'wide:transition-[flex-basis,min-width,max-width,margin] wide:duration-200 wide:ease-in-out';
export const FLEX = {
  SOURCES_SIDE: 'wide:[flex:0_1_var(--sources-width,25%)]',
  STUDIO_SIDE: 'wide:[flex:0_1_var(--studio-width,25%)]',
  RAIL: 'wide:[flex:0_0_56px]',
  CHAT: 'wide:[flex:1_1_48%] wide:max-w-[48%]',
  CHAT_FILLING: 'wide:[flex:1_1_48%] wide:max-w-full',
  // Once a side column was dragged to a width, the chat is only what is left.
  CHAT_REST: 'wide:[flex:1_1_0%] wide:max-w-full',
  STUDIO_VIEWING: 'wide:min-w-[37.5vw]',
} as const;

/** While a strip between two columns is dragged the columns follow at once, without the motion. */
export const RESIZING = 'wide:transition-none';

/** Below the wide layout only the column that is selected shows. */
const hiddenBelowWide = (shown: Column, own: Column) => (shown === own ? '' : 'max-wide:hidden');

/** The classes every column has: its visibility below the wide layout, its width and its motion. */
export const columnClasses = (shown: Column, own: Column, resizing = false) =>
  [hiddenBelowWide(shown, own), 'w-full wide:w-auto', resizing ? RESIZING : MOTION]
    .filter(Boolean)
    .join(' ');
