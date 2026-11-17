import { useState } from "react";
import { canSee, useRol, useSesion } from "../sigemi/core";
import type { Ficha, Hallazgo, Resultado, Revision } from "./clinica";

/* ─── Types ─────────────────────────────────────────────── */
export type Estado =
  | "Pendiente"
  | "En Proceso"
  | "Terminado y validado"
  | "Cancelado";

// Superficiales: Uñas / Cabello / Piel. Profundas: material clínico (Esputo, BAL, Biopsia…).
export type TipoMuestra = "Uñas" | "Cabello" | "Piel" | (string & {});
export type TipoAnalisis = "Micosis ungueal" | "Micosis superficial" | "Micosis profunda";

export interface Analisis {
  id: string;
  paciente: string;
  dni: string;
  tipoMuestra: TipoMuestra;
  tipoAnalisis: TipoAnalisis;
  estado: Estado;
  fechaIngreso: string;
  bioquimico: string;
  hallazgos?: Hallazgo[];
  revisiones?: Revision[];
  ficha?: Ficha;
  resultado?: Resultado;
}

export interface Turno {
  id: string;
  hora: string;
  paciente: string;
  dni: string;
  tipoAnalisis: TipoAnalisis;
  recurso: string;
  estado: "Pendiente" | "Confirmado" | "Atendido" | "No Asistió" | "Cancelado";
}

/* ─── Shared Styles ─────────────────────────────────────── */
export const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid #e5e7eb",
  borderRadius: 4,
  background: "#f9fafb",
  color: "#374151",
  fontSize: 12,
  outline: "none",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  height: 28,
};

/* ─── Status pill & Badges ──────────────────────────────── */
export const STATUS_MAP: Record<Estado, { bg: string; text: string; dot: string; label: string }> = {
  Pendiente:   { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af",  label: "Pendiente" },
  "En Proceso":{ bg: "#fef3c7", text: "#92400e", dot: "#f59e0b",  label: "En Proceso" },
  "Terminado y validado": { bg: "#d1fae5", text: "#065f46", dot: "#10b981", label: "Terminado y validado" },
  Cancelado:   { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444",  label: "Cancelado" },
};

export function StatusPill({ estado }: { estado: Estado }) {
  const s = STATUS_MAP[estado];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.02em",
        background: s.bg,
        color: s.text,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

export const MUESTRA_COLORS: Record<string, { bg: string; text: string }> = {
  "Uñas": { bg: "#f0fdf4", text: "#166534" },
  "Cabello": { bg: "#fff7ed", text: "#9a3412" },
  "Piel": { bg: "#faf5ff", text: "#6b21a8" },
};

export function MuestraBadge({ tipo }: { tipo: string }) {
  const c = MUESTRA_COLORS[tipo] ?? { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 2,
        fontSize: 11,
        fontWeight: 500,
        background: c.bg,
        color: c.text,
      }}
    >
      {tipo}
    </span>
  );
}

/* ─── Shared Sidebar Component ──────────────────────────── */
export function Sidebar({
  activePage,
  onNavigate,
  onLogout,
}: {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void;
}) {
  const NAV: { label: string; items: { icon: string; label: string; subPages?: string[] }[] }[] = [
    {
      label: "Principal",
      items: [
        { icon: "⬡", label: "Panel de Control" },
        { icon: "◫", label: "Agenda y Turnos" },
        { icon: "◻", label: "Pacientes" },
      ],
    },
    {
      label: "Laboratorio",
      items: [
        { icon: "◈", label: "Análisis", subPages: ["Detalle de Análisis", "Ficha Clínica", "Carga de Resultados"] },
        { icon: "◱", label: "Resultados" },
      ],
    },
    {
      label: "Insumos",
      items: [
        { icon: "▦", label: "Insumos y Stock" },
        { icon: "⚗", label: "Control de Residuos" },
      ],
    },
    {
      label: "Reportes",
      items: [{ icon: "▤", label: "Reportes y Estadísticas" }],
    },
    {
      label: "Administración",
      items: [
        { icon: "◎", label: "Usuarios y Roles" },
        { icon: "⊙", label: "Auditoría" },
      ],
    },
  ];

  const rol = useRol();
  const me = useSesion();
  const [menu, setMenu] = useState(false);
  const visibleNav = NAV.map((s) => ({ ...s, items: s.items.filter((i) => canSee(me.roles.length ? me.roles : rol, i.label)) })).filter((s) => s.items.length);

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "#1e2433",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #2d3650",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #2d3650" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.5px",
            }}
          >
            S
          </div>
          <div>
            <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 13, letterSpacing: "0.03em" }}>SIGEMI</div>
            <div style={{ color: "#6b7587", fontSize: 10, marginTop: 1 }}>Lab. Micología · UNaM</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "8px 0" }}>
        {visibleNav.map((section) => (
          <div key={section.label} style={{ marginBottom: 4 }}>
            <div
              style={{
                padding: "8px 16px 4px",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#6b7587",
              }}
            >
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive = activePage === item.label || (item.subPages?.includes(activePage) ?? false);
              return (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.label)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    width: "100%",
                    padding: "7px 16px",
                    background: isActive ? "#2d3650" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: isActive ? "#ffffff" : "#c9d1e0",
                    fontSize: 12.5,
                    fontWeight: isActive ? 600 : 400,
                    textAlign: "left",
                    borderLeft: isActive ? "2px solid #2563eb" : "2px solid transparent",
                    transition: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#262d42";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: 14, opacity: 0.7 }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ position: "relative", padding: "10px 12px", borderTop: "1px solid #2d3650" }}>
        {menu && (
          <div style={{ position: "absolute", bottom: "100%", left: 8, right: 8, background: "#262d42", border: "1px solid #3a4462", borderRadius: 6, padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
            <div style={{ padding: "6px 8px", fontSize: 10, color: "#6b7587", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Roles asignados</div>
            {(me.roles.length ? me.roles : [rol]).map((r) => (
              <div key={r} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", color: "#e5e7eb", fontSize: 12 }}>
                {r}
              </div>
            ))}
            {onLogout && (
              <button
                onClick={() => {
                  setMenu(false);
                  onLogout();
                }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", marginTop: 2, borderTop: "1px solid #3a4462", borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", color: "#fca5a5", fontSize: 12 }}
              >
                Cerrar sesión
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => setMenu((m) => !m)}
          title="Sesión actual"
          aria-label="Abrir menú de sesión"
          aria-expanded={menu}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 4, textAlign: "left" }}
        >
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#374151", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9d1e0", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {me.iniciales}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 500 }}>{me.nombre}</div>
            <div style={{ color: "#6b7587", fontSize: 10.5 }}>{rol}</div>
          </div>
          <span style={{ color: "#6b7587", fontSize: 10 }}>⇅</span>
        </button>
      </div>
    </aside>
  );
}
