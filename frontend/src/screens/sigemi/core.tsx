import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Btn, Banner, Empty, TONES, type Tone } from "../components/ui";

/* ─── Tiny external store ───────────────────────────────── */
export function createStore<T>(initial: T) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (fn: (s: T) => T) => {
      state = fn(state);
      subs.forEach((s) => s());
    },
    use: (): T =>
      useSyncExternalStore(
        (cb) => {
          subs.add(cb);
          return () => subs.delete(cb);
        },
        () => state,
      ),
  };
}

/* ─── Sesión real (GET /auth/me) mapeada a los roles del prototipo ── */
export type Rol = "Bioquímico/Doctor" | "Profesor" | "Administrador";

/** Códigos del catálogo cerrado de nivel 3 → etiqueta del prototipo. */
export const ROL_LABELS: Record<string, Rol> = {
  administrador: "Administrador",
  bioquimico: "Bioquímico/Doctor",
  profesor: "Profesor",
};

/** Precedencia cuando el usuario acumula roles: se usa el más amplio. */
const ROL_RANK: Record<Rol, number> = {
  Administrador: 3,
  "Bioquímico/Doctor": 2,
  Profesor: 1,
};

export interface SesionUI {
  nombre: string;
  iniciales: string;
  roles: Rol[];
}

export const sessionStore = createStore<SesionUI>({ nombre: "—", iniciales: "—", roles: [] });

/** Aplica el usuario autenticado a la sesión que leen las pantallas. */
export function setSesion(usuario: { nombre: string; apellido: string; roles: string[] }) {
  const roles = usuario.roles.map((r) => ROL_LABELS[r]).filter((r): r is Rol => Boolean(r));
  const nombre = `${usuario.apellido}, ${usuario.nombre}`;
  const iniciales = `${usuario.nombre.charAt(0)}${usuario.apellido.charAt(0)}`.toUpperCase();
  sessionStore.set(() => ({ nombre, iniciales, roles: roles.length ? roles : ["Profesor"] }));
}

export function useSesion(): SesionUI {
  return sessionStore.use();
}

/** Rol efectivo: el más amplio de los que tiene el usuario. */
export const useRol = (): Rol => {
  const { roles } = useSesion();
  return [...roles].sort((a, b) => ROL_RANK[b] - ROL_RANK[a])[0] ?? "Profesor";
};

export const currentUser = () => sessionStore.get().nombre;

/* Páginas visibles por rol (§3, §5.6) */
export const PAGES_BY_ROLE: Record<Rol, string[] | "all"> = {
  Administrador: "all",
  "Bioquímico/Doctor": [
    "Panel de Control", "Agenda y Turnos", "Pacientes", "Análisis", "Resultados",
    "Insumos y Stock", "Control de Residuos", "Reportes y Estadísticas",
  ],
  Profesor: ["Insumos y Stock", "Control de Residuos"],
};
export const canSee = (roles: Rol | Rol[], page: string) => {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((rol) => {
    const p = PAGES_BY_ROLE[rol];
    return p === "all" || p.includes(page);
  });
};

