import Markdown from 'react-markdown';

/** Only these marks of Markdown are read in an answer: bold, italic and code. The rest stays text. */
const ALLOWED = ['strong', 'em', 'code'];

/**
 * The text of one statement: the bold and italic words are shown as such. It sits inside a line, so
 * the chips with the numbers of the passages can follow right after it.
 */
export function InlineText({ text }: { text: string }) {
  return (
    <Markdown
      allowedElements={[...ALLOWED, 'p']}
      unwrapDisallowed
      skipHtml
      components={{ p: ({ children }) => <>{children}</> }}
    >
      {text}
    </Markdown>
  );
}
