import { useMemo, useState } from "react";
import { PageShell, Panel, Btn, Banner, Pill, Table, tr, td, tdMono, inputCls, Field, Modal, SegTabs, type Tone } from "../components/ui";
import {
  createStore, useRol, currentUser, logAudit, toast, Drawer, KpiCard, Pager, useCarga, EstadoSwitch, Skeleton,
  ErrorState, EmptyBox, Info, Radio, Check, selCls, HOY, parseDate, fmtDate, isoToAr, arToIso, num, nowStamp,
} from "./core";

/* ─── Modelo ────────────────────────────────────────────── */
type Unidad = "g" | "ml" | "unidades";
interface Lote { codigo: string; ingreso: string; vence: string; inicial: number; actual: number }
interface Insumo {
  id: string; nombre: string; categoria: string; unidad: Unidad; umbral: number; dias: number;
  ubicacion: string; activo: boolean; descripcion?: string; lotes: Lote[];
}
interface Mov {
  id: string; insumoId: string; fecha: string; hora: string; tipo: "Ingreso" | "Retiro" | "Devolución";
  cantidad: number; alloc: { codigo: string; cant: number }[]; destino: string; usuario: string; devuelto: number; obs?: string;
}
interface Cat { nombre: string; descripcion: string; activo: boolean }
interface Ubi { nombre: string; tipo: string; activo: boolean }

const L = (codigo: string, ingreso: string, vence: string, inicial: number, actual: number): Lote => ({ codigo, ingreso, vence, inicial, actual });
const SEED: Insumo[] = [
  { id: "AGS", nombre: "Agar Sabouraud", categoria: "Medios de cultivo", unidad: "g", umbral: 200, dias: 30, ubicacion: "Estante A-3", activo: true, descripcion: "Medio de cultivo deshidratado con dextrosa al 4%.", lotes: [L("AS-2401", "02/03/2026", "15/01/2027", 500, 350), L("AS-2402", "10/06/2026", "12/12/2027", 500, 500)] },
  { id: "KOH", nombre: "KOH 20%", categoria: "Reactivos", unidad: "ml", umbral: 250, dias: 30, ubicacion: "Heladera R-1", activo: true, lotes: [L("KO-2603", "05/04/2026", "31/03/2027", 500, 120)] },
  { id: "HIS", nombre: "Hisopos estériles", categoria: "Descartables", unidad: "unidades", umbral: 50, dias: 30, ubicacion: "Estante B-2", activo: true, lotes: [L("HI-2602", "12/02/2026", "12/02/2029", 200, 0)] },
  { id: "AZL", nombre: "Azul de lactofenol", categoria: "Reactivos", unidad: "ml", umbral: 100, dias: 30, ubicacion: "Estante A-1", activo: true, lotes: [L("AL-2511", "20/11/2025", "10/11/2026", 500, 300)] },
  { id: "GNM", nombre: "Guantes nitrilo M", categoria: "Descartables", unidad: "unidades", umbral: 300, dias: 30, ubicacion: "Estante C-4", activo: true, lotes: [L("GN-2604", "08/04/2026", "31/08/2028", 1000, 700), L("GN-2610", "17/10/2026", "31/08/2028", 500, 500)] },
  { id: "MSL", nombre: "Medio Sabouraud líquido", categoria: "Medios de cultivo", unidad: "ml", umbral: 150, dias: 30, ubicacion: "Heladera R-2", activo: true, lotes: [L("ML-2603", "01/03/2026", "30/09/2026", 600, 500)] },
  { id: "CLO", nombre: "Cloranfenicol", categoria: "Reactivos", unidad: "g", umbral: 10, dias: 30, ubicacion: "Heladera R-1", activo: true, lotes: [L("CL-2605", "14/05/2026", "14/05/2028", 50, 38)] },
  { id: "POB", nombre: "Portaobjetos", categoria: "Material de vidrio", unidad: "unidades", umbral: 100, dias: 30, ubicacion: "Estante C-4", activo: true, lotes: [L("PO-2601", "10/01/2026", "", 500, 410)] },
  { id: "COB", nombre: "Cubreobjetos 22×22", categoria: "Material de vidrio", unidad: "unidades", umbral: 100, dias: 30, ubicacion: "Estante C-4", activo: true, lotes: [] },
  { id: "TCH", nombre: "Tinta china", categoria: "Reactivos", unidad: "ml", umbral: 20, dias: 30, ubicacion: "Estante A-1", activo: true, lotes: [L("TC-2604", "22/04/2026", "22/04/2028", 100, 85)] },
  { id: "ALC", nombre: "Alcohol 70%", categoria: "Reactivos", unidad: "ml", umbral: 500, dias: 30, ubicacion: "Estante B-2", activo: true, lotes: [L("AC-2609", "02/09/2026", "02/09/2028", 5000, 3200)] },
  { id: "PDP", nombre: "Placas de Petri 90 mm", categoria: "Descartables", unidad: "unidades", umbral: 40, dias: 30, ubicacion: "Estante B-2", activo: true, lotes: [L("PP-2607", "03/07/2026", "03/07/2030", 200, 64)] },
  { id: "LUG", nombre: "Lugol", categoria: "Reactivos", unidad: "ml", umbral: 50, dias: 30, ubicacion: "Estante A-1", activo: false, lotes: [L("LU-2502", "01/02/2025", "01/02/2027", 250, 40)] },
];
const SEED_MOV: Mov[] = [
  { id: "M-0213", insumoId: "GNM", fecha: "18/10/2026", hora: "11:02", tipo: "Retiro", cantidad: 40, alloc: [{ codigo: "GN-2604", cant: 40 }], destino: "Práctica 3", usuario: "Sosa, Martín", devuelto: 0 },
  { id: "M-0212", insumoId: "GNM", fecha: "17/10/2026", hora: "15:44", tipo: "Ingreso", cantidad: 500, alloc: [{ codigo: "GN-2610", cant: 500 }], destino: "Proveedor: Descartables del NEA", usuario: "Benítez, Laura", devuelto: 0 },
  { id: "M-0210", insumoId: "AGS", fecha: "15/10/2026", hora: "14:02", tipo: "Retiro", cantidad: 150, alloc: [{ codigo: "AS-2401", cant: 150 }], destino: "MIC-2026-0042", usuario: "Ramírez, Claudia B.", devuelto: 0 },
  { id: "M-0205", insumoId: "KOH", fecha: "10/10/2026", hora: "09:30", tipo: "Retiro", cantidad: 80, alloc: [{ codigo: "KO-2603", cant: 80 }], destino: "MIC-2026-0038", usuario: "Ramírez, Claudia B.", devuelto: 0 },
  { id: "M-0198", insumoId: "HIS", fecha: "06/10/2026", hora: "10:15", tipo: "Retiro", cantidad: 30, alloc: [{ codigo: "HI-2602", cant: 30 }], destino: "Práctica 2", usuario: "Sosa, Martín", devuelto: 0 },
  { id: "M-0190", insumoId: "AGS", fecha: "02/10/2026", hora: "12:40", tipo: "Devolución", cantidad: 20, alloc: [{ codigo: "AS-2401", cant: 20 }], destino: "Ret. M-0182 · Utilizable", usuario: "Sosa, Martín", devuelto: 0 },
  { id: "M-0182", insumoId: "AGS", fecha: "01/10/2026", hora: "08:55", tipo: "Retiro", cantidad: 60, alloc: [{ codigo: "AS-2401", cant: 60 }], destino: "Práctica 1", usuario: "Sosa, Martín", devuelto: 20 },
];
const invStore = createStore({
  insumos: SEED,
  movs: SEED_MOV,
  categorias: [
    { nombre: "Medios de cultivo", descripcion: "Medios sólidos y líquidos para aislamiento fúngico.", activo: true },
    { nombre: "Reactivos", descripcion: "Soluciones y colorantes para examen directo.", activo: true },
    { nombre: "Descartables", descripcion: "Material de un solo uso.", activo: true },
    { nombre: "Material de vidrio", descripcion: "Portaobjetos, cubreobjetos y vidriería.", activo: true },
  ] as Cat[],
  ubicaciones: [
    { nombre: "Estante A-1", tipo: "Estante", activo: true },
    { nombre: "Estante A-3", tipo: "Estante", activo: true },
    { nombre: "Estante B-2", tipo: "Estante", activo: true },
    { nombre: "Estante C-4", tipo: "Estante", activo: true },
    { nombre: "Heladera R-1", tipo: "Heladera (2-8 °C)", activo: true },
    { nombre: "Heladera R-2", tipo: "Heladera (2-8 °C)", activo: true },
  ] as Ubi[],
});
const setInv = invStore.set;

