import { useState } from "react";
import { PageShell, Panel, Btn, Banner, Pill, Table, tr, td, tdMono, inputCls, Field, type Tone } from "../components/ui";
import {
  useRol, currentUser, toast, addReporte, reportStore, type ReporteGen, useCarga, EstadoSwitch, Skeleton, ErrorState,
  EmptyBox, Check, selCls, HOY, fmtDate, isoToAr, num, downloadCsv, KpiCard, Pager, NoAccess,
} from "./core";

type Tipo = ReporteGen["tipo"];
const TIPOS: { t: Tipo; icon: string; desc: string; formatos: ReporteGen["formato"][] }[] = [
  { t: "Clínico", icon: "◈", desc: "Análisis, muestras y resultados (anonimizado)", formatos: ["CSV", "XLSX"] },
  { t: "Inventario", icon: "▦", desc: "Stock, lotes, vencimientos y movimientos", formatos: ["PDF", "CSV"] },
  { t: "Residuos", icon: "⚗", desc: "Volumen, peso, categorías y disposición", formatos: ["PDF", "CSV"] },
  { t: "Operativo", icon: "◫", desc: "Turnos y pacientes (derivado — validar)", formatos: ["CSV", "XLSX"] },
];

/* ─── Contenedor ────────────────────────────────────────── */
type Vista = { k: "panel" } | { k: "gen"; tipo?: Tipo } | { k: "hist" };
export default function ReportesView({ onNavigate, params }: { onNavigate: (p: string, params?: Record<string, unknown>) => void; params?: Record<string, unknown> }) {
  const rol = useRol();
  const [vista, setVista] = useState<Vista>(params?.tipo ? { k: "gen", tipo: params.tipo as Tipo } : { k: "panel" });
  if (rol === "Profesor")
    return <PageShell activePage="Reportes y Estadísticas" onNavigate={onNavigate} section="Reportes" title="Reportes y Estadísticas"><NoAccess onNavigate={onNavigate} /></PageShell>;
  return (
    <>
      {vista.k === "panel" && <PanelEst onNavigate={onNavigate} go={setVista} />}
      {vista.k === "gen" && <Generador key={vista.tipo ?? "nuevo"} initial={vista.tipo} onNavigate={onNavigate} onBack={() => setVista({ k: "panel" })} onHist={() => setVista({ k: "hist" })} />}
      {vista.k === "hist" && <Historial onNavigate={onNavigate} onBack={() => setVista({ k: "panel" })} />}
    </>
  );
}

