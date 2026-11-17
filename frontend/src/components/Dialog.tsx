import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  /** Called on Escape, on the backdrop and on the close control. */
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal primitive for the P2/P3 dialogs (a row action that needs an input, such
 * as the deactivation motive of REC-19 paso 6).
 *
 * `aria-modal="true"` is a promise that the rest of the page is out of reach, so
 * the dialog keeps Tab inside itself, closes on Escape and on a backdrop click,
 * and returns focus to the control that opened it. Focus moves in once, on open,
 * and never again: re-focusing on every render would steal the caret from the
 * field being typed.
 */
export function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = `dialog-${title.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) {
        return;
      }

      // Keep the tab cycle inside the dialog: aria-modal says the rest is inert.
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      opener?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        // Only a click on the backdrop itself closes; a click inside must not.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
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
