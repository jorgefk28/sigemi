/**
 * SIGEMI workspace: the back-office shell and every screen of the delivered
 * repository (spec S2 of `odd/tasks/07-frontend-backoffice.md`).
 *
 * Navigation is the repository's own single-state router (`activePage`), kept
 * as delivered so the screens behave exactly like the prototype.
 */

import { useEffect, useState } from "react";
import { Sidebar, StatusPill, MuestraBadge, selectStyle, STATUS_MAP, type Analisis, type Estado } from "./components/SharedLayout";
import { AgendaView } from "./components/AgendaView";
import { FichaClinicaView } from "./components/FichaClinicaView";
import { DetalleAnalisisView } from "./components/DetalleAnalisisView";
import { ResultadosView } from "./components/ResultadosView";
import PanelControlView from "./components/PanelControlView";
import PacientesView from "./components/PacientesView";
import InsumosView from "./sigemi/InsumosView";
import ResiduosView from "./sigemi/ResiduosView";
import ReportesView from "./sigemi/ReportesView";
import UsuariosView from "./sigemi/UsuariosView";
import AuditoriaView from "./sigemi/AuditoriaView";
import { CargaResultadosView } from "./components/CargaResultadosView";
import { ToastHost, canSee, useSesion } from "./sigemi/core";
import { INITIAL_MOCK_DATA } from "./seed";
import { hidratarPacientes } from "../data/pacientes";

/** Sub-pages of the analysis module: they are reachable through its menu entry. */
const PAGE_PARENT: Record<string, string> = {
  "Detalle de Análisis": "Análisis",
  "Ficha Clínica": "Análisis",
  "Carga de Resultados": "Análisis",
};

/** First screen the signed-in roles may open, used as the landing page. */
function landingPage(roles: Parameters<typeof canSee>[0]): string {
  for (const page of ["Análisis", "Insumos y Stock", "Pacientes", "Panel de Control"]) {
    if (canSee(roles, page)) {
      return page;
    }
  }
  return "Insumos y Stock";
}