/* ─── Fecha "hoy" del prototipo ─────────────────────────── */
export const HOY = new Date(2026, 9, 19, 11, 20);
export const parseDate = (s: string) => {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, m - 1, d);
};
export const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
export const isoToAr = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");
export const arToIso = (ar: string) => (ar ? ar.split("/").reverse().join("-") : "");
export const nowStamp = () => {
  const d = new Date();
  return { fecha: fmtDate(HOY), hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
};
export const num = (n: number, dec = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/* ─── Auditoría global ──────────────────────────────────── */
export type AccionAud =
  | "CREAR" | "MODIFICAR" | "DESACTIVAR" | "CANCELAR" | "VALIDAR" | "INGRESO" | "RETIRO"
  | "DEVOLUCION" | "DISPOSICION" | "LOGIN" | "LOGOUT" | "EXPORTAR";
export interface EventoAud {
  /** Backend rows carry a UUID; demo rows carry a small number, both as text. */
  id: string;
  fecha: string;
  hora: string;
  usuario: string;
  /** The audit event does not store the role; it stays absent for real rows. */
  rol?: Rol;
  ip: string;
  modulo: string;
  accion: string;
  entidad: string;
  entidadId: string;
  resumen: string;
  cambios: { campo: string; antes: string; despues: string }[];
}
export const AUD_TONE: Record<string, Tone> = {
  CREAR: "green", MODIFICAR: "blue", DESACTIVAR: "red", CANCELAR: "red", VALIDAR: "violet",
  INGRESO: "green", RETIRO: "red", DEVOLUCION: "blue", DISPOSICION: "teal", LOGIN: "gray",
  LOGOUT: "gray", EXPORTAR: "dark",
  // Closed catalog of `accion_auditoria` in level 3.
  ELIMINAR: "red", CONSULTAR: "gray", ACCEDER: "dark", BLOQUEAR: "amber",
};
const USR_ROL: Record<string, Rol> = {
  "Benítez, Laura": "Administrador",
  "Ramírez, Claudia B.": "Bioquímico/Doctor",
  "Sosa, Martín": "Profesor",
  "Ferreyra, Ana": "Bioquímico/Doctor",
};
const IP: Record<string, string> = {
  "Benítez, Laura": "192.168.1.45",
  "Ramírez, Claudia B.": "192.168.1.22",
  "Sosa, Martín": "192.168.1.31",
  "Ferreyra, Ana": "192.168.1.27",
};
type Seed = [string, string, string, string, AccionAud, string, string, string, [string, string, string][]?];
const SEED_AUD: Seed[] = [
  ["19/10/2026", "11:20:04", "Benítez, Laura", "Residuos", "DISPOSICION", "DisposicionFinal", "R-2026-016, R-2026-011", "2 residuos dispuestos (950 ml)", [["estado", "Generado", "Dispuesto"], ["metodo", "—", "Recolección externa"]]],
  ["19/10/2026", "10:42:18", "Ramírez, Claudia B.", "Residuos", "CREAR", "ResiduoQuimico", "R-2026-018", "Alta de residuo — Clase I — Ácidos, 250 ml / 180 g", [["categoria", "—", "Clase I — Ácidos"], ["volumen", "—", "250 ml"], ["peso", "—", "180 g"], ["origen", "—", "MIC-2026-0042"], ["estado", "—", "Generado"]]],
  ["19/10/2026", "09:15:40", "Ramírez, Claudia B.", "Análisis", "VALIDAR", "AnalisisMicologico", "MIC-2026-0042", "Validación de análisis", [["estado", "En Proceso", "Terminado y validado"]]],
  ["19/10/2026", "08:30:02", "Benítez, Laura", "Seguridad", "LOGIN", "Usuario", "3", "Inicio de sesión exitoso"],
  ["19/10/2026", "08:12:11", "Ramírez, Claudia B.", "Seguridad", "LOGIN", "Usuario", "1", "Inicio de sesión exitoso"],
  ["19/10/2026", "07:58:47", "Sosa, Martín", "Seguridad", "LOGIN", "Usuario", "2", "Inicio de sesión exitoso"],
  ["18/10/2026", "17:40:33", "Ramírez, Claudia B.", "Análisis", "MODIFICAR", "AnalisisMicologico", "MIC-2026-0042", "Hallazgo agregado", [["hallazgos", "1 registro", "2 registros"]]],
  ["18/10/2026", "16:10:05", "Sosa, Martín", "Residuos", "CREAR", "ResiduoQuimico", "R-2026-017", "Alta de residuo — Clase II — Solventes, 500 ml / 420 g", [["categoria", "—", "Clase II — Solventes orgánicos"], ["volumen", "—", "500 ml"], ["peso", "—", "420 g"]]],
  ["18/10/2026", "11:02:19", "Sosa, Martín", "Insumos", "RETIRO", "MovimientoInsumo", "M-0213", "Retiro de 40 unidades de Guantes nitrilo M — Práctica 3", [["stock", "1.240 unidades", "1.200 unidades"]]],
  ["18/10/2026", "10:05:51", "Ramírez, Claudia B.", "Análisis", "VALIDAR", "AnalisisMicologico", "MIC-2026-0038", "Validación de análisis", [["estado", "En Proceso", "Terminado y validado"]]],
  ["18/10/2026", "09:12:30", "Ramírez, Claudia B.", "Reportes", "EXPORTAR", "Reporte", "RPT-0045", "Reporte de inventario exportado (PDF)"],
  ["17/10/2026", "15:44:02", "Benítez, Laura", "Insumos", "INGRESO", "Lote", "GN-2610", "Ingreso de 500 unidades de Guantes nitrilo M (lote GN-2610)", [["stock", "740 unidades", "1.240 unidades"]]],
  ["17/10/2026", "09:05:13", "Ramírez, Claudia B.", "Residuos", "CREAR", "ResiduoQuimico", "R-2026-016", "Alta de residuo — Clase I — Ácidos, 750 ml / 610 g"],
  ["16/10/2026", "18:20:00", "Ferreyra, Ana", "Seguridad", "LOGIN", "Usuario", "5", "Intento fallido — usuario bloqueado temporalmente", [["intentos_fallidos", "4", "5"], ["estado", "Activo", "Bloqueado Temporal"]]],
  ["16/10/2026", "12:31:45", "Benítez, Laura", "Usuarios", "DESACTIVAR", "Usuario", "4", "Baja de Gómez, Pablo — Egreso del laboratorio", [["estado", "Activo", "Inactivo"]]],
  ["15/10/2026", "16:40:12", "Benítez, Laura", "Reportes", "EXPORTAR", "Reporte", "RPT-0044", "Reporte de residuos Septiembre 2026 (PDF)"],
  ["15/10/2026", "14:02:58", "Ramírez, Claudia B.", "Insumos", "RETIRO", "MovimientoInsumo", "M-0210", "Retiro de 150 g de Agar Sabouraud — MIC-2026-0042", [["stock", "1.000 g", "850 g"]]],
  ["15/10/2026", "11:30:26", "Sosa, Martín", "Residuos", "CREAR", "ResiduoQuimico", "R-2026-015", "Alta de residuo — Clase III — Otros, 120 ml / 95 g"],
  ["14/10/2026", "10:11:09", "Benítez, Laura", "Insumos", "MODIFICAR", "Insumo", "KOH", "Umbral de KOH 20% actualizado", [["umbral_minimo", "200 ml", "250 ml"]]],
  ["13/10/2026", "09:00:41", "Benítez, Laura", "Usuarios", "CREAR", "Usuario", "6", "Alta de usuario Acosta, Julieta (Profesor)", [["rol", "—", "Profesor"], ["estado", "—", "Activo"]]],
  ["12/10/2026", "17:20:16", "Ferreyra, Ana", "Seguridad", "LOGOUT", "Usuario", "5", "Cierre de sesión"],
  ["12/10/2026", "08:45:00", "Ferreyra, Ana", "Seguridad", "LOGIN", "Usuario", "5", "Inicio de sesión exitoso"],
  ["09/10/2026", "10:20:00", "Benítez, Laura", "Residuos", "MODIFICAR", "CategoriaResiduo", "C4", "Baja de categoría Clase I — Metales pesados", [["activo", "true", "false"]]],
];
export const auditStore = createStore<EventoAud[]>(
  SEED_AUD.map((s, i) => ({
    id: String(1842 - i),
    fecha: s[0], hora: s[1], usuario: s[2], rol: USR_ROL[s[2]], ip: IP[s[2]], modulo: s[3], accion: s[4],
    entidad: s[5], entidadId: s[6], resumen: s[7],
    cambios: (s[8] ?? []).map(([campo, antes, despues]) => ({ campo, antes, despues })),
  })),
);
export function logAudit(e: Omit<EventoAud, "id" | "fecha" | "hora" | "usuario" | "rol" | "ip" | "cambios"> & { cambios?: EventoAud["cambios"] }) {
  const d = new Date();
  const { nombre: usuario, roles } = sessionStore.get();
  const rol = roles[0] ?? "Profesor";
  auditStore.set((list) => [
    {
      ...e,
      cambios: e.cambios ?? [],
      // Real rows carry a UUID, so only the demo ids are numeric.
      id: String(
        Math.max(0, ...list.map((x) => Number(x.id)).filter(Number.isFinite)) + 1,
      ),
      fecha: fmtDate(HOY),
      hora: d.toTimeString().slice(0, 8),
      usuario, rol, ip: IP[usuario] ?? "192.168.1.10",
    },
    ...list,
  ]);
}

/* ─── Toasts ────────────────────────────────────────────── */
const toastStore = createStore<{ id: number; text: string; tone: Tone }[]>([]);
export function toast(text: string, tone: Tone = "green") {
  const id = Date.now() + Math.random();
  toastStore.set((t) => [...t, { id, text, tone }]);
  setTimeout(() => toastStore.set((t) => t.filter((x) => x.id !== id)), 4000);
}
export function ToastHost() {
  const list = toastStore.use();
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[70] flex flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex items-center gap-2.5 rounded-md border bg-surface px-4 py-3 text-[12.5px] shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
          style={{ borderColor: TONES[t.tone].dot, borderLeftWidth: 4 }}
        >
          <span className="font-bold" style={{ color: TONES[t.tone].dot }}>{t.tone === "red" || t.tone === "amber" ? "!" : "✓"}</span>
          <span className="text-text-primary">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Drawer derecho 640 px (no tapa el sidebar) ────────── */
export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed top-0 right-0 bottom-0 left-0 z-50 flex justify-end bg-[rgba(17,24,39,0.45)] md:left-[220px]" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[640px] flex-col border-l border-border bg-surface shadow-[-12px_0_40px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-light px-4 py-3 md:px-6 md:py-4">
          <div>
            <h2 className="m-0 text-[15px] font-bold text-text-primary">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="shrink-0 cursor-pointer border-none bg-transparent py-1 text-[12px] text-text-secondary hover:text-text-primary">
            ✕ Cerrar
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-5">{children}</div>
        {footer && <div className="flex items-center justify-between gap-2 border-t border-border-light px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-6 md:pb-3 [&_button]:max-md:h-10">{footer}</div>}
      </aside>
    </div>
  );
}

/* ─── KPI card ──────────────────────────────────────────── */
export function KpiCard({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
}) {
  const c = tone ? TONES[tone].dot : "#d1d5db";
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col gap-1.5 rounded-md border bg-surface px-4 py-3 text-left ${onClick ? "cursor-pointer hover:bg-[#fafafa]" : "cursor-default"} ${active ? "ring-2 ring-[#bfdbfe]" : ""}`}
      style={{ borderColor: active ? "#2563eb" : "#e5e7eb", borderTop: `3px solid ${c}` }}
    >
      <span className="text-[11px] font-semibold tracking-[0.04em] text-text-secondary uppercase">{label}</span>
      <span className="font-mono text-[28px] leading-none font-medium text-text-primary tabular-nums">{value}</span>
      {sub && <span className="text-[11.5px] text-text-muted">{sub}</span>}
    </button>
  );
}

/* ─── Paginación ────────────────────────────────────────── */
export function Pager({ page, total, size, onPage, noun }: { page: number; total: number; size: number; onPage: (p: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const list = pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1) : [...new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))].sort((a, b) => a - b);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-light px-4 py-2.5 text-[12px] text-text-secondary">
      <span>
        Mostrando {from}-{to} de {num(total)} {noun}
      </span>
      <div className="flex items-center gap-1">
        <PgBtn disabled={page === 1} onClick={() => onPage(page - 1)}>◀</PgBtn>
        {list.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - list[i - 1] > 1 && <span className="px-1">…</span>}
            <PgBtn active={p === page} onClick={() => onPage(p)}>{p}</PgBtn>
          </span>
        ))}
        <PgBtn disabled={page === pages} onClick={() => onPage(page + 1)}>▶</PgBtn>
      </div>
    </div>
  );
}
function PgBtn({ children, active, ...rest }: { active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`h-7 min-w-7 cursor-pointer rounded border px-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-accent bg-accent font-semibold text-white" : "border-border-light bg-surface text-text-primary hover:bg-bg"}`}
    >
      {children}
    </button>
  );
}

