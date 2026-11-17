import type { ReactNode } from "react";

export const areaCls =
  "w-full rounded border border-border bg-surface px-2.5 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-[#bfdbfe] disabled:bg-bg";

export type SectionStatus = "locked" | "active" | "done";

/** Sección numerada de un formulario progresivo. Bloqueada: solo encabezado + motivo. */
export function Section({
  n,
  title,
  subtitle,
  status,
  lockedHint,
  children,
  id,
}: {
  n: number;
  title: string;
  subtitle?: string;
  status: SectionStatus;
  lockedHint?: string;
  children: ReactNode;
  id?: string;
}) {
  const locked = status === "locked";
  return (
    <section
      id={id}
      className={`scroll-mt-4 rounded-md border bg-surface transition-colors ${locked ? "border-dashed border-border-light bg-transparent" : status === "active" ? "border-accent/50 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]" : "border-border-light"}`}
    >
      <header className={`flex items-center gap-3 px-4 py-3 ${locked ? "" : "border-b border-border-light"}`}>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
            status === "done" ? "bg-validado-text text-white" : status === "active" ? "bg-accent text-white" : "bg-border-light text-text-muted"
          }`}
        >
          {status === "done" ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`m-0 text-[13px] font-bold ${locked ? "text-text-muted" : "text-text-primary"}`}>{title}</h3>
          {(locked ? lockedHint : subtitle) && <p className="m-0 mt-0.5 text-[11.5px] text-text-muted">{locked ? lockedHint : subtitle}</p>}
        </div>
        {status === "done" && <span className="text-[11px] font-semibold text-validado-text">Completo</span>}
        {locked && <span className="text-[11px] font-semibold text-text-muted">Bloqueado</span>}
      </header>
      {!locked && <div className="p-4">{children}</div>}
    </section>
  );
}

/** Selector segmentado (radio con aspecto de botones). */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  tones,
  disabled,
}: {
  value: T | "";
  options: readonly T[];
  onChange: (v: T) => void;
  tones?: Partial<Record<T, string>>;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap overflow-hidden rounded border border-border">
      {options.map((o, i) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o)}
            className={`h-8 cursor-pointer px-3 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-60 ${i > 0 ? "border-l border-border" : ""} ${
              on ? `${tones?.[o] ?? "bg-accent text-white"} font-semibold` : "bg-surface text-text-primary hover:bg-bg"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Grilla de casillas de verificación. */
export function CheckGrid({
  items,
  value,
  onChange,
  cols = 2,
  disabled,
}: {
  items: string[];
  value: string[];
  onChange: (v: string[]) => void;
  cols?: number;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it) => {
        const on = value.includes(it);
        return (
          <label key={it} className={`flex items-center gap-2 rounded px-1.5 py-1 text-[12.5px] ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-bg"} ${on ? "font-medium text-text-primary" : "text-text-secondary"}`}>
            <input
              type="checkbox"
              className="accent-accent"
              checked={on}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked ? [...value, it] : value.filter((x) => x !== it))}
            />
            {it}
          </label>
        );
      })}
    </div>
  );
}

/** Etiqueta de grupo pequeña. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[10.5px] font-bold tracking-[0.07em] text-text-muted uppercase">{children}</div>;
}
