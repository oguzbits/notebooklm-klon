const NEEDS_QUOTES = /[",\r\n]/;
const BYTE_ORDER_MARK = '﻿';

// A spreadsheet runs a field that starts with one of these as a formula; plain numbers are no formula.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+([.,]\d+)?$/;

const safe = (value: string) =>
  FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;

const field = (raw: string) => {
  const value = safe(raw);
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
};

/** Rows as CSV text. The mark at the start makes Excel read umlauts right. */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [header, ...rows].map((row) => `${row.map(field).join(',')}\r\n`);
  return BYTE_ORDER_MARK + lines.join('');
}
