const NEEDS_QUOTES = /[",\r\n]/;
const BYTE_ORDER_MARK = '﻿';

const field = (value: string) =>
  NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

/** Rows as CSV text. The mark at the start makes Excel read umlauts right. */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header, ...rows].map((row) => `${row.map(field).join(',')}\r\n`);
  return BYTE_ORDER_MARK + lines.join('');
}
