import { useState, type ReactNode } from "react";
import { StatusPill, MuestraBadge, type Analisis } from "./SharedLayout";
import { PageShell, Panel, Btn, Banner, Pill, Field, Modal, inputCls, type Tone } from "./ui";
import { Seg, areaCls } from "./formKit";
import { estadoRevision, naturalezaDe, REVISION_DIAS, type CondicionMuestra, type Hallazgo, type Ficha } from "./clinica";
import { ResultadoResumen } from "./CargaResultadosView";
import { HOY, fmtDate, arToIso, isoToAr, currentUser, logAudit, toast } from "../sigemi/core";

const HOY_ISO = arToIso(fmtDate(HOY));
const stamp = () => `${fmtDate(HOY)} ${new Date().toTimeString().slice(0, 5)}`;
const COND_TONE: Record<CondicionMuestra, Tone> = { "Óptimas condiciones": "green", "Con observaciones": "amber", "Deteriorada o contaminada": "red" };
const CONDICIONES: CondicionMuestra[] = ["Óptimas condiciones", "Con observaciones", "Deteriorada o contaminada"];
const DEFAULT_HALLAZGOS: Hallazgo[] = [
  { fecha: "14/09/2026 08:30", tipo: "Observación", texto: "Muestra recibida en condiciones óptimas. Inicio de siembra en agar Sabouraud." },
  { fecha: "14/09/2026 11:15", tipo: "Nota", texto: "Se solicita al paciente no aplicar antifúngicos tópicos hasta finalizar el estudio." },
];
const PASOS = ["Pendiente", "En Proceso", "Carga de resultados", "Terminado y validado"];