/* ─── Demo de estados de pantalla (datos/vacío/carga/error) ─ */
export type VistaEstado = "Con datos" | "Vacío" | "Cargando" | "Error";
export function useCarga() {
  const [estado, setEstado] = useState<VistaEstado>("Cargando");
  useEffect(() => {
    const t = setTimeout(() => setEstado((e) => (e === "Cargando" ? "Con datos" : e)), 650);
    return () => clearTimeout(t);
  }, []);
  const reintentar = () => {
    setEstado("Cargando");
    setTimeout(() => setEstado("Con datos"), 650);
  };
  return { estado, setEstado, reintentar };
}
export function EstadoSwitch({ value, onChange }: { value: VistaEstado; onChange: (v: VistaEstado) => void }) {
  const opts: VistaEstado[] = ["Con datos", "Vacío", "Cargando", "Error"];
  return (
    <div className="hidden items-center gap-1 rounded border border-dashed border-border px-1.5 py-1 md:flex" title="Vista previa de estados del prototipo">
      <span className="px-1 text-[10px] font-semibold tracking-[0.06em] text-text-muted uppercase">Estado</span>
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`cursor-pointer rounded border-none px-2 py-0.5 text-[11px] ${value === o ? "bg-[#1e2433] text-white" : "bg-transparent text-text-secondary hover:bg-bg"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
export function Skeleton({ rows = 6, kpis = 0 }: { rows?: number; kpis?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Cargando">
      {kpis > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${kpis}, minmax(0,1fr))` }}>
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="h-[86px] rounded-md bg-[#e5e7eb]" />
          ))}
        </div>
      )}
      <div className="rounded-md border border-border-light bg-surface p-4">
        <div className="mb-3 h-4 w-1/3 rounded bg-[#e5e7eb]" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="mb-2 h-9 rounded bg-[#f3f4f6]" />
        ))}
      </div>
    </div>
  );
}
export function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Banner tone="red" action={<Btn onClick={onRetry}>Reintentar</Btn>}>
        <strong>{text}</strong> Verifique su conexión e intente nuevamente.
      </Banner>
      <div className="rounded-md border border-border-light bg-surface">
        <Empty title="No se pudieron obtener los datos">
          <span className="text-[12px] text-text-secondary">El servidor no respondió dentro del tiempo esperado.</span>
        </Empty>
      </div>
    </div>
  );
}
export function EmptyBox({ icon = "○", title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bg text-[18px] text-text-muted">{icon}</div>
      <div className="text-[14px] font-semibold text-text-primary">{title}</div>
      {text && <div className="max-w-[420px] text-[12.5px] text-text-secondary">{text}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ─── Varios ────────────────────────────────────────────── */
export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">{label}</span>
      <span className="text-[13px] text-text-primary">{children}</span>
    </div>
  );
}
export function Radio({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-text-primary">
      <input type="radio" checked={checked} onChange={onChange} className="accent-accent" />
      {children}
    </label>
  );
}
export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] whitespace-nowrap text-text-primary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {children}
    </label>
  );
}
export const selCls =
  "h-8 rounded border border-border bg-surface px-2 text-[12.5px] text-text-primary outline-none focus:border-accent";