export function Workspace({ onLogout }: { onLogout: () => void }) {
  const [analisisList, setAnalisisList] = useState<Analisis[]>(INITIAL_MOCK_DATA);
  const sesion = useSesion();

  // Spec S5: the patient screens read the backend. When it answers with no
  // rows, or does not answer at all, the delivered dataset stays on screen (S4).
  useEffect(() => {
    hidratarPacientes().catch(() => undefined);
  }, []);

  const [consultaDni, setConsultaDni] = useState<string | null>(null);
  const [consultaKey, setConsultaKey] = useState(0);
  const nuevaConsulta = (dni: string | null) => {
    setConsultaDni(dni);
    setConsultaKey((k) => k + 1);
    setActivePage("Ficha Clínica");
  };
  const nextId = `MIC-2026-${String(Math.max(0, ...analisisList.map((a) => Number(a.id.slice(-4)) || 0)) + 1).padStart(4, "0")}`;
  const [activePage, setActivePage] = useState("Análisis");
  const [selectedAnalisisId, setSelectedAnalisisId] = useState<string>("MIC-2026-0341");

  // A role that cannot open the landing screen would see content the sidebar
  // hides; send it to the first screen its roles do grant (A5, §5.6).
  useEffect(() => {
    const roles = sesion.roles.length ? sesion.roles : null;
    if (!roles) {
      return;
    }
    if (!canSee(roles, PAGE_PARENT[activePage] ?? activePage)) {
      setActivePage(landingPage(roles));
    }
  }, [sesion, activePage]);

  // Filters for Main Panel
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroMuestra, setFiltroMuestra] = useState<string>("");
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [filtroBioquimico, setFiltroBioquimico] = useState<string>("");
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  const handleUpdateAnalisis = (updated: Analisis) => {
    setAnalisisList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleMuestraIngresada = (newAnalisis: Analisis) => {
    setAnalisisList((prev) => [newAnalisis, ...prev]);
    setSelectedAnalisisId(newAnalisis.id);
    setActivePage("Detalle de Análisis");
  };

  const [navParams, setNavParams] = useState<{ key: number; params?: Record<string, unknown> }>({ key: 0 });
  const navigate = (page: string, params?: Record<string, unknown>) => {
    setActivePage(page);
    setNavParams((n) => ({ key: n.key + 1, params }));
  };
  const MODULES: Record<string, (p: { onNavigate: typeof navigate; params?: Record<string, unknown> }) => React.ReactNode> = {
    "Insumos y Stock": InsumosView,
    "Control de Residuos": ResiduosView,
    "Reportes y Estadísticas": ReportesView,
    "Usuarios y Roles": UsuariosView,
    "Auditoría": AuditoriaView,
  };
  const Mod = MODULES[activePage];
  if (Mod) {
    return (
      <>
        <Mod key={`${activePage}-${navParams.key}`} onNavigate={navigate} params={navParams.params} />
        <ToastHost />
      </>
    );
  }
  return (
    <>
      {renderClinico()}
      <ToastHost />
    </>
  );

  function renderClinico() {

  const currentAnalisis = analisisList.find((a) => a.id === selectedAnalisisId) || analisisList[0];

  if (activePage === "Agenda y Turnos") {
    return (
      <AgendaView
        onNavigate={setActivePage}
        onNuevoTurnoConsulta={() => nuevaConsulta(null)}
      />
    );
  }

  if (activePage === "Ficha Clínica") {
    return (
      <FichaClinicaView
        key={consultaKey}
        pacienteDni={consultaDni}
        nextId={nextId}
        onNavigate={setActivePage}
        onMuestraIngresada={handleMuestraIngresada}
      />
    );
  }

  if (activePage === "Detalle de Análisis") {
    return (
      <DetalleAnalisisView
        analisis={currentAnalisis}
        onNavigate={setActivePage}
        onUpdateAnalisis={handleUpdateAnalisis}
      />
    );
  }

  if (activePage === "Carga de Resultados") {
    return (
      <CargaResultadosView
        key={currentAnalisis.id}
        analisis={currentAnalisis}
        onNavigate={setActivePage}
        onUpdateAnalisis={handleUpdateAnalisis}
      />
    );
  }

  if (activePage === "Panel de Control") {
    return <PanelControlView analisis={analisisList} onNavigate={setActivePage} />;
  }

  if (activePage === "Pacientes") {
    return <PacientesView onNavigate={setActivePage} onNuevaConsulta={nuevaConsulta} />;
  }

  if (activePage === "Resultados") {
    return <ResultadosView onNavigate={setActivePage} />;
  }

  // Default: Panel de Análisis
  const filtered = analisisList.filter((a) => {
    if (filtroEstado && a.estado !== filtroEstado) return false;
    if (filtroMuestra && a.tipoMuestra !== filtroMuestra) return false;
    if (filtroBioquimico && a.bioquimico !== filtroBioquimico) return false;
    // The date input was rendered but never read; `yyyy-mm-dd` vs `dd/mm/yyyy`.
    if (filtroFecha && a.fechaIngreso.split("/").reverse().join("-") !== filtroFecha) return false;
    return true;
  });

  const bioquimicos = [...new Set(analisisList.map((a) => a.bioquimico))];

  const estadoCounts = analisisList.reduce<Record<string, number>>((acc, a) => {
    acc[a.estado] = (acc[a.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "var(--font-sans)" }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} onLogout={onLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f4f5f7" }}>
        {/* Header bar */}
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
            <span style={{ color: "#111827", fontWeight: 600, fontSize: 13 }}>Panel de Análisis</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                fontSize: 12,
                color: "#374151",
              }}
            >
              <span style={{ color: "#9ca3af", fontSize: 11 }}>🔍</span>
              <input
                placeholder="Buscar análisis o paciente…"
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 12,
                  color: "#374151",
                  width: 200,
                  fontFamily: "var(--font-sans)",
                }}
              />
            </div>
            <button
              onClick={() => nuevaConsulta(null)}
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
                letterSpacing: "0.01em",
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              Nueva Consulta
            </button>
          </div>
        </header>

        {/* Estado summary strip */}
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
          {(Object.entries(STATUS_MAP) as [Estado, typeof STATUS_MAP[Estado]][]).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setFiltroEstado(filtroEstado === key ? "" : key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                background: filtroEstado === key ? s.bg : "transparent",
                border: "none",
                borderBottom: filtroEstado === key ? `2px solid ${s.dot}` : "2px solid transparent",
                cursor: "pointer",
                fontSize: 12,
                color: filtroEstado === key ? s.text : "#6b7280",
                fontWeight: filtroEstado === key ? 600 : 400,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />
              {s.label}
              <span
                style={{
                  background: filtroEstado === key ? s.dot : "#e5e7eb",
                  color: filtroEstado === key ? "#fff" : "#6b7280",
                  borderRadius: 10,
                  padding: "0 5px",
                  fontSize: 10,
                  fontWeight: 600,
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {estadoCounts[key] ?? 0}
              </span>
            </button>
          ))}
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
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={selectStyle}
          >
            <option value="">Estado — Todos</option>
            {Object.keys(STATUS_MAP).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <select
            value={filtroMuestra}
            onChange={(e) => setFiltroMuestra(e.target.value)}
            style={selectStyle}
          >
            <option value="">Muestra — Todas</option>
            {[...new Set(analisisList.map((a) => a.tipoMuestra))].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            style={{ ...selectStyle, color: filtroFecha ? "#111827" : "#9ca3af" }}
          />

          <select
            value={filtroBioquimico}
            onChange={(e) => setFiltroBioquimico(e.target.value)}
            style={selectStyle}
          >
            <option value="">Bioquímico — Todos</option>
            {bioquimicos.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          {(filtroEstado || filtroMuestra || filtroFecha || filtroBioquimico) && (
            <button
              onClick={() => { setFiltroEstado(""); setFiltroMuestra(""); setFiltroFecha(""); setFiltroBioquimico(""); }}
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
            {filtered.length} de {analisisList.length} análisis
          </span>
        </div>

        {/* Table area */}
        <div style={{ flex: 1, overflow: "auto", padding: "0" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 148 }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 106 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr
                style={{
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                }}
              >
                {["N.º Análisis", "Paciente", "Muestra", "Tipo de Análisis", "Estado", "Fecha Ingreso", "Bioquímico"].map(
                  (col) => (
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
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const isSelected = selectedRow === a.id;
                return (
                  <tr
                    key={a.id}
                    onClick={() => {
                      setSelectedRow(a.id);
                      setSelectedAnalisisId(a.id);
                    }}
                    onDoubleClick={() => {
                      setSelectedAnalisisId(a.id);
                      setActivePage("Detalle de Análisis");
                    }}
                    style={{
                      height: 36,
                      borderBottom: "1px solid #f3f4f6",
                      background: isSelected ? "#eff6ff" : i % 2 === 0 ? "#ffffff" : "#fafafa",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "0 12px" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnalisisId(a.id);
                          setActivePage("Detalle de Análisis");
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: 0,
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          color: "#2563eb",
                          fontWeight: 600,
                          textDecoration: "underline",
                        }}
                      >
                        {a.id}
                      </button>
                    </td>
                    <td style={{ padding: "0 12px" }}>
                      <div>
                        <span style={{ fontWeight: 500, color: "#111827" }}>{a.paciente}</span>
                        <span
                          style={{
                            marginLeft: 7,
                            fontFamily: "var(--font-mono)",
                            fontSize: 10.5,
                            color: "#9ca3af",
                          }}
                        >
                          {a.dni}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "0 12px" }}>
                      <MuestraBadge tipo={a.tipoMuestra} />
                    </td>
                    <td
                      style={{
                        padding: "0 12px",
                        color: "#374151",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.tipoAnalisis}
                    </td>
                    <td style={{ padding: "0 12px" }}>
                      <StatusPill estado={a.estado} />
                    </td>
                    <td
                      style={{
                        padding: "0 12px",
                        color: "#6b7280",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11.5,
                      }}
                    >
                      {a.fechaIngreso}
                    </td>
                    <td style={{ padding: "0 12px", color: "#374151" }}>
                      {a.bioquimico}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "48px 24px",
                      textAlign: "center",
                      color: "#9ca3af",
                      fontSize: 13,
                    }}
                  >
                    No hay análisis para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
}