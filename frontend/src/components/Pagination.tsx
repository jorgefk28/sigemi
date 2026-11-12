import { Btn } from './Btn';

/**
 * Pagination primitive for the P1 listing pattern. It reports the visible range
 * from the envelope the backend answers and never computes a page count from
 * invented numbers.
 */

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  /** Items actually rendered on this page. */
  items: number;
  onOffsetChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, items, onOffsetChange }: PaginationProps) {
  const from = items === 0 ? 0 : offset + 1;
  const to = offset + items;
  const hasPrevious = offset > 0;
  const hasNext = to < total;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-3 py-2">
      <p className="text-xs text-muted">{`Mostrando ${from}–${to} de ${total}`}</p>
      <div className="flex items-center gap-2">
        <Btn
          disabled={!hasPrevious}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          Anterior
        </Btn>
        <Btn disabled={!hasNext} onClick={() => onOffsetChange(offset + limit)}>
          Siguiente
        </Btn>
      </div>
    </div>
  );
}