/* ─── Gráficos SVG ──────────────────────────────────────── */
type Serie = { label: string; value: number; color: string }[];
function Donut({ data }: { data: Serie }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-8">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Análisis por estado">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f3f4f6" strokeWidth="20" />
        {data.map((d) => {
          const len = (d.value / total) * C;
          const el = <circle key={d.label} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />;
          acc += len;
          return el;
        })}
        <text x="70" y="70" textAnchor="middle" fontSize="24" fontFamily="var(--font-mono)" fill="#111827">{total}</text>
        <text x="70" y="88" textAnchor="middle" fontSize="11" fill="#9ca3af">análisis</text>
      </svg>
      <div className="flex flex-col gap-2 text-[12.5px]">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="w-24 text-text-secondary">{d.label}</span>
            <span className="font-mono font-medium">{num(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function HBars({ data, unit = "", pct }: { data: Serie; unit?: string; pct?: boolean }) {
  const max = Math.max(...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-[12.5px]">
          <span className="w-24 text-text-secondary">{d.label}</span>
          <div className="h-6 flex-1 rounded-sm bg-bg"><div className="h-6 rounded-sm" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} /></div>
          <span className="w-20 text-right font-mono">{pct ? `${Math.round((d.value / total) * 100)}%` : `${num(d.value)}${unit}`}</span>
        </div>
      ))}
    </div>
  );
}
function Line({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 1000, Hh = 180, pad = 30;
  const max = Math.max(...values) * 1.15;
  const pts = values.map((v, i) => [pad + (i * (W - pad * 2)) / (values.length - 1), Hh - pad - (v / max) * (Hh - pad * 2)]);
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="h-[190px] w-full" role="img" aria-label="Evolución mensual de análisis">
      {[0, 0.5, 1].map((g) => <line key={g} x1={pad} x2={W - pad} y1={pad + g * (Hh - pad * 2)} y2={pad + g * (Hh - pad * 2)} stroke="#f3f4f6" />)}
      <polygon points={`${pad},${Hh - pad} ${pts.map((p) => p.join(",")).join(" ")} ${W - pad},${Hh - pad}`} fill="#2563eb" opacity="0.07" />
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2" />
          <text x={x} y={y - 10} textAnchor="middle" fontSize="12" fontFamily="var(--font-mono)" fill="#111827">{values[i]}</text>
          <text x={x} y={Hh - 8} textAnchor="middle" fontSize="12" fill="#9ca3af">{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}

/* ─── 14 Panel de Estadísticas ──────────────────────────── */
const RANGOS = { "Este mes": 1, "Últimos 3 meses": 3, "Últimos 6 meses": 6, "Este año": 10 } as const;
function PanelEst({ onNavigate, go }: { onNavigate: (p: string) => void; go: (v: Vista) => void }) {
  const carga = useCarga();
  const [rango, setRango] = useState<keyof typeof RANGOS>("Este mes");
  const [stamp, setStamp] = useState("19/10/2026 11:20");
  const k = RANGOS[rango];
  const f = k === 1 ? 1 : k * 0.92;
  const s = (n: number) => Math.round(n * f);
  const refresh = () => { carga.reintentar(); setStamp(`${fmtDate(HOY)} ${new Date().toTimeString().slice(0, 5)}`); };
  return (
    <PageShell activePage="Reportes y Estadísticas" onNavigate={onNavigate} section="Reportes" title="Reportes y Estadísticas" actions={
      <>
        <EstadoSwitch value={carga.estado} onChange={carga.setEstado} />
        <select className={selCls} value={rango} onChange={(e) => { setRango(e.target.value as keyof typeof RANGOS); refresh(); }}>{Object.keys(RANGOS).map((r) => <option key={r}>{r}</option>)}</select>
        <Btn title="Actualizar datos" aria-label="Actualizar datos" onClick={refresh}>↻</Btn>
        <Btn variant="primary" onClick={() => go({ k: "gen" })}>Generar reporte</Btn>
      </>
    }>
      {carga.estado === "Cargando" ? <Skeleton kpis={4} rows={6} /> : carga.estado === "Error" ? <ErrorState text="No se pudieron calcular las estadísticas." onRetry={carga.reintentar} /> : carga.estado === "Vacío" ? (
        <Panel><EmptyBox icon="▤" title="No hay datos para el período seleccionado" text="Pruebe con un rango de fechas más amplio." action={<Btn onClick={() => { setRango("Este año"); refresh(); }}>Ver este año</Btn>} /></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between text-[11.5px] text-text-muted"><span>Datos agregados · sin pacientes identificables</span><span>Actualizado: {stamp}</span></div>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Pacientes" value={num(1284)} sub={`+${s(12)} en el período`} tone="blue" />
            <KpiCard label="Turnos" value={s(86)} sub={`atendidos · ${s(7)} no asistió`} tone="violet" />
            <KpiCard label="Análisis" value={s(12)} sub={`validados · ${s(9)} en proceso`} tone="green" />
            <KpiCard label="Residuos" value={`${num(4.25 * f, 2)} L`} sub={`${num(3.8 * f, 2)} kg · ${s(18)} registros`} tone="teal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Panel title="Análisis por estado"><Donut data={[{ label: "Pendiente", value: s(12), color: "#9ca3af" }, { label: "En proceso", value: s(9), color: "#f59e0b" }, { label: "Terminado y validado", value: s(16), color: "#10b981" }]} /></Panel>
            <Panel title="Análisis por tipo de muestra"><HBars pct data={[{ label: "Uñas", value: 45, color: "#16a34a" }, { label: "Piel", value: 30, color: "#9333ea" }, { label: "Cabello", value: 25, color: "#ea580c" }]} /></Panel>
            <Panel title="Turnos por estado"><HBars data={[{ label: "Atendidos", value: s(86), color: "#10b981" }, { label: "Pendientes", value: s(14), color: "#9ca3af" }, { label: "No asistió", value: s(7), color: "#ef4444" }]} /></Panel>
            <Panel title="Residuos por categoría" meta="volumen"><HBars unit=" ml" data={[{ label: "Clase I", value: s(1800), color: "#dc2626" }, { label: "Clase II", value: s(1650), color: "#f59e0b" }, { label: "Clase III", value: s(800), color: "#0d9488" }]} /></Panel>
          </div>
          <Panel title="Evolución mensual de análisis" meta="2026"><Line labels={["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"]} values={[28, 31, 36, 34, 41, 38, 33, 39, 44, 37]} /></Panel>
          <Panel>
            <div className="flex items-center gap-2">
              <span className="mr-2 text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase">Accesos rápidos</span>
              <Btn onClick={() => go({ k: "gen", tipo: "Clínico" })}>◈ Reporte clínico</Btn>
              <Btn onClick={() => go({ k: "gen", tipo: "Inventario" })}>▦ Inventario</Btn>
              <Btn onClick={() => go({ k: "gen", tipo: "Residuos" })}>⚗ Residuos</Btn>
              <Btn onClick={() => go({ k: "hist" })}>☰ Historial</Btn>
            </div>
          </Panel>
        </div>
      )}
    </PageShell>
  );
}

/* ─── Datos simulados para la previsualización ──────────── */
function rng(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
interface Params { desde: string; hasta: string; a: string; b: string; c: string; d: string; alertas: boolean }
interface Result { cols: string[]; rows: (string | number)[][]; right: number[] }
function buildRows(tipo: Tipo, p: Params): Result {
  const days = Math.max(1, Math.round((new Date(p.hasta).getTime() - new Date(p.desde).getTime()) / 86400000) + 1);
  const outOfData = p.hasta < "2025-01-01";
  const r = rng(days * 7 + p.a.length + p.b.length * 3 + p.c.length * 5 + p.d.length * 11);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const dateIn = () => fmtDate(new Date(new Date(p.desde + "T12:00").getTime() + r() * (days - 1) * 86400000));
  if (tipo === "Clínico") {
    let n = outOfData ? 0 : Math.round(days * 4.73);
    if (p.a) n = Math.round(n / 3);
    if (p.b) n = Math.round(n / 3);
    if (p.c) n = Math.round(n / 3.5);
    if (p.d) n = Math.round(n / 2);
    const rows = Array.from({ length: n }, (_, i) => [
      `PAC-${String(i + 1).padStart(4, "0")}`, 18 + Math.floor(r() * 60), pick(["F", "M"]), p.b || pick(["Uñas", "Piel", "Cabello"]),
      p.a || pick(["Micosis ungueal", "Micosis superficial", "Micosis profunda"]), p.c || pick(["Terminado y validado", "Terminado y validado", "En Proceso", "Pendiente"]), dateIn(),
      pick(["Trichophyton rubrum", "Candida albicans", "Malassezia furfur", "Negativo", "Microsporum canis"]), pick(["Posadas", "Oberá", "Apóstoles", "Garupá"]),
    ]);
    return { cols: ["ID seudónimo", "Edad", "Sexo", "Tipo muestra", "Tipo análisis", "Estado", "Fecha", "Resultado", "Localidad"], rows, right: [1] };
  }
  if (tipo === "Inventario") {
    const base: (string | number)[][] = [
      ["Agar Sabouraud", "Medios de cultivo", "850 g", "200 g", "Normal", "15/01/2027", "Estante A-3"],
      ["KOH 20%", "Reactivos", "120 ml", "250 ml", "Bajo umbral", "31/03/2027", "Heladera R-1"],
      ["Hisopos estériles", "Descartables", "0 unidades", "50 unidades", "Agotado", "—", "Estante B-2"],
      ["Azul de lactofenol", "Reactivos", "300 ml", "100 ml", "Próximo a vencer", "10/11/2026", "Estante A-1"],
      ["Guantes nitrilo M", "Descartables", "1.200 unidades", "300 unidades", "Normal", "31/08/2028", "Estante C-4"],
      ["Medio Sabouraud líquido", "Medios de cultivo", "500 ml", "150 ml", "Vencido", "30/09/2026", "Heladera R-2"],
      ["Cloranfenicol", "Reactivos", "38 g", "10 g", "Normal", "14/05/2028", "Heladera R-1"],
      ["Portaobjetos", "Material de vidrio", "410 unidades", "100 unidades", "Normal", "—", "Estante C-4"],
      ["Cubreobjetos 22×22", "Material de vidrio", "0 unidades", "100 unidades", "Revisar (sin lotes)", "—", "Estante C-4"],
      ["Tinta china", "Reactivos", "85 ml", "20 ml", "Normal", "22/04/2028", "Estante A-1"],
      ["Alcohol 70%", "Reactivos", "3.200 ml", "500 ml", "Normal", "02/09/2028", "Estante B-2"],
      ["Placas de Petri 90 mm", "Descartables", "64 unidades", "40 unidades", "Normal", "03/07/2030", "Estante B-2"],
    ];
    const rows = outOfData ? [] : base.filter((x) => (!p.a || x[1] === p.a) && (!p.alertas || x[4] !== "Normal"));
    return { cols: ["Insumo", "Categoría", "Stock", "Umbral", "Estado", "Próx. vencimiento", "Ubicación"], rows, right: [2, 3] };
  }
  if (tipo === "Residuos") {
    const n = outOfData ? 0 : Math.round(days * 0.6);
    const rows = Array.from({ length: n }, (_, i) => [
      `R-2026-${String(Math.max(1, 120 - i)).padStart(3, "0")}`, dateIn(), p.a || pick(["Clase I — Ácidos", "Clase II — Solventes orgánicos", "Clase III — Otros"]),
      `${num(50 + Math.floor(r() * 70) * 10)} ml`, `${num(40 + Math.floor(r() * 60) * 10)} g`, pick(["MIC-2026-0042", "MIC-2026-0038", "Práctica 2", "Práctica 3"]), p.b || pick(["Generado", "Dispuesto"]),
    ]);
    return { cols: ["ID", "Fecha", "Categoría", "Volumen", "Peso", "Origen", "Estado"], rows, right: [3, 4] };
  }
  const n = outOfData ? 0 : Math.min(days, 60);
  const rows = Array.from({ length: n }, (_, i) => { const t = 3 + Math.floor(r() * 6); const na = Math.floor(r() * 2); return [fmtDate(new Date(new Date(p.hasta + "T12:00").getTime() - i * 86400000)), t, t - na, na, Math.floor(r() * 3)]; });
  return { cols: ["Fecha", "Turnos", "Atendidos", "No asistió", "Pacientes nuevos"], rows, right: [1, 2, 3, 4] };
}

/* ─── 15-17 Generador (asistente) + Previsualización ────── */
function Stepper({ step }: { step: number }) {
  const names = ["Tipo", "Parámetros", "Resultado"];
  return (
    <div className="flex items-center px-1 py-1">
      {names.map((n, i) => (
        <div key={n} className="flex flex-1 items-center last:flex-none">
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${i + 1 < step ? "bg-[#10b981] text-white" : i + 1 === step ? "bg-accent text-white" : "border border-border bg-surface text-text-muted"}`}>{i + 1 < step ? "✓" : i + 1}</span>
            <span className={`text-[12.5px] ${i + 1 === step ? "font-semibold text-text-primary" : "text-text-secondary"}`}>{n}</span>
          </div>
          {i < 2 && <div className={`mx-4 h-[2px] flex-1 ${i + 1 < step ? "bg-[#10b981]" : "bg-border-light"}`} />}
        </div>
      ))}
    </div>
  );
}
function Generador({ initial, onNavigate, onBack, onHist }: { initial?: Tipo; onNavigate: (p: string) => void; onBack: () => void; onHist: () => void }) {
  const [step, setStep] = useState(initial ? 2 : 1);
  const [tipo, setTipo] = useState<Tipo | null>(initial ?? null);
  const [p, setP] = useState<Params>({ desde: initial === "Inventario" ? "2026-10-01" : "2026-09-01", hasta: initial === "Inventario" ? "2026-10-18" : "2026-09-30", a: "", b: "", c: "", d: "", alertas: false });
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [exportado, setExportado] = useState<string | null>(null);
  const [genAt, setGenAt] = useState("");
  const days = Math.round((new Date(p.hasta).getTime() - new Date(p.desde).getTime()) / 86400000) + 1;
  const errRango = !p.desde || !p.hasta ? "Ingrese el rango de fechas." : p.hasta < p.desde ? "La fecha 'hasta' debe ser posterior a 'desde'." : days > 731 ? "El rango máximo es de 24 meses." : p.hasta > "2026-10-19" ? "La fecha 'hasta' no puede ser futura." : "";
  const generar = () => {
    setTried(true);
    if (errRango || !tipo) return;
    setLoading(true);
    setStep(3);
    setTimeout(() => { setRes(buildRows(tipo, p)); setLoading(false); setPage(1); setExportado(null); setGenAt(`${fmtDate(HOY)} ${new Date().toTimeString().slice(0, 5)}`); }, 900);
  };
  const periodo = `${isoToAr(p.desde)} — ${isoToAr(p.hasta)}`;
  const filtros = tipo === "Clínico" ? `Tipo de análisis: ${p.a || "Todos"} | Muestra: ${p.b || "Todas"} | Estado: ${p.c || "Todos"} | Bioquímico: ${p.d || "Todos"}` : tipo === "Inventario" ? `Categoría: ${p.a || "Todas"} | Solo alertas: ${p.alertas ? "Sí" : "No"}` : tipo === "Residuos" ? `Categoría: ${p.a || "Todas"} | Estado: ${p.b || "Todos"}` : "Turnos y pacientes por día";
  const exportar = (formato: ReporteGen["formato"]) => {
    if (!res || !tipo || !res.rows.length) return;
    if (formato !== "PDF") downloadCsv(`reporte_${tipo.toLowerCase()}_${p.desde}_${p.hasta}.csv`, [res.cols, ...res.rows]);
    const id = addReporte({ tipo, periodo, formato, registros: res.rows.length, filtros });
    setExportado(id);
    toast(`Reporte ${id} generado (${formato}). Registrado en Historial y Auditoría.`);
  };
  const def = TIPOS.find((t) => t.t === tipo);
  const title = step === 3 && tipo ? `Previsualización — Reporte ${tipo.toLowerCase()}` : `Generar reporte${tipo && step > 1 ? ` — ${tipo}` : ""}`;
  return (
    <PageShell activePage="Reportes y Estadísticas" onNavigate={onNavigate} section="Reportes y Estadísticas" title={title} actions={<><Btn onClick={onHist}>☰ Historial</Btn><Btn onClick={onBack}>← Volver</Btn></>}>
      <div className="flex flex-col gap-4">
        <Panel><Stepper step={step} /></Panel>
        {step === 1 && (
          <Panel title="Paso 1 — Tipo de reporte">
            <div className="grid grid-cols-4 gap-3">
              {TIPOS.map((t) => (
                <button key={t.t} onClick={() => setTipo(t.t)} aria-pressed={tipo === t.t} className={`flex cursor-pointer flex-col gap-2 rounded-md border-2 p-4 text-left ${tipo === t.t ? "border-accent bg-[#eff6ff]" : "border-border-light bg-surface hover:border-border"}`}>
                  <span className="text-[22px] text-accent">{t.icon}</span>
                  <span className="text-[14px] font-bold text-text-primary">{t.t}</span>
                  <span className="text-[12px] text-text-secondary">{t.desc}</span>
                  <span className="mt-1 text-[10.5px] text-text-muted">Formatos: {t.formatos.join(" · ")}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end"><span title={!tipo ? "Seleccione un tipo de reporte" : ""}><Btn variant="primary" disabled={!tipo} onClick={() => setStep(2)}>Continuar →</Btn></span></div>
          </Panel>
        )}
        {step === 2 && tipo && (
          <Panel title={`Paso 2 — Parámetros (${tipo})`}>
            <div className="grid max-w-[880px] grid-cols-2 gap-4">
              <Field label="Desde" required error={tried ? errRango || undefined : undefined}><input type="date" className={inputCls} value={p.desde} onChange={(e) => setP({ ...p, desde: e.target.value })} /></Field>
              <Field label="Hasta" required><input type="date" className={inputCls} value={p.hasta} onChange={(e) => setP({ ...p, hasta: e.target.value })} /></Field>
              {tipo === "Clínico" && (
                <>
                  <Field label="Tipo de análisis"><select className={inputCls} value={p.a} onChange={(e) => setP({ ...p, a: e.target.value })}><option value="">Todos</option>{["Micosis ungueal", "Micosis superficial", "Micosis profunda"].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Tipo de muestra"><select className={inputCls} value={p.b} onChange={(e) => setP({ ...p, b: e.target.value })}><option value="">Todas</option>{["Uñas", "Piel", "Cabello"].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Estado"><select className={inputCls} value={p.c} onChange={(e) => setP({ ...p, c: e.target.value })}><option value="">Todos</option>{["Pendiente", "En Proceso", "Terminado y validado", "Cancelado"].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Bioquímico"><select className={inputCls} value={p.d} onChange={(e) => setP({ ...p, d: e.target.value })}><option value="">Todos</option>{["Ramírez, Claudia B.", "Ferreyra, Ana", "Fernández, R.", "Salinas, M."].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <div className="col-span-2"><Banner tone="amber">⚠ Los reportes clínicos se exportan <strong>ANONIMIZADOS</strong>: se remueven DNI, nombre, apellido y datos de contacto. Se conserva un ID seudónimo (Ley 25.326).</Banner></div>
                </>
              )}
              {tipo === "Inventario" && (
                <>
                  <Field label="Categoría"><select className={inputCls} value={p.a} onChange={(e) => setP({ ...p, a: e.target.value })}><option value="">Todas</option>{["Medios de cultivo", "Reactivos", "Descartables", "Material de vidrio"].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <div className="flex items-end pb-1.5"><Check checked={p.alertas} onChange={(v) => setP({ ...p, alertas: v })}>Solo insumos en alerta</Check></div>
                </>
              )}
              {tipo === "Residuos" && (
                <>
                  <Field label="Categoría"><select className={inputCls} value={p.a} onChange={(e) => setP({ ...p, a: e.target.value })}><option value="">Todas</option>{["Clase I — Ácidos", "Clase II — Solventes orgánicos", "Clase III — Otros"].map((x) => <option key={x}>{x}</option>)}</select></Field>
                  <Field label="Estado"><select className={inputCls} value={p.b} onChange={(e) => setP({ ...p, b: e.target.value })}><option value="">Todos</option><option>Generado</option><option>Dispuesto</option></select></Field>
                </>
              )}
              {tipo === "Operativo" && <div className="col-span-2"><Banner tone="blue">ℹ Tipo de reporte derivado de RF-15 (validar si se incluye en la versión). Agrupa turnos y pacientes por día.</Banner></div>}
            </div>
            <div className="mt-5 flex justify-between">
              <Btn onClick={() => setStep(1)}>← Atrás</Btn>
              <Btn variant="primary" onClick={generar}>Generar previsualización →</Btn>
            </div>
          </Panel>
        )}
        {step === 3 && tipo && (loading ? (
          <Panel><div className="flex flex-col items-center gap-3 py-14"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-border-light border-t-accent" /><span className="text-[13px] font-semibold">Procesando consulta…</span><span className="text-[12px] text-text-muted">Puede demorar hasta 5 segundos.</span></div></Panel>
        ) : res && res.rows.length === 0 ? (
          <Panel><EmptyBox icon="○" title="No se encontraron registros para los parámetros ingresados" text="No se genera un reporte vacío. Ajuste el rango de fechas o los filtros." action={<Btn variant="primary" onClick={() => setStep(2)}>← Modificar parámetros</Btn>} /></Panel>
        ) : res && (
          <>
            <Panel>
              <div className="flex flex-col gap-1.5 text-[12.5px]">
                <div className="flex justify-between"><span>Período: <strong>{periodo}</strong></span><span className="text-text-secondary">Generado: {genAt} · {currentUser()}</span></div>
                <div className="text-text-secondary">Filtros: {filtros}</div>
                {tipo === "Clínico" && <div className="mt-1"><Pill tone="dark">🔒 Datos anonimizados: DNI, nombre, apellido y contacto removidos</Pill></div>}
              </div>
            </Panel>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Registros" value={num(res.rows.length)} tone="blue" />
              <KpiCard label="Columnas" value={res.cols.length} tone="gray" />
              <KpiCard label="Período" value={`${days} días`} tone="gray" />
            </div>
            <Panel flush title="Vista previa" meta="20 filas por página · el archivo contiene el conjunto completo">
              <Table head={res.cols.map((c, i) => (res.right.includes(i) ? <span className="block text-right">{c}</span> : c))}>
                {res.rows.slice((page - 1) * 20, page * 20).map((row, i) => (
                  <tr key={i} className={tr}>
                    {row.map((c, j) => <td key={j} className={`${j === 0 || typeof c === "number" ? tdMono : td} ${res.right.includes(j) ? "text-right" : ""}`}>{c}</td>)}
                  </tr>
                ))}
              </Table>
              <Pager page={page} total={res.rows.length} size={20} onPage={setPage} noun="registros" />
            </Panel>
            {exportado && <Banner tone="green" action={<Btn onClick={onHist}>Ver en Historial</Btn>}>✓ Reporte {exportado} registrado. La exportación quedó en auditoría.</Banner>}
            <div className="flex items-center gap-2">
              <Btn onClick={() => setStep(2)}>← Volver al generador</Btn>
              <Btn onClick={() => { setStep(1); setTipo(null); setRes(null); setTried(false); }}>Nueva consulta</Btn>
              <div className="flex-1" />
              {def?.formatos.map((fm, i) => <Btn key={fm} variant={i === def.formatos.length - 1 ? "primary" : "secondary"} onClick={() => exportar(fm)}>⬇ Exportar {fm}</Btn>)}
            </div>
          </>
        ))}
      </div>
    </PageShell>
  );
}

/* ─── 18 Historial de Reportes ──────────────────────────── */
const EST_TONE: Record<ReporteGen["estado"], Tone> = { Generando: "amber", Listo: "green", Error: "red" };
function Historial({ onNavigate, onBack }: { onNavigate: (p: string) => void; onBack: () => void }) {
  const list = reportStore.use();
  const rol = useRol();
  const carga = useCarga();
  const [f, setF] = useState({ tipo: "", desde: "", hasta: "", usuario: "" });
  const visible = rol === "Administrador" ? list : list.filter((r) => r.usuario === currentUser());
  const rows = visible.filter((r) => { const iso = r.fecha.split("/").reverse().join("-"); return (!f.tipo || r.tipo === f.tipo) && (!f.usuario || r.usuario === f.usuario) && (!f.desde || iso >= f.desde) && (!f.hasta || iso <= f.hasta); });
  const usuarios = [...new Set(list.map((r) => r.usuario))];
  const descargar = (r: ReporteGen) => {
    if (r.formato !== "PDF") downloadCsv(`${r.id}_${r.tipo.toLowerCase()}.csv`, [["Reporte", r.id], ["Tipo", r.tipo], ["Período", r.periodo], ["Registros", r.registros], ["Filtros", r.filtros]]);
    toast(`Descarga de ${r.id} registrada en auditoría`, "blue");
  };
  const empty = carga.estado === "Vacío";
  return (
    <PageShell activePage="Reportes y Estadísticas" onNavigate={onNavigate} section="Reportes y Estadísticas" title="Historial de reportes" actions={<><EstadoSwitch value={carga.estado} onChange={carga.setEstado} /><Btn onClick={onBack}>← Volver</Btn></>}>
      {carga.estado === "Cargando" ? <Skeleton rows={6} /> : carga.estado === "Error" ? <ErrorState text="No se pudo cargar el historial." onRetry={carga.reintentar} /> : (
        <div className="flex flex-col gap-3">
          {rol !== "Administrador" && <Banner tone="blue">ℹ Se muestran solo los reportes generados por usted. (derivado — validar)</Banner>}
          <Panel flush>
            <div className="flex flex-wrap items-center gap-2 border-b border-border-light px-4 py-3">
              <select className={selCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Tipo: todos</option>{TIPOS.map((t) => <option key={t.t}>{t.t}</option>)}</select>
              <label className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">Desde <input type="date" className={selCls} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
              <label className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">Hasta <input type="date" className={selCls} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
              {rol === "Administrador" && <select className={selCls} value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })}><option value="">Usuario: todos</option>{usuarios.map((x) => <option key={x}>{x}</option>)}</select>}
              <div className="flex-1" />
              <Btn variant="ghost" onClick={() => setF({ tipo: "", desde: "", hasta: "", usuario: "" })}>Limpiar filtros</Btn>
            </div>
            {empty || rows.length === 0 ? (
              <EmptyBox icon="☰" title={empty ? "Todavía no se generaron reportes" : "No hay reportes con los filtros aplicados"} text="Los reportes exportados aparecen aquí con su estado de generación." />
            ) : (
              <Table head={["Fecha/hora", "ID", "Tipo", "Período", "Generado por", "Formato", <span className="block text-right">Registros</span>, "Estado", ""]}>
                {rows.map((r) => (
                  <tr key={r.id} className={`${tr} h-12`}>
                    <td className={tdMono}>{r.fecha.slice(0, 5)} {r.hora}</td>
                    <td className={tdMono}>{r.id}</td>
                    <td className={td}>{r.tipo}</td>
                    <td className={td}>{r.periodo}</td>
                    <td className={`${td} text-text-secondary`}>{r.usuario}</td>
                    <td className={td}><Pill tone="gray">{r.formato}</Pill></td>
                    <td className={`${tdMono} text-right`}>{r.estado === "Error" ? "—" : num(r.registros)}</td>
                    <td className={td}><Pill tone={EST_TONE[r.estado]}>{r.estado === "Generando" ? "◷ Generando" : r.estado === "Listo" ? "✓ Listo" : "✕ Error"}</Pill></td>
                    <td className={`${td} text-right`}>
                      <span title={r.estado === "Generando" ? "El reporte aún se está generando" : r.estado === "Error" ? "No se pudo generar; vuelva a ejecutar la consulta" : ""}>
                        <Btn className="!h-7 !px-2.5" disabled={r.estado !== "Listo"} onClick={() => descargar(r)}>⬇ Descargar</Btn>
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      )}
    </PageShell>
  );
}
