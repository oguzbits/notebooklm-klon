import { SOURCE_KIND } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { detectSourceKind } from './file-kind';

const bytes = (...values: number[]) => new Uint8Array(values);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04); // PK..
const TEXT = new TextEncoder().encode('Hallo');

describe('detectSourceKind', () => {
  it('accepts a PDF only when the name and the content agree', () => {
    expect(detectSourceKind('bericht.pdf', PDF)).toBe(SOURCE_KIND.PDF);
    expect(detectSourceKind('BERICHT.PDF', PDF)).toBe(SOURCE_KIND.PDF);
    expect(detectSourceKind('bericht.pdf', TEXT)).toBeNull();
  });

  it('accepts a DOCX only when the name and the ZIP signature agree', () => {
    expect(detectSourceKind('brief.docx', ZIP)).toBe(SOURCE_KIND.DOCX);
    expect(detectSourceKind('brief.docx', TEXT)).toBeNull();
  });

  it('accepts text and Markdown by extension', () => {
    expect(detectSourceKind('notiz.txt', TEXT)).toBe(SOURCE_KIND.TXT);
    expect(detectSourceKind('readme.md', TEXT)).toBe(SOURCE_KIND.MD);
    expect(detectSourceKind('readme.markdown', TEXT)).toBe(SOURCE_KIND.MD);
  });

  it('rejects other types, a missing extension and a disguised executable', () => {
    expect(detectSourceKind('bild.png', TEXT)).toBeNull();
    expect(detectSourceKind('ohne-endung', TEXT)).toBeNull();
    expect(detectSourceKind('virus.pdf.exe', PDF)).toBeNull();
    expect(detectSourceKind('archiv.zip', ZIP)).toBeNull();
  });

  it('does not mistake inherited object properties for extensions', () => {
    expect(detectSourceKind('datei.constructor', TEXT)).toBeNull();
    expect(detectSourceKind('datei.toString', TEXT)).toBeNull();
    expect(detectSourceKind('datei.__proto__', TEXT)).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(detectSourceKind('leer.txt', new Uint8Array())).toBeNull();
    expect(detectSourceKind('leer.pdf', new Uint8Array())).toBeNull();
  });
});