export function DetalleAnalisisView({
  analisis,
  onNavigate,
  onUpdateAnalisis,
}: {
  analisis: Analisis;
  onNavigate: (page: string) => void;
  onUpdateAnalisis: (updated: Analisis) => void;
}) {
  const [tipoNota, setTipoNota] = useState<Hallazgo["tipo"]>("Observación");
  const [texto, setTexto] = useState("");
  const [cancelar, setCancelar] = useState<string | null>(null);

  const a = analisis;
  const activo = a.estado === "Pendiente" || a.estado === "En Proceso";
  const hallazgos = a.hallazgos ?? DEFAULT_HALLAZGOS;
  const rev = estadoRevision(a.fechaIngreso, a.revisiones);
  const borrador = a.resultado && !a.resultado.validado;
  const paso = a.estado === "Pendiente" ? 0 : a.estado === "En Proceso" ? (borrador ? 2 : 1) : a.estado === "Terminado y validado" ? 3 : -1;

  const update = (patch: Partial<Analisis>) => onUpdateAnalisis({ ...a, ...patch });

  const iniciar = () => {
    update({ estado: "En Proceso" });
    logAudit({ modulo: "Análisis", accion: "MODIFICAR", entidad: "AnalisisMicologico", entidadId: a.id, resumen: "Inicio de procesamiento", cambios: [{ campo: "estado", antes: "Pendiente", despues: "En Proceso" }] });
    toast(`Análisis ${a.id} en proceso`);
  };

  const agregarNota = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    update({ hallazgos: [...hallazgos, { fecha: stamp(), tipo: tipoNota, texto: texto.trim(), usuario: currentUser() }] });
    setTexto("");
    toast(`${tipoNota} registrada`);
  };

  const confirmarCancelacion = () => {
    if (!cancelar?.trim()) return;
    update({ estado: "Cancelado", hallazgos: [...hallazgos, { fecha: stamp(), tipo: "Nota", texto: `ANÁLISIS CANCELADO. Motivo: ${cancelar.trim()}`, usuario: currentUser() }] });
    logAudit({ modulo: "Análisis", accion: "CANCELAR", entidad: "AnalisisMicologico", entidadId: a.id, resumen: `Cancelación — ${cancelar.trim()}`, cambios: [{ campo: "estado", antes: a.estado, despues: "Cancelado" }] });
    toast(`Análisis ${a.id} cancelado`, "red");
    setCancelar(null);
  };

  return (
    <PageShell
      activePage="Detalle de Análisis"
      onNavigate={onNavigate}
      section="Laboratorio / Análisis"
      title={<span className="font-mono">{a.id}</span>}
      actions={<Btn onClick={() => onNavigate("Análisis")}>← Volver al panel</Btn>}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Cabecera */}
          <Panel>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[15px] font-bold text-accent">{a.id}</span>
                  <StatusPill estado={a.estado} />
                </div>
                <div className="mt-1 text-[15px] font-semibold text-text-primary">
                  {a.paciente} <span className="font-mono text-[12px] font-normal text-text-secondary">DNI {a.dni}</span>
                </div>
              </div>
              <div className="text-right text-[12px]">
                <div className="text-text-muted">Fecha de ingreso</div>
                <div className="font-mono font-semibold">{a.fechaIngreso}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-3 border-t border-border-light pt-3 text-[12px]">
              <Info k="Muestra"><MuestraBadge tipo={a.tipoMuestra} /></Info>
              <Info k="Tipo de análisis">{a.tipoAnalisis}</Info>
              <Info k="Ficha">{naturalezaDe(a.tipoAnalisis, a.ficha) === "Profunda" ? "Micosis profundas" : "Superficiales y cutáneas"}</Info>
              <Info k="Bioquímico">{a.bioquimico}</Info>
            </div>
          </Panel>

          {/* Línea de tiempo */}
          <Panel title="Línea de tiempo del análisis">
            {a.estado === "Cancelado" ? (
              <Banner tone="red">Análisis cancelado. El ciclo de vida se detuvo; el historial se conserva.</Banner>
            ) : (
              <ol className="m-0 grid list-none grid-cols-4 p-0">
                {PASOS.map((s, i) => {
                  const hecho = i < paso || (i === paso && paso === 3);
                  const actual = i === paso;
                  return (
                    <li key={s} className="relative flex flex-col items-center gap-1.5 text-center">
                      {i > 0 && <span className={`absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2 ${i <= paso ? "bg-accent" : "bg-border-light"}`} />}
                      <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${hecho ? (i === 3 ? "bg-validado-text text-white" : "bg-accent text-white") : actual ? "bg-accent text-white ring-4 ring-[#bfdbfe]" : "bg-border-light text-text-muted"}`}>
                        {hecho && !actual ? "✓" : i + 1}
                      </span>
                      <span className={`text-[11.5px] ${actual ? "font-bold text-text-primary" : i <= paso ? "font-medium text-text-primary" : "text-text-muted"}`}>{s}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          {/* Control periódico */}
          <RevisionPanel a={a} activo={activo} onUpdate={update} onCancelar={(m) => setCancelar(m)} />

          {/* Resultados */}
          {a.resultado ? (
            <Panel
              title="Resultados y diagnóstico"
              meta={a.resultado.validado ? <Pill tone="green">Validado</Pill> : <Pill tone="amber">Borrador · {a.resultado.guardado}</Pill>}
              footer={a.estado === "En Proceso" && <Btn variant="ghost" onClick={() => onNavigate("Carga de Resultados")}>Editar resultados →</Btn>}
            >
              <ResultadoResumen r={a.resultado} />
            </Panel>
          ) : a.estado === "Terminado y validado" ? (
            <Panel title="Resultados y diagnóstico"><p className="m-0 text-[12.5px] text-text-secondary">Informe validado antes de la digitalización. Consulte el PDF en Resultados.</p></Panel>
          ) : null}

          {/* Ficha */}
          {a.ficha && <FichaResumen f={a.ficha} />}

          {/* Observaciones y notas */}
          <Panel title="Historial de observaciones y notas" meta="Los resultados se cargan en «Carga de resultados»" flush>
            <ul className="m-0 flex list-none flex-col gap-2 p-4">
              {hallazgos.length === 0 && <li className="py-4 text-center text-[12.5px] text-text-muted">Sin observaciones registradas.</li>}
              {hallazgos.map((h, i) => (
                <li key={i} className="rounded border border-border-light bg-[#f9fafb] px-3 py-2.5">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <Pill tone={h.tipo === "Nota" ? "violet" : "gray"}>{h.tipo}</Pill>
                    <span className="font-mono text-[11px] text-text-muted">{h.fecha}{h.usuario ? ` · ${h.usuario}` : ""}</span>
                  </div>
                  <div className="text-[12.5px] text-text-primary">{h.texto}</div>
                </li>
              ))}
            </ul>
            {activo && (
              <form onSubmit={agregarNota} className="flex flex-col gap-2 border-t border-border-light p-4">
                <div className="flex items-center gap-3">
                  <Seg value={tipoNota} options={["Observación", "Nota"] as const} onChange={setTipoNota} />
                  <span className="text-[11.5px] text-text-muted">{tipoNota === "Observación" ? "Hallazgo del proceso (microscopía, crecimiento, siembra…)" : "Comentario interno o administrativo"}</span>
                </div>
                <div className="flex gap-2">
                  <input className={inputCls} placeholder={tipoNota === "Observación" ? "Ej. Desarrollo de colonias blanco-algodonosas a los 7 días" : "Ej. Se contactó al médico remitente"} value={texto} onChange={(e) => setTexto(e.target.value)} />
                  <Btn type="submit" variant="primary" disabled={!texto.trim()}>+ Agregar</Btn>
                </div>
              </form>
            )}
          </Panel>
        </div>

        {/* ─── Panel lateral ─── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          <Panel title="Gestión del análisis">
            <div className="flex flex-col gap-3">
              {a.estado === "Pendiente" && (
                <>
                  <p className="m-0 text-[12px] text-text-secondary">La muestra fue recibida y espera procesamiento.</p>
                  <Btn variant="primary" className="h-10 justify-center" onClick={iniciar}>Iniciar procesamiento</Btn>
                </>
              )}
              {a.estado === "En Proceso" && (
                <>
                  <p className="m-0 text-[12px] text-text-secondary">
                    {borrador ? <>Resultados en borrador, guardados el <span className="font-mono">{a.resultado!.guardado}</span> por {a.resultado!.guardadoPor}.</> : "Cuando el estudio esté completo, cargue los resultados y el diagnóstico para validarlo."}
                  </p>
                  <Btn variant="primary" className="h-10 justify-center" onClick={() => onNavigate("Carga de Resultados")}>
                    {borrador ? "Continuar carga de resultados →" : "Cargar resultados y diagnóstico →"}
                  </Btn>
                </>
              )}
              {a.estado === "Terminado y validado" && (
                <>
                  <div className="rounded bg-validado-bg px-3 py-2.5 text-[12px] font-medium text-validado-text">
                    ✓ Terminado y validado{a.resultado?.validado ? ` por ${a.resultado.validado.por} el ${a.resultado.validado.fecha}` : ""}. Informe PDF generado con OTP para el paciente.
                  </div>
                  <Btn className="justify-center" onClick={() => onNavigate("Resultados")}>Ver informe en Resultados</Btn>
                </>
              )}
              {a.estado === "Cancelado" && <div className="rounded bg-cancelado-bg px-3 py-2.5 text-[12px] font-medium text-cancelado-text">Análisis cancelado. No admite cambios.</div>}
              {activo && (
                <button onClick={() => setCancelar("")} className="mt-1 cursor-pointer rounded border border-[#fee2e2] bg-transparent px-2 py-1.5 text-[11.5px] text-cancelado-text hover:bg-cancelado-bg">
                  Cancelar análisis…
                </button>
              )}
            </div>
          </Panel>

          {activo && (
            <a href="#revision" className="block rounded-md border border-border-light bg-surface p-4 no-underline hover:border-border">
              <div className="mb-2 text-[11px] font-bold tracking-[0.06em] text-pendiente-text uppercase">Revisión semanal</div>
              <Pill tone={rev.tone}>{rev.label}</Pill>
              <div className="mt-2 text-[12px] text-text-secondary">Próxima: <span className="font-mono text-text-primary">{rev.proxima}</span></div>
            </a>
          )}
        </aside>
      </div>

      {cancelar !== null && (
        <Modal
          title="Cancelar análisis"
          onClose={() => setCancelar(null)}
          footer={<><Btn onClick={() => setCancelar(null)}>Volver</Btn><Btn variant="primary" className="!border-[#b91c1c] !bg-[#b91c1c]" disabled={!cancelar.trim()} onClick={confirmarCancelacion}>Confirmar cancelación</Btn></>}
        >
          <div className="flex flex-col gap-3 text-[12.5px]">
            <p className="m-0">Esta acción es irreversible. El motivo queda registrado en el historial y en Auditoría.</p>
            <Field label="Motivo" required>
              <textarea rows={3} className={areaCls} value={cancelar} onChange={(e) => setCancelar(e.target.value)} placeholder="Ej. Muestra insuficiente, contaminación" />
            </Field>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

/* ─── Control periódico de la muestra ─── */
function RevisionPanel({ a, activo, onUpdate, onCancelar }: { a: Analisis; activo: boolean; onUpdate: (p: Partial<Analisis>) => void; onCancelar: (motivo: string) => void }) {
  const revisiones = a.revisiones ?? [];
  const rev = estadoRevision(a.fechaIngreso, revisiones);
  const [fecha, setFecha] = useState(HOY_ISO);
  const [cond, setCond] = useState<CondicionMuestra>("Óptimas condiciones");
  const [nota, setNota] = useState("");
  const [tried, setTried] = useState(false);
  const minIso = arToIso(rev.ultima?.fecha ?? a.fechaIngreso);
  const err = {
    fecha: !fecha ? "Ingrese la fecha." : fecha > HOY_ISO ? "La fecha no puede ser futura." : fecha < minIso ? `No puede ser anterior a ${isoToAr(minIso)}.` : "",
    nota: cond !== "Óptimas condiciones" && !nota.trim() ? "Describa lo observado." : "",
  };
  const ultimaMala = rev.ultima?.condicion === "Deteriorada o contaminada";

  const registrar = () => {
    setTried(true);
    if (err.fecha || err.nota) return;
    const nueva = { fecha: isoToAr(fecha), hora: new Date().toTimeString().slice(0, 5), responsable: currentUser(), condicion: cond, nota: nota.trim() };
    onUpdate({ revisiones: [...revisiones, nueva] });
    logAudit({ modulo: "Análisis", accion: "MODIFICAR", entidad: "RevisionMuestra", entidadId: a.id, resumen: `Revisión periódica de muestra — ${cond}`, cambios: [{ campo: "ultima_revision", antes: rev.ultima?.fecha ?? "—", despues: nueva.fecha }] });
    toast(cond === "Deteriorada o contaminada" ? "Revisión registrada: muestra deteriorada" : "Revisión registrada", cond === "Óptimas condiciones" ? "green" : "amber");
    setNota("");
    setCond("Óptimas condiciones");
    setTried(false);
  };

  return (
    <div id="revision" className="scroll-mt-4">
      <Panel title="Control periódico de la muestra" meta={`Revisión cada ${REVISION_DIAS} días durante el análisis`} flush>
        <div className="grid grid-cols-3 gap-4 border-b border-border-light px-4 py-3">
          <Info k="Última revisión">{rev.ultima ? <span className="font-mono">{rev.ultima.fecha}</span> : <span className="text-text-muted">Sin revisiones (desde ingreso)</span>}</Info>
          <Info k="Próxima revisión"><span className="font-mono">{activo ? rev.proxima : "—"}</span></Info>
          <Info k="Estado">{activo ? <Pill tone={rev.tone}>{rev.label}</Pill> : <span className="text-text-muted">Ciclo finalizado</span>}</Info>
        </div>

        {activo && (rev.dias < 0 || ultimaMala) && (
          <div className="px-4 pt-3">
            {ultimaMala ? (
              <Banner tone="red" action={<Btn variant="danger" onClick={() => onCancelar(`Muestra deteriorada o contaminada (revisión ${rev.ultima!.fecha})`)}>Cancelar análisis</Btn>}>
                La última revisión informó la muestra <strong>deteriorada o contaminada</strong>. Evalúe cancelar el análisis o solicitar nueva muestra.
              </Banner>
            ) : (
              <Banner tone="amber">La revisión semanal está vencida. Registre el control de la muestra.</Banner>
            )}
          </div>
        )}

        {activo && (
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-40">
                <Field label="Fecha" required error={tried ? err.fecha || undefined : undefined}>
                  <input type="date" min={minIso} max={HOY_ISO} className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </Field>
              </div>
              <Field label="Condición de la muestra" required>
                <Seg value={cond} options={CONDICIONES} onChange={setCond} tones={{ "Óptimas condiciones": "bg-validado-text text-white", "Con observaciones": "bg-[#d97706] text-white", "Deteriorada o contaminada": "bg-[#b91c1c] text-white" }} />
              </Field>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={cond === "Óptimas condiciones" ? "Nota (opcional)" : "Detalle de lo observado"} required={cond !== "Óptimas condiciones"} error={tried ? err.nota || undefined : undefined}>
                  <input className={inputCls} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={cond === "Óptimas condiciones" ? "Ej. Sin desecación ni contaminación visible" : "Ej. Contaminación bacteriana en tubo 2"} />
                </Field>
              </div>
              <div className={tried && (err.fecha || err.nota) ? "pb-[18px]" : ""}>
                <Btn variant="primary" onClick={registrar}>Registrar revisión</Btn>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-border-light">
          {revisiones.length === 0 ? (
            <p className="m-0 px-4 py-4 text-center text-[12px] text-text-muted">Todavía no se registraron revisiones de esta muestra.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {[...revisiones].reverse().map((r, i) => (
                <li key={i} className="grid grid-cols-[120px_180px_1fr] items-center gap-3 border-b border-border-light px-4 py-2 text-[12.5px] last:border-b-0">
                  <span className="font-mono text-[12px]">{r.fecha} <span className="text-text-muted">{r.hora}</span></span>
                  <Pill tone={COND_TONE[r.condicion]}>{r.condicion}</Pill>
                  <span className="min-w-0 text-text-secondary"><span className="text-text-primary">{r.responsable}</span>{r.nota ? ` — ${r.nota}` : ""}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ─── Resumen de ficha ─── */
function FichaResumen({ f }: { f: Ficha }) {
  const [open, setOpen] = useState(false);
  const sup = f.naturaleza === "Superficial";
  const base: [string, ReactNode][] = sup
    ? [["Sitio", f.sitio], ["Localización", f.localizacion], ["Diagnóstico presuntivo", f.diagnostico], ["Material clínico", f.material]]
    : [["Situación", f.modalidad === "Internado" ? `Internado · ${f.internacion}` : "Ambulatorio"], ["Dx micológico presuntivo", f.dxPresuntivo], ["Diagnóstico", f.diagnostico], ["Muestra", f.material]];
  const extra: [string, ReactNode][] = [
    [sup ? "Médico remitente" : "Médico solicitante", f.medico],
    ["Institución", f.institucion],
    ["Evolución", f.evolucion || "—"],
    ...(sup
      ? ([["Características", f.lesion?.join(", ") || "—"], ...(f.bordes ? [["Bordes", f.bordes]] : []), ...(f.unaInicio ? [["Inicio", f.unaInicio]] : []), ...(f.unaColor ? [["Color", f.unaColor]] : [])] as [string, ReactNode][])
      : ([["Rayos X", f.rayosX || "—"], ["Trayectoria residencial", f.trayResidencial], ["Trayectoria ocupacional", f.trayOcupacional || "—"], ["ATF actual", f.atfActual === "Sí" ? f.atfActualDetalle : "No"], ["Inmunodiagnóstico solicitado", f.inmuno?.join(", ") || "—"]] as [string, ReactNode][])),
    [sup ? "Tratamiento ATF previo" : "ATF previo", f.atfPrevio === "Sí" ? f.atfPrevioDetalle : "No"],
    ["Factores predisponentes", f.sinFactores ? "Sin factores conocidos" : [...f.factores.filter((x) => x !== "Otros"), ...(f.factoresOtros ? [f.factoresOtros] : [])].join(", ")],
    ["Observaciones de recepción", f.obsMuestra || "—"],
  ];
  return (
    <Panel
      title={`Ficha clínica · ${sup ? "Micosis superficiales y cutáneas" : "Micosis profundas"}`}
      meta={<span className="font-mono">Reg. {f.registro}</span>}
      footer={<Btn variant="ghost" onClick={() => setOpen(!open)}>{open ? "Ocultar detalle ▲" : "Ver ficha completa ▼"}</Btn>}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
        {(open ? [...base, ...extra] : base).map(([k, v]) => <Info key={k} k={k}>{v}</Info>)}
      </div>
    </Panel>
  );
}

function Info({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">{k}</div>
      <div className="mt-0.5 text-[12.5px] break-words text-text-primary">{children}</div>
    </div>
  );
}
