import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  /** Called on Escape, on the backdrop and on the close control. */
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal primitive for the P2/P3 dialogs (a row action that needs an input, such
 * as the deactivation motive of REC-19 paso 6).
 *
 * Focus moves to the panel once, when the dialog opens; it is never re-focused
 * on re-render, because that would steal the caret from the field being typed.
 * Escape closes.
 */
export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = `dialog-${title.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    if (open) {
      panel.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl outline-none"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            ×
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