export const ANALISIS_SEL = [
  { id: "MIC-2026-0042", tipo: "Micosis ungueal", paciente: "Ramírez, Claudia B.", dni: "••••5678" },
  { id: "MIC-2026-0038", tipo: "Micosis superficial", paciente: "López, Ana", dni: "••••1290" },
  { id: "MIC-2026-0341", tipo: "Micosis ungueal", paciente: "Ramírez, Claudia B.", dni: "••••4901" },
  { id: "MIC-2026-0340", tipo: "Micosis superficial", paciente: "Gómez Torres, Luis A.", dni: "••••0005" },
];
const PRACTICAS = ["Práctica 1", "Práctica 2", "Práctica 3", "Práctica 4"];

/* ─── Cálculo de estados (§5.8) ─────────────────────────── */
const diasHasta = (d: string) => Math.ceil((parseDate(d).getTime() - HOY.getTime()) / 86400000);
const loteVencido = (l: Lote) => !!l.vence && diasHasta(l.vence) < 0;
const venceTs = (l: Lote) => (l.vence ? parseDate(l.vence).getTime() : 9e15);
function estadoLote(l: Lote, dias: number): { tone: Tone; label: string } {
  if (l.actual === 0) return { tone: "gray", label: "Consumido" };
  if (loteVencido(l)) return { tone: "red", label: "✕ Vencido" };
  if (l.vence && diasHasta(l.vence) <= dias) return { tone: "orange", label: `◷ Vence en ${diasHasta(l.vence)} d` };
  return { tone: "green", label: "✓ Activo" };
}
function calc(i: Insumo) {
  const stock = i.lotes.reduce((a, l) => a + l.actual, 0);
  const disponible = i.lotes.filter((l) => !loteVencido(l)).reduce((a, l) => a + l.actual, 0);
  const conStock = i.lotes.filter((l) => l.actual > 0);
  const vencido = conStock.some(loteVencido);
  const vence = conStock.some((l) => !loteVencido(l) && !!l.vence && diasHasta(l.vence) <= i.dias);
  const prox = conStock.filter((l) => l.vence).sort((a, b) => venceTs(a) - venceTs(b))[0];
  const sinLotes = i.lotes.length === 0;
  const agotado = stock === 0;
  const bajo = !agotado && stock <= i.umbral;
  return { stock, disponible, vencido, vence, prox, sinLotes, agotado, bajo, alerta: agotado || bajo || vencido || vence };
}
type Calc = ReturnType<typeof calc>;
const u = (n: number, un: Unidad) => `${num(n)} ${un}`;

function StockBadges({ i, c }: { i: Insumo; c: Calc }) {
  if (!i.activo) return <Pill tone="gray">○ Inactivo</Pill>;
  const b: [Tone, string][] = [];
  if (c.sinLotes) b.push(["amber", "⚠ Revisar"]);
  if (c.agotado && !c.sinLotes) b.push(["red", "✕ Agotado"]);
  if (c.bajo) b.push(["amber", "▼ Bajo umbral"]);
  if (c.vencido) b.push(["red", "✕ Vencido"]);
  if (c.vence) b.push(["orange", "◷ Próximo a vencer"]);
  if (!b.length) b.push(["green", "✓ Normal"]);
  return (
    <div className="flex flex-wrap gap-1">
      {b.map(([t, l]) => <Pill key={l} tone={t}>{l}</Pill>)}
    </div>
  );
}
function Qty({ value, onChange, unit }: { value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <div className="relative">
      <input className={`${inputCls} pr-20 text-right font-mono`} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} />
      <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-text-muted">{unit}</span>
    </div>
  );
}
const ModalFooter = ({ onCancel, onOk, label, danger }: { onCancel: () => void; onOk: () => void; label: string; danger?: boolean }) => (
  <div className="flex w-full justify-between">
    <Btn onClick={onCancel}>Cancelar</Btn>
    {danger ? <button className="h-8 cursor-pointer rounded border-none bg-[#dc2626] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#b91c1c]" onClick={onOk}>{label}</button> : <Btn variant="primary" onClick={onOk}>{label}</Btn>}
  </div>
);

/* Barra fija inferior con las acciones principales, solo en móvil */
function MobileBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border-light bg-surface px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.08)] md:hidden [&>*]:flex-1 [&_button]:h-11 [&_button]:w-full [&_button]:justify-center [&_button]:text-[13.5px]">
      {children}
    </div>
  );
}

/* ─── Contenedor del módulo ─────────────────────────────── */
type Vista = { k: "inv" } | { k: "det"; id: string } | { k: "cat" };
type Over = null | { k: "ing"; id?: string } | { k: "ret"; id?: string } | { k: "dev"; id: string } | { k: "umb"; id: string };

export default function InsumosView({ onNavigate, params }: { onNavigate: (p: string, params?: Record<string, unknown>) => void; params?: Record<string, unknown> }) {
  const [vista, setVista] = useState<Vista>({ k: "inv" });
  const [over, setOver] = useState<Over>(null);
  const [soloAlertas, setSoloAlertas] = useState(!!params?.soloAlertas);
  const rol = useRol();
  const admin = rol === "Administrador";
  return (
    <>
      {vista.k === "inv" && <Inventario admin={admin} rol={rol} soloAlertas={soloAlertas} setSoloAlertas={setSoloAlertas} onNavigate={onNavigate} onVer={(id) => setVista({ k: "det", id })} onOver={setOver} onCatalogos={() => setVista({ k: "cat" })} />}
      {vista.k === "det" && <Detalle id={vista.id} admin={admin} onNavigate={onNavigate} onBack={() => setVista({ k: "inv" })} onOver={setOver} onCatalogos={() => setVista({ k: "cat" })} />}
      {vista.k === "cat" && admin && <Catalogos onNavigate={onNavigate} onBack={() => setVista({ k: "inv" })} />}
      {over?.k === "ing" && admin && <Ingreso preId={over.id} onClose={() => setOver(null)} onDone={(id) => { setOver(null); setVista({ k: "det", id }); }} />}
      {over?.k === "ret" && <Retiro preId={over.id} onClose={() => setOver(null)} onDone={(id) => { setOver(null); setVista({ k: "det", id }); }} />}
      {over?.k === "dev" && <Devolucion preId={over.id} onClose={() => setOver(null)} />}
      {over?.k === "umb" && admin && <Umbrales id={over.id} onClose={() => setOver(null)} />}
    </>
  );
}

