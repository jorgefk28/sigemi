import { useState } from "react";
import { Sidebar, type Turno } from "./SharedLayout";

const TURNOS_MOCK: Turno[] = [
  { id: "T-01", hora: "08:00 - 08:30", paciente: "Ramírez, Claudia B.",    dni: "27.384.901", tipoAnalisis: "Micosis ungueal",    recurso: "Consultorio 1", estado: "Atendido" },
  { id: "T-02", hora: "08:30 - 09:00", paciente: "Gómez Torres, Luis A.", dni: "33.210.005", tipoAnalisis: "Micosis superficial", recurso: "Consultorio 1", estado: "Confirmado" },
  { id: "T-03", hora: "09:00 - 09:30", paciente: "Pereyra, Ana M.",        dni: "20.771.442", tipoAnalisis: "Micosis profunda",    recurso: "Consultorio 1", estado: "Confirmado" },
  { id: "T-04", hora: "09:30 - 10:00", paciente: "Juárez, Marcelo F.",     dni: "18.902.673", tipoAnalisis: "Micosis superficial", recurso: "Consultorio 1", estado: "No Asistió" },
  { id: "T-05", hora: "10:00 - 10:30", paciente: "Torres, Beatriz N.",     dni: "35.448.120", tipoAnalisis: "Micosis profunda",    recurso: "Consultorio 2", estado: "Confirmado" },
  { id: "T-06", hora: "10:30 - 11:00", paciente: "Rodríguez, Pablo O.",    dni: "22.116.759", tipoAnalisis: "Micosis ungueal",    recurso: "Consultorio 2", estado: "Cancelado" },
  { id: "T-07", hora: "11:00 - 11:30", paciente: "Navarro, Inés P.",       dni: "43.007.661", tipoAnalisis: "Micosis profunda",    recurso: "Consultorio 2", estado: "Pendiente" },
];

export function AgendaView({
  onNavigate,
  onNuevoTurnoConsulta,
}: {
  onNavigate: (page: string) => void;
  onNuevoTurnoConsulta: () => void;
}) {
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--font-sans)" }}>
      <Sidebar activePage="Agenda y Turnos" onNavigate={onNavigate} />

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
            <span style={{ color: "#9ca3af", fontSize: 12 }}>Principal</span>
            <span style={{ color: "#d1d5db" }}>/</span>
            <span style={{ color: "#111827", fontWeight: 600, fontSize: 13 }}>Agenda y Turnos</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onNuevoTurnoConsulta}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Nuevo Turno
            </button>
          </div>
        </header>

        {/* Calendar toolbar */}
        <div
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Lunes, 14 de Septiembre 2026</span>
            <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 4, overflow: "hidden" }}>
              <button style={{ padding: "4px 10px", background: "#f9fafb", border: "none", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>Día</button>
              <button style={{ padding: "4px 10px", background: "#ffffff", border: "none", fontSize: 12, fontWeight: 600, borderRight: "1px solid #e5e7eb" }}>Semana</button>
              <button style={{ padding: "4px 10px", background: "#f9fafb", border: "none", fontSize: 12 }}>Mes</button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Total en la jornada: <strong>7 turnos</strong> (1 Atendido, 3 Confirmados, 1 Pendiente, 1 No Asistió, 1 Cancelado)
          </div>
        </div>

        {/* Schedule grid */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", gap: 16 }}>
          {/* Main timeline */}
          <div style={{ flex: 1, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Programación de Turnos - Consultorios 1 y 2
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TURNOS_MOCK.map((t) => {
                const getStatusColor = (e: Turno["estado"]) => {
                  switch (e) {
                    case "Pendiente":  return { bg: "#f3f4f6", border: "#9ca3af", text: "#6b7280" };
                    case "Confirmado": return { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" };
                    case "Atendido":   return { bg: "#d1fae5", border: "#10b981", text: "#065f46" };
                    case "No Asistió": return { bg: "#fee2e2", border: "#f87171", text: "#991b1b" };
                    case "Cancelado":  return { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" };
                  }
                };
                const st = getStatusColor(t.estado);

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTurno(t)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: st.bg,
                      borderLeft: `4px solid ${st.border}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      border: "1px solid #e5e7eb",
                      borderLeftWidth: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "#111827", minWidth: 100 }}>
                        {t.hora}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>{t.paciente}</div>
                        <div style={{ fontSize: 11, color: "#4b5563" }}>
                          DNI: <span style={{ fontFamily: "var(--font-mono)" }}>{t.dni}</span> · {t.tipoAnalisis} · <strong style={{ color: "#374151" }}>{t.recurso}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st.text, padding: "2px 8px", background: "#ffffff", borderRadius: 3, border: `1px solid ${st.border}` }}>
                        {t.estado}
                      </span>
                      {(t.estado === "Confirmado" || t.estado === "Pendiente") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNuevoTurnoConsulta();
                          }}
                          style={{
                            padding: "4px 8px",
                            background: "#2563eb",
                            color: "#fff",
                            border: "none",
                            borderRadius: 3,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Atender →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details / Action panel */}
          <div style={{ width: 300, background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 16, display: "flex", flexDirection: "column" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase" }}>
              Detalle del Turno
            </h4>

            {selectedTurno ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11 }}>Paciente:</label>
                  <div style={{ fontWeight: 600, color: "#111827" }}>{selectedTurno.paciente}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#6b7280" }}>DNI: {selectedTurno.dni}</div>
                </div>

                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11 }}>Estudio programado:</label>
                  <div style={{ fontWeight: 500, color: "#374151" }}>{selectedTurno.tipoAnalisis}</div>
                </div>

                <div>
                  <label style={{ color: "#9ca3af", fontSize: 11 }}>Horario y Recurso:</label>
                  <div style={{ fontWeight: 500, color: "#374151" }}>{selectedTurno.hora} ({selectedTurno.recurso})</div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={onNuevoTurnoConsulta}
                    style={{
                      padding: "8px",
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Registrar Asistencia e Iniciar Consulta
                  </button>
                  <button
                    style={{
                      padding: "6px",
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Marcar No Asistió
                  </button>
                  <button
                    style={{
                      padding: "6px",
                      background: "#fee2e2",
                      color: "#991b1b",
                      border: "1px solid #fca5a5",
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar Turno
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                Selecciona un turno de la lista para ver opciones y registrar asistencia.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
