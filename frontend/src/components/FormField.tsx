import type { ReactNode } from 'react';

/**
 * Form field primitive for the P3 pattern.
 *
 * It renders the label, the control the caller passes and, below it, the hint or
 * the error. `fieldDescribedBy` gives the control the matching
 * `aria-describedby`, so a `400` with `campo` lands on the field instead of in a
 * generic banner.
 */

/** Shared control styling, so every text input looks the same. */
export const INPUT_CLASSES =
  'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none';

/** `aria-describedby` target for a control rendered inside a `FormField`. */
export function fieldDescribedBy(
  id: string,
  error?: string | null,
  hint?: string,
): string | undefined {
  if (error) {
    return `${id}-error`;
  }
  return hint ? `${id}-hint` : undefined;
}

interface FormFieldProps {
  id: string;
  label: string;
  /** Field-scoped message; when present it replaces the hint as description. */
  error?: string | null;
  hint?: string;
  children: ReactNode;
}

export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm text-body">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
