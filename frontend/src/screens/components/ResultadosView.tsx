import { useState } from "react";
import { Sidebar, selectStyle } from "./SharedLayout";

type EstadoOtp = "Vigente" | "Usado" | "Expirado";

interface Informe {
  id: string;
  analisisId: string;
  paciente: string;
  dni: string;
  tipoAnalisis: string;
  bioquimicoValidador: string;
  fechaValidacion: string;
  fechaExpiracionOtp: string;
  estadoOtp: EstadoOtp;
  whatsappEnviado: boolean;
  hashArchivo: string;
}

const OTP_MAP: Record<EstadoOtp, { bg: string; text: string; dot: string }> = {
  Vigente:  { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
  Usado:    { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" },
  Expirado: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

const INFORMES_MOCK: Informe[] = [
  {
    id: "INF-2026-0004",
    analisisId: "MIC-2026-0338",
    paciente: "Vargas, Diego H.",
    dni: "40.105.887",
    tipoAnalisis: "Micosis ungueal",
    bioquimicoValidador: "Salinas, M.",
    fechaValidacion: "10/09/2026",
    fechaExpiracionOtp: "17/09/2026",
    estadoOtp: "Vigente",
    whatsappEnviado: true,
    hashArchivo: "a3f8c1d2e9b4",
  },
  {
    id: "INF-2026-0003",
    analisisId: "MIC-2026-0337",
    paciente: "Medina, Sofía L.",
    dni: "29.553.314",
    tipoAnalisis: "Micosis profunda",
    bioquimicoValidador: "Fernández, R.",
    fechaValidacion: "09/09/2026",
    fechaExpiracionOtp: "16/09/2026",
    estadoOtp: "Usado",
    whatsappEnviado: true,
    hashArchivo: "b7e2a4f1c830",
  },
  {
    id: "INF-2026-0002",
    analisisId: "MIC-2026-0332",
    paciente: "Herrera, Tomás G.",
    dni: "26.040.516",
    tipoAnalisis: "Micosis profunda",
    bioquimicoValidador: "Salinas, M.",
    fechaValidacion: "05/09/2026",
    fechaExpiracionOtp: "12/09/2026",
    estadoOtp: "Expirado",
    whatsappEnviado: true,
    hashArchivo: "d9c3b5e7f210",
  },
  {
    id: "INF-2026-0001",
    analisisId: "MIC-2026-0327",
    paciente: "Ríos, Lorena A.",
    dni: "30.199.340",
    tipoAnalisis: "Micosis profunda",
    bioquimicoValidador: "Fernández, R.",
    fechaValidacion: "01/09/2026",
    fechaExpiracionOtp: "08/09/2026",
    estadoOtp: "Expirado",
    whatsappEnviado: true,
    hashArchivo: "f1a9d4c2b670",
  },
];

function OtpPill({ estado }: { estado: EstadoOtp }) {
  const s = OTP_MAP[estado];
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
        background: s.bg,
        color: s.text,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      OTP {estado}
    </span>
  );
}

export function ResultadosView({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [filtroOtp, setFiltroOtp] = useState<string>("");
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  const filtered = INFORMES_MOCK.filter((inf) => !filtroOtp || inf.estadoOtp === filtroOtp);

  const counts = INFORMES_MOCK.reduce<Record<string, number>>((acc, inf) => {
    acc[inf.estadoOtp] = (acc[inf.estadoOtp] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--font-sans)" }}>
      <Sidebar activePage="Resultados" onNavigate={onNavigate} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f4f5f7" }}>
        {/* Header */}
        <header
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            padding: "0 24px",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>Laboratorio</span>
            <span style={{ color: "#d1d5db" }}>/</span>
            <span style={{ color: "#111827", fontWeight: 600, fontSize: 13 }}>Resultados — Informes Emitidos</span>
          </div>
        </header>

        {/* Estado OTP summary strip */}
        <div
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            padding: "0 24px",
            display: "flex",
            gap: 0,
            flexShrink: 0,
          }}
        >
          {(["Vigente", "Usado", "Expirado"] as EstadoOtp[]).map((key) => {
            const s = OTP_MAP[key];
            const active = filtroOtp === key;
            return (
              <button
                key={key}
                onClick={() => setFiltroOtp(active ? "" : key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  background: active ? s.bg : "transparent",
                  border: "none",
                  borderBottom: active ? `2px solid ${s.dot}` : "2px solid transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  color: active ? s.text : "#6b7280",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />
                OTP {key}
                <span
                  style={{
                    background: active ? s.dot : "#e5e7eb",
                    color: active ? "#fff" : "#6b7280",
                    borderRadius: 10,
                    padding: "0 5px",
                    fontSize: 10,
                    fontWeight: 600,
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {counts[key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, marginRight: 2 }}>Filtros:</span>
          <select
            value={filtroOtp}
            onChange={(e) => setFiltroOtp(e.target.value)}
            style={selectStyle}
          >
            <option value="">Estado OTP — Todos</option>
            <option value="Vigente">Vigente</option>
            <option value="Usado">Usado</option>
            <option value="Expirado">Expirado</option>
          </select>

          {filtroOtp && (
            <button
              onClick={() => setFiltroOtp("")}
              style={{
                padding: "4px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                background: "#f9fafb",
                color: "#6b7280",
                fontSize: 11.5,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              × Limpiar
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#9ca3af" }}>
            {filtered.length} de {INFORMES_MOCK.length} informes
          </span>
        </div>

        {/* Notice: portal externo */}
        <div
          style={{
            background: "#eff6ff",
            borderBottom: "1px solid #bfdbfe",
            padding: "7px 24px",
            fontSize: 11.5,
            color: "#1e40af",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 700 }}>ℹ</span>
          El paciente descarga su informe desde el portal externo ingresando DNI + OTP. Solo 1 descarga válida por OTP (TTL 7 días).
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 140 }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: 148 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 128 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 74 }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 }}>
                {[
                  "N.º Informe",
                  "Paciente",
                  "N.º Análisis",
                  "Tipo de Análisis",
                  "Bioquímico Validador",
                  "Fecha Validación",
                  "Exp. OTP",
                  "Estado OTP",
                  "WhatsApp",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "0 12px",
                      height: 34,
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b7280",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      borderBottom: "1px solid #e5e7eb",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inf, i) => {
                const isSelected = selectedRow === inf.id;
                return (
                  <tr
                    key={inf.id}
                    onClick={() => setSelectedRow(isSelected ? null : inf.id)}
                    style={{
                      height: 36,
                      borderBottom: "1px solid #f3f4f6",
                      background: isSelected ? "#eff6ff" : i % 2 === 0 ? "#ffffff" : "#fafafa",
                      cursor: "pointer",
                    }}
                  >
                    {/* N.º Informe */}
                    <td style={{ padding: "0 12px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#2563eb", fontWeight: 600 }}>
                        {inf.id}
                      </span>
                    </td>

                    {/* Paciente */}
                    <td style={{ padding: "0 12px" }}>
                      <span style={{ fontWeight: 500, color: "#111827" }}>{inf.paciente}</span>
                      <span style={{ marginLeft: 7, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#9ca3af" }}>
                        {inf.dni}
                      </span>
                    </td>

                    {/* N.º Análisis */}
                    <td style={{ padding: "0 12px" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate("Análisis"); }}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "#6b7280",
                          textDecoration: "underline",
                        }}
                      >
                        {inf.analisisId}
                      </button>
                    </td>

                    {/* Tipo de análisis */}
                    <td style={{ padding: "0 12px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inf.tipoAnalisis}
                    </td>

                    {/* Bioquímico */}
                    <td style={{ padding: "0 12px", color: "#374151" }}>{inf.bioquimicoValidador}</td>

                    {/* Fecha validación */}
                    <td style={{ padding: "0 12px", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#6b7280" }}>
                      {inf.fechaValidacion}
                    </td>

                    {/* Expiración OTP */}
                    <td style={{ padding: "0 12px", fontFamily: "var(--font-mono)", fontSize: 11.5, color: inf.estadoOtp === "Expirado" ? "#ef4444" : "#6b7280" }}>
                      {inf.fechaExpiracionOtp}
                    </td>

                    {/* Estado OTP */}
                    <td style={{ padding: "0 12px" }}>
                      <OtpPill estado={inf.estadoOtp} />
                    </td>

                    {/* WhatsApp */}
                    <td style={{ padding: "0 12px", textAlign: "center" }}>
                      {inf.whatsappEnviado ? (
                        <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }} title="Notificación enviada">✓</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#9ca3af" }} title="Sin notificación">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "48px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                    No hay informes para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail row (audit info) */}
        {selectedRow && (() => {
          const inf = INFORMES_MOCK.find((i) => i.id === selectedRow)!;
          return (
            <div
              style={{
                background: "#ffffff",
                borderTop: "2px solid #e5e7eb",
                padding: "12px 24px",
                display: "flex",
                alignItems: "center",
                gap: 32,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              <div>
                <span style={{ color: "#9ca3af", fontSize: 11 }}>Hash de integridad</span>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#374151", marginTop: 2 }}>
                  SHA-256: {inf.hashArchivo}…
                </div>
              </div>
              <div>
                <span style={{ color: "#9ca3af", fontSize: 11 }}>Informe PDF</span>
                <div style={{ marginTop: 2 }}>
                  <button
                    style={{
                      padding: "3px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: 3,
                      background: "#f9fafb",
                      fontSize: 11.5,
                      cursor: "pointer",
                      color: "#374151",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Ver auditoría de descarga
                  </button>
                </div>
              </div>
              {inf.estadoOtp === "Expirado" && (
                <div style={{ marginLeft: "auto" }}>
                  <button
                    style={{
                      padding: "5px 14px",
                      border: "1px solid #fca5a5",
                      borderRadius: 3,
                      background: "#fff1f2",
                      fontSize: 12,
                      cursor: "pointer",
                      color: "#991b1b",
                      fontWeight: 600,
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Regenerar OTP ⚠ (requiere confirmación)
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Pagination footer */}
        <div
          style={{
            background: "#ffffff",
            borderTop: "1px solid #e5e7eb",
            padding: "6px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11.5, color: "#9ca3af" }}>
            Mostrando 1–{filtered.length} de {filtered.length} resultados
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              style={{
                width: 28,
                height: 26,
                border: "1px solid #2563eb",
                borderRadius: 3,
                background: "#eff6ff",
                color: "#2563eb",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
              }}
            >
              1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
