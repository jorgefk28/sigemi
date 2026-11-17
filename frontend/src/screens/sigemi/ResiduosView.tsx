import { useState } from "react";
import { PageShell, Panel, Btn, Banner, Pill, Table, tr, td, tdMono, inputCls, Field, Modal, SegTabs } from "../components/ui";
import {
  createStore, currentUser, useRol, logAudit, toast, addReporte, Drawer, KpiCard, Pager, useCarga, EstadoSwitch, Skeleton,
  ErrorState, EmptyBox, Info, Radio, Check, selCls, HOY, fmtDate, isoToAr, arToIso, parseDate, num, nowStamp, downloadCsv,
} from "./core";
import { ANALISIS_SEL } from "./InsumosView";

/* ─── Modelo ────────────────────────────────────────────── */
interface CatRes { id: string; nombre: string; clase: string; descripcion: string; instrucciones: string[]; activo: boolean }
interface Disp { fecha: string; metodo: string; responsable: string; obs: string }
interface Residuo {
  id: string; fecha: string; hora: string; catId: string; volumen: number; peso: number;
  origenTipo: "Análisis" | "Práctica"; origen: string; descripcion: string; autor: string;
  disposicion: Disp | null; consolidado: string | null;
  historial: { fecha: string; hora: string; accion: string; usuario: string; detalle: string }[];
}
const CATS: CatRes[] = [
  { id: "C1", nombre: "Ácidos", clase: "I", descripcion: "Ácidos fuertes y soluciones de tinción ácidas (ácido fénico, ácido acético).", instrucciones: ["Almacenar en bidón de polietileno rotulado.", "No mezclar con bases ni solventes.", "Mantener tapado en bandeja de contención."], activo: true },
  { id: "C2", nombre: "Solventes orgánicos", clase: "II", descripcion: "Xilol, formaldehído, alcoholes de fijación.", instrucciones: ["Recipiente de vidrio ámbar con tapa hermética.", "Lejos de fuentes de calor."], activo: true },
  { id: "C3", nombre: "Otros", clase: "III", descripcion: "Residuos menores: colorantes, KOH diluido, restos de medios.", instrucciones: ["Bidón genérico rotulado con fecha de inicio."], activo: true },
  { id: "C4", nombre: "Metales pesados", clase: "I", descripcion: "Soluciones con mercurio o plata (en desuso).", instrucciones: ["Contenedor específico provisto por el operador."], activo: false },
];
const catLabel = (c?: CatRes) => (c ? `Clase ${c.clase} — ${c.nombre}` : "—");
const H = (fecha: string, hora: string, accion: string, usuario: string, detalle: string) => ({ fecha, hora, accion, usuario, detalle });
const R = (id: string, fecha: string, hora: string, catId: string, volumen: number, peso: number, origenTipo: "Análisis" | "Práctica", origen: string, autor: string, descripcion: string, extra: Partial<Residuo> = {}): Residuo => ({
  id, fecha, hora, catId, volumen, peso, origenTipo, origen, autor, descripcion, disposicion: null, consolidado: null,
  historial: [H(fecha, hora, "CREAR", autor, "Registro inicial")], ...extra,
});
const DISP_SEP: Disp = { fecha: "05/10/2026", metodo: "Recolección externa", responsable: "Ecoservicios Misiones S.R.L.", obs: "Manifiesto N° 2026-0921" };
const DISP_OCT: Disp = { fecha: "19/10/2026", metodo: "Recolección externa", responsable: "Ecoservicios Misiones S.R.L.", obs: "" };
const SEED: Residuo[] = [
  R("R-2026-018", "19/10/2026", "10:42", "C1", 250, 180, "Análisis", "MIC-2026-0042", "Ramírez, Claudia B.", "Residuo de tinción con ácido fénico.", { historial: [H("19/10/2026", "10:42", "CREAR", "Ramírez, Claudia B.", "Registro inicial"), H("19/10/2026", "11:05", "MODIFICAR", "Ramírez, Claudia B.", "Peso: 170 g → 180 g")] }),
  R("R-2026-017", "18/10/2026", "16:10", "C2", 500, 420, "Práctica", "Práctica 3", "Sosa, Martín", "Xilol de aclaramiento de preparados."),
  R("R-2026-016", "17/10/2026", "09:05", "C1", 750, 610, "Análisis", "MIC-2026-0038", "Ramírez, Claudia B.", "Ácido acético de lavado.", { disposicion: DISP_OCT }),
  R("R-2026-015", "15/10/2026", "11:30", "C3", 120, 95, "Práctica", "Práctica 2", "Sosa, Martín", "Restos de KOH diluido.", { consolidado: "RPT-0044" }),
  R("R-2026-014", "14/10/2026", "15:20", "C1", 300, 210, "Análisis", "MIC-2026-0341", "Ramírez, Claudia B.", "Tinción de examen directo."),
  R("R-2026-013", "13/10/2026", "09:48", "C2", 400, 340, "Análisis", "MIC-2026-0340", "Ferreyra, Ana", "Formaldehído de fijación."),
  R("R-2026-012", "10/10/2026", "12:15", "C3", 250, 230, "Práctica", "Práctica 1", "Sosa, Martín", "Colorantes de práctica de tinción."),
  R("R-2026-011", "08/10/2026", "10:00", "C1", 200, 160, "Análisis", "MIC-2026-0038", "Ramírez, Claudia B.", "", { disposicion: DISP_OCT }),
  R("R-2026-010", "06/10/2026", "14:30", "C2", 350, 300, "Práctica", "Práctica 2", "Sosa, Martín", "Alcohol de fijación usado."),
  R("R-2026-009", "02/10/2026", "08:40", "C3", 180, 160, "Análisis", "MIC-2026-0341", "Benítez, Laura", "Restos de medio Sabouraud líquido."),
  R("R-2026-008", "28/09/2026", "11:10", "C1", 400, 330, "Análisis", "MIC-2026-0340", "Ramírez, Claudia B.", "", { consolidado: "RPT-0044", disposicion: DISP_SEP }),
  R("R-2026-007", "22/09/2026", "16:00", "C2", 600, 520, "Práctica", "Práctica 4", "Sosa, Martín", "", { consolidado: "RPT-0044", disposicion: DISP_SEP }),
  R("R-2026-006", "15/09/2026", "10:25", "C3", 220, 190, "Práctica", "Práctica 3", "Sosa, Martín", "", { consolidado: "RPT-0044", disposicion: DISP_SEP }),
  R("R-2026-005", "09/09/2026", "09:15", "C1", 350, 280, "Análisis", "MIC-2026-0341", "Ferreyra, Ana", "", { consolidado: "RPT-0044", disposicion: DISP_SEP }),
];
const resStore = createStore({ residuos: SEED, cats: CATS });
const setRes = resStore.set;
const METODOS = ["Recolección externa", "Incineración", "Neutralización química", "Otro"];
const USUARIOS = ["Ramírez, Claudia B.", "Sosa, Martín", "Benítez, Laura", "Ferreyra, Ana"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const vol = (ml: number) => (ml >= 1000 ? `${num(ml / 1000, 2)} L` : `${num(ml)} ml`);
const pes = (g: number) => (g >= 1000 ? `${num(g / 1000, 2)} kg` : `${num(g)} g`);
const short = (n: string) => { const [a, b] = n.split(", "); return b ? `${a}, ${b[0]}.` : n; };
const DangerBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button className="h-8 cursor-pointer rounded border-none bg-[#dc2626] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#b91c1c]" onClick={onClick}>{children}</button>
);

