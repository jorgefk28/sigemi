import { useState, type ReactNode } from "react";
import { StatusPill, MuestraBadge, type Analisis } from "./SharedLayout";
import { PageShell, Panel, Btn, Banner, Pill, Field, Modal, inputCls, type Tone } from "./ui";
import { Seg, CheckGrid, GroupLabel, areaCls } from "./formKit";
import {
  ED_ELEMENTOS, MEDIOS, AGENTES, OTRO_AGENTE, INMUNO, nuevaDeterminacion, agenteDe, naturalezaDe, sitioDe,
  type Determinacion, type Resultado, type ResInmuno, type Naturaleza, type Sitio,
} from "./clinica";
import { HOY, fmtDate, arToIso, isoToAr, currentUser, logAudit, toast } from "../sigemi/core";

const HOY_ISO = arToIso(fmtDate(HOY));
const stamp = () => `${fmtDate(HOY)} ${new Date().toTimeString().slice(0, 5)}`;
type Draft = Omit<Resultado, "guardado" | "guardadoPor" | "validado">;

const DX_PROF: [RegExp, string][] = [
  [/Paracoccidioides/, "Paracoccidioidomicosis"], [/Histoplasma/, "Histoplasmosis"], [/Cryptococcus/, "Criptococosis"],
  [/Aspergillus/, "Aspergilosis"], [/Sporothrix/, "Esporotricosis"], [/Candida/, "Candidiasis invasiva"],
  [/Mucorales/, "Mucormicosis"], [/Fonsecaea/, "Cromoblastomicosis"],
];
function sugerencias(nat: Naturaleza, sitio: Sitio | undefined, d: Draft) {
  const agentes = [...new Set(d.determinaciones.map(agenteDe).filter(Boolean))];
  const base = nat === "Profunda" ? "Micosis profunda" : sitio === "Uñas" ? "Onicomicosis" : sitio === "Cuero cabelludo" ? "Tiña capitis" : "Micosis cutánea";
  const out = agentes.map((ag) => (nat === "Profunda" ? `${DX_PROF.find(([r]) => r.test(ag))?.[1] ?? base} (${ag})` : `${base} por ${ag}`));
  const dets = d.determinaciones;
  if (dets.length && dets.every((x) => x.ed === "Negativo" && x.cultivo === "Negativo")) out.push("Examen micológico negativo");
  if (dets.some((x) => x.ed === "Positivo") && dets.every((x) => x.cultivo === "Negativo" || x.cultivo === "Contaminado")) out.push(`${base}: examen directo positivo, cultivo sin desarrollo`);
  return out;
}

