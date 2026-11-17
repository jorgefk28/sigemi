import { useState, type ReactNode } from "react";
import { Sidebar } from "./SharedLayout";

/* ─── Page shell: sidebar + header + scrollable body ────── */
export function PageShell({
  activePage,
  onNavigate,
  section,
  title,
  actions,
  children,
}: {
  activePage: string;
  onNavigate: (page: string) => void;
  section: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [nav, setNav] = useState(false);
  return (
    <div className="flex h-dvh overflow-hidden font-sans">
      {/* Escritorio: sidebar fijo. Móvil: menú desplegable */}
      <div className="hidden md:flex">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
      </div>
      {nav && (
        <div className="fixed inset-0 z-[60] flex md:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div className="absolute inset-0 bg-[rgba(17,24,39,0.55)]" onClick={() => setNav(false)} />
          <div className="relative flex h-full shadow-[12px_0_40px_rgba(0,0,0,0.3)]">
            <Sidebar activePage={activePage} onNavigate={(p) => { setNav(false); onNavigate(p); }} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-light bg-surface px-3 py-2 md:h-12 md:flex-nowrap md:px-6 md:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none">
            <button
              onClick={() => setNav(true)}
              aria-label="Abrir menú"
              className="-ml-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-[18px] text-text-primary hover:bg-bg md:hidden"
            >
              ☰
            </button>
            <span className="hidden text-xs text-text-muted sm:inline">{section}</span>
            <span className="hidden text-border sm:inline">/</span>
            <span className="truncate text-[14px] font-semibold text-text-primary md:text-[13px]">{title}</span>
          </div>
          {actions && (
            <div className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-2 overflow-x-auto px-3 md:mx-0 md:w-auto md:overflow-visible md:px-0">{actions}</div>
          )}
        </header>
        <main className="flex-1 overflow-auto p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}

/* ─── Buttons ───────────────────────────────────────────── */
type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover border border-accent",
  secondary: "bg-surface text-text-primary border border-border hover:bg-bg",
  danger: "bg-surface text-cancelado-text border border-[#fca5a5] hover:bg-cancelado-bg",
  ghost: "bg-transparent text-accent border border-transparent hover:underline px-0",
};
export function Btn({
  variant = "secondary",
  children,
  className = "",
  ...rest
}: { variant?: BtnVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded px-3.5 text-[12.5px] font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${BTN[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Panel / card ──────────────────────────────────────── */
export function Panel({
  title,
  meta,
  footer,
  children,
  className = "",
  flush = false,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`flex flex-col rounded-md border border-border-light bg-surface ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-border-light px-4 py-2.5">
          <h3 className="m-0 text-[11px] font-bold tracking-[0.06em] text-pendiente-text uppercase">{title}</h3>
          {meta && <div className="text-[11px] text-text-muted">{meta}</div>}
        </div>
      )}
      <div className={`flex-1 ${flush ? "" : "p-4"}`}>{children}</div>
      {footer && <div className="border-t border-border-light px-4 py-2.5">{footer}</div>}
    </section>
  );
}

/* ─── KPI number ────────────────────────────────────────── */
export function Kpi({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        {tone && <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />}
        {label}
      </div>
      <div className="font-mono text-[26px] leading-none font-medium text-text-primary tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-text-muted">{sub}</div>}
    </div>
  );
}

/* ─── Generic pill ──────────────────────────────────────── */
export const TONES = {
  gray: { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
  amber: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  blue: { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  green: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  red: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  violet: { bg: "#ede9fe", text: "#5b21b6", dot: "#8b5cf6" },
  dark: { bg: "#e5e7eb", text: "#1f2937", dot: "#374151" },
  orange: { bg: "#ffedd5", text: "#9a3412", dot: "#f97316" },
  teal: { bg: "#ccfbf1", text: "#115e59", dot: "#0d9488" },
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[11px] font-medium tracking-[0.02em] whitespace-nowrap"
      style={{ background: t.bg, color: t.text }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.dot }} />
      {children}
    </span>
  );
}

/* ─── Table primitives ──────────────────────────────────── */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-[#f9fafb]">
            {head.map((h, i) => (
              <th
                key={i}
                className="border-b border-border px-4 py-2 text-left text-[10.5px] font-semibold tracking-[0.06em] whitespace-nowrap text-text-secondary uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const tr = "border-b border-border-light hover:bg-[#f9fafb]";
export const td = "px-4 py-2.5 align-middle text-text-primary";
export const tdMono = "px-4 py-2.5 align-middle font-mono text-[12px] text-text-primary";

/* ─── Form controls ─────────────────────────────────────── */
export const inputCls =
  "h-8 w-full rounded border border-border bg-surface px-2.5 text-[12.5px] text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-[#bfdbfe]";

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-[0.04em] text-pendiente-text uppercase">
        {label}
        {required && <span className="ml-0.5 text-cancelado-text">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-[11px] text-cancelado-text">{error}</span>
      ) : (
        hint && <span className="text-[11px] text-text-muted">{hint}</span>
      )}
    </label>
  );
}

/* ─── Banners, empty states, modal ──────────────────────── */
export function Banner({ tone, children, action }: { tone: Tone; children: ReactNode; action?: ReactNode }) {
  const t = TONES[tone];
  return (
    <div
      className="flex items-center justify-between gap-3 rounded border-l-4 px-4 py-2.5 text-[12.5px]"
      style={{ background: t.bg, color: t.text, borderLeftColor: t.dot }}
    >
      <div>{children}</div>
      {action}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="text-[13px] font-semibold text-pendiente-text">{title}</div>
      {children}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 480,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(17,24,39,0.55)] md:items-center md:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-border bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.25)] md:max-h-[90vh] md:rounded-md"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-light px-5 py-3">
          <h2 className="m-0 text-[14px] font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-lg leading-none text-text-muted">
            ×
          </button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border-light px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:pb-3 [&_button]:max-md:h-10">{footer}</div>}
      </div>
    </div>
  );
}

export function SegTabs<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex border-b border-border-light">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-4 py-2 text-[12.5px] ${
            value === o ? "border-accent font-semibold text-text-primary" : "border-transparent text-text-secondary"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