function EstadoRes({ r }: { r: Residuo }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {r.disposicion ? <Pill tone="green">✓ Dispuesto</Pill> : <Pill tone="amber">◷ Generado</Pill>}
      {r.consolidado && <span title={`Consolidado en ${r.consolidado}: no editable`}><Pill tone="dark">🔒 Consolidado</Pill></span>}
    </div>
  );
}
const motivoNoEdit = (r: Residuo, rol: string) =>
  r.consolidado ? "Registro consolidado en un reporte mensual emitido" : r.disposicion ? "El residuo ya fue dispuesto" : rol !== "Administrador" && r.autor !== currentUser() ? "Solo el autor o un Administrador pueden editar" : "";

/* ─── Contenedor ────────────────────────────────────────── */
type Vista = { k: "panel" } | { k: "det"; id: string } | { k: "disp"; pre?: string[] } | { k: "mes" } | { k: "cat" };
export default function ResiduosView({ onNavigate }: { onNavigate: (p: string, params?: Record<string, unknown>) => void }) {
  const [vista, setVista] = useState<Vista>({ k: "panel" });
  const [form, setForm] = useState<null | { id?: string }>(null);
  const rol = useRol();
  const admin = rol === "Administrador";
  const back = () => setVista({ k: "panel" });
  return (
    <>
      {vista.k === "panel" && <PanelRes admin={admin} rol={rol} onNavigate={onNavigate} go={setVista} onNuevo={() => setForm({})} onEdit={(id) => setForm({ id })} />}
      {vista.k === "det" && <DetalleRes id={vista.id} rol={rol} onNavigate={onNavigate} onBack={back} onEdit={() => setForm({ id: vista.id })} onDisp={() => setVista({ k: "disp", pre: [vista.id] })} />}
      {vista.k === "disp" && admin && <Disposicion pre={vista.pre} onNavigate={onNavigate} onBack={back} />}
      {vista.k === "mes" && admin && <ReporteMensual onNavigate={onNavigate} onBack={back} />}
      {vista.k === "cat" && admin && <CategoriasRes onNavigate={onNavigate} onBack={back} />}
      {form && <RegistroRes id={form.id} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); setVista({ k: "det", id }); }} />}
    </>
  );
}

