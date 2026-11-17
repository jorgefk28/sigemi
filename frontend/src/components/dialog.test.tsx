import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './Dialog';

/**
 * The dialog primitive. `aria-modal="true"` promises the rest of the page is
 * out of reach, so these tests pin the three things that promise costs: Escape
 * closes, Tab stays inside, and focus goes back where it came from.
 */

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Desactivar
      </button>
      <Dialog
        open={open}
        title="Desactivar paciente"
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        footer={
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onClose();
            }}
          >
            Confirmar
          </button>
        }
      >
        <label htmlFor="motivo">Motivo</label>
        <input id="motivo" />
      </Dialog>
    </div>
  );
}

describe('Dialog', () => {
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(screen.getByRole('dialog', { name: 'Desactivar paciente' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the control that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness onClose={vi.fn()} />);

    const opener = screen.getByRole('button', { name: 'Desactivar' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    // The last focusable in reading order is the footer action.
    screen.getByRole('button', { name: 'Confirmar' }).focus();

    await user.tab();

    // Wrapped to the first control of the dialog, not out to the page behind.
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
  });

  it('closes when the backdrop is clicked but not when the panel is', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    await user.click(screen.getByLabelText('Motivo'));
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