/* ─── 01 Inventario ─────────────────────────────────────── */
function Inventario({ admin, rol, soloAlertas, setSoloAlertas, onNavigate, onVer, onOver, onCatalogos }: {
  admin: boolean; rol: string; soloAlertas: boolean; setSoloAlertas: (v: boolean) => void;
  onNavigate: (p: string, params?: Record<string, unknown>) => void; onVer: (id: string) => void; onOver: (o: Over) => void; onCatalogos: () => void;
}) {
  const { insumos, categorias, ubicaciones } = invStore.use();
  const carga = useCarga();
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fUbi, setFUbi] = useState("");
  const [fEst, setFEst] = useState("");
  const [page, setPage] = useState(1);
  const PAGE = 10;
  const rows = useMemo(() => {
    const sev = (c: Calc) => (c.agotado ? 0 : c.bajo ? 1 : c.vence || c.vencido ? 2 : 3);
    return insumos
      .map((i) => ({ i, c: calc(i) }))
      .filter(({ i, c }) => {
        if (q && !i.nombre.toLowerCase().includes(q.toLowerCase())) return false;
        if (fCat && i.categoria !== fCat) return false;
        if (fUbi && i.ubicacion !== fUbi) return false;
        if (soloAlertas && (!i.activo || !c.alerta)) return false;
        if (fEst === "Normal" && (!i.activo || c.alerta)) return false;
        if (fEst === "Bajo umbral" && !c.bajo) return false;
        if (fEst === "Agotado" && !c.agotado) return false;
        if (fEst === "Próximo a vencer" && !c.vence) return false;
        if (fEst === "Vencido" && !c.vencido) return false;
        if (fEst === "Inactivo" && i.activo) return false;
        return true;
      })
      .sort((a, b) => Number(!a.i.activo) - Number(!b.i.activo) || sev(a.c) - sev(b.c) || a.i.nombre.localeCompare(b.i.nombre));
  }, [insumos, q, fCat, fUbi, fEst, soloAlertas]);
  const activos = insumos.filter((i) => i.activo).map((i) => ({ i, c: calc(i) }));
  const kBajo = activos.filter((x) => x.c.bajo || x.c.agotado).length;
  const kVence = activos.reduce((a, x) => a + x.i.lotes.filter((l) => l.actual > 0 && !loteVencido(l) && l.vence && diasHasta(l.vence) <= x.i.dias).length, 0);
  const kVencidos = activos.reduce((a, x) => a + x.i.lotes.filter((l) => l.actual > 0 && loteVencido(l)).length, 0);
  const hasFilters = !!(q || fCat || fUbi || fEst || soloAlertas);
  const clear = () => { setQ(""); setFCat(""); setFUbi(""); setFEst(""); setSoloAlertas(false); setPage(1); };
  const empty = carga.estado === "Vacío";
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  return (
    <PageShell activePage="Insumos y Stock" onNavigate={onNavigate} section="Insumos" title="Insumos y Stock" actions={
      <>
        <EstadoSwitch value={carga.estado} onChange={carga.setEstado} />
        {admin && <Btn onClick={onCatalogos}>⚙ Catálogos</Btn>}
        {rol !== "Profesor" && <Btn onClick={() => onNavigate("Reportes y Estadísticas", { tipo: "Inventario" })}>⬇ Exportar</Btn>}
        {admin && <span className="hidden md:contents"><Btn variant="primary" onClick={() => onOver({ k: "ing" })}>+ Ingreso</Btn></span>}
      </>
    }>
      {carga.estado === "Cargando" ? <Skeleton kpis={4} rows={8} /> : carga.estado === "Error" ? <ErrorState text="No se pudo cargar el inventario." onRetry={carga.reintentar} /> : (
        <div className="flex flex-col gap-3 pb-20 md:gap-4 md:pb-0">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <KpiCard label="Insumos activos" value={empty ? 0 : activos.length} sub="en el catálogo" tone="blue" />
            <KpiCard label="Bajo umbral" value={empty ? 0 : kBajo} sub="▼ incluye agotados · ver alertas" tone="amber" onClick={() => { setFEst(""); setSoloAlertas(true); setPage(1); }} active={soloAlertas} />
            <KpiCard label="Por vencer" value={empty ? 0 : kVence} sub="◷ lotes en ≤ 30 días" tone="orange" onClick={() => { setSoloAlertas(false); setFEst("Próximo a vencer"); setPage(1); }} active={fEst === "Próximo a vencer"} />
            <KpiCard label="Vencidos" value={empty ? 0 : kVencidos} sub="✕ lotes no disponibles" tone="red" onClick={() => { setSoloAlertas(false); setFEst("Vencido"); setPage(1); }} active={fEst === "Vencido"} />
          </div>
          <Panel flush>
            <div className="flex flex-wrap items-center gap-2 border-b border-border-light px-4 py-3">
              <input className={`${inputCls} md:!w-[240px]`} type="search" placeholder="Buscar insumo…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              <select className={`${selCls} min-w-0 flex-1 basis-[45%] md:flex-none md:basis-auto`} value={fCat} onChange={(e) => { setFCat(e.target.value); setPage(1); }}><option value="">Categoría: todas</option>{categorias.map((c) => <option key={c.nombre}>{c.nombre}</option>)}</select>
              <select className={`${selCls} min-w-0 flex-1 basis-[45%] md:flex-none md:basis-auto`} value={fUbi} onChange={(e) => { setFUbi(e.target.value); setPage(1); }}><option value="">Ubicación: todas</option>{ubicaciones.map((c) => <option key={c.nombre}>{c.nombre}</option>)}</select>
              <select className={`${selCls} min-w-0 flex-1 basis-[45%] md:flex-none md:basis-auto`} value={fEst} onChange={(e) => { setFEst(e.target.value); setPage(1); }}><option value="">Estado: todos</option>{["Normal", "Bajo umbral", "Agotado", "Próximo a vencer", "Vencido", "Inactivo"].map((c) => <option key={c}>{c}</option>)}</select>
              <Check checked={soloAlertas} onChange={(v) => { setSoloAlertas(v); setPage(1); }}>Solo alertas</Check>
              <div className="hidden flex-1 md:block" />
              <Btn variant="ghost" className="ml-auto md:ml-0" disabled={!hasFilters} onClick={clear}>Limpiar filtros</Btn>
            </div>
            {empty ? (
              <EmptyBox icon="▦" title="No hay insumos registrados en el catálogo" text={admin ? "Registre el primer ingreso para comenzar a controlar el stock." : "Consulte con el Administrador para dar de alta los insumos."} action={admin && <Btn variant="primary" onClick={() => onOver({ k: "ing" })}>+ Ingreso</Btn>} />
            ) : rows.length === 0 ? (
              soloAlertas && !q && !fCat && !fUbi && !fEst
                ? <EmptyBox icon="✓" title="No hay insumos en alerta" text="Todo el stock está por encima del umbral y sin vencimientos próximos." action={<Btn onClick={clear}>Ver todo el inventario</Btn>} />
                : <EmptyBox icon="🔍" title="No se encontraron insumos con los criterios ingresados" action={<Btn onClick={clear}>Limpiar filtros</Btn>} />
            ) : (
              <>
                <ul className="m-0 list-none divide-y divide-border-light p-0 md:hidden">
                  {pageRows.map(({ i, c }) => {
                    const motivo = !i.activo ? "Inactivo" : c.sinLotes ? "Sin lotes" : c.disponible === 0 ? "Sin stock" : "";
                    return (
                      <li key={i.id} onClick={() => onVer(i.id)} className={`flex cursor-pointer flex-col gap-2 px-4 py-3 active:bg-bg ${!i.activo ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-text-primary">{i.nombre}</div>
                            <div className="text-[12px] text-text-secondary">{i.categoria} · {i.ubicacion}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className={`font-mono text-[16px] font-semibold ${c.agotado ? "text-cancelado-text" : c.bajo ? "text-enproceso-text" : "text-text-primary"}`}>{u(c.stock, i.unidad)}</div>
                            <div className="text-[11px] text-text-muted">mín. {u(i.umbral, i.unidad)}</div>
                          </div>
                        </div>
                        <StockBadges i={i} c={c} />
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[12px] text-text-secondary">Próx. venc.: <span className="font-mono text-text-primary">{c.sinLotes ? "Sin lotes" : c.prox ? c.prox.vence : "—"}</span></span>
                          <span onClick={(e) => e.stopPropagation()}>
                            <Btn className="!h-9 !px-3" disabled={!!motivo} title={motivo} onClick={() => onOver({ k: "ret", id: i.id })}>{motivo || "↓ Retirar"}</Btn>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="hidden md:block">
                <Table head={["Insumo", "Categoría", <span className="block text-right">Stock</span>, <span className="block text-right">Umbral</span>, "Estado", "Próx. vencimiento", "Ubicación", ""]}>
                  {pageRows.map(({ i, c }) => {
                    const motivo = !i.activo ? "El insumo está inactivo y no admite movimientos" : c.sinLotes ? "No hay lotes disponibles" : c.disponible === 0 ? "Stock insuficiente" : "";
                    return (
                      <tr key={i.id} className={`${tr} h-12 cursor-pointer ${!i.activo ? "opacity-60" : ""}`} onClick={() => onVer(i.id)}>
                        <td className={`${td} font-semibold`}>{i.nombre}</td>
                        <td className={`${td} text-text-secondary`}>{i.categoria}</td>
                        <td className={`${tdMono} text-right ${c.agotado ? "text-cancelado-text" : c.bajo ? "text-enproceso-text" : ""}`}>{u(c.stock, i.unidad)}</td>
                        <td className={`${tdMono} text-right text-text-secondary`}>{u(i.umbral, i.unidad)}</td>
                        <td className={td}><StockBadges i={i} c={c} /></td>
                        <td className={tdMono}>{c.sinLotes ? <span className="text-enproceso-text">Sin lotes</span> : c.prox ? c.prox.vence : "—"}</td>
                        <td className={`${td} text-text-secondary`}>{i.ubicacion}</td>
                        <td className={`${td} text-right whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Btn className="!h-7 !px-2.5" onClick={() => onVer(i.id)}>Ver</Btn>
                            <span title={motivo}><Btn className="!h-7 !px-2.5" disabled={!!motivo} onClick={() => onOver({ k: "ret", id: i.id })}>↓ Retirar</Btn></span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
                </div>
                <Pager page={page} total={rows.length} size={PAGE} onPage={setPage} noun="insumos" />
              </>
            )}
          </Panel>
        </div>
      )}
      {carga.estado === "Con datos" && (
        <MobileBar>
          <Btn variant={admin ? "secondary" : "primary"} onClick={() => onOver({ k: "ret" })}>↓ Retirar insumo</Btn>
          {admin && <Btn variant="primary" onClick={() => onOver({ k: "ing" })}>↑ Ingreso</Btn>}
        </MobileBar>
      )}
    </PageShell>
  );
}

/* ─── 02 Detalle de Insumo ──────────────────────────────── */
function Detalle({ id, admin, onNavigate, onBack, onOver, onCatalogos }: { id: string; admin: boolean; onNavigate: (p: string) => void; onBack: () => void; onOver: (o: Over) => void; onCatalogos: () => void }) {
  const { insumos, movs } = invStore.use();
  const i = insumos.find((x) => x.id === id)!;
  const c = calc(i);
  const [tab, setTab] = useState<"Lotes" | "Movimientos" | "Ficha">("Lotes");
  const [edit, setEdit] = useState(false);
  const [baja, setBaja] = useState(false);
  const ms = movs.filter((m) => m.insumoId === id);
  const hayRetiros = ms.some((m) => m.tipo === "Retiro" && m.cantidad - m.devuelto > 0);
  const bloqueo = !i.activo ? "El insumo está inactivo y no admite movimientos." : "";
  return (
    <PageShell activePage="Insumos y Stock" onNavigate={onNavigate} section="Insumos y Stock" title={i.nombre} actions={
      <>
        <Btn onClick={onBack}>← Volver</Btn>
        <span className="hidden md:contents">
          <span title={bloqueo || (c.disponible === 0 ? "Stock insuficiente" : "")}><Btn disabled={!!bloqueo || c.disponible === 0} onClick={() => onOver({ k: "ret", id })}>↓ Retirar</Btn></span>
          <span title={bloqueo || (!hayRetiros ? "No hay retiros con saldo para devolver" : "")}><Btn disabled={!!bloqueo || !hayRetiros} onClick={() => onOver({ k: "dev", id })}>↺ Devolución</Btn></span>
        </span>
        {admin && <Btn onClick={() => setEdit(true)}>✏ Editar</Btn>}
        {admin && <span className="hidden md:contents"><span title={bloqueo}><Btn variant="primary" disabled={!!bloqueo} onClick={() => onOver({ k: "ing", id })}>↑ Registrar ingreso</Btn></span></span>}
      </>
    }>
      <div className="flex flex-col gap-3 pb-20 md:gap-4 md:pb-0">
        {!i.activo && <Banner tone="gray">El insumo está inactivo y no admite movimientos. Su historial se conserva.</Banner>}
        {c.vencido && i.activo && <Banner tone="red">Hay lotes vencidos con stock. No están disponibles para retiro (se conservan para trazabilidad).</Banner>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr] md:gap-4">
          <Panel title="Resumen">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Categoría">{i.categoria}</Info>
              <Info label="Unidad de medida">{i.unidad}</Info>
              <Info label="Ubicación">{i.ubicacion}</Info>
              <Info label="Estado">{i.activo ? <Pill tone="green">✓ Activo</Pill> : <Pill tone="gray">○ Inactivo</Pill>}</Info>
            </div>
          </Panel>
          <Panel title="Alerta" meta={admin ? <Btn variant="ghost" onClick={() => onOver({ k: "umb", id })}>Editar umbral</Btn> : <span>Umbral configurado por el Administrador</span>}>
            <div className="flex flex-col gap-3">
              <StockBadges i={i} c={c} />
              <div className="grid grid-cols-2 gap-3">
                <Info label="Stock actual"><span className="font-mono text-[18px]">{u(c.stock, i.unidad)}</span></Info>
                <Info label="Umbral mínimo"><span className="font-mono text-[18px]">{u(i.umbral, i.unidad)}</span></Info>
              </div>
              <div className="text-[12px] text-text-secondary">Próximo vencimiento: <strong className="text-text-primary">{c.prox?.vence ?? "—"}</strong> · {i.lotes.filter((l) => l.actual > 0).length} lotes con stock · alerta {i.dias} días antes</div>
            </div>
          </Panel>
        </div>
        <Panel flush>
          <SegTabs value={tab} options={["Lotes", "Movimientos", "Ficha"]} onChange={setTab} />
          {tab === "Lotes" && (i.lotes.length === 0 ? (
            <EmptyBox icon="▦" title="Este insumo no tiene lotes" text="Inconsistencia de datos: registre un ingreso para habilitar retiros." action={admin && i.activo && <Btn variant="primary" onClick={() => onOver({ k: "ing", id })}>Registrar ingreso</Btn>} />
          ) : (
            <>
              <ul className="m-0 list-none divide-y divide-border-light p-0 md:hidden">
                {[...i.lotes].sort((a, b) => venceTs(a) - venceTs(b)).map((l) => {
                  const e = estadoLote(l, i.dias);
                  return (
                    <li key={l.codigo} className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[13px] font-semibold">{l.codigo}</span>
                        <Pill tone={e.tone}>{e.label}</Pill>
                      </div>
                      <div className="flex items-end justify-between gap-3 text-[12px] text-text-secondary">
                        <span>Vence <span className="font-mono text-text-primary">{l.vence || "—"}</span> · ingresó <span className="font-mono">{l.ingreso}</span></span>
                        <span className="font-mono text-[14px] font-semibold text-text-primary">{u(l.actual, i.unidad)}<span className="text-[11px] font-normal text-text-muted"> / {num(l.inicial)}</span></span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden md:block">
              <Table head={["Lote", "Ingreso", "Vence", <span className="block text-right">Inicial</span>, <span className="block text-right">Actual</span>, "Estado"]}>
                {[...i.lotes].sort((a, b) => venceTs(a) - venceTs(b)).map((l) => {
                  const e = estadoLote(l, i.dias);
                  return (
                    <tr key={l.codigo} className={`${tr} h-11`}>
                      <td className={tdMono}>{l.codigo}</td>
                      <td className={tdMono}>{l.ingreso}</td>
                      <td className={tdMono}>{l.vence || "Sin vencimiento"}</td>
                      <td className={`${tdMono} text-right`}>{u(l.inicial, i.unidad)}</td>
                      <td className={`${tdMono} text-right font-semibold`}>{u(l.actual, i.unidad)}</td>
                      <td className={td}><Pill tone={e.tone}>{e.label}</Pill></td>
                    </tr>
                  );
                })}
              </Table>
              </div>
              <div className="flex flex-col gap-1 border-t border-border-light px-4 py-2.5 text-[12px] text-text-secondary sm:flex-row sm:justify-between">
                <span>Mostrando {i.lotes.length} lotes</span>
                <span>Total en lotes: <strong className="font-mono text-text-primary">{u(c.stock, i.unidad)}</strong> <span className="hidden sm:inline">&nbsp;|&nbsp;</span><br className="sm:hidden" />Disponible para retiro: <strong className="font-mono text-text-primary">{u(c.disponible, i.unidad)}</strong></span>
              </div>
            </>
          ))}
          {tab === "Movimientos" && (ms.length === 0 ? (
            <EmptyBox icon="⇅" title="Sin movimientos registrados" text="Los ingresos, retiros y devoluciones de este insumo aparecerán aquí." />
          ) : (
            <>
            <ul className="m-0 list-none divide-y divide-border-light p-0 md:hidden">
              {ms.map((m) => (
                <li key={m.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Pill tone={m.tipo === "Ingreso" ? "green" : m.tipo === "Retiro" ? "red" : "blue"}>{m.tipo === "Ingreso" ? "↑" : m.tipo === "Retiro" ? "↓" : "↺"} {m.tipo}</Pill>
                    <span className="font-mono text-[14px] font-semibold">{m.tipo === "Retiro" ? "−" : "+"}{u(m.cantidad, i.unidad)}</span>
                  </div>
                  <div className="text-[12.5px] text-text-primary">{m.destino}</div>
                  <div className="flex flex-wrap justify-between gap-x-3 text-[11.5px] text-text-secondary">
                    <span className="font-mono">{m.fecha} {m.hora} · {m.alloc.map((a) => a.codigo).join(", ")}</span>
                    <span>{m.usuario}</span>
                  </div>
                  {m.devuelto > 0 && <div className="text-[11px] text-terminado-text">devuelto {u(m.devuelto, i.unidad)}</div>}
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
            <Table head={["Fecha/hora", "Tipo", <span className="block text-right">Cantidad</span>, "Lote(s)", "Destino / origen", "Usuario"]}>
              {ms.map((m) => (
                <tr key={m.id} className={`${tr} h-11`}>
                  <td className={tdMono}>{m.fecha} {m.hora}</td>
                  <td className={td}><Pill tone={m.tipo === "Ingreso" ? "green" : m.tipo === "Retiro" ? "red" : "blue"}>{m.tipo === "Ingreso" ? "↑" : m.tipo === "Retiro" ? "↓" : "↺"} {m.tipo}</Pill></td>
                  <td className={`${tdMono} text-right`}>
                    {m.tipo === "Retiro" ? "−" : "+"}{u(m.cantidad, i.unidad)}
                    {m.devuelto > 0 && <div className="text-[10.5px] text-terminado-text">devuelto {u(m.devuelto, i.unidad)}</div>}
                  </td>
                  <td className={tdMono}>{m.alloc.map((a) => a.codigo).join(", ")}</td>
                  <td className={td}>{m.destino}</td>
                  <td className={`${td} text-text-secondary`}>{m.usuario}</td>
                </tr>
              ))}
            </Table>
            </div>
            </>
          ))}
          {tab === "Ficha" && (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5 md:p-5">
              <Info label="Nombre">{i.nombre}</Info>
              <Info label="Categoría">{i.categoria}</Info>
              <Info label="Unidad">{i.unidad}</Info>
              <Info label="Ubicación habitual">{i.ubicacion}</Info>
              <Info label="Stock mínimo de alerta">{u(i.umbral, i.unidad)}</Info>
              <Info label="Días de alerta de vencimiento">{i.dias} días</Info>
              <div className="col-span-full"><Info label="Descripción">{i.descripcion || "—"}</Info></div>
              {admin && (
                <div className="col-span-full flex flex-wrap gap-2 border-t border-border-light pt-4">
                  <Btn onClick={() => setEdit(true)}>✏ Editar ficha</Btn>
                  {i.activo ? <Btn variant="danger" onClick={() => setBaja(true)}>⏻ Desactivar insumo</Btn> : <Btn onClick={() => toggleInsumo(i, true)}>Reactivar insumo</Btn>}
                  <Btn variant="ghost" onClick={onCatalogos}>Ir a Catálogos →</Btn>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
      <MobileBar>
        <Btn variant="primary" disabled={!!bloqueo || c.disponible === 0} onClick={() => onOver({ k: "ret", id })}>↓ Retirar</Btn>
        <Btn disabled={!!bloqueo || !hayRetiros} onClick={() => onOver({ k: "dev", id })}>↺ Devolver</Btn>
        {admin && <Btn disabled={!!bloqueo} onClick={() => onOver({ k: "ing", id })}>↑ Ingreso</Btn>}
      </MobileBar>
      {edit && <InsumoForm insumo={i} onClose={() => setEdit(false)} />}
      {baja && <BajaInsumo i={i} onClose={() => setBaja(false)} />}
    </PageShell>
  );
}

/* ─── 03 Registrar Ingreso ──────────────────────────────── */
function Ingreso({ preId, onClose, onDone }: { preId?: string; onClose: () => void; onDone: (id: string) => void }) {
  const { insumos, ubicaciones } = invStore.use();
  const [f, setF] = useState({ id: preId ?? "", lote: "", ingreso: arToIso(fmtDate(HOY)), vence: "", cant: "", ubi: insumos.find((i) => i.id === preId)?.ubicacion ?? "", prov: "", obs: "" });
  const [tried, setTried] = useState(false);
  const sel = insumos.find((i) => i.id === f.id);
  const dupLote = sel?.lotes.some((l) => l.codigo.toLowerCase() === f.lote.trim().toLowerCase());
  const err = {
    id: !f.id ? "Seleccione un insumo." : "",
    lote: !f.lote.trim() ? "Ingrese el número de lote." : dupLote ? "Ya existe un lote con ese número para este insumo." : "",
    vence: !f.vence ? "Ingrese la fecha de vencimiento." : f.vence <= f.ingreso ? "El vencimiento debe ser posterior a la fecha de ingreso." : "",
    cant: !(Number(f.cant) > 0) ? "La cantidad debe ser mayor a 0." : "",
    ubi: !f.ubi ? "Seleccione la ubicación." : "",
  };
  const e = (k: keyof typeof err) => (tried ? err[k] || undefined : undefined);
  const submit = () => {
    setTried(true);
    if (Object.values(err).some(Boolean) || !sel) return;
    const cant = Number(f.cant);
    const lote = f.lote.trim();
    const antes = calc(sel).stock;
    setInv((s) => ({
      ...s,
      insumos: s.insumos.map((i) => (i.id === sel.id ? { ...i, lotes: [...i.lotes, L(lote, isoToAr(f.ingreso), isoToAr(f.vence), cant, cant)] } : i)),
      movs: [{ id: `M-${Date.now() % 10000}`, insumoId: sel.id, ...nowStamp(), tipo: "Ingreso", cantidad: cant, alloc: [{ codigo: lote, cant }], destino: f.prov ? `Proveedor: ${f.prov} · ${f.ubi}` : `Ingreso de stock · ${f.ubi}`, usuario: currentUser(), devuelto: 0, obs: f.obs }, ...s.movs],
    }));
    logAudit({ modulo: "Insumos", accion: "INGRESO", entidad: "Lote", entidadId: lote, resumen: `Ingreso de ${u(cant, sel.unidad)} de ${sel.nombre} (lote ${lote})`, cambios: [{ campo: "stock", antes: u(antes, sel.unidad), despues: u(antes + cant, sel.unidad) }] });
    toast(`Ingreso registrado: +${u(cant, sel.unidad)} de ${sel.nombre}`);
    onDone(sel.id);
  };
  return (
    <Drawer title="Registrar ingreso de insumo" subtitle="UC–LAB-01 · Cada ingreso crea un lote" onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={submit}>Registrar ingreso →</Btn></>}>
      <div className="flex flex-col gap-4">
        <Field label="Insumo" required error={e("id")} hint={sel ? `→ ${sel.nombre} — ${sel.categoria} — ${sel.unidad}` : "Solo se listan insumos activos."}>
          <select className={inputCls} value={f.id} onChange={(ev) => { const i = insumos.find((x) => x.id === ev.target.value); setF({ ...f, id: ev.target.value, ubi: i?.ubicacion ?? f.ubi }); }}>
            <option value="">Buscar / seleccionar…</option>
            {insumos.filter((i) => i.activo).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="N° de lote" required error={e("lote")}><input className={inputCls} value={f.lote} onChange={(ev) => setF({ ...f, lote: ev.target.value })} placeholder="Ej.: AS-2410" /></Field>
          <Field label="Fecha de ingreso" hint="Automática, editable"><input type="date" className={inputCls} value={f.ingreso} onChange={(ev) => setF({ ...f, ingreso: ev.target.value })} /></Field>
          <Field label="Fecha de vencimiento" required error={e("vence")}><input type="date" className={inputCls} value={f.vence} onChange={(ev) => setF({ ...f, vence: ev.target.value })} /></Field>
          <Field label="Cantidad" required error={e("cant")}><Qty value={f.cant} onChange={(v) => setF({ ...f, cant: v })} unit={sel?.unidad ?? "—"} /></Field>
          <Field label="Ubicación" required error={e("ubi")}>
            <select className={inputCls} value={f.ubi} onChange={(ev) => setF({ ...f, ubi: ev.target.value })}>
              <option value="">Seleccionar…</option>
              {ubicaciones.filter((x) => x.activo).map((x) => <option key={x.nombre}>{x.nombre}</option>)}
            </select>
          </Field>
          <Field label="Proveedor" hint="Opcional (FALTA DEFINIR en el modelo)"><input className={inputCls} value={f.prov} onChange={(ev) => setF({ ...f, prov: ev.target.value })} /></Field>
        </div>
        <Field label="Observaciones"><textarea className={`${inputCls} !h-20 py-2`} value={f.obs} onChange={(ev) => setF({ ...f, obs: ev.target.value })} /></Field>
        <Banner tone="blue">ℹ El stock del insumo se incrementará al confirmar{sel && Number(f.cant) > 0 ? `: ${u(calc(sel).stock, sel.unidad)} → ${u(calc(sel).stock + Number(f.cant), sel.unidad)}` : "."}</Banner>
      </div>
    </Drawer>
  );
}

/* ─── 04 Registrar Retiro (FEFO) ────────────────────────── */
function Retiro({ preId, onClose, onDone }: { preId?: string; onClose: () => void; onDone: (id: string) => void }) {
  const { insumos } = invStore.use();
  const rol = useRol();
  const [f, setF] = useState({ id: preId ?? "", cant: "", destino: (rol === "Profesor" ? "Práctica" : "Análisis") as "Análisis" | "Práctica", analisis: "", practica: "", obs: "" });
  const [tried, setTried] = useState(false);
  const sel = insumos.find((i) => i.id === f.id);
  const c = sel ? calc(sel) : null;
  const fefo = sel ? sel.lotes.filter((l) => l.actual > 0 && !loteVencido(l)).sort((a, b) => venceTs(a) - venceTs(b)) : [];
  const cant = Number(f.cant) || 0;
  let rest = cant;
  const alloc = fefo.map((l) => { const t = Math.min(l.actual, Math.max(rest, 0)); rest -= t; return { codigo: l.codigo, cant: t }; });
  const an = ANALISIS_SEL.find((a) => a.id === f.analisis);
  const err = {
    id: !f.id ? "Seleccione un insumo." : "",
    cant: !(cant > 0) ? "La cantidad debe ser mayor a 0." : c && cant > c.disponible ? `Stock insuficiente: disponible ${u(c.disponible, sel!.unidad)}.` : "",
    dest: f.destino === "Análisis" ? (!f.analisis ? "Seleccione el análisis asociado." : "") : !f.practica ? "Seleccione la práctica educativa." : "",
  };
  const e = (k: keyof typeof err) => (tried || (k === "cant" && cant > 0) ? err[k] || undefined : undefined);
  const submit = () => {
    setTried(true);
    if (Object.values(err).some(Boolean) || !sel || !c) return;
    const destino = f.destino === "Análisis" ? f.analisis : f.practica;
    const used = alloc.filter((a) => a.cant > 0);
    setInv((s) => ({
      ...s,
      insumos: s.insumos.map((i) => (i.id === sel.id ? { ...i, lotes: i.lotes.map((l) => ({ ...l, actual: l.actual - (used.find((a) => a.codigo === l.codigo)?.cant ?? 0) })) } : i)),
      movs: [{ id: `M-${Date.now() % 10000}`, insumoId: sel.id, ...nowStamp(), tipo: "Retiro", cantidad: cant, alloc: used, destino, usuario: currentUser(), devuelto: 0, obs: f.obs }, ...s.movs],
    }));
    logAudit({ modulo: "Insumos", accion: "RETIRO", entidad: "MovimientoInsumo", entidadId: sel.id, resumen: `Retiro de ${u(cant, sel.unidad)} de ${sel.nombre} — ${destino}`, cambios: [{ campo: "stock", antes: u(c.stock, sel.unidad), despues: u(c.stock - cant, sel.unidad) }, { campo: "lotes", antes: "—", despues: used.map((a) => `${a.codigo}: ${a.cant}`).join(", ") }] });
    const nuevo = c.stock - cant;
    toast(`Retiro registrado: −${u(cant, sel.unidad)} de ${sel.nombre}`);
    if (nuevo <= sel.umbral) toast(`${sel.nombre} quedó ${nuevo === 0 ? "agotado" : "bajo el umbral"} (${u(nuevo, sel.unidad)})`, "amber");
    onDone(sel.id);
  };
  return (
    <Drawer title="Registrar retiro de insumo" subtitle="UC–LAB-02 · Consumo trazable por análisis o práctica" onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={submit}>Registrar retiro →</Btn></>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Insumo" required error={e("id")}>
            <select className={inputCls} value={f.id} onChange={(ev) => setF({ ...f, id: ev.target.value })}>
              <option value="">Seleccionar…</option>
              {insumos.filter((i) => i.activo && calc(i).disponible > 0).map((i) => <option key={i.id} value={i.id}>{i.nombre} — {u(calc(i).disponible, i.unidad)} disponibles</option>)}
            </select>
          </Field>
          <Field label="Cantidad" required error={e("cant")} hint={sel && c ? `Máx. ${u(c.disponible, sel.unidad)}` : undefined}><Qty value={f.cant} onChange={(v) => setF({ ...f, cant: v })} unit={sel?.unidad ?? "—"} /></Field>
        </div>
        <Field label="Destino" required>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {rol !== "Profesor" && <Radio checked={f.destino === "Análisis"} onChange={() => setF({ ...f, destino: "Análisis" })}>Análisis micológico</Radio>}
            {rol !== "Bioquímico/Doctor" && <Radio checked={f.destino === "Práctica"} onChange={() => setF({ ...f, destino: "Práctica" })}>Práctica educativa</Radio>}
          </div>
          {rol !== "Administrador" && <span className="text-[11px] text-text-muted">{rol === "Profesor" ? "El rol Profesor retira solo para prácticas educativas." : "El rol Bioquímico/Doctor retira para análisis micológicos."} (derivado — validar)</span>}
        </Field>
        {f.destino === "Análisis" ? (
          <Field label="Análisis" required error={e("dest")} hint={an ? `→ Paciente: ${an.paciente} (DNI ${an.dni})` : undefined}>
            <select className={inputCls} value={f.analisis} onChange={(ev) => setF({ ...f, analisis: ev.target.value })}>
              <option value="">🔍 Buscar análisis…</option>
              {ANALISIS_SEL.map((a) => <option key={a.id} value={a.id}>{a.id} — {a.tipo} — {a.paciente}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Práctica educativa" required error={e("dest")}>
            <select className={inputCls} value={f.practica} onChange={(ev) => setF({ ...f, practica: ev.target.value })}>
              <option value="">Seleccionar práctica…</option>
              {PRACTICAS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        )}
        {sel && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-[0.04em] text-pendiente-text uppercase">Lotes a consumir (FEFO)</span>
            <div className="overflow-hidden rounded border border-border-light">
              <Table head={["Lote", "Vence", <span className="block text-right">Disponible</span>, <span className="block text-right">A consumir</span>]}>
                {fefo.map((l, idx) => (
                  <tr key={l.codigo} className={tr}>
                    <td className={tdMono}>{l.codigo}</td>
                    <td className={tdMono}>{l.vence || "—"}</td>
                    <td className={`${tdMono} text-right`}>{u(l.actual, sel.unidad)}</td>
                    <td className={`${tdMono} text-right font-semibold`}>{alloc[idx].cant > 0 ? <>{u(alloc[idx].cant, sel.unidad)} {idx === 0 && <span className="font-sans text-[10.5px] font-normal text-text-muted">(primero)</span>}</> : "—"}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <span className="text-[11.5px] text-text-secondary">ℹ Se consume primero el lote con vencimiento más próximo. Los lotes vencidos no están disponibles.</span>
          </div>
        )}
        <Field label="Observaciones"><textarea className={`${inputCls} !h-16 py-2`} value={f.obs} onChange={(ev) => setF({ ...f, obs: ev.target.value })} /></Field>
        {sel && c && cant > 0 && !err.cant && c.stock - cant <= sel.umbral && (
          <Banner tone="amber">⚠ Tras este retiro el stock quedará en {u(c.stock - cant, sel.unidad)}, por debajo del umbral ({u(sel.umbral, sel.unidad)}). Se generará una alerta en el Panel de Control.</Banner>
        )}
      </div>
    </Drawer>
  );
}

/* ─── 05 Registrar Devolución ───────────────────────────── */
function Devolucion({ preId, onClose }: { preId: string; onClose: () => void }) {
  const { insumos, movs, ubicaciones } = invStore.use();
  const [id, setId] = useState(preId);
  const sel = insumos.find((i) => i.id === id)!;
  const retiros = movs.filter((m) => m.insumoId === id && m.tipo === "Retiro" && m.cantidad - m.devuelto > 0);
  const [rid, setRid] = useState(retiros[0]?.id ?? "");
  const ret = retiros.find((r) => r.id === rid);
  const max = ret ? ret.cantidad - ret.devuelto : 0;
  const [cant, setCant] = useState("");
  const [estado, setEstado] = useState<"Utilizable" | "Vencido">("Utilizable");
  const [ubi, setUbi] = useState(sel.ubicacion);
  const [obs, setObs] = useState("");
  const [tried, setTried] = useState(false);
  const n = Number(cant) || 0;
  const loteOrig = sel.lotes.find((l) => l.codigo === ret?.alloc[0]?.codigo);
  const loteVenc = loteOrig ? loteVencido(loteOrig) : false;
  const err = { rid: !ret ? "Seleccione el retiro original." : "", cant: !(n > 0) ? "La cantidad debe ser mayor a 0." : n > max ? `No puede superar lo retirado pendiente (${u(max, sel.unidad)}).` : "" };
  const e = (k: keyof typeof err) => (tried || (k === "cant" && n > 0) ? err[k] || undefined : undefined);
  const submit = () => {
    setTried(true);
    if (err.rid || err.cant || !ret) return;
    const lote = ret.alloc[0]?.codigo;
    const est = loteVenc ? "Vencido" : estado;
    setInv((s) => ({
      ...s,
      insumos: s.insumos.map((i) => (i.id === id ? { ...i, lotes: i.lotes.map((l) => (l.codigo === lote ? { ...l, actual: l.actual + n } : l)) } : i)),
      movs: [
        { id: `M-${Date.now() % 10000}`, insumoId: id, ...nowStamp(), tipo: "Devolución", cantidad: n, alloc: [{ codigo: lote, cant: n }], destino: `Ret. ${ret.id} · ${est === "Utilizable" ? "Utilizable" : "Vencido — no utilizable"} · ${ubi}`, usuario: currentUser(), devuelto: 0, obs },
        ...s.movs.map((m) => (m.id === ret.id ? { ...m, devuelto: m.devuelto + n } : m)),
      ],
    }));
    logAudit({ modulo: "Insumos", accion: "DEVOLUCION", entidad: "MovimientoInsumo", entidadId: ret.id, resumen: `Devolución de ${u(n, sel.unidad)} de ${sel.nombre} (${est})` });
    toast(`Devolución registrada: ${u(n, sel.unidad)} de ${sel.nombre}`, "blue");
    onClose();
  };
  return (
    <Drawer title="Registrar devolución" subtitle="UC–LAB-09 · Reversión total o parcial de un retiro" onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={submit}>Registrar devolución →</Btn></>}>
      <div className="flex flex-col gap-4">
        <Field label="Insumo" required>
          <select className={inputCls} value={id} onChange={(ev) => { setId(ev.target.value); setRid(""); }}>
            {insumos.filter((i) => i.activo).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </Field>
        <Field label="Retiro original" required error={e("rid")}>
          {retiros.length === 0 ? <Banner tone="gray">No hay retiros con saldo pendiente de devolución para este insumo.</Banner> : (
            <div className="overflow-hidden rounded border border-border-light">
              <Table head={["", "Fecha", <span className="block text-right">Cantidad</span>, "Destino", <span className="block text-right">Devuelto</span>]}>
                {retiros.map((r) => (
                  <tr key={r.id} className={`${tr} cursor-pointer ${rid === r.id ? "bg-[#eff6ff]" : ""}`} onClick={() => setRid(r.id)}>
                    <td className={`${td} w-8`}><input type="radio" checked={rid === r.id} readOnly className="accent-accent" /></td>
                    <td className={tdMono}>{r.fecha}</td>
                    <td className={`${tdMono} text-right`}>{u(r.cantidad, sel.unidad)}</td>
                    <td className={td}>{r.destino}</td>
                    <td className={`${tdMono} text-right`}>{u(r.devuelto, sel.unidad)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cantidad a devolver" required error={e("cant")} hint={ret ? `Máx. ${u(max, sel.unidad)}` : undefined}><Qty value={cant} onChange={setCant} unit={sel.unidad} /></Field>
          <Field label="Ubicación" required>
            <select className={inputCls} value={ubi} onChange={(ev) => setUbi(ev.target.value)}>{ubicaciones.filter((x) => x.activo).map((x) => <option key={x.nombre}>{x.nombre}</option>)}</select>
          </Field>
        </div>
        <Field label="Estado del insumo" required>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            <Radio checked={estado === "Utilizable" && !loteVenc} onChange={() => setEstado("Utilizable")}>Utilizable</Radio>
            <Radio checked={estado === "Vencido" || loteVenc} onChange={() => setEstado("Vencido")}>Vencido</Radio>
          </div>
        </Field>
        <Field label="Observaciones"><textarea className={`${inputCls} !h-16 py-2`} value={obs} onChange={(ev) => setObs(ev.target.value)} /></Field>
        <Banner tone="amber">⚠ {loteVenc ? `El lote ${loteOrig?.codigo} está vencido: ` : "Si el lote está vencido, "}la devolución se registra como "Vencido — no utilizable" y no queda disponible.</Banner>
      </div>
    </Drawer>
  );
}

/* ─── 06 Configurar Umbrales ────────────────────────────── */
function Umbrales({ id, onClose }: { id: string; onClose: () => void }) {
  const i = invStore.use().insumos.find((x) => x.id === id)!;
  const [min, setMin] = useState(String(i.umbral));
  const [dias, setDias] = useState(String(i.dias));
  const [tried, setTried] = useState(false);
  const err = { min: !(Number(min) >= 1) ? "Debe ser un número mayor o igual a 1." : "", dias: !(Number(dias) >= 1 && Number(dias) <= 365) ? "Ingrese entre 1 y 365 días." : "" };
  const save = () => {
    setTried(true);
    if (err.min || err.dias) return;
    setInv((s) => ({ ...s, insumos: s.insumos.map((x) => (x.id === id ? { ...x, umbral: Number(min), dias: Number(dias) } : x)) }));
    logAudit({ modulo: "Insumos", accion: "MODIFICAR", entidad: "Insumo", entidadId: id, resumen: `Umbrales de ${i.nombre} actualizados`, cambios: [{ campo: "umbral_minimo", antes: u(i.umbral, i.unidad), despues: u(Number(min), i.unidad) }, { campo: "dias_alerta_vencimiento", antes: `${i.dias}`, despues: dias }] });
    toast("Umbrales actualizados. Las alertas se recalcularon.");
    onClose();
  };
  return (
    <Modal title={`Configurar umbrales — ${i.nombre}`} onClose={onClose} width={720} footer={<ModalFooter onCancel={onClose} onOk={save} label="Guardar cambios" />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Stock mínimo de alerta" required error={tried ? err.min || undefined : undefined}><Qty value={min} onChange={setMin} unit={i.unidad} /></Field>
          <Field label="Días de anticipación de vencimiento" required error={tried ? err.dias || undefined : undefined}><Qty value={dias} onChange={setDias} unit="días" /></Field>
        </div>
        <Banner tone="blue">ℹ Valores por defecto: 1 unidad y 30 días.<br />ℹ El Panel de Control mostrará alertas cuando el stock esté por debajo del mínimo o un lote esté por vencer.</Banner>
      </div>
    </Modal>
  );
}

/* ─── 07 Catálogos de Inventario ────────────────────────── */
function toggleInsumo(i: Insumo, activo: boolean) {
  setInv((s) => ({ ...s, insumos: s.insumos.map((x) => (x.id === i.id ? { ...x, activo } : x)) }));
  logAudit({ modulo: "Insumos", accion: activo ? "MODIFICAR" : "DESACTIVAR", entidad: "Insumo", entidadId: i.id, resumen: `${activo ? "Reactivación" : "Baja lógica"} de ${i.nombre}`, cambios: [{ campo: "estado", antes: activo ? "Inactivo" : "Activo", despues: activo ? "Activo" : "Inactivo" }] });
  toast(`${i.nombre} ${activo ? "reactivado" : "desactivado"}`, activo ? "green" : "gray");
}
function BajaInsumo({ i, onClose }: { i: Insumo; onClose: () => void }) {
  const c = calc(i);
  return (
    <Modal title="Desactivar insumo" onClose={onClose} footer={<ModalFooter danger onCancel={onClose} onOk={() => { toggleInsumo(i, false); onClose(); }} label="Desactivar" />}>
      <div className="flex flex-col gap-3 text-[13px]">
        <p className="m-0">¿Desactivar <strong>{i.nombre}</strong>?</p>
        {c.stock > 0 && <Banner tone="amber">⚠ El insumo tiene {u(c.stock, i.unidad)} en stock. Quedará inmovilizado hasta su reactivación.</Banner>}
        <p className="m-0 text-text-secondary">No admitirá ingresos, retiros ni devoluciones. Sus movimientos históricos se conservan.</p>
      </div>
    </Modal>
  );
}
function InsumoForm({ insumo, onClose }: { insumo?: Insumo; onClose: () => void }) {
  const { categorias, ubicaciones, insumos, movs } = invStore.use();
  const [f, setF] = useState({ nombre: insumo?.nombre ?? "", categoria: insumo?.categoria ?? "", unidad: insumo?.unidad ?? ("g" as Unidad), ubicacion: insumo?.ubicacion ?? "", umbral: String(insumo?.umbral ?? 1), dias: String(insumo?.dias ?? 30), descripcion: insumo?.descripcion ?? "" });
  const [tried, setTried] = useState(false);
  const dup = insumos.some((x) => x.id !== insumo?.id && x.nombre.toLowerCase() === f.nombre.trim().toLowerCase());
  const conMovs = !!insumo && (insumo.lotes.length > 0 || movs.some((m) => m.insumoId === insumo.id));
  const err = { nombre: !f.nombre.trim() ? "Ingrese el nombre." : dup ? "Ya existe un insumo con ese nombre." : "", categoria: !f.categoria ? "Seleccione la categoría." : "", ubicacion: !f.ubicacion ? "Seleccione la ubicación." : "" };
  const e = (k: keyof typeof err) => (tried ? err[k] || undefined : undefined);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const data = { nombre: f.nombre.trim(), categoria: f.categoria, unidad: f.unidad, ubicacion: f.ubicacion, umbral: Number(f.umbral) || 1, dias: Number(f.dias) || 30, descripcion: f.descripcion };
    if (insumo) setInv((s) => ({ ...s, insumos: s.insumos.map((x) => (x.id === insumo.id ? { ...x, ...data } : x)) }));
    else setInv((s) => ({ ...s, insumos: [...s.insumos, { id: `N${Date.now() % 100000}`, activo: true, lotes: [], ...data }] }));
    logAudit({ modulo: "Insumos", accion: insumo ? "MODIFICAR" : "CREAR", entidad: "Insumo", entidadId: insumo?.id ?? data.nombre, resumen: `${insumo ? "Edición" : "Alta"} de insumo ${data.nombre}` });
    toast(insumo ? "Insumo actualizado" : "Insumo creado");
    onClose();
  };
  return (
    <Modal title={insumo ? `Editar insumo — ${insumo.nombre}` : "Nuevo insumo"} onClose={onClose} width={720} footer={<ModalFooter onCancel={onClose} onOk={save} label="Guardar" />}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nombre" required error={e("nombre")}><input className={inputCls} value={f.nombre} onChange={(x) => setF({ ...f, nombre: x.target.value })} /></Field></div>
        <Field label="Categoría" required error={e("categoria")}>
          <select className={inputCls} value={f.categoria} onChange={(x) => setF({ ...f, categoria: x.target.value })}><option value="">Seleccionar…</option>{categorias.filter((c) => c.activo || c.nombre === insumo?.categoria).map((c) => <option key={c.nombre}>{c.nombre}</option>)}</select>
        </Field>
        <Field label="Unidad de medida" required hint={conMovs ? "No se puede cambiar: el insumo tiene movimientos." : undefined}>
          <select className={inputCls} disabled={conMovs} value={f.unidad} onChange={(x) => setF({ ...f, unidad: x.target.value as Unidad })}>{["g", "ml", "unidades"].map((x) => <option key={x}>{x}</option>)}</select>
        </Field>
        <Field label="Ubicación habitual" required error={e("ubicacion")}>
          <select className={inputCls} value={f.ubicacion} onChange={(x) => setF({ ...f, ubicacion: x.target.value })}><option value="">Seleccionar…</option>{ubicaciones.filter((c) => c.activo || c.nombre === insumo?.ubicacion).map((c) => <option key={c.nombre}>{c.nombre}</option>)}</select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Umbral mínimo" hint={`en ${f.unidad}`}><input className={`${inputCls} text-right font-mono`} value={f.umbral} onChange={(x) => setF({ ...f, umbral: x.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Días alerta" hint="por defecto 30"><input className={`${inputCls} text-right font-mono`} value={f.dias} onChange={(x) => setF({ ...f, dias: x.target.value.replace(/\D/g, "") })} /></Field>
        </div>
        <div className="sm:col-span-2"><Field label="Descripción"><textarea className={`${inputCls} !h-16 py-2`} value={f.descripcion} onChange={(x) => setF({ ...f, descripcion: x.target.value })} /></Field></div>
      </div>
    </Modal>
  );
}
type Kind = "Categorías" | "Ubicaciones";
function SimpleForm({ kind, item, onClose }: { kind: Kind; item?: Cat | Ubi; onClose: () => void }) {
  const s = invStore.use();
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [extra, setExtra] = useState(item ? ("descripcion" in item ? item.descripcion : item.tipo) : "");
  const [tried, setTried] = useState(false);
  const list: { nombre: string }[] = kind === "Categorías" ? s.categorias : s.ubicaciones;
  const dup = list.some((x) => x.nombre !== item?.nombre && x.nombre.toLowerCase() === nombre.trim().toLowerCase());
  const err = !nombre.trim() ? "Ingrese el nombre." : dup ? "Ya existe con ese nombre." : "";
  const save = () => {
    setTried(true);
    if (err) return;
    const n = nombre.trim();
    setInv((st) => {
      if (kind === "Categorías") {
        const c: Cat = { nombre: n, descripcion: extra, activo: item?.activo ?? true };
        return { ...st, categorias: item ? st.categorias.map((x) => (x.nombre === item.nombre ? c : x)) : [...st.categorias, c], insumos: item ? st.insumos.map((i) => (i.categoria === item.nombre ? { ...i, categoria: n } : i)) : st.insumos };
      }
      const ub: Ubi = { nombre: n, tipo: extra, activo: item?.activo ?? true };
      return { ...st, ubicaciones: item ? st.ubicaciones.map((x) => (x.nombre === item.nombre ? ub : x)) : [...st.ubicaciones, ub], insumos: item ? st.insumos.map((i) => (i.ubicacion === item.nombre ? { ...i, ubicacion: n } : i)) : st.insumos };
    });
    logAudit({ modulo: "Insumos", accion: item ? "MODIFICAR" : "CREAR", entidad: kind === "Categorías" ? "CategoriaInsumo" : "UbicacionAlmacenamiento", entidadId: n, resumen: `${item ? "Edición" : "Alta"} de ${kind === "Categorías" ? "categoría" : "ubicación"} ${n}` });
    toast("Cambios guardados");
    onClose();
  };
  return (
    <Modal title={`${item ? "Editar" : "Nueva"} ${kind === "Categorías" ? "categoría" : "ubicación"}`} onClose={onClose} width={720} footer={<ModalFooter onCancel={onClose} onOk={save} label="Guardar" />}>
      <div className="flex flex-col gap-4">
        <Field label="Nombre" required error={tried ? err || undefined : undefined}><input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <Field label={kind === "Categorías" ? "Descripción" : "Tipo"}><input className={inputCls} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={kind === "Ubicaciones" ? "Estante, Heladera (2-8 °C)…" : ""} /></Field>
      </div>
    </Modal>
  );
}
function Catalogos({ onNavigate, onBack }: { onNavigate: (p: string) => void; onBack: () => void }) {
  const s = invStore.use();
  const [tab, setTab] = useState<"Insumos" | Kind>("Insumos");
  const [form, setForm] = useState<null | { item?: Insumo | Cat | Ubi }>(null);
  const [baja, setBaja] = useState<Insumo | null>(null);
  const [page, setPage] = useState(1);
  const PAGE = 10;
  const toggleSimple = (kind: "categorias" | "ubicaciones", nombre: string) => {
    const enUso = s.insumos.some((i) => i.activo && (kind === "categorias" ? i.categoria : i.ubicacion) === nombre);
    const it = (s[kind] as { nombre: string; activo: boolean }[]).find((x) => x.nombre === nombre)!;
    if (it.activo && enUso) return toast(`No se puede desactivar: hay insumos activos que usan "${nombre}".`, "red");
    setInv((st) => ({ ...st, [kind]: (st[kind] as { nombre: string; activo: boolean }[]).map((x) => (x.nombre === nombre ? { ...x, activo: !x.activo } : x)) }));
    toast(`"${nombre}" ${it.activo ? "desactivada" : "reactivada"}`, "gray");
  };
  const simple: (Cat | Ubi)[] = tab === "Categorías" ? s.categorias : s.ubicaciones;
  return (
    <PageShell activePage="Insumos y Stock" onNavigate={onNavigate} section="Insumos y Stock" title="Catálogos de Inventario" actions={<Btn onClick={onBack}>← Volver</Btn>}>
      <Panel flush>
        <div className="flex flex-wrap items-center justify-between gap-2 pr-4">
          <SegTabs value={tab} options={["Insumos", "Categorías", "Ubicaciones"] as ("Insumos" | Kind)[]} onChange={(t) => { setTab(t); setPage(1); }} />
          <Btn variant="primary" onClick={() => setForm({})}>+ Nuevo</Btn>
        </div>
        {tab === "Insumos" ? (
          <>
            <Table head={["Nombre", "Unidad", "Categoría", "Ubicación", "Estado", ""]}>
              {s.insumos.slice((page - 1) * PAGE, page * PAGE).map((i) => (
                <tr key={i.id} className={`${tr} h-11`}>
                  <td className={`${td} font-semibold`}>{i.nombre}</td>
                  <td className={td}>{i.unidad}</td>
                  <td className={td}>{i.categoria}</td>
                  <td className={td}>{i.ubicacion}</td>
                  <td className={td}>{i.activo ? <Pill tone="green">✓ Activo</Pill> : <Pill tone="gray">○ Inactivo</Pill>}</td>
                  <td className={`${td} text-right`}>
                    <div className="flex justify-end gap-1.5">
                      <Btn className="!h-7 !px-2.5" onClick={() => setForm({ item: i })}>✏ Editar</Btn>
                      {i.activo ? <Btn variant="danger" className="!h-7 !px-2.5" onClick={() => setBaja(i)}>⏻ Desactivar</Btn> : <Btn className="!h-7 !px-2.5" onClick={() => toggleInsumo(i, true)}>Reactivar</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            <Pager page={page} total={s.insumos.length} size={PAGE} onPage={setPage} noun="insumos" />
          </>
        ) : (
          <Table head={["Nombre", tab === "Categorías" ? "Descripción" : "Tipo", <span className="block text-right">Insumos</span>, "Estado", ""]}>
            {simple.map((c) => {
              const count = s.insumos.filter((i) => (tab === "Categorías" ? i.categoria : i.ubicacion) === c.nombre).length;
              return (
                <tr key={c.nombre} className={`${tr} h-11`}>
                  <td className={`${td} font-semibold`}>{c.nombre}</td>
                  <td className={`${td} text-text-secondary`}>{"descripcion" in c ? c.descripcion : c.tipo}</td>
                  <td className={`${tdMono} text-right`}>{count}</td>
                  <td className={td}>{c.activo ? <Pill tone="green">✓ Activo</Pill> : <Pill tone="gray">○ Inactivo</Pill>}</td>
                  <td className={`${td} text-right`}>
                    <div className="flex justify-end gap-1.5">
                      <Btn className="!h-7 !px-2.5" onClick={() => setForm({ item: c })}>✏ Editar</Btn>
                      <Btn variant={c.activo ? "danger" : "secondary"} className="!h-7 !px-2.5" onClick={() => toggleSimple(tab === "Categorías" ? "categorias" : "ubicaciones", c.nombre)}>{c.activo ? "⏻ Desactivar" : "Reactivar"}</Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
      <div className="mt-3 text-[12px] text-text-muted">ℹ La baja es lógica: los registros desactivados no se ofrecen en nuevos movimientos, pero el histórico se conserva.</div>
      {form && tab === "Insumos" && <InsumoForm insumo={form.item as Insumo | undefined} onClose={() => setForm(null)} />}
      {form && tab !== "Insumos" && <SimpleForm kind={tab} item={form.item as Cat | Ubi | undefined} onClose={() => setForm(null)} />}
      {baja && <BajaInsumo i={baja} onClose={() => setBaja(null)} />}
    </PageShell>
  );
}
