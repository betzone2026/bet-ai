import { cn } from '@/lib/utils';

/**
 * One table component, two layouts.
 *
 * Above the tablet breakpoint this is a real data table. Below it, each
 * row is re-laid-out as a card with label/value pairs — because the
 * alternative, a wide table inside a horizontally scrolling box, hides
 * columns behind a gesture nobody discovers and is the single worst thing
 * a dashboard can do on a phone.
 *
 * Both layouts are driven by the same column definitions, so they cannot
 * describe different data.
 */
export interface Column<T> {
  /** Stable identity for React keys and the mobile label. */
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  /** Monospace, tabular figures. Use for anything numeric. */
  numeric?: boolean;
  /**
   * Marks the column that identifies the row. On mobile it becomes the
   * card's heading instead of another label/value pair. Exactly one
   * column should set it.
   */
  primary?: boolean;
  /** Dropped from the mobile card, for columns that are context only. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Read by screen readers, and rendered as the table's own caption. */
  caption: string;
  /** Shown in place of both layouts when there is nothing to render. */
  empty?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter(
    (column) => column !== primary && !column.hideOnMobile,
  );

  return (
    <div className={className}>
      {/* Desktop: a table, because that is what this data is. --------- */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface shadow-card md:block">
        <table className="w-full text-small">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'eyebrow whitespace-nowrap px-4 py-2.5 font-normal',
                    column.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors duration-fast hover:bg-raised/50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-2.5 align-middle',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.numeric && 'tabular font-mono text-small',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: the same rows as cards. ------------------------------ */}
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card hairline-top"
          >
            {primary && (
              <div className="border-b border-line pb-2.5">{primary.cell(row)}</div>
            )}
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
              {secondary.map((column) => (
                <div key={column.key} className="min-w-0">
                  <dt className="eyebrow truncate">{column.header}</dt>
                  <dd
                    className={cn(
                      'mt-0.5 truncate text-small',
                      column.numeric && 'tabular font-mono',
                    )}
                  >
                    {column.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
