import { useEffect, useState } from "react";
import { PageShell, Panel, Btn, Banner, Pill, Table, tr, td, tdMono, inputCls, Field } from "../components/ui";
import {
  useRol, auditStore, AUD_TONE, logAudit, toast, useCarga, EstadoSwitch, Skeleton, ErrorState, EmptyBox, selCls,
  Drawer, Pager, NoAccess, Info, HOY, arToIso, parseDate, num, downloadCsv, type EventoAud,
} from "./core";
import { cargarDetalleAuditoria, hidratarAuditoria } from "../../data/auditoria";
import { mensajeDeError } from "../../data/pacientes";

type Nav = (p: string, params?: Record<string, unknown>) => void;
const MOD_PAGE: Record<string, string> = {
  Residuos: "Control de Residuos", Insumos: "Insumos y Stock", Análisis: "Análisis", Reportes: "Reportes y Estadísticas", Usuarios: "Usuarios y Roles",
};
const hace7 = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - 7);
const iso = (d: Date) => arToIso(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
const corto = (n: string) => { const [a, b] = n.split(", "); return b ? `${a}, ${b[0]}.` : n; };

export default function AuditoriaView({ onNavigate, params }: { onNavigate: Nav; params?: Record<string, unknown> }) {
  const rol = useRol();
  const all = auditStore.use();
  const { estado, setEstado, reintentar } = useCarga();
  const def = { desde: params?.usuario ? "" : iso(hace7), hasta: iso(HOY), usuario: (params?.usuario as string) ?? "", modulo: "", accion: "", entidad: "", q: "" };
  const [f, setF] = useState(def);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [exp, setExp] = useState(false);

  // Spec S5: the trail comes from `GET /auditoria`; the demo events stay behind
  // the real ones so the screen never looks empty (S4).
  useEffect(() => {
    hidratarAuditoria().catch(() => undefined);
  }, []);
  if (rol !== "Administrador")
    return <PageShell activePage="Auditoría" onNavigate={onNavigate} section="Administración" title="Auditoría"><NoAccess onNavigate={onNavigate} /></PageShell>;

  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); setPage(1); };
  const uniq = (k: keyof EventoAud) => [...new Set(all.map((e) => String(e[k])))].sort();
  const rangoInv = !!f.desde && !!f.hasta && f.desde > f.hasta;
  const rangoLargo = !!f.desde && !!f.hasta && (new Date(f.hasta).getTime() - new Date(f.desde).getTime()) / 864e5 > 366;
  const data = estado === "Vacío" ? [] : all;
  const filtered = rangoInv ? [] : data.filter((e) => {
    const d = parseDate(e.fecha).getTime();
    return (!f.desde || d >= new Date(f.desde + "T00:00").getTime()) && (!f.hasta || d <= new Date(f.hasta + "T00:00").getTime())
      && (!f.usuario || e.usuario === f.usuario) && (!f.modulo || e.modulo === f.modulo) && (!f.accion || e.accion === f.accion)
      && (!f.entidad || e.entidad === f.entidad)
      && (!f.q || `${e.resumen} ${e.entidad} ${e.entidadId}`.toLowerCase().includes(f.q.toLowerCase()));
  });
  const SIZE = 25;
  const exportar = () => {
    setExp(true);
    setTimeout(() => {
      downloadCsv(`auditoria_${iso(HOY)}.csv`, [
        ["ID", "Fecha", "Hora", "Usuario", "Rol", "IP", "Módulo", "Acción", "Entidad", "ID entidad", "Resumen"],
        ...filtered.map((e) => [e.id, e.fecha, e.hora, e.usuario, e.rol ?? '', e.ip, e.modulo, e.accion, e.entidad, e.entidadId, e.resumen]),
      ]);
      logAudit({ modulo: "Auditoría", accion: "EXPORTAR", entidad: "Auditoria", entidadId: "CSV", resumen: `Exportación de ${filtered.length} eventos de auditoría (CSV)` });
      toast(`Se exportaron ${num(filtered.length)} eventos.`);
      setExp(false);
    }, 900);
  };
  const ev = all.find((e) => e.id === sel);
  return (
    <PageShell
      activePage="Auditoría" onNavigate={onNavigate} section="Administración" title="Auditoría"
      actions={<><EstadoSwitch value={estado} onChange={setEstado} /><Btn variant="primary" disabled={filtered.length === 0 || exp || estado !== "Con datos"} onClick={exportar}>{exp ? "Generando archivo…" : "⬇ Exportar CSV"}</Btn></>}
    >
      <div className="flex flex-col gap-4">
        <Banner tone="dark">Registro inmutable. Solo lectura. Se muestran los últimos 7 días por defecto.</Banner>
        {estado === "Cargando" ? <Skeleton rows={10} /> : estado === "Error" ? <ErrorState text="No se pudo cargar la auditoría." onRetry={reintentar} /> : (
          <Panel flush>
            <div className="flex flex-wrap items-end gap-2 border-b border-border-light px-4 py-3">
              <Field label="Desde"><input type="date" className={`${inputCls} w-[150px]`} value={f.desde} onChange={(e) => set("desde", e.target.value)} /></Field>
              <Field label="Hasta"><input type="date" className={`${inputCls} w-[150px]`} value={f.hasta} onChange={(e) => set("hasta", e.target.value)} /></Field>
              <select className={selCls} value={f.usuario} onChange={(e) => set("usuario", e.target.value)}><option value="">Usuario: todos</option>{uniq("usuario").map((x) => <option key={x}>{x}</option>)}</select>
              <select className={selCls} value={f.modulo} onChange={(e) => set("modulo", e.target.value)}><option value="">Módulo: todos</option>{uniq("modulo").map((x) => <option key={x}>{x}</option>)}</select>
              <select className={selCls} value={f.accion} onChange={(e) => set("accion", e.target.value)}><option value="">Acción: todas</option>{uniq("accion").map((x) => <option key={x}>{x}</option>)}</select>
              <select className={selCls} value={f.entidad} onChange={(e) => set("entidad", e.target.value)}><option value="">Entidad: todas</option>{uniq("entidad").map((x) => <option key={x}>{x}</option>)}</select>
              <input className={`${inputCls} max-w-[220px]`} placeholder="Buscar..." value={f.q} onChange={(e) => set("q", e.target.value)} />
              <div className="flex-1" />
              <Btn variant="ghost" onClick={() => { setF({ ...def, usuario: "", desde: iso(hace7) }); setPage(1); }}>Limpiar filtros</Btn>
            </div>
            {rangoInv && <div className="px-4 pt-3"><Banner tone="red">La fecha desde no puede ser posterior a la hasta.</Banner></div>}
            {rangoLargo && <div className="px-4 pt-3"><Banner tone="amber">Para rangos mayores a un año, use la exportación.</Banner></div>}
            {filtered.length === 0 ? (
              <EmptyBox icon="⌕" title="No hay eventos de auditoría para los filtros seleccionados." action={<Btn onClick={() => setF({ ...def, usuario: "", desde: "" })}>Ver todo el historial</Btn>} />
            ) : (
              <>
                <Table head={["Fecha/hora", "Usuario", "Módulo", "Acción", "Entidad", "IP", "Resumen", ""]}>
                  {filtered.slice((page - 1) * SIZE, page * SIZE).map((e) => (
                    <tr key={e.id} className={tr}>
                      <td className={tdMono}>{e.fecha.slice(0, 5)} {e.hora.slice(0, 5)}</td>
                      <td className={td}>{corto(e.usuario)}</td>
                      <td className={td}>{e.modulo}</td>
                      <td className={td}><Pill tone={AUD_TONE[e.accion]}>{e.accion}</Pill></td>
                      <td className={td}><span className="text-text-secondary">{e.entidad}</span> <span className="font-mono text-[12px]">#{e.entidadId}</span></td>
                      <td className={tdMono}>{e.ip}</td>
                      <td className={`${td} max-w-[280px] truncate`} title={e.resumen}>{e.resumen}</td>
                      <td className={td}><Btn variant="ghost" onClick={() => setSel(e.id)}>Ver detalle</Btn></td>
                    </tr>
                  ))}
                </Table>
                <Pager page={page} total={filtered.length} size={SIZE} onPage={setPage} noun="eventos" />
              </>
            )}
          </Panel>
        )}
      </div>
      {sel !== null && <DetalleEvento id={sel} ev={ev} onClose={() => setSel(null)} onNavigate={onNavigate} />}
    </PageShell>
  );
}

