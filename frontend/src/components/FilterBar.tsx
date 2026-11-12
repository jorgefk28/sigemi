import type { ReactNode } from 'react';
import { Btn } from './Btn';

/**
 * Filter bar primitive for the P1 listing pattern: a search form with its own
 * submit and, when filters are applied, a reset control.
 *
 * It owns no filter state; the page decides which controls apply on change and
 * which ones wait for the submit.
 */

interface FilterBarProps {
  /** Accessible name of the search form. */
  label: string;
  children: ReactNode;
  onSubmit: () => void;
  /** Rendered as "Limpiar filtros"; omit it when no filter is applied. */
  onReset?: () => void;
}

export function FilterBar({ label, children, onSubmit, onReset }: FilterBarProps) {
  return (
    <form
      role="search"
      aria-label={label}
      className="flex flex-wrap items-end gap-3 border-b border-gray-200 px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <div className="flex items-center gap-2">
        <Btn type="submit" variant="primary">
          Buscar
        </Btn>
        {onReset && <Btn onClick={onReset}>Limpiar filtros</Btn>}
      </div>
    </form>
  );
}
