import type { ReactNode } from 'react';

/**
 * Table primitive for the P1 listing pattern.
 *
 * It renders the header row and the body only: loading, empty and error states
 * belong to the page, so the table never fabricates a row. While loading it
 * exposes `aria-busy` and renders skeleton cells that are hidden from the
 * accessibility tree.
 */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  /** Accessible name of the table. */
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  /**
   * Row that must stand out as the only match of a search. It is highlighted,
   * never auto-selected: the invoking use case decides what to do with it.
   */
  highlightedRowKey?: string;
}

export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 4,
  highlightedRowKey,
}: DataTableProps<T>) {
  return (
    <table
      aria-label={label}
      aria-busy={loading}
      className="w-full border-collapse text-left text-sm"
    >
      <thead>
        <tr className="border-b border-gray-200">
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading
          ? Array.from({ length: skeletonRows }, (_, index) => (
              <tr key={`skeleton-${index}`} aria-hidden="true">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3">
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                  </td>
                ))}
              </tr>
            ))
          : rows.map((row) => {
              const key = rowKey(row);
              const highlighted = highlightedRowKey !== undefined && key === highlightedRowKey;
              return (
                <tr
                  key={key}
                  className={[
                    'border-b border-gray-100 last:border-0',
                    highlighted ? 'bg-blue-50' : '',
                  ].join(' ')}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2 text-gray-800">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
      </tbody>
    </table>
  );
}