export function NoAccess({ onNavigate }: { onNavigate: (p: string) => void }) {
  const rol = useRol();
  return (
    <EmptyBox
      icon="⊘"
      title="No tiene permisos para acceder a esta sección"
      text={`Su rol (${rol}) no habilita esta pantalla. Si necesita acceso, consulte con el Administrador.`}
      action={<Btn variant="primary" onClick={() => onNavigate("Insumos y Stock")}>Ir a Insumos y Stock</Btn>}
    />
  );
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Historial de reportes (compartido) ────────────────── */
export interface ReporteGen {
  id: string; fecha: string; hora: string; tipo: "Clínico" | "Inventario" | "Residuos" | "Operativo";
  periodo: string; usuario: string; formato: "CSV" | "XLSX" | "PDF"; registros: number;
  estado: "Generando" | "Listo" | "Error"; filtros: string;
}
export const reportStore = createStore<ReporteGen[]>([
  { id: "RPT-0046", fecha: "19/10/2026", hora: "11:35", tipo: "Clínico", periodo: "01/09/2026 — 30/09/2026", usuario: "Benítez, Laura", formato: "XLSX", registros: 142, estado: "Listo", filtros: "Estado: Validado" },
  { id: "RPT-0045", fecha: "18/10/2026", hora: "09:12", tipo: "Inventario", periodo: "01/10/2026 — 18/10/2026", usuario: "Ramírez, Claudia B.", formato: "PDF", registros: 42, estado: "Listo", filtros: "Todas las categorías" },
  { id: "RPT-0044", fecha: "15/10/2026", hora: "16:40", tipo: "Residuos", periodo: "Septiembre 2026", usuario: "Benítez, Laura", formato: "PDF", registros: 18, estado: "Listo", filtros: "Reporte mensual consolidado" },
  { id: "RPT-0043", fecha: "02/10/2026", hora: "10:05", tipo: "Operativo", periodo: "01/09/2026 — 30/09/2026", usuario: "Ramírez, Claudia B.", formato: "CSV", registros: 0, estado: "Error", filtros: "Turnos por estado" },
  { id: "RPT-0042", fecha: "01/10/2026", hora: "08:30", tipo: "Clínico", periodo: "01/08/2026 — 31/08/2026", usuario: "Ramírez, Claudia B.", formato: "CSV", registros: 128, estado: "Listo", filtros: "Tipo de muestra: Uñas" },
]);
export function addReporte(r: Omit<ReporteGen, "id" | "fecha" | "hora" | "usuario" | "estado">) {
  const list = reportStore.get();
  const id = `RPT-${String(Number(list[0]?.id.slice(4) ?? 0) + 1).padStart(4, "0")}`;
  const st = nowStamp();
  reportStore.set((l) => [{ ...r, id, ...st, usuario: currentUser(), estado: "Generando" }, ...l]);
  setTimeout(() => reportStore.set((l) => l.map((x) => (x.id === id ? { ...x, estado: "Listo" } : x))), 1800);
  logAudit({ modulo: "Reportes", accion: "EXPORTAR", entidad: "Reporte", entidadId: id, resumen: `Reporte ${r.tipo.toLowerCase()} ${r.periodo} (${r.formato})` });
  return id;
}
