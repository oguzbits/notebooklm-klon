import type { DataTable } from '@nlm/shared';

import { CitedBy } from '@/components/studio/cited-by';

const EMPTY_CELL = '–';

/**
 * A data table: the columns as a header, one row per entry, every filled cell with the chips of the
 * passages behind it. A cell the sources do not answer shows a dash. The table scrolls on its own
 * when it is wider or taller than the room.
 */
export function DataTableView({
  notebookId,
  table,
  onOpenCitation,
}: {
  notebookId: string;
  table: DataTable;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <div className="max-h-full overflow-auto rounded-2xl border border-[var(--table-line)]">
      <table className="text-read w-full min-w-max border-collapse text-left">
        <thead className="sticky top-0 bg-secondary">
          <tr>
            {table.columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className="border-b border-[var(--table-line)] px-4 py-3 align-top font-[500]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--table-line)] last:border-b-0">
              {row.cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-96 min-w-40 px-4 py-3 align-top">
                  {cell.text === '' ? (
                    <span className="text-muted-foreground">{EMPTY_CELL}</span>
                  ) : (
                    <>
                      {cell.text}{' '}
                      <CitedBy
                        notebookId={notebookId}
                        chunkIds={cell.chunkIds}
                        onOpen={onOpenCitation}
                      />
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