export function CargaResultadosView({
  analisis: a,
  onNavigate,
  onUpdateAnalisis,
}: {
  analisis: Analisis;
  onNavigate: (page: string) => void;
  onUpdateAnalisis: (updated: Analisis) => void;
}) {
  const nat = naturalezaDe(a.tipoAnalisis, a.ficha);
  const sitio = sitioDe(a.tipoMuestra, a.ficha);
  const maxDet = nat === "Profunda" ? 3 : 1;
  const inicial: Draft = a.resultado
    ? { material: a.resultado.material, determinaciones: a.resultado.determinaciones, inmuno: a.resultado.inmuno, diagnostico: a.resultado.diagnostico, interpretacion: a.resultado.interpretacion, recomendaciones: a.resultado.recomendaciones }
    : {
        material: a.ficha?.material ?? a.tipoMuestra,
        determinaciones: [nuevaDeterminacion(HOY_ISO)],
        inmuno: (a.ficha?.inmuno ?? []).map((prueba) => ({ prueba, resultado: "" as ResInmuno, titulo: "" })),
        diagnostico: "", interpretacion: "", recomendaciones: "",
      };
  const [d, setD] = useState<Draft>(inicial);
  const [guardado, setGuardado] = useState(JSON.stringify(inicial));
  const [confirmar, setConfirmar] = useState(false);
  const [salir, setSalir] = useState(false);
  const editable = a.estado === "En Proceso";
  const dirty = JSON.stringify(d) !== guardado;

  const setDet = (i: number, patch: Partial<Determinacion>) => setD((s) => ({ ...s, determinaciones: s.determinaciones.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  /* ─── Completitud ─── */
  const detOk = (x: Determinacion) => !!x.fecha && x.fecha <= HOY_ISO && !!x.ed && !!x.cultivo && (x.cultivo !== "Positivo" || !!agenteDe(x));
  const checks: { k: string; ok: boolean; na?: boolean }[] = [
    { k: "Material clínico", ok: !!d.material.trim() },
    { k: "Examen directo", ok: d.determinaciones.every((x) => !!x.ed) },
    { k: "Cultivo", ok: d.determinaciones.every((x) => !!x.cultivo) },
    { k: "Identificación", ok: d.determinaciones.every((x) => x.cultivo !== "Positivo" || !!agenteDe(x)), na: d.determinaciones.every((x) => x.cultivo && x.cultivo !== "Positivo") },
    ...(nat === "Profunda" ? [{ k: "Inmunodiagnóstico", ok: d.inmuno.every((x) => !!x.resultado), na: d.inmuno.length === 0 }] : []),
    { k: "Diagnóstico micológico", ok: !!d.diagnostico.trim() },
  ];
  const completo = checks.every((c) => c.ok) && d.determinaciones.every(detOk);

  const persist = (validar: boolean) => {
    const st = stamp();
    const r: Resultado = { ...d, guardado: st, guardadoPor: currentUser(), ...(validar ? { validado: { por: currentUser(), fecha: st } } : {}) };
    onUpdateAnalisis({ ...a, resultado: r, ...(validar ? { estado: "Terminado y validado" as const } : {}) });
    setGuardado(JSON.stringify(d));
    if (validar) {
      logAudit({ modulo: "Análisis", accion: "VALIDAR", entidad: "AnalisisMicologico", entidadId: a.id, resumen: `Validación — ${d.diagnostico.trim()}`, cambios: [{ campo: "estado", antes: "En Proceso", despues: "Terminado y validado" }] });
      toast(`Análisis ${a.id} terminado y validado. Informe con OTP generado.`);
      onNavigate("Detalle de Análisis");
    } else {
      logAudit({ modulo: "Análisis", accion: "MODIFICAR", entidad: "ResultadoAnalisis", entidadId: a.id, resumen: "Borrador de resultados guardado" });
      toast("Borrador de resultados guardado", "blue");
    }
  };

  const sug = sugerencias(nat, sitio, d);
  const preview: Resultado = { ...d, guardado: stamp(), guardadoPor: currentUser() };

  return (
    <PageShell
      activePage="Carga de Resultados"
      onNavigate={onNavigate}
      section={`Laboratorio / Análisis / ${a.id}`}
      title="Carga de resultados y diagnóstico"
      actions={<Btn onClick={() => (dirty && editable ? setSalir(true) : onNavigate("Detalle de Análisis"))}>← Volver al análisis</Btn>}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Contexto */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border-light bg-surface px-4 py-3 text-[12.5px]">
            <span className="font-mono font-bold text-accent">{a.id}</span>
            <StatusPill estado={a.estado} />
            <span className="font-semibold">{a.paciente}</span>
            <span className="font-mono text-text-secondary">DNI {a.dni}</span>
            <MuestraBadge tipo={a.tipoMuestra} />
            <span className="text-text-secondary">{a.tipoAnalisis}</span>
            {(a.ficha?.dxPresuntivo || a.ficha?.diagnostico) && (
              <span className="text-text-secondary">Presuntivo: <span className="text-text-primary">{a.ficha.dxPresuntivo || a.ficha.diagnostico}</span></span>
            )}
          </div>

          {a.estado === "Pendiente" && <Banner tone="amber" action={<Btn onClick={() => onNavigate("Detalle de Análisis")}>Ir al análisis</Btn>}>El análisis está Pendiente. Inicie el procesamiento antes de cargar resultados.</Banner>}
          {a.estado === "Cancelado" && <Banner tone="red">Análisis cancelado: no admite carga de resultados.</Banner>}
          {a.estado === "Terminado y validado" && (
            <>
              <Banner tone="green">Resultados validados. El registro es inmutable.</Banner>
              {a.resultado && <Panel title="Resultados validados"><ResultadoResumen r={a.resultado} /></Panel>}
            </>
          )}

          {editable && (
            <>
              <Panel title="1 · Material clínico">
                <div className="max-w-md">
                  <Field label="Material clínico procesado" required hint={a.ficha ? "Tomado de la ficha clínica; corrija si corresponde." : undefined}>
                    <input className={inputCls} value={d.material} onChange={(e) => setD({ ...d, material: e.target.value })} />
                  </Field>
                </div>
              </Panel>

              <Panel
                title={nat === "Profunda" ? "2 · Determinaciones seriadas" : "2 · Examen directo, cultivo e identificación"}
                meta={nat === "Profunda" ? `${d.determinaciones.length} de ${maxDet}` : undefined}
                footer={nat === "Profunda" && d.determinaciones.length < maxDet && (
                  <Btn variant="ghost" onClick={() => setD({ ...d, determinaciones: [...d.determinaciones, nuevaDeterminacion(HOY_ISO)] })}>+ Agregar determinación</Btn>
                )}
                flush
              >
                {d.determinaciones.map((x, i) => (
                  <DeterminacionCard
                    key={i}
                    i={i}
                    x={x}
                    nat={nat}
                    multiple={maxDet > 1}
                    minFecha={arToIso(a.fechaIngreso)}
                    onChange={(p) => setDet(i, p)}
                    onRemove={d.determinaciones.length > 1 ? () => setD({ ...d, determinaciones: d.determinaciones.filter((_, j) => j !== i) }) : undefined}
                  />
                ))}
              </Panel>

              {nat === "Profunda" && (
                <Panel title="3 · Inmunodiagnóstico" meta="Marque las pruebas realizadas" flush>
                  <div className="divide-y divide-border-light">
                    {INMUNO.map((t) => {
                      const row = d.inmuno.find((r) => r.prueba === t.k);
                      const pedida = a.ficha?.inmuno?.includes(t.k);
                      const setRow = (p: Partial<{ resultado: ResInmuno; titulo: string }>) => setD((s) => ({ ...s, inmuno: s.inmuno.map((r) => (r.prueba === t.k ? { ...r, ...p } : r)) }));
                      return (
                        <div key={t.k} className={`grid grid-cols-[200px_1fr_160px] items-center gap-4 px-4 py-2.5 ${row ? "" : "opacity-70"}`}>
                          <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                            <input
                              type="checkbox"
                              className="accent-accent"
                              checked={!!row}
                              onChange={(e) => setD((s) => ({ ...s, inmuno: e.target.checked ? [...s.inmuno, { prueba: t.k, resultado: "", titulo: "" }] : s.inmuno.filter((r) => r.prueba !== t.k) }))}
                            />
                            <span>
                              <span className="font-mono font-semibold">{t.k}</span>
                              <span className="block text-[11px] text-text-muted">{t.d}{pedida ? " · solicitada" : ""}</span>
                            </span>
                          </label>
                          <Seg disabled={!row} value={row?.resultado ?? ""} options={["Reactivo", "No reactivo", "Indeterminado"] as const} onChange={(v) => setRow({ resultado: v, titulo: v === "Reactivo" ? row?.titulo ?? "" : "" })} tones={{ Reactivo: "bg-[#b91c1c] text-white", "No reactivo": "bg-validado-text text-white", Indeterminado: "bg-[#d97706] text-white" }} />
                          <input className={inputCls} disabled={row?.resultado !== "Reactivo"} placeholder="Título / bandas" value={row?.titulo ?? ""} onChange={(e) => setRow({ titulo: e.target.value })} />
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )}

              <Panel title={`${nat === "Profunda" ? 4 : 3} · Diagnóstico micológico`}>
                <div className="flex flex-col gap-4">
                  {sug.length > 0 && (
                    <div>
                      <GroupLabel>Sugerencias según los resultados cargados</GroupLabel>
                      <div className="flex flex-wrap gap-2">
                        {sug.map((s) => (
                          <button key={s} type="button" onClick={() => setD({ ...d, diagnostico: s })} className={`cursor-pointer rounded-full border px-3 py-1 text-[12px] ${d.diagnostico === s ? "border-accent bg-[#eff6ff] font-semibold text-accent" : "border-border bg-surface text-text-primary hover:bg-bg"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Field label="Diagnóstico" required hint="Figura en el informe entregado al paciente.">
                    <textarea rows={2} className={areaCls} value={d.diagnostico} onChange={(e) => setD({ ...d, diagnostico: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Interpretación / comentarios"><textarea rows={3} className={areaCls} value={d.interpretacion} onChange={(e) => setD({ ...d, interpretacion: e.target.value })} /></Field>
                    <Field label="Recomendaciones al médico"><textarea rows={3} className={areaCls} value={d.recomendaciones} onChange={(e) => setD({ ...d, recomendaciones: e.target.value })} placeholder="Ej. Se sugiere control micológico post-tratamiento" /></Field>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </div>

        {/* ─── Rail ─── */}
        {editable && (
          <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
            <div className="rounded-md border border-border-light bg-surface">
              <div className="border-b border-border-light px-4 py-2.5 text-[11px] font-bold tracking-[0.06em] text-pendiente-text uppercase">Estado de la carga</div>
              <ul className="m-0 flex list-none flex-col gap-1 p-3">
                {checks.map((c) => (
                  <li key={c.k} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className={c.ok ? "text-text-primary" : "text-text-secondary"}>{c.k}</span>
                    {c.na && c.ok ? <span className="text-[11px] text-text-muted">No corresponde</span> : c.ok ? <span className="font-bold text-validado-text">✓</span> : <span className="text-[11px] text-enproceso-text">Pendiente</span>}
                  </li>
                ))}
              </ul>
            </div>
            <Btn className="h-9 w-full justify-center" onClick={() => persist(false)} disabled={!dirty && !!a.resultado}>
              {dirty || !a.resultado ? "Guardar borrador" : "Borrador guardado"}
            </Btn>
            <Btn variant="primary" className="h-10 w-full justify-center text-[13px]" disabled={!completo} title={completo ? "" : "Complete todos los ítems pendientes"} onClick={() => setConfirmar(true)}>
              Validar y finalizar →
            </Btn>
            <p className="m-0 text-[11.5px] leading-relaxed text-text-muted">
              Al validar, el análisis pasa a <strong className="text-text-secondary">Terminado y validado</strong>, los resultados quedan inmutables y se genera el informe PDF con OTP para el paciente.
            </p>
          </aside>
        )}
      </div>

      {confirmar && (
        <Modal
          title="Validar y finalizar análisis"
          width={640}
          onClose={() => setConfirmar(false)}
          footer={<><Btn onClick={() => setConfirmar(false)}>Revisar</Btn><Btn variant="primary" onClick={() => persist(true)}>Confirmar validación</Btn></>}
        >
          <div className="flex flex-col gap-4">
            <Banner tone="amber">Esta acción es irreversible. Firma como bioquímico validante: <strong>{currentUser()}</strong>.</Banner>
            <ResultadoResumen r={preview} />
          </div>
        </Modal>
      )}
      {salir && (
        <Modal
          title="Cambios sin guardar"
          onClose={() => setSalir(false)}
          footer={<><Btn onClick={() => onNavigate("Detalle de Análisis")}>Descartar</Btn><Btn variant="primary" onClick={() => { persist(false); onNavigate("Detalle de Análisis"); }}>Guardar borrador y salir</Btn></>}
        >
          <p className="m-0 text-[12.5px]">Hay resultados cargados que todavía no se guardaron.</p>
        </Modal>
      )}
    </PageShell>
  );
}

/* ─── Tarjeta de determinación ─── */
function DeterminacionCard({ i, x, nat, multiple, minFecha, onChange, onRemove }: {
  i: number; x: Determinacion; nat: Naturaleza; multiple: boolean; minFecha: string; onChange: (p: Partial<Determinacion>) => void; onRemove?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border-light p-4 last:border-b-0">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          {multiple && <span className="pb-1.5 text-[13px] font-bold text-text-primary">Determinación {i + 1}</span>}
          <div className="w-44">
            <Field label="Fecha" required error={x.fecha > HOY_ISO ? "No puede ser futura." : undefined}>
              <input type="date" min={minFecha} max={HOY_ISO} className={inputCls} value={x.fecha} onChange={(e) => onChange({ fecha: e.target.value })} />
            </Field>
          </div>
        </div>
        {onRemove && <Btn variant="danger" className="!h-7" onClick={onRemove}>Quitar</Btn>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-3 rounded border border-border-light p-3">
          <div className="flex items-center justify-between gap-3">
            <GroupLabel>Examen directo *</GroupLabel>
            <Seg value={x.ed} options={["Positivo", "Negativo"] as const} onChange={(v) => onChange({ ed: v, edElementos: v === "Negativo" ? [] : x.edElementos })} />
          </div>
          {x.ed === "Positivo" && <CheckGrid cols={2} items={ED_ELEMENTOS[nat]} value={x.edElementos} onChange={(v) => onChange({ edElementos: v })} />}
          {x.ed && (
            <input className={inputCls} value={x.edDetalle} onChange={(e) => onChange({ edDetalle: e.target.value })} placeholder={x.ed === "Positivo" ? "Técnica y detalle (ej. KOH 20%)" : "Ej. No se observan elementos fúngicos"} />
          )}
        </div>

        <div className="flex flex-col gap-3 rounded border border-border-light p-3">
          <div className="flex items-center justify-between gap-3">
            <GroupLabel>Cultivo *</GroupLabel>
            <Seg value={x.cultivo} options={["Positivo", "Negativo", "Contaminado"] as const} onChange={(v) => onChange({ cultivo: v, ...(v !== "Positivo" ? { identificacion: "", identificacionOtro: "" } : {}) })} />
          </div>
          {x.cultivo && (
            <>
              <CheckGrid cols={2} items={MEDIOS} value={x.medios} onChange={(v) => onChange({ medios: v })} />
              {x.cultivo === "Positivo" && (
                <div className="grid grid-cols-1 gap-2">
                  <Field label="Identificación" required>
                    <select className={inputCls} value={x.identificacion} onChange={(e) => onChange({ identificacion: e.target.value })}>
                      <option value="">Seleccione agente…</option>
                      {[...AGENTES[nat], OTRO_AGENTE].map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </Field>
                  {x.identificacion === OTRO_AGENTE && <input className={inputCls} placeholder="Género y especie" value={x.identificacionOtro} onChange={(e) => onChange({ identificacionOtro: e.target.value })} />}
                </div>
              )}
              {x.cultivo === "Contaminado" && <Banner tone="amber">Cultivo contaminado: considere solicitar una nueva muestra.</Banner>}
              <textarea rows={2} className={areaCls} value={x.cultivoDetalle} onChange={(e) => onChange({ cultivoDetalle: e.target.value })} placeholder="Descripción macro y microscópica, días de incubación" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Resumen de solo lectura (Detalle, confirmación) ─── */
const TONE_RES: Record<string, Tone> = { Positivo: "red", Negativo: "green", Contaminado: "amber", Reactivo: "red", "No reactivo": "green", Indeterminado: "amber" };
export function ResultadoResumen({ r }: { r: Resultado }) {
  return (
    <div className="flex flex-col gap-4 text-[12.5px]">
      <div className="rounded border-l-4 border-validado-text bg-validado-bg px-4 py-3">
        <div className="text-[10.5px] font-bold tracking-[0.07em] text-validado-text uppercase">Diagnóstico micológico</div>
        <div className="mt-1 text-[14px] font-semibold text-text-primary">{r.diagnostico || "—"}</div>
      </div>
      <Line k="Material clínico">{r.material}</Line>
      {r.determinaciones.map((x, i) => (
        <div key={i} className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-1.5 rounded border border-border-light p-3">
          <span className="font-mono text-[12px] text-text-secondary">{isoToAr(x.fecha)}</span>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-text-muted">Examen directo</span>{x.ed ? <Pill tone={TONE_RES[x.ed]}>{x.ed}</Pill> : "—"}<span className="text-text-secondary">{[x.edElementos.join(", "), x.edDetalle].filter(Boolean).join(" · ")}</span></div>
            <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-text-muted">Cultivo</span>{x.cultivo ? <Pill tone={TONE_RES[x.cultivo]}>{x.cultivo}</Pill> : "—"}<span className="text-text-secondary">{[x.medios.join(", "), x.cultivoDetalle].filter(Boolean).join(" · ")}</span></div>
            {agenteDe(x) && <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-text-muted">Identificación</span><em className="font-semibold text-text-primary">{agenteDe(x)}</em></div>}
          </div>
        </div>
      ))}
      {r.inmuno.length > 0 && (
        <Line k="Inmunodiagnóstico">
          <span className="flex flex-wrap gap-2">
            {r.inmuno.map((t) => <span key={t.prueba} className="inline-flex items-center gap-1.5"><span className="font-mono">{t.prueba}</span>{t.resultado ? <Pill tone={TONE_RES[t.resultado]}>{t.resultado}{t.titulo ? ` ${t.titulo}` : ""}</Pill> : "—"}</span>)}
          </span>
        </Line>
      )}
      {r.interpretacion && <Line k="Interpretación">{r.interpretacion}</Line>}
      {r.recomendaciones && <Line k="Recomendaciones">{r.recomendaciones}</Line>}
      <Line k="Informado">{r.validado ? `${r.validado.por} · ${r.validado.fecha}` : `Pendiente de validación (borrador de ${r.guardadoPor})`}</Line>
    </div>
  );
}
function Line({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4">
      <span className="text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">{k}</span>
      <span className="text-text-primary">{children}</span>
    </div>
  );
}
