import type { UsageSummary } from '@nlm/shared';

const COLUMN_GAP = '  ';

/** Left-aligns the first column and right-aligns the numbers, so the report reads as a table. */
function table(header: string[], rows: (string | number)[][]): string[] {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((cells) => String(cells[column]).length))
  );
  const line = (cells: (string | number)[]) =>
    cells
      .map((cell, column) =>
        column === 0
          ? String(cell).padEnd(widths[column] ?? 0)
          : String(cell).padStart(widths[column] ?? 0)
      )
      .join(COLUMN_GAP);
  return [line(header), ...rows.map(line)];
}

function groupBy(rows: UsageSummary[], key: (row: UsageSummary) => string) {
  const groups = new Map<string, UsageSummary[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

const sum = (rows: UsageSummary[], pick: (row: UsageSummary) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

/** The usage of a period as text: the average cost of a call per purpose, and the heaviest users. */
export function formatUsageReport(rows: UsageSummary[]): string {
  if (rows.length === 0) return 'No model calls in this period.';

  const byPurpose = groupBy(rows, (row) => row.purpose);
  const purposes = [...byPurpose].map(([purpose, group]) => {
    const calls = sum(group, (row) => row.calls);
    return [
      purpose,
      calls,
      Math.round(sum(group, (row) => row.inputTokens) / calls),
      Math.round(sum(group, (row) => row.outputTokens) / calls),
      sum(group, (row) => row.estimatedCalls),
    ];
  });

  const byUser = groupBy(rows, (row) => row.userId);
  const users = [...byUser]
    .map(([userId, group]) => ({
      userId,
      calls: sum(group, (row) => row.calls),
      tokens: sum(group, (row) => row.inputTokens + row.outputTokens),
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .map((entry) => [entry.userId, entry.calls, entry.tokens]);

  return [
    ...table(['Purpose', 'Calls', 'Avg input', 'Avg output', 'Estimated'], purposes),
    '',
    ...table(['User', 'Calls', 'Tokens'], users),
  ].join('\n');
}
