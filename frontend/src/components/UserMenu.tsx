import { useEffect, useRef, useState } from 'react';
import type { User } from '../api/auth';

interface UserMenuProps {
  user: User;
  onOpenProfile: () => void;
}

/**
 * Header account menu (D3). The sidebar is the map of business modules, so the
 * screen of the signed-in account is reachable only from here.
 *
 * "Cerrar sesión" stays in the sidebar footer as a single, always-visible
 * control: it is the placement T1 pinned with a test, and duplicating the
 * control inside the menu would give the same action two different lifetimes.
 */
export function UserMenu({ user, onOpenProfile }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (container.current && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const fullName = `${user.nombre} ${user.apellido}`;

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded px-2 py-1 text-[12.5px] text-gray-800 hover:bg-gray-100"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
          {user.nombre.charAt(0)}
          {user.apellido.charAt(0)}
        </span>
        <span className="max-w-[180px] truncate">{fullName}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Mi cuenta"
          className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-[12.5px] text-gray-800 hover:bg-gray-100"
            onClick={() => {
              setOpen(false);
              onOpenProfile();
            }}
          >
            Mi perfil
          </button>
        </div>
      )}
    </div>
  );
}