/* ─── 08 Panel de Residuos ──────────────────────────────── */
function PanelRes({ admin, rol, onNavigate, go, onNuevo, onEdit }: { admin: boolean; rol: string; onNavigate: (p: string) => void; go: (v: Vista) => void; onNuevo: () => void; onEdit: (id: string) => void }) {
  const { residuos, cats } = resStore.use();
  const carga = useCarga();
  const hoy = arToIso(fmtDate(HOY));
  const [desde, setDesde] = useState("2026-10-01");
  const [hasta, setHasta] = useState(hoy);
  const [fCat, setFCat] = useState("");
  const [fUsr, setFUsr] = useState("");
  const [fEst, setFEst] = useState("");
  const [soloCons, setSoloCons] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"Todos" | "Pendientes" | "Dispuestos">("Todos");
  const [page, setPage] = useState(1);
  const inRange = (r: Residuo) => { const d = arToIso(r.fecha); return (!desde || d >= desde) && (!hasta || d <= hasta); };
  const base = residuos.filter((r) => inRange(r) && (!fCat || r.catId === fCat) && (!fUsr || r.autor === fUsr) && (!fEst || (fEst === "Dispuesto" ? !!r.disposicion : !r.disposicion)) && (!soloCons || !!r.consolidado) && (!q || (r.descripcion + r.origen + r.id).toLowerCase().includes(q.toLowerCase())));
  const pend = base.filter((r) => !r.disposicion);
  const rows = tab === "Todos" ? base : tab === "Pendientes" ? pend : base.filter((r) => r.disposicion);
  const mes = residuos.filter((r) => r.fecha.endsWith("/10/2026"));
  const empty = carga.estado === "Vacío";
  const clear = () => { setDesde("2026-10-01"); setHasta(hoy); setFCat(""); setFUsr(""); setFEst(""); setSoloCons(false); setQ(""); setPage(1); };
  const PAGE = 10;
  const tabLabel = `Pendientes de disposición (${pend.length})`;
  return (
    <PageShell activePage="Control de Residuos" onNavigate={onNavigate} section="Insumos" title="Control de Residuos" actions={
      <>
        <EstadoSwitch value={carga.estado} onChange={carga.setEstado} />
        {admin && <Btn onClick={() => go({ k: "cat" })}>⚙ Categorías</Btn>}
        {admin && <Btn onClick={() => go({ k: "mes" })}>▤ Reporte mensual</Btn>}
        {admin && <Btn onClick={() => go({ k: "disp" })}>Registrar disposición</Btn>}
        <Btn variant="primary" onClick={onNuevo}>+ Registrar residuo</Btn>
      </>
    }>
      {carga.estado === "Cargando" ? <Skeleton kpis={4} /> : carga.estado === "Error" ? <ErrorState text="No se pudieron cargar los residuos." onRetry={carga.reintentar} /> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Registros del mes" value={empty ? 0 : mes.length} sub="Octubre 2026" tone="blue" />
            <KpiCard label="Volumen total" value={empty ? "0 ml" : vol(mes.reduce((a, r) => a + r.volumen, 0))} sub="generado en el mes" tone="teal" />
            <KpiCard label="Peso total" value={empty ? "0 g" : pes(mes.reduce((a, r) => a + r.peso, 0))} sub="generado en el mes" tone="teal" />
            <KpiCard label="Pendientes" value={empty ? 0 : residuos.filter((r) => !r.disposicion).length} sub="◷ sin disposición final" tone="amber" onClick={() => { setTab("Pendientes"); setPage(1); }} active={tab === "Pendientes"} />
          </div>
          <Panel flush>
            <div className="flex flex-wrap items-center gap-2 border-b border-border-light px-4 py-3">
              <label className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">Desde <input type="date" className={selCls} value={desde} onChange={(e) => { setDesde(e.target.value); setPage(1); }} /></label>
              <label className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">Hasta <input type="date" className={selCls} value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(1); }} /></label>
              <select className={selCls} value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="">Categoría: todas</option>{cats.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}</select>
              <select className={selCls} value={fUsr} onChange={(e) => setFUsr(e.target.value)}><option value="">Usuario: todos</option>{USUARIOS.map((x) => <option key={x}>{x}</option>)}</select>
              <select className={selCls} value={fEst} onChange={(e) => setFEst(e.target.value)}><option value="">Estado: todos</option><option>Generado</option><option>Dispuesto</option></select>
              <Check checked={soloCons} onChange={setSoloCons}>Solo consolidados</Check>
              <input className={`${inputCls} !w-[200px]`} placeholder="🔍 Buscar descripción…" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="flex-1" />
              <Btn variant="ghost" onClick={clear}>Limpiar filtros</Btn>
            </div>
            <SegTabs value={tab === "Pendientes" ? tabLabel : tab} options={["Todos", tabLabel, "Dispuestos"]} onChange={(t) => { setTab(t === "Todos" ? "Todos" : t === "Dispuestos" ? "Dispuestos" : "Pendientes"); setPage(1); }} />
            {empty ? (
              <EmptyBox icon="⚗" title="No hay residuos registrados en el período" text="Registre la generación de residuos químicos para mantener la trazabilidad." action={<Btn variant="primary" onClick={onNuevo}>+ Registrar residuo</Btn>} />
            ) : rows.length === 0 ? (
              <EmptyBox icon="🔍" title="No hay residuos que coincidan con los filtros" action={<Btn onClick={clear}>Limpiar filtros</Btn>} />
            ) : (
              <>
                <Table head={["Fecha/hora", "Categoría", <span className="block text-right">Volumen</span>, <span className="block text-right">Peso</span>, "Origen", "Estado", "Registrado por", ""]}>
                  {rows.slice((page - 1) * PAGE, page * PAGE).map((r) => {
                    const m = motivoNoEdit(r, rol);
                    return (
                      <tr key={r.id} className={`${tr} h-12 cursor-pointer`} onClick={() => go({ k: "det", id: r.id })}>
                        <td className={tdMono}>{r.fecha.slice(0, 5)} {r.hora}</td>
                        <td className={td}>{catLabel(cats.find((c) => c.id === r.catId))}</td>
                        <td className={`${tdMono} text-right`}>{num(r.volumen)} ml</td>
                        <td className={`${tdMono} text-right`}>{num(r.peso)} g</td>
                        <td className={r.origenTipo === "Análisis" ? tdMono : td}>{r.origen}</td>
                        <td className={td}><EstadoRes r={r} /></td>
                        <td className={`${td} text-text-secondary`}>{short(r.autor)}</td>
                        <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Btn className="!h-7 !px-2.5" onClick={() => go({ k: "det", id: r.id })}>Ver</Btn>
                            <span title={m}><Btn className="!h-7 !px-2.5" disabled={!!m} onClick={() => onEdit(r.id)}>Editar</Btn></span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
                <Pager page={page} total={rows.length} size={PAGE} onPage={setPage} noun="registros" />
              </>
            )}
          </Panel>
        </div>
      )}
    </PageShell>
  );
}

/* ─── 09 Registrar generación / edición ─────────────────── */
function RegistroRes({ id, onClose, onSaved }: { id?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const { residuos, cats } = resStore.use();
  const rol = useRol();
  const orig = residuos.find((r) => r.id === id);
  const now = nowStamp();
  const [f, setF] = useState({
    fecha: arToIso(orig?.fecha ?? now.fecha), hora: orig?.hora ?? now.hora, catId: orig?.catId ?? "", volumen: orig ? String(orig.volumen) : "", peso: orig ? String(orig.peso) : "",
    origenTipo: orig?.origenTipo ?? (rol === "Profesor" ? "Práctica" : "Análisis"), origen: orig?.origen ?? "", descripcion: orig?.descripcion ?? "", motivo: "",
  });
  const [tried, setTried] = useState(false);
  const cat = cats.find((c) => c.id === f.catId);
  const err = {
    fecha: !f.fecha ? "Ingrese la fecha." : f.fecha > arToIso(fmtDate(HOY)) ? "La fecha no puede ser futura." : "",
    catId: !f.catId ? "Seleccione la categoría." : "",
    volumen: !(Number(f.volumen) > 0) ? "Ingrese el volumen (mayor a 0)." : "",
    peso: !(Number(f.peso) > 0) ? "Ingrese el peso (mayor a 0)." : "",
    origen: !f.origen ? (f.origenTipo === "Análisis" ? "Seleccione el análisis." : "Seleccione la práctica.") : "",
    motivo: orig && !f.motivo.trim() ? "Indique el motivo de la corrección." : "",
  };
  const e = (k: keyof typeof err) => (tried ? err[k] || undefined : undefined);
  const save = () => {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    const data = { fecha: isoToAr(f.fecha), hora: f.hora, catId: f.catId, volumen: Number(f.volumen), peso: Number(f.peso), origenTipo: f.origenTipo as Residuo["origenTipo"], origen: f.origen, descripcion: f.descripcion };
    const st = nowStamp();
    if (orig) {
      const lbl: Record<string, string> = { fecha: "Fecha", hora: "Hora", catId: "Categoría", volumen: "Volumen", peso: "Peso", origen: "Origen", descripcion: "Descripción", origenTipo: "Tipo de origen" };
      const fmt = (k: string, v: unknown) => (k === "catId" ? catLabel(cats.find((c) => c.id === v)) : k === "volumen" ? `${v} ml` : k === "peso" ? `${v} g` : String(v || "—"));
      const cambios = (Object.keys(data) as (keyof typeof data)[]).filter((k) => data[k] !== orig[k]).map((k) => ({ campo: lbl[k], antes: fmt(k, orig[k]), despues: fmt(k, data[k]) }));
      if (!cambios.length) return toast("No hay cambios para guardar", "gray");
      setRes((s) => ({ ...s, residuos: s.residuos.map((r) => (r.id === orig.id ? { ...r, ...data, historial: [...r.historial, { ...st, accion: "MODIFICAR", usuario: currentUser(), detalle: cambios.map((c) => `${c.campo}: ${c.antes} → ${c.despues}`).join(" · ") + ` (${f.motivo})` }] } : r)) }));
      logAudit({ modulo: "Residuos", accion: "MODIFICAR", entidad: "ResiduoQuimico", entidadId: orig.id, resumen: `Corrección de residuo — ${f.motivo}`, cambios });
      toast(`Residuo ${orig.id} actualizado`);
      onSaved(orig.id);
    } else {
      const nid = `R-2026-${String(Math.max(...residuos.map((r) => Number(r.id.slice(-3)))) + 1).padStart(3, "0")}`;
      setRes((s) => ({ ...s, residuos: [{ id: nid, ...data, autor: currentUser(), disposicion: null, consolidado: null, historial: [{ ...st, accion: "CREAR", usuario: currentUser(), detalle: "Registro inicial" }] }, ...s.residuos] }));
      logAudit({ modulo: "Residuos", accion: "CREAR", entidad: "ResiduoQuimico", entidadId: nid, resumen: `Alta de residuo — ${catLabel(cat)}, ${data.volumen} ml / ${data.peso} g`, cambios: [{ campo: "categoria", antes: "—", despues: catLabel(cat) }, { campo: "volumen", antes: "—", despues: `${data.volumen} ml` }, { campo: "peso", antes: "—", despues: `${data.peso} g` }, { campo: "origen", antes: "—", despues: data.origen }, { campo: "estado", antes: "—", despues: "Generado" }] });
      toast(`Residuo ${nid} registrado`);
      onSaved(nid);
    }
  };
  const Unit = ({ k, unit }: { k: "volumen" | "peso"; unit: string }) => (
    <div className="relative"><input className={`${inputCls} pr-12 text-right font-mono`} value={f[k]} onChange={(x) => setF({ ...f, [k]: x.target.value.replace(/\D/g, "") })} /><span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-text-muted">{unit}</span></div>
  );
  return (
    <Drawer title={orig ? `Editar residuo #${orig.id}` : "Registrar generación de residuo"} subtitle={orig ? "UC–LAB-11 · La corrección queda auditada (valor anterior / nuevo)" : "UC–LAB-03 · Estado inicial: Generado"} onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={save}>{orig ? "Guardar cambios" : "Registrar residuo →"}</Btn></>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha" required error={e("fecha")} hint="Editable"><input type="date" className={inputCls} value={f.fecha} onChange={(x) => setF({ ...f, fecha: x.target.value })} /></Field>
          <Field label="Hora" required><input type="time" className={inputCls} value={f.hora} onChange={(x) => setF({ ...f, hora: x.target.value })} /></Field>
        </div>
        <Field label="Categoría" required error={e("catId")} hint={cat ? `→ Clase de peligrosidad: ${cat.clase}` : undefined}>
          <select className={inputCls} value={f.catId} onChange={(x) => setF({ ...f, catId: x.target.value })}>
            <option value="">Seleccionar…</option>
            {cats.filter((c) => c.activo || c.id === orig?.catId).map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
          </select>
        </Field>
        {cat && cat.instrucciones.length > 0 && (
          <div className="rounded border border-border-light bg-bg px-3 py-2 text-[12px] text-text-secondary">
            <div className="mb-1 text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">Instrucciones de almacenamiento</div>
            <ol className="m-0 pl-4">{cat.instrucciones.map((i) => <li key={i}>{i}</li>)}</ol>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Volumen" required error={e("volumen")}>{Unit({ k: "volumen", unit: "ml" })}</Field>
          <Field label="Peso" required error={e("peso")}>{Unit({ k: "peso", unit: "g" })}</Field>
        </div>
        <Field label="Origen" required>
          <div className="flex gap-5 pt-1">
            <Radio checked={f.origenTipo === "Análisis"} onChange={() => setF({ ...f, origenTipo: "Análisis", origen: "" })}>Análisis micológico</Radio>
            <Radio checked={f.origenTipo === "Práctica"} onChange={() => setF({ ...f, origenTipo: "Práctica", origen: "" })}>Práctica educativa</Radio>
          </div>
        </Field>
        <Field label={f.origenTipo === "Análisis" ? "Análisis" : "Práctica"} required error={e("origen")}>
          <select className={inputCls} value={f.origen} onChange={(x) => setF({ ...f, origen: x.target.value })}>
            <option value="">{f.origenTipo === "Análisis" ? "🔍 Buscar análisis…" : "Seleccionar práctica…"}</option>
            {f.origenTipo === "Análisis" ? ANALISIS_SEL.map((a) => <option key={a.id} value={a.id}>{a.id} — {a.paciente}</option>) : ["Práctica 1", "Práctica 2", "Práctica 3", "Práctica 4"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Descripción"><textarea className={`${inputCls} !h-20 py-2`} value={f.descripcion} onChange={(x) => setF({ ...f, descripcion: x.target.value })} /></Field>
        {orig && <Field label="Motivo de la corrección" required error={e("motivo")}><input className={inputCls} value={f.motivo} onChange={(x) => setF({ ...f, motivo: x.target.value })} placeholder="Ej.: error de pesada" /></Field>}
        <Banner tone="blue">ℹ Ambos valores (volumen y peso) son obligatorios. El registro queda vinculado a {orig ? orig.autor : currentUser()} y a la fecha/hora indicadas.</Banner>
      </div>
    </Drawer>
  );
}

/* ─── 10 Detalle / Edición de Residuo ───────────────────── */
function DetalleRes({ id, rol, onNavigate, onBack, onEdit, onDisp }: { id: string; rol: string; onNavigate: (p: string) => void; onBack: () => void; onEdit: () => void; onDisp: () => void }) {
  const { residuos, cats } = resStore.use();
  const r = residuos.find((x) => x.id === id)!;
  const cat = cats.find((c) => c.id === r.catId);
  const an = ANALISIS_SEL.find((a) => a.id === r.origen);
  const m = motivoNoEdit(r, rol);
  return (
    <PageShell activePage="Control de Residuos" onNavigate={onNavigate} section="Control de Residuos" title={`Residuo #${r.id}`} actions={
      <>
        <Btn onClick={onBack}>← Volver</Btn>
        <span title={m}><Btn disabled={!!m} onClick={onEdit}>✏ Editar</Btn></span>
        {rol === "Administrador" && <span title={r.disposicion ? "Ya tiene disposición final" : ""}><Btn variant="primary" disabled={!!r.disposicion} onClick={onDisp}>Disposición final</Btn></span>}
      </>
    }>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-text-secondary">Estado:</span>
          <EstadoRes r={r} />
          {r.consolidado && <span className="text-[12px] text-text-secondary">Incluido en el reporte {r.consolidado}. La edición está bloqueada; la disposición final sigue habilitada.</span>}
        </div>
        <Panel title="Datos del residuo">
          <div className="grid grid-cols-3 gap-5">
            <Info label="Fecha/hora"><span className="font-mono">{r.fecha} {r.hora}</span></Info>
            <Info label="Categoría">{catLabel(cat)}</Info>
            <Info label="Clase de peligrosidad">{cat?.clase}</Info>
            <Info label="Volumen"><span className="font-mono">{num(r.volumen)} ml</span></Info>
            <Info label="Peso"><span className="font-mono">{num(r.peso)} g</span></Info>
            <Info label="Registrado por">{r.autor}</Info>
            <div className="col-span-3"><Info label="Descripción">{r.descripcion || "—"}</Info></div>
          </div>
        </Panel>
        <div className="grid grid-cols-2 gap-4">
          <Panel title="Origen">
            {r.origenTipo === "Análisis" ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px]"><span className="font-mono">{r.origen}</span> — {an?.tipo} — {an?.paciente}</span>
                {rol !== "Profesor" && <Btn variant="ghost" className="self-start" onClick={() => onNavigate("Detalle de Análisis")}>Ver análisis →</Btn>}
              </div>
            ) : <span className="text-[13px]">Práctica educativa: <strong>{r.origen}</strong></span>}
          </Panel>
          <Panel title="Disposición final">
            {r.disposicion ? (
              <div className="grid grid-cols-2 gap-3">
                <Info label="Fecha">{r.disposicion.fecha}</Info>
                <Info label="Método">{r.disposicion.metodo}</Info>
                <div className="col-span-2"><Info label="Responsable / empresa">{r.disposicion.responsable}</Info></div>
                {r.disposicion.obs && <div className="col-span-2"><Info label="Observaciones">{r.disposicion.obs}</Info></div>}
              </div>
            ) : <div className="flex items-center gap-2 text-[13px] text-text-secondary"><Pill tone="amber">◷ Pendiente</Pill> No se registró disposición final.</div>}
          </Panel>
        </div>
        <Panel title="Historial" meta="Auditoría del registro" flush>
          <Table head={["Fecha/hora", "Acción", "Usuario", "Detalle"]}>
            {[...r.historial].reverse().map((h, i) => (
              <tr key={i} className={tr}>
                <td className={tdMono}>{h.fecha.slice(0, 5)} {h.hora}</td>
                <td className={td}><Pill tone={h.accion === "CREAR" ? "green" : h.accion === "DISPOSICION" ? "teal" : "blue"}>{h.accion}</Pill></td>
                <td className={td}>{short(h.usuario)}</td>
                <td className={`${td} text-text-secondary`}>{h.detalle}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </PageShell>
  );
}

/* ─── 11 Disposición Final ──────────────────────────────── */
function Disposicion({ pre, onNavigate, onBack }: { pre?: string[]; onNavigate: (p: string) => void; onBack: () => void }) {
  const { residuos, cats } = resStore.use();
  const pend = residuos.filter((r) => !r.disposicion);
  const [sel, setSel] = useState<string[]>(pre ?? []);
  const [f, setF] = useState({ fecha: arToIso(fmtDate(HOY)), metodo: "Recolección externa", otro: "", resp: "", obs: "" });
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const chosen = pend.filter((r) => sel.includes(r.id));
  const tv = chosen.reduce((a, r) => a + r.volumen, 0);
  const tp = chosen.reduce((a, r) => a + r.peso, 0);
  const err = {
    sel: !chosen.length ? "Seleccione al menos un residuo." : "",
    resp: !f.resp.trim() ? "Ingrese el responsable o la empresa." : "",
    otro: f.metodo === "Otro" && !f.otro.trim() ? "Describa el método." : "",
    fecha: !f.fecha ? "Ingrese la fecha." : chosen.some((r) => arToIso(r.fecha) > f.fecha) ? "La fecha no puede ser anterior a la generación de los residuos." : f.fecha > arToIso(fmtDate(HOY)) ? "La fecha no puede ser futura." : "",
  };
  const e = (k: keyof typeof err) => (tried ? err[k] || undefined : undefined);
  const metodo = f.metodo === "Otro" ? `Otro: ${f.otro}` : f.metodo;
  const ejecutar = () => {
    const d: Disp = { fecha: isoToAr(f.fecha), metodo, responsable: f.resp, obs: f.obs };
    const st = nowStamp();
    setRes((s) => ({ ...s, residuos: s.residuos.map((r) => (sel.includes(r.id) && !r.disposicion ? { ...r, disposicion: d, historial: [...r.historial, { ...st, accion: "DISPOSICION", usuario: currentUser(), detalle: `${metodo} — ${f.resp}` }] } : r)) }));
    logAudit({ modulo: "Residuos", accion: "DISPOSICION", entidad: "DisposicionFinal", entidadId: chosen.map((r) => r.id).join(", "), resumen: `${chosen.length} residuos dispuestos (${num(tv)} ml)`, cambios: [{ campo: "estado", antes: "Generado", despues: "Dispuesto" }, { campo: "metodo", antes: "—", despues: metodo }, { campo: "responsable", antes: "—", despues: f.resp }] });
    toast(`Disposición final registrada para ${chosen.length} residuos`);
    onBack();
  };
  return (
    <PageShell activePage="Control de Residuos" onNavigate={onNavigate} section="Control de Residuos" title="Disposición final de residuos" actions={<Btn onClick={onBack}>← Volver</Btn>}>
      {pend.length === 0 ? (
        <Panel><EmptyBox icon="✓" title="No hay residuos pendientes de disposición" text="Todos los residuos registrados tienen disposición final." action={<Btn onClick={onBack}>Volver al panel</Btn>} /></Panel>
      ) : (
        <div className="flex flex-col gap-4">
          <Panel title={`Residuos pendientes (${pend.length})`} meta={<Check checked={sel.length === pend.length} onChange={(v) => setSel(v ? pend.map((r) => r.id) : [])}>Seleccionar todos</Check>} flush>
            <Table head={["", "Fecha", "Categoría", <span className="block text-right">Volumen</span>, <span className="block text-right">Peso</span>, "Origen", ""]}>
              {pend.map((r) => (
                <tr key={r.id} className={`${tr} cursor-pointer ${sel.includes(r.id) ? "bg-[#eff6ff]" : ""}`} onClick={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}>
                  <td className={`${td} w-8`}><input type="checkbox" readOnly checked={sel.includes(r.id)} className="accent-accent" aria-label={`Seleccionar ${r.id}`} /></td>
                  <td className={tdMono}>{r.fecha.slice(0, 5)}</td>
                  <td className={td}>{catLabel(cats.find((c) => c.id === r.catId))}</td>
                  <td className={`${tdMono} text-right`}>{num(r.volumen)} ml</td>
                  <td className={`${tdMono} text-right`}>{num(r.peso)} g</td>
                  <td className={td}>{r.origen}</td>
                  <td className={td}>{r.consolidado && <Pill tone="dark">🔒 Consolidado</Pill>}</td>
                </tr>
              ))}
            </Table>
            <div className="flex gap-6 border-t border-border-light bg-bg px-4 py-2.5 text-[12.5px]">
              <span>Seleccionados: <strong>{chosen.length}</strong></span>
              <span>Volumen: <strong className="font-mono">{num(tv)} ml</strong></span>
              <span>Peso: <strong className="font-mono">{num(tp)} g</strong></span>
              {e("sel") && <span className="text-cancelado-text">{e("sel")}</span>}
            </div>
          </Panel>
          <Panel title="Datos de la disposición">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Fecha de disposición" required error={e("fecha")}><input type="date" className={inputCls} value={f.fecha} onChange={(x) => setF({ ...f, fecha: x.target.value })} /></Field>
              <Field label="Método de tratamiento" required><select className={inputCls} value={f.metodo} onChange={(x) => setF({ ...f, metodo: x.target.value })}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select></Field>
              {f.metodo === "Otro" ? <Field label="Especificar método" required error={e("otro")}><input className={inputCls} value={f.otro} onChange={(x) => setF({ ...f, otro: x.target.value })} /></Field> : <div />}
              <div className="col-span-3"><Field label="Responsable / empresa" required error={e("resp")}><input className={inputCls} value={f.resp} onChange={(x) => setF({ ...f, resp: x.target.value })} placeholder="Ej.: Ecoservicios Misiones S.R.L." /></Field></div>
              <div className="col-span-3"><Field label="Observaciones"><input className={inputCls} value={f.obs} onChange={(x) => setF({ ...f, obs: x.target.value })} placeholder="N° de manifiesto, condiciones de retiro…" /></Field></div>
            </div>
            <div className="mt-4"><Banner tone="amber">⚠ La disposición final es irreversible. Los residuos seleccionados quedarán en estado "Dispuesto".</Banner></div>
            <div className="mt-4 flex justify-between">
              <Btn onClick={onBack}>Cancelar</Btn>
              <DangerBtn onClick={() => { setTried(true); if (!Object.values(err).some(Boolean)) setConfirm(true); }}>Confirmar disposición final</DangerBtn>
            </div>
          </Panel>
        </div>
      )}
      {confirm && (
        <Modal title="Confirmar disposición final" onClose={() => setConfirm(false)} footer={<div className="flex w-full justify-between"><Btn onClick={() => setConfirm(false)}>Cancelar</Btn><DangerBtn onClick={ejecutar}>Sí, registrar disposición</DangerBtn></div>}>
          <p className="m-0 text-[13px]">Se registrará la disposición final de <strong>{chosen.length} residuos</strong> ({num(tv)} ml / {num(tp)} g) por <strong>{metodo}</strong> a cargo de {f.resp}.</p>
          <p className="mt-2 mb-0 text-[12.5px] text-text-secondary">Esta acción no se puede deshacer desde la aplicación.</p>
        </Modal>
      )}
    </PageShell>
  );
}

/* ─── 12 Reporte Mensual ────────────────────────────────── */
function ReporteMensual({ onNavigate, onBack }: { onNavigate: (p: string) => void; onBack: () => void }) {
  const { residuos, cats } = resStore.use();
  const [mes, setMes] = useState({ m: 9, y: 2026 });
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const key = `${mes.m}-${mes.y}`;
  const del = residuos.filter((r) => { const d = parseDate(r.fecha); return d.getMonth() === mes.m && d.getFullYear() === mes.y; });
  const emitido = del.length > 0 && del.every((r) => r.consolidado);
  const tot = { v: del.reduce((a, r) => a + r.volumen, 0), p: del.reduce((a, r) => a + r.peso, 0) };
  const porCat = cats.map((c) => { const l = del.filter((r) => r.catId === c.id); return { c, n: l.length, v: l.reduce((a, r) => a + r.volumen, 0), p: l.reduce((a, r) => a + r.peso, 0) }; }).filter((x) => x.n);
  const mover = (d: number) => { let m = mes.m + d; let y = mes.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } if (y > 2026 || (y === 2026 && m > 9) || y < 2026) return; setMes({ m, y }); setPreview(null); };
  const generar = () => { setLoading(true); setTimeout(() => { setLoading(false); setPreview(key); }, 700); };
  const titulo = `${MESES[mes.m]} ${mes.y}`;
  const mm = String(mes.m + 1).padStart(2, "0");
  const ultimo = new Date(mes.y, mes.m + 1, 0).getDate();
  const emitir = () => {
    const id = addReporte({ tipo: "Residuos", periodo: titulo, formato: "PDF", registros: del.length, filtros: "Reporte mensual consolidado" });
    setRes((s) => ({ ...s, residuos: s.residuos.map((r) => (del.some((d) => d.id === r.id) ? { ...r, consolidado: r.consolidado ?? id } : r)) }));
    toast(`Reporte ${titulo} emitido: ${del.length} registros consolidados`);
    setConfirm(false);
  };
  const max = Math.max(1, ...porCat.map((x) => x.v));
  return (
    <PageShell activePage="Control de Residuos" onNavigate={onNavigate} section="Control de Residuos" title="Reporte mensual de residuos" actions={<Btn onClick={onBack}>← Volver</Btn>}>
      <div className="flex flex-col gap-4">
        <Panel>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-secondary">Mes:</span>
            <Btn className="!px-2.5" onClick={() => mover(-1)} aria-label="Mes anterior">◀</Btn>
            <select className={selCls} value={key} onChange={(e) => { const [m, y] = e.target.value.split("-").map(Number); setMes({ m, y }); setPreview(null); }}>
              {Array.from({ length: 10 }, (_, i) => <option key={i} value={`${i}-2026`}>{MESES[i]} 2026</option>)}
            </select>
            <Btn className="!px-2.5" onClick={() => mover(1)} aria-label="Mes siguiente">▶</Btn>
            {emitido && <Pill tone="dark">🔒 Emitido y consolidado</Pill>}
            <div className="flex-1" />
            <Btn variant="primary" onClick={generar}>Generar previsualización</Btn>
          </div>
        </Panel>
        {loading ? <Skeleton rows={5} kpis={3} /> : preview !== key ? (
          <Panel><EmptyBox icon="▤" title="Seleccione un mes y genere la previsualización" text="El reporte consolida todos los residuos del mes, dispuestos o pendientes de disposición." /></Panel>
        ) : del.length === 0 ? (
          <Panel><EmptyBox icon="○" title={`No hay residuos registrados en ${titulo}`} text="No se puede emitir un reporte vacío." /></Panel>
        ) : (
          <>
            <div className="rounded-md border border-border bg-surface px-10 py-8 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between border-b-2 border-text-primary pb-4">
                <div>
                  <div className="text-[10.5px] font-semibold tracking-[0.08em] text-text-muted uppercase">SIGEMI · Lab. de Micología · UNaM</div>
                  <h2 className="m-0 mt-1 text-[20px] font-bold">Reporte de Residuos Químicos — {titulo}</h2>
                </div>
                <div className="text-right text-[12px] text-text-secondary">Generado por: Lic. {currentUser()} (Admin)<br />Fecha: {fmtDate(HOY)} 11:20<br />Período: 01/{mm}/{mes.y} — {ultimo}/{mm}/{mes.y}</div>
              </div>
              <div className="my-5 grid grid-cols-3 gap-3">
                <KpiCard label="Total registros" value={del.length} tone="blue" />
                <KpiCard label="Volumen total" value={vol(tot.v)} tone="teal" />
                <KpiCard label="Peso total" value={pes(tot.p)} tone="teal" />
              </div>
              <h3 className="mb-2 text-[12px] font-bold tracking-[0.06em] uppercase">Por categoría</h3>
              <div className="grid grid-cols-2 gap-6">
                <Table head={["Categoría", <span className="block text-right">Registros</span>, <span className="block text-right">Volumen</span>, <span className="block text-right">Peso</span>, <span className="block text-right">%</span>]}>
                  {porCat.map((x) => (
                    <tr key={x.c.id} className={tr}>
                      <td className={td}>{catLabel(x.c)}</td>
                      <td className={`${tdMono} text-right`}>{x.n}</td>
                      <td className={`${tdMono} text-right`}>{vol(x.v)}</td>
                      <td className={`${tdMono} text-right`}>{pes(x.p)}</td>
                      <td className={`${tdMono} text-right`}>{Math.round((x.v / tot.v) * 100)}%</td>
                    </tr>
                  ))}
                </Table>
                <div className="flex flex-col justify-center gap-3">
                  {porCat.map((x) => (
                    <div key={x.c.id} className="flex items-center gap-3 text-[12px]">
                      <span className="w-[170px] truncate">{catLabel(x.c)}</span>
                      <div className="h-5 flex-1 rounded-sm bg-bg"><div className="h-5 rounded-sm bg-[#0d9488]" style={{ width: `${(x.v / max) * 100}%` }} /></div>
                      <span className="w-16 text-right font-mono">{vol(x.v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <h3 className="mt-6 mb-2 text-[12px] font-bold tracking-[0.06em] uppercase">Detalle de registros ({del.length})</h3>
              <Table head={["Fecha", "Categoría", <span className="block text-right">Volumen</span>, <span className="block text-right">Peso</span>, "Origen", "Estado", "Dispuesto"]}>
                {del.map((r) => (
                  <tr key={r.id} className={tr}>
                    <td className={tdMono}>{r.fecha}</td>
                    <td className={td}>{catLabel(cats.find((c) => c.id === r.catId))}</td>
                    <td className={`${tdMono} text-right`}>{num(r.volumen)} ml</td>
                    <td className={`${tdMono} text-right`}>{num(r.peso)} g</td>
                    <td className={td}>{r.origen}</td>
                    <td className={td}><EstadoRes r={r} /></td>
                    <td className={tdMono}>{r.disposicion ? `${r.disposicion.fecha} · ${r.disposicion.metodo}` : "—"}</td>
                  </tr>
                ))}
              </Table>
              <p className="mt-6 mb-0 border-t border-border-light pt-3 text-[11px] text-text-muted">Nota legal: Reporte generado conforme a la normativa vigente 2026. (FALTA DEFINIR texto legal definitivo)</p>
            </div>
            <div className="flex items-center gap-2">
              <Btn onClick={() => { addReporte({ tipo: "Residuos", periodo: titulo, formato: "PDF", registros: del.length, filtros: "Previsualización mensual" }); toast("Generando PDF… disponible en Historial de reportes", "blue"); }}>⬇ Descargar PDF</Btn>
              <Btn onClick={() => { downloadCsv(`residuos_${MESES[mes.m].toLowerCase()}_${mes.y}.csv`, [["ID", "Fecha", "Hora", "Categoría", "Volumen (ml)", "Peso (g)", "Origen", "Estado", "Disposición"], ...del.map((r) => [r.id, r.fecha, r.hora, catLabel(cats.find((c) => c.id === r.catId)), r.volumen, r.peso, r.origen, r.disposicion ? "Dispuesto" : "Generado", r.disposicion?.fecha ?? ""])]); addReporte({ tipo: "Residuos", periodo: titulo, formato: "CSV", registros: del.length, filtros: "Exportación mensual" }); }}>⬇ Exportar CSV</Btn>
              <div className="flex-1" />
              <span title={emitido ? "El reporte de este mes ya fue emitido" : ""}><Btn variant="primary" disabled={emitido} onClick={() => setConfirm(true)}>Emitir y consolidar el mes</Btn></span>
            </div>
          </>
        )}
      </div>
      {confirm && (
        <Modal title={`Emitir reporte — ${titulo}`} onClose={() => setConfirm(false)} footer={<div className="flex w-full justify-between"><Btn onClick={() => setConfirm(false)}>Cancelar</Btn><DangerBtn onClick={emitir}>Emitir y consolidar</DangerBtn></div>}>
          <p className="m-0 text-[13px]">Se emitirá el reporte oficial y se <strong>consolidarán {del.length} registros</strong>.</p>
          <p className="mt-2 mb-0 text-[12.5px] text-text-secondary">Los registros consolidados no podrán editarse. La disposición final de los pendientes seguirá habilitada. El reporte no se reemite.</p>
        </Modal>
      )}
    </PageShell>
  );
}

/* ─── 13 Catálogo de Categorías ─────────────────────────── */
function CategoriasRes({ onNavigate, onBack }: { onNavigate: (p: string) => void; onBack: () => void }) {
  const { cats, residuos } = resStore.use();
  const [form, setForm] = useState<null | { c?: CatRes }>(null);
  const [baja, setBaja] = useState<CatRes | null>(null);
  const toggle = (c: CatRes) => {
    setRes((s) => ({ ...s, cats: s.cats.map((x) => (x.id === c.id ? { ...x, activo: !x.activo } : x)) }));
    logAudit({ modulo: "Residuos", accion: c.activo ? "DESACTIVAR" : "MODIFICAR", entidad: "CategoriaResiduo", entidadId: c.id, resumen: `${c.activo ? "Baja" : "Reactivación"} de categoría ${catLabel(c)}` });
    toast(`Categoría ${c.activo ? "desactivada" : "reactivada"}`, "gray");
  };
  return (
    <PageShell activePage="Control de Residuos" onNavigate={onNavigate} section="Control de Residuos" title="Catálogo de categorías de residuos" actions={<><Btn onClick={onBack}>← Volver</Btn><Btn variant="primary" onClick={() => setForm({})}>+ Nueva categoría</Btn></>}>
      <Panel flush>
        <Table head={["Nombre", "Clase", "Descripción", "Instrucciones", <span className="block text-right">Residuos</span>, "Estado", ""]}>
          {cats.map((c) => (
            <tr key={c.id} className={`${tr} h-12 ${!c.activo ? "opacity-60" : ""}`}>
              <td className={`${td} font-semibold`}>{c.nombre}</td>
              <td className={tdMono}>{c.clase}</td>
              <td className={`${td} max-w-[300px] truncate text-text-secondary`} title={c.descripcion}>{c.descripcion}</td>
              <td className={`${td} text-text-secondary`}>{c.instrucciones.length} pasos</td>
              <td className={`${tdMono} text-right`}>{residuos.filter((r) => r.catId === c.id).length}</td>
              <td className={td}>{c.activo ? <Pill tone="green">✓ Activo</Pill> : <Pill tone="gray">○ Inactivo</Pill>}</td>
              <td className={`${td} text-right`}>
                <div className="flex justify-end gap-1.5">
                  <Btn className="!h-7 !px-2.5" onClick={() => setForm({ c })}>✏ Editar</Btn>
                  {c.activo ? <Btn variant="danger" className="!h-7 !px-2.5" onClick={() => setBaja(c)}>⏻ Desactivar</Btn> : <Btn className="!h-7 !px-2.5" onClick={() => toggle(c)}>Reactivar</Btn>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      <div className="mt-3 text-[12px] text-text-muted">ℹ Las categorías con residuos históricos no se eliminan: solo se desactivan y dejan de ofrecerse en nuevos registros.</div>
      {form && <CatForm c={form.c} onClose={() => setForm(null)} />}
      {baja && (
        <Modal title="Desactivar categoría" onClose={() => setBaja(null)} footer={<div className="flex w-full justify-between"><Btn onClick={() => setBaja(null)}>Cancelar</Btn><DangerBtn onClick={() => { toggle(baja); setBaja(null); }}>Desactivar</DangerBtn></div>}>
          <p className="m-0 text-[13px]">¿Desactivar <strong>{catLabel(baja)}</strong>?</p>
          <p className="mt-2 mb-0 text-[12.5px] text-text-secondary">No se ofrecerá en nuevos registros. Los {residuos.filter((r) => r.catId === baja.id).length} residuos históricos conservan la categoría.</p>
        </Modal>
      )}
    </PageShell>
  );
}
function CatForm({ c, onClose }: { c?: CatRes; onClose: () => void }) {
  const { cats } = resStore.use();
  const [f, setF] = useState({ nombre: c?.nombre ?? "", clase: c?.clase ?? "I", descripcion: c?.descripcion ?? "", instrucciones: c?.instrucciones.length ? c.instrucciones : [""] });
  const [tried, setTried] = useState(false);
  const dup = cats.some((x) => x.id !== c?.id && x.nombre.toLowerCase() === f.nombre.trim().toLowerCase() && x.clase === f.clase);
  const err = !f.nombre.trim() ? "Ingrese el nombre." : dup ? "Ya existe una categoría con ese nombre y clase." : "";
  const save = () => {
    setTried(true);
    if (err) return;
    const data = { ...f, nombre: f.nombre.trim(), instrucciones: f.instrucciones.map((i) => i.trim()).filter(Boolean) };
    setRes((s) => ({ ...s, cats: c ? s.cats.map((x) => (x.id === c.id ? { ...x, ...data } : x)) : [...s.cats, { id: `C${Date.now() % 10000}`, activo: true, ...data }] }));
    logAudit({ modulo: "Residuos", accion: c ? "MODIFICAR" : "CREAR", entidad: "CategoriaResiduo", entidadId: c?.id ?? data.nombre, resumen: `${c ? "Edición" : "Alta"} de categoría Clase ${data.clase} — ${data.nombre}` });
    toast("Categoría guardada");
    onClose();
  };
  const ins = f.instrucciones;
  return (
    <Modal title={c ? `Editar categoría — ${catLabel(c)}` : "Nueva categoría de residuo"} onClose={onClose} width={720} footer={<div className="flex w-full justify-between"><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={save}>Guardar</Btn></div>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_160px] gap-4">
          <Field label="Nombre" required error={tried ? err || undefined : undefined}><input className={inputCls} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
          <Field label="Clase de peligrosidad" required><select className={inputCls} value={f.clase} onChange={(e) => setF({ ...f, clase: e.target.value })}>{["I", "II", "III"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        </div>
        <Field label="Descripción"><textarea className={`${inputCls} !h-16 py-2`} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Field>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[0.04em] text-pendiente-text uppercase">Instrucciones de almacenamiento (en orden)</span>
          {ins.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-right font-mono text-[12px] text-text-muted">{i + 1}.</span>
              <input className={inputCls} value={t} onChange={(e) => setF({ ...f, instrucciones: ins.map((x, j) => (j === i ? e.target.value : x)) })} />
              <Btn className="!px-2" disabled={i === 0} aria-label="Subir paso" onClick={() => { const n = [...ins]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setF({ ...f, instrucciones: n }); }}>↑</Btn>
              <Btn className="!px-2" aria-label="Quitar paso" onClick={() => setF({ ...f, instrucciones: ins.length > 1 ? ins.filter((_, j) => j !== i) : [""] })}>✕</Btn>
            </div>
          ))}
          <Btn variant="ghost" className="self-start" onClick={() => setF({ ...f, instrucciones: [...ins, ""] })}>+ Agregar paso</Btn>
        </div>
      </div>
    </Modal>
  );
}