function Valor({ v }: { v: string }) {
  const [open, setOpen] = useState(false);
  if (v.length <= 60) return <>{v}</>;
  return <>{open ? v : v.slice(0, 60) + "…"} <Btn variant="ghost" onClick={() => setOpen(!open)}>{open ? "Ver menos" : "Ver completo"}</Btn></>;
}

function DetalleEvento({ id, ev, onClose, onNavigate }: { id: string; ev?: EventoAud; onClose: () => void; onNavigate: Nav }) {
  const [detalle, setDetalle] = useState<EventoAud | undefined>(ev);
  const [error, setError] = useState<string | null>(null);

  // The listing carries no field-level changes: they travel with SEG-U05.
  useEffect(() => {
    cargarDetalleAuditoria(id)
      .then(setDetalle)
      .catch((e: unknown) => setError(mensajeDeError(e)));
  }, [id]);

  const evento = detalle ?? ev;
  if (!evento)
    return <Drawer title="Detalle de evento" onClose={onClose}><EmptyBox title="El evento ya no está disponible." action={<Btn onClick={onClose}>Cerrar</Btn>} /></Drawer>;
  const ev2 = evento;
  return <DetalleContenido ev={ev2} error={error} onClose={onClose} onNavigate={onNavigate} />;
}

function DetalleContenido({ ev, error, onClose, onNavigate }: { ev: EventoAud; error: string | null; onClose: () => void; onNavigate: Nav }) {
  const page = MOD_PAGE[ev.modulo];
  return (
    <Drawer title="Detalle de evento" subtitle={`Evento #${ev.id}`} onClose={onClose}
      footer={<><span className="text-[11.5px] text-text-muted">Solo lectura — los valores se muestran tal como se registraron.</span>{page && <Btn variant="primary" onClick={() => { onClose(); onNavigate(page); }}>Ver entidad afectada →</Btn>}</>}>
      <div className="flex flex-col gap-5">
        {error && <Banner tone="red">{error}</Banner>}
        <div className="grid grid-cols-2 gap-4">
          <Info label="Fecha/hora"><span className="font-mono text-[12.5px]">{ev.fecha} {ev.hora}</span></Info>
          <Info label="IP"><span className="font-mono text-[12.5px]">{ev.ip}</span></Info>
          <Info label="Usuario">{ev.usuario} {ev.rol && <span className="text-text-secondary">({ev.rol})</span>}</Info><span />
          <Info label="Módulo">{ev.modulo}</Info>
          <Info label="Acción"><Pill tone={AUD_TONE[ev.accion]}>{ev.accion}</Pill></Info>
          <Info label="Entidad">{ev.entidad}</Info>
          <Info label="ID"><span className="font-mono text-[12.5px]">{ev.entidadId}</span></Info>
        </div>
        <Info label="Resumen">{ev.resumen}</Info>
        {ev.cambios.length > 0 && (
          <div>
            <div className="mb-2 text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">Cambios por campo</div>
            <div className="overflow-hidden rounded border border-border-light">
              <Table head={["Campo", "Valor anterior", "Valor nuevo"]}>
                {ev.cambios.map((c) => (
                  <tr key={c.campo} className={tr}>
                    <td className={tdMono}>{c.campo}</td>
                    <td className={`${td} text-text-secondary`}><Valor v={c.antes} /></td>
                    <td className={`${td} font-medium`}><Valor v={c.despues} /></td>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

