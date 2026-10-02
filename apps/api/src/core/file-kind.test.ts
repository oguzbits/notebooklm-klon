import { SOURCE_KIND } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { detectSourceKind } from './file-kind';

const bytes = (...values: number[]) => new Uint8Array(values);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04); // PK..
const TEXT = new TextEncoder().encode('Hallo');
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);

describe('detectSourceKind', () => {
  it('accepts a PDF only when the name and the content agree', () => {
    expect(detectSourceKind('bericht.pdf', PDF)).toBe(SOURCE_KIND.PDF);
    expect(detectSourceKind('BERICHT.PDF', PDF)).toBe(SOURCE_KIND.PDF);
    expect(detectSourceKind('bericht.pdf', TEXT)).toBeNull();
  });

  it('accepts a PPTX only when the name and the ZIP signature agree', () => {
    expect(detectSourceKind('folien.pptx', ZIP)).toBe(SOURCE_KIND.PPTX);
    expect(detectSourceKind('folien.pptx', TEXT)).toBeNull();
  });

  it('accepts a DOCX only when the name and the ZIP signature agree', () => {
    expect(detectSourceKind('brief.docx', ZIP)).toBe(SOURCE_KIND.DOCX);
    expect(detectSourceKind('brief.docx', TEXT)).toBeNull();
  });

  it('accepts a PNG, JPEG or WebP image only when the name and the content agree', () => {
    expect(detectSourceKind('scan.png', PNG)).toBe(SOURCE_KIND.IMAGE);
    expect(detectSourceKind('Foto.JPG', JPEG)).toBe(SOURCE_KIND.IMAGE);
    expect(detectSourceKind('foto.jpeg', JPEG)).toBe(SOURCE_KIND.IMAGE);
    expect(detectSourceKind('bild.webp', WEBP)).toBe(SOURCE_KIND.IMAGE);
    expect(detectSourceKind('scan.png', TEXT)).toBeNull();
    // A page or script renamed to an image must not get through.
    expect(detectSourceKind('seite.png', new TextEncoder().encode('<html><script>'))).toBeNull();
    // The name says JPEG, the content is a PNG: still an image the model can read, but the kinds agree on "image".
    expect(detectSourceKind('foto.jpg', PNG)).toBe(SOURCE_KIND.IMAGE);
  });

  it('accepts text and Markdown by extension', () => {
    expect(detectSourceKind('notiz.txt', TEXT)).toBe(SOURCE_KIND.TXT);
    expect(detectSourceKind('readme.md', TEXT)).toBe(SOURCE_KIND.MD);
    expect(detectSourceKind('readme.markdown', TEXT)).toBe(SOURCE_KIND.MD);
  });

  it('rejects other types, a missing extension and a disguised executable', () => {
    expect(detectSourceKind('bild.gif', PNG)).toBeNull();
    expect(detectSourceKind('bild.svg', TEXT)).toBeNull();
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
