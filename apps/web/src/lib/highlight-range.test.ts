import type { Element, Root, Text } from 'hast';
import { describe, expect, it } from 'vitest';

import { rehypeHighlightRange } from './highlight-range';

/** A text node that stands for `value` at the given place in a source. */
function text(value: string, start: number, end = start + value.length): Text {
  return {
    type: 'text',
    value,
    position: {
      start: { line: 1, column: 1, offset: start },
      end: { line: 1, column: 1, offset: end },
    },
  };
}

function tree(...children: Text[]): Root {
  const paragraph: Element = { type: 'element', tagName: 'p', properties: {}, children };
  return { type: 'root', children: [paragraph] };
}

function run(root: Root, start: number | null, end: number | null) {
  rehypeHighlightRange({ start, end })(root);
  return (root.children[0] as Element).children.map((child) =>
    child.type === 'element'
      ? `[${child.children.map((inner) => (inner.type === 'text' ? inner.value : '?')).join('')}]`
      : child.type === 'text'
        ? child.value
        : '?'
  );
}

describe('rehypeHighlightRange', () => {
  it('cuts a text node at the edges of the passage', () => {
    expect(run(tree(text('abcdef', 10)), 12, 14)).toEqual(['ab', '[cd]', 'ef']);
  });

  it('marks a node that lies inside the passage and leaves the ones outside', () => {
    expect(run(tree(text('aa', 0), text('bb', 2), text('cc', 4)), 2, 4)).toEqual([
      'aa',
      '[bb]',
      'cc',
    ]);
  });

  it('marks the whole node when its length does not match its place in the source', () => {
    expect(run(tree(text('a*b', 0, 4)), 3, 4)).toEqual(['[a*b]']);
  });

  it('does nothing without a passage, and skips nodes without a place', () => {
    const plain: Text = { type: 'text', value: 'x' };
    expect(run(tree(text('abc', 0)), null, null)).toEqual(['abc']);
    expect(run(tree(plain), 0, 5)).toEqual(['x']);
  });

  it('ignores an empty or backwards range', () => {
    expect(run(tree(text('abc', 0)), 2, 2)).toEqual(['abc']);
    expect(run(tree(text('abc', 0)), 3, 1)).toEqual(['abc']);
  });
});
