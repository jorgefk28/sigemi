import { useState, type ReactNode } from "react";
import { PageShell, Btn, Banner, Pill, Field, inputCls, type Tone } from "./ui";
import { MuestraBadge, type Analisis } from "./SharedLayout";
import {
  pacientesStore, estadoPaciente, edad, SITIOS, LESION, FACTORES, MATERIAL_SUP, MATERIAL_PROF, INMUNO, clasificar,
  type Ficha, type Naturaleza, type Sitio, type SiNo, type Sexo, type Paciente,
} from "./clinica";
import { HOY, fmtDate, isoToAr, arToIso, currentUser, logAudit, toast } from "../sigemi/core";
import { Section, Seg, CheckGrid, GroupLabel, areaCls, type SectionStatus } from "./formKit";

const BIOQUIMICOS = ["Fernández, R.", "Salinas, M.", "Ramírez, Claudia B."];
const HOY_ISO = arToIso(fmtDate(HOY));
const EST_TONE: Record<string, Tone> = { "Alta temprana": "blue", Activo: "green", Inactivo: "dark" };

interface Form {
  fechaIngreso: string;
  naturaleza: Naturaleza | "";
  sitio: Sitio | "";
  medico: string;
  institucion: string;
  diagnostico: string;
  localizacion: string;
  evolucion: string;
  atfPrevio: SiNo;
  atfPrevioDetalle: string;
  atfActual: SiNo;
  atfActualDetalle: string;
  modalidad: "" | "Internado" | "Ambulatorio";
  internacion: string;
  dxPresuntivo: string;
  rayosX: string;
  trayResidencial: string;
  trayOcupacional: string;
  lesion: string[];
  bordes: string;
  unaInicio: string;
  unaColor: string;
  factores: string[];
  sinFactores: boolean;
  factoresOtros: string;
  material: string;
  materialOtro: string;
  inmuno: string[];
  obsMuestra: string;
  bioquimico: string;
}
const EMPTY: Form = {
  fechaIngreso: HOY_ISO, naturaleza: "", sitio: "", medico: "", institucion: "", diagnostico: "", localizacion: "", evolucion: "",
  atfPrevio: "", atfPrevioDetalle: "", atfActual: "", atfActualDetalle: "", modalidad: "", internacion: "", dxPresuntivo: "", rayosX: "",
  trayResidencial: "", trayOcupacional: "", lesion: [], bordes: "", unaInicio: "", unaColor: "", factores: [], sinFactores: false,
  factoresOtros: "", material: "", materialOtro: "", inmuno: [], obsMuestra: "", bioquimico: BIOQUIMICOS[0],
};
interface Reg { nacimiento: string; sexo: Sexo; ocupacion: string; direccion: string; obraSocial: string; correo: string }

const atfOk = (v: SiNo, d: string) => v === "No" || (v === "Sí" && !!d.trim());

export function FichaClinicaView({
  pacienteDni,
  nextId,
  onNavigate,
  onMuestraIngresada,
}: {
  pacienteDni?: string | null;
  nextId: string;
  onNavigate: (page: string) => void;
  onMuestraIngresada: (a: Analisis) => void;
}) {
  const pacientes = pacientesStore.use();
  const [dni, setDni] = useState<string | null>(pacienteDni ?? null);
  const [q, setQ] = useState("");
  const [f, setF] = useState<Form>(EMPTY);
  const [reg, setReg] = useState<Reg>({ nacimiento: "", sexo: "", ocupacion: "", direccion: "", obraSocial: "", correo: "" });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));

  const p = pacientes.find((x) => x.dni === dni);
  const esAT = !!p?.altaTemprana;
  const sup = f.naturaleza === "Superficial";
  const prof = f.naturaleza === "Profunda";

  /* ─── Reglas de habilitación progresiva ─── */
  const s1 = !!p && p.activo && (!esAT || (!!reg.nacimiento && reg.nacimiento <= HOY_ISO && !!reg.sexo));
  const s2 = s1 && !!f.fechaIngreso && f.fechaIngreso <= HOY_ISO && !!f.naturaleza && (prof || !!f.sitio);
  const s3 = s2 && !!f.medico.trim() && !!f.institucion.trim() && !!f.diagnostico.trim() && atfOk(f.atfPrevio, f.atfPrevioDetalle) &&
    (sup ? !!f.localizacion.trim() : !!f.modalidad && (f.modalidad === "Ambulatorio" || !!f.internacion.trim()) && !!f.dxPresuntivo.trim() && atfOk(f.atfActual, f.atfActualDetalle));
  const s4 = s3 && (sup ? f.lesion.length > 0 : !!f.trayResidencial.trim());
  const s5 = s4 && (f.sinFactores || f.factores.length > 0) && (!f.factores.includes("Otros") || !!f.factoresOtros.trim());
  const s6 = s5 && !!f.material && (f.material !== "Otro" || !!f.materialOtro.trim()) && !!f.bioquimico;
  const done = [s1, s2, s3, s4, s5, s6];
  const status = (i: number): SectionStatus => (done[i] ? "done" : i === 0 || done[i - 1] ? "active" : "locked");

  const faltantes: string[] = [];
  if (!p) faltantes.push("Seleccionar paciente");
  else if (esAT && !s1) faltantes.push("Completar fecha de nacimiento y sexo del paciente");
  if (s1 && !s2) faltantes.push(!f.naturaleza ? "Elegir la naturaleza de la lesión" : "Elegir el sitio de la lesión");
  if (s2 && !s3) {
    if (!f.medico.trim()) faltantes.push(sup ? "Médico remitente" : "Médico solicitante");
    if (!f.institucion.trim()) faltantes.push("Institución");
    if (!f.diagnostico.trim()) faltantes.push(sup ? "Diagnóstico presuntivo" : "Diagnóstico");
    if (sup && !f.localizacion.trim()) faltantes.push("Localización de la lesión");
    if (prof && !f.modalidad) faltantes.push("Internado o ambulatorio");
    if (prof && f.modalidad === "Internado" && !f.internacion.trim()) faltantes.push("Nivel / habitación / cama");
    if (prof && !f.dxPresuntivo.trim()) faltantes.push("Dx micológico presuntivo");
    if (prof && !atfOk(f.atfActual, f.atfActualDetalle)) faltantes.push("Tratamiento antifúngico actual");
    if (!atfOk(f.atfPrevio, f.atfPrevioDetalle)) faltantes.push(sup ? "Tratamiento ATF previo" : "Tratamiento antifúngico previo");
  }
  if (s3 && !s4) faltantes.push(sup ? "Marcar al menos una característica de la lesión" : "Trayectoria residencial");
  if (s4 && !s5) faltantes.push(f.factores.includes("Otros") ? "Especificar «Otros» factores" : "Indicar factores predisponentes (o «Sin factores conocidos»)");
  if (s5 && !s6) faltantes.push(f.material === "Otro" ? "Especificar el material" : sup ? "Material clínico" : "Muestra / suero");

  const cls = f.naturaleza ? clasificar(f.naturaleza, f.sitio, f.material === "Otro" ? f.materialOtro : f.material) : null;

  const elegirNaturaleza = (n: Naturaleza) => {
    if (n === f.naturaleza) return;
    setF((s) => ({ ...s, naturaleza: n, sitio: "", lesion: [], factores: [], sinFactores: false, factoresOtros: "", material: "", materialOtro: "", inmuno: [] }));
  };
  const elegirSitio = (st: Sitio) => {
    if (st === f.sitio) return;
    setF((s) => ({ ...s, sitio: st, lesion: [], bordes: "", unaInicio: "", unaColor: "", material: "" }));
  };

  const registrar = () => {
    if (!s6 || !p || !f.naturaleza || !cls) return;
    const material = f.material === "Otro" ? f.materialOtro.trim() : f.material;
    const comunes = {
      registro: nextId, fechaIngreso: isoToAr(f.fechaIngreso), naturaleza: f.naturaleza, medico: f.medico.trim(), institucion: f.institucion.trim(),
      diagnostico: f.diagnostico.trim(), evolucion: f.evolucion.trim(), atfPrevio: f.atfPrevio, atfPrevioDetalle: f.atfPrevio === "Sí" ? f.atfPrevioDetalle.trim() : "",
      factores: f.sinFactores ? [] : f.factores, sinFactores: f.sinFactores, material, obsMuestra: f.obsMuestra.trim(),
    };
    const ficha: Ficha = sup
      ? { ...comunes, sitio: f.sitio as Sitio, localizacion: f.localizacion.trim(), lesion: f.lesion, bordes: f.bordes.trim(), unaInicio: f.unaInicio.trim(), unaColor: f.unaColor.trim() }
      : {
          ...comunes, modalidad: f.modalidad as "Internado" | "Ambulatorio", internacion: f.modalidad === "Internado" ? f.internacion.trim() : "",
          dxPresuntivo: f.dxPresuntivo.trim(), rayosX: f.rayosX.trim(), trayResidencial: f.trayResidencial.trim(), trayOcupacional: f.trayOcupacional.trim(),
          atfActual: f.atfActual, atfActualDetalle: f.atfActual === "Sí" ? f.atfActualDetalle.trim() : "", factoresOtros: f.factores.includes("Otros") ? f.factoresOtros.trim() : "", inmuno: f.inmuno,
        };
    if (esAT) {
      pacientesStore.set((l) => l.map((x) => (x.dni === p.dni ? {
        ...x, nacimiento: isoToAr(reg.nacimiento), sexo: reg.sexo, ocupacion: reg.ocupacion.trim(), direccion: reg.direccion.trim(),
        obraSocial: reg.obraSocial.trim(), correo: reg.correo.trim(), registro: fmtDate(HOY), altaTemprana: undefined,
      } : x)));
      logAudit({ modulo: "Pacientes", accion: "MODIFICAR", entidad: "Paciente", entidadId: p.dni, resumen: `Registro completo de ${p.apellido}, ${p.nombre} (desde alta temprana)`, cambios: [{ campo: "estado", antes: "Alta temprana", despues: "Activo" }] });
    }
    const usuario = currentUser();
    const fecha = `${fmtDate(HOY)} ${new Date().toTimeString().slice(0, 5)}`;
    const a: Analisis = {
      id: nextId, paciente: `${p.apellido}, ${p.nombre}`, dni: p.dni, tipoMuestra: cls.tipoMuestra, tipoAnalisis: cls.tipoAnalisis,
      estado: "Pendiente", fechaIngreso: isoToAr(f.fechaIngreso), bioquimico: f.bioquimico, ficha, revisiones: [],
      hallazgos: f.obsMuestra.trim() ? [{ fecha, tipo: "Observación", texto: `Recepción de muestra: ${f.obsMuestra.trim()}`, usuario }] : [],
    };
    logAudit({ modulo: "Análisis", accion: "CREAR", entidad: "AnalisisMicologico", entidadId: nextId, resumen: `Alta de análisis (${cls.tipoAnalisis}, ${material}) — ${a.paciente}`, cambios: [{ campo: "estado", antes: "—", despues: "Pendiente" }] });
    toast(`Consulta registrada. Análisis ${nextId} generado en estado Pendiente.`);
    onMuestraIngresada(a);
  };

  const sugeridos = pacientes.filter((x) => x.activo && (!q.trim() || `${x.dni.replace(/\./g, "")} ${x.dni} ${x.apellido} ${x.nombre}`.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 6);
  const titulos = ["Paciente", "Tipo de estudio", "Datos clínicos", sup ? "Características de la lesión" : prof ? "Antecedentes epidemiológicos" : "Lesión / antecedentes", "Factores predisponentes", "Muestra para el laboratorio"];
  const hint = (i: number) => `Complete «${titulos[i - 1]}» para habilitar esta sección.`;

  return (
    <PageShell
      activePage="Ficha Clínica"
      onNavigate={onNavigate}
      section="Laboratorio / Análisis"
      title="Nueva consulta · Ficha de resumen de datos"
      actions={<Btn onClick={() => onNavigate("Análisis")}>✕ Cancelar</Btn>}
    >
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          <div className="border-b-2 border-text-primary pb-3">
            <div className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">
              {f.naturaleza ? (sup ? "Ficha de resumen de datos · Micosis superficiales y cutáneas" : "Ficha de resumen de datos · Micosis profundas") : "Ficha de resumen de datos"}
            </div>
            <h1 className="m-0 mt-1 text-[26px] leading-tight font-bold tracking-[-0.02em]">Registro de consulta y muestra</h1>
            <p className="m-0 mt-1 text-[12.5px] text-text-secondary">Las secciones se habilitan a medida que completa la anterior. Los campos dependen de la naturaleza de la lesión.</p>
          </div>

          {/* 1 · Paciente */}
          <Section id="sec-1" n={1} title="Paciente" status={status(0)} subtitle={p ? "Datos demográficos tomados del registro del paciente." : "Busque por DNI, nombre o apellido."}>
            {!p ? (
              <div className="flex flex-col gap-3">
                <input autoFocus className={inputCls} placeholder="Ej. 27384901 o Ramírez" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="flex flex-col divide-y divide-border-light rounded border border-border-light">
                  {sugeridos.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-text-muted">No hay pacientes que coincidan. Regístrelo desde Pacientes.</div>}
                  {sugeridos.map((x) => (
                    <button key={x.dni} type="button" onClick={() => setDni(x.dni)} className="flex cursor-pointer items-center justify-between gap-3 border-none bg-surface px-3 py-2 text-left hover:bg-bg">
                      <span>
                        <span className="text-[13px] font-semibold text-text-primary">{x.apellido}, {x.nombre}</span>
                        <span className="ml-2 font-mono text-[11.5px] text-text-muted">DNI {x.dni}</span>
                      </span>
                      <Pill tone={EST_TONE[estadoPaciente(x)]}>{estadoPaciente(x)}</Pill>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <PacienteCard p={p} onCambiar={() => { setDni(null); setQ(""); }} reg={reg} setReg={setReg} />
            )}
          </Section>

          {/* 2 · Tipo de estudio */}
          <Section id="sec-2" n={2} title="Tipo de estudio" status={status(1)} lockedHint={hint(1)} subtitle="La naturaleza de la lesión define qué ficha se completa.">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fecha de ingreso" required error={f.fechaIngreso > HOY_ISO ? "La fecha no puede ser futura." : undefined}>
                  <input type="date" max={HOY_ISO} className={inputCls} value={f.fechaIngreso} onChange={(e) => set("fechaIngreso", e.target.value)} />
                </Field>
                <Field label="Número de registro" hint="Asignado automáticamente al registrar.">
                  <div className="flex h-8 items-center rounded border border-border-light bg-bg px-2.5 font-mono text-[12.5px] font-semibold text-accent">{nextId}</div>
                </Field>
              </div>
              <div>
                <GroupLabel>Naturaleza de la lesión *</GroupLabel>
                <div className="grid grid-cols-2 gap-3">
                  <Choice on={sup} onClick={() => elegirNaturaleza("Superficial")} title="Micosis superficiales y cutáneas" desc="Cuero cabelludo, piel lampiña o uñas." />
                  <Choice on={prof} onClick={() => elegirNaturaleza("Profunda")} title="Micosis profundas" desc="Muestras respiratorias, biopsias, LCR, sangre o suero." />
                </div>
              </div>
              {sup && (
                <div>
                  <GroupLabel>Sitio de la lesión *</GroupLabel>
                  <div className="grid grid-cols-3 gap-3">
                    {SITIOS.map((s) => <Choice key={s.k} compact on={f.sitio === s.k} onClick={() => elegirSitio(s.k)} title={s.k} desc={s.d} />)}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 3 · Datos clínicos */}
          <Section id="sec-3" n={3} title="Datos clínicos" status={status(2)} lockedHint={hint(2)}>
            {sup ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Médico remitente" required><input className={inputCls} value={f.medico} onChange={(e) => set("medico", e.target.value)} /></Field>
                <Field label="Institución" required><input className={inputCls} value={f.institucion} onChange={(e) => set("institucion", e.target.value)} placeholder="Ej. Hospital Madariaga" /></Field>
                <Field label="Diagnóstico presuntivo" required><input className={inputCls} value={f.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} placeholder="Ej. Onicomicosis" /></Field>
                <Field label="Localización de la lesión" required hint={f.sitio ? `Dentro de: ${f.sitio}` : undefined}>
                  <input className={inputCls} value={f.localizacion} onChange={(e) => set("localizacion", e.target.value)} placeholder={f.sitio === "Uñas" ? "Ej. Hallux derecho" : "Ej. Región occipital"} />
                </Field>
                <div className="col-span-2"><Field label="Evolución"><input className={inputCls} value={f.evolucion} onChange={(e) => set("evolucion", e.target.value)} placeholder="Ej. 3 meses, progresiva" /></Field></div>
                <div className="col-span-2"><SiNoField label="Tratamiento ATF previo" v={f.atfPrevio} d={f.atfPrevioDetalle} onV={(v) => set("atfPrevio", v)} onD={(v) => set("atfPrevioDetalle", v)} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-wrap items-end gap-4">
                  <Field label="Situación del paciente" required>
                    <Seg value={f.modalidad} options={["Ambulatorio", "Internado"] as const} onChange={(v) => set("modalidad", v)} />
                  </Field>
                  {f.modalidad === "Internado" && (
                    <div className="min-w-[240px] flex-1"><Field label="Nivel / habitación / cama" required><input className={inputCls} value={f.internacion} onChange={(e) => set("internacion", e.target.value)} placeholder="Ej. 2° / 214 / B" /></Field></div>
                  )}
                </div>
                <Field label="Institución" required><input className={inputCls} value={f.institucion} onChange={(e) => set("institucion", e.target.value)} /></Field>
                <Field label="Médico solicitante" required><input className={inputCls} value={f.medico} onChange={(e) => set("medico", e.target.value)} /></Field>
                <Field label="Diagnóstico" required><input className={inputCls} value={f.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} /></Field>
                <Field label="Dx micológico presuntivo" required><input className={inputCls} value={f.dxPresuntivo} onChange={(e) => set("dxPresuntivo", e.target.value)} placeholder="Ej. Paracoccidioidomicosis" /></Field>
                <div className="col-span-2"><Field label="Evolución"><input className={inputCls} value={f.evolucion} onChange={(e) => set("evolucion", e.target.value)} /></Field></div>
                <div className="col-span-2"><Field label="Rayos X (imagen pulmonar u otra)"><textarea rows={2} className={areaCls} value={f.rayosX} onChange={(e) => set("rayosX", e.target.value)} placeholder="Ej. Infiltrado intersticial bilateral" /></Field></div>
                <div className="col-span-2"><SiNoField label="Tratamiento antifúngico actual" v={f.atfActual} d={f.atfActualDetalle} onV={(v) => set("atfActual", v)} onD={(v) => set("atfActualDetalle", v)} /></div>
                <div className="col-span-2"><SiNoField label="Tratamiento antifúngico previo" v={f.atfPrevio} d={f.atfPrevioDetalle} onV={(v) => set("atfPrevio", v)} onD={(v) => set("atfPrevioDetalle", v)} /></div>
              </div>
            )}
          </Section>

          {/* 4 · Lesión (superficial) o antecedentes epidemiológicos (profunda) */}
          <Section id="sec-4" n={4} title={titulos[3]} status={status(3)} lockedHint={hint(3)} subtitle={sup ? `Solo se muestran las características de: ${f.sitio}. Marque al menos una.` : "Datos clave para micosis endémicas."}>
            {sup && f.sitio ? (
              <div className="flex flex-col gap-4">
                <CheckGrid cols={3} items={LESION[f.sitio]} value={f.lesion} onChange={(v) => set("lesion", v)} />
                {f.sitio === "Piel lampiña" && <Field label="Bordes"><input className={inputCls} value={f.bordes} onChange={(e) => set("bordes", e.target.value)} placeholder="Ej. Netos, sobreelevados, vesiculosos" /></Field>}
                {f.sitio === "Uñas" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Inicio"><input className={inputCls} value={f.unaInicio} onChange={(e) => set("unaInicio", e.target.value)} placeholder="Ej. Borde libre distal" /></Field>
                    <Field label="Color"><input className={inputCls} value={f.unaColor} onChange={(e) => set("unaColor", e.target.value)} placeholder="Ej. Amarillento" /></Field>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <Field label="Trayectoria residencial" required hint="Provincias que habitó y visitó.">
                  <textarea rows={2} className={areaCls} value={f.trayResidencial} onChange={(e) => set("trayResidencial", e.target.value)} placeholder="Ej. Misiones (nacimiento), Chaco 2010–2015" />
                </Field>
                <Field label="Trayectoria ocupacional" hint={p?.ocupacion ? `Ocupación registrada: ${p.ocupacion}. Detalle trabajo actual y anterior.` : "Trabajo actual y anterior."}>
                  <textarea rows={2} className={areaCls} value={f.trayOcupacional} onChange={(e) => set("trayOcupacional", e.target.value)} />
                </Field>
              </div>
            )}
          </Section>

          {/* 5 · Factores predisponentes */}
          <Section id="sec-5" n={5} title="Factores predisponentes" status={status(4)} lockedHint={hint(4)}>
            {f.naturaleza && (
              <div className="flex flex-col gap-4">
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded border border-border-light bg-bg px-3 py-1.5 text-[12.5px]">
                  <input type="checkbox" className="accent-accent" checked={f.sinFactores} onChange={(e) => setF((s) => ({ ...s, sinFactores: e.target.checked, factores: e.target.checked ? [] : s.factores }))} />
                  Sin factores predisponentes conocidos
                </label>
                <div className={`grid grid-cols-3 gap-5 ${f.sinFactores ? "opacity-40" : ""}`}>
                  {FACTORES[f.naturaleza].map((g) => (
                    <div key={g.grupo}>
                      <GroupLabel>{g.grupo}</GroupLabel>
                      <CheckGrid cols={1} disabled={f.sinFactores} items={g.items} value={f.factores} onChange={(v) => set("factores", v)} />
                    </div>
                  ))}
                </div>
                {f.factores.includes("Otros") && (
                  <Field label="Otros factores" required><input className={inputCls} value={f.factoresOtros} onChange={(e) => set("factoresOtros", e.target.value)} /></Field>
                )}
              </div>
            )}
          </Section>

          {/* 6 · Muestra */}
          <Section id="sec-6" n={6} title="Muestra para el laboratorio" status={status(5)} lockedHint={hint(5)} subtitle="Uso exclusivo del Laboratorio de Micología.">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={sup ? "Material clínico" : "Muestra / suero"} required>
                  <select className={inputCls} value={f.material} onChange={(e) => set("material", e.target.value)}>
                    <option value="">Seleccione…</option>
                    {(sup && f.sitio ? MATERIAL_SUP[f.sitio] : MATERIAL_PROF).map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                {f.material === "Otro" ? (
                  <Field label="Especificar material" required><input className={inputCls} value={f.materialOtro} onChange={(e) => set("materialOtro", e.target.value)} /></Field>
                ) : (
                  <Field label="Bioquímico responsable" required>
                    <select className={inputCls} value={f.bioquimico} onChange={(e) => set("bioquimico", e.target.value)}>{BIOQUIMICOS.map((b) => <option key={b}>{b}</option>)}</select>
                  </Field>
                )}
                {f.material === "Otro" && (
                  <Field label="Bioquímico responsable" required>
                    <select className={inputCls} value={f.bioquimico} onChange={(e) => set("bioquimico", e.target.value)}>{BIOQUIMICOS.map((b) => <option key={b}>{b}</option>)}</select>
                  </Field>
                )}
              </div>
              {prof && (
                <div>
                  <GroupLabel>Inmunodiagnóstico solicitado</GroupLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {INMUNO.map((t) => {
                      const on = f.inmuno.includes(t.k);
                      return (
                        <label key={t.k} className={`flex cursor-pointer items-start gap-2 rounded border px-2.5 py-2 text-[12px] ${on ? "border-accent bg-[#eff6ff]" : "border-border-light hover:bg-bg"}`}>
                          <input type="checkbox" className="mt-0.5 accent-accent" checked={on} onChange={(e) => set("inmuno", e.target.checked ? [...f.inmuno, t.k] : f.inmuno.filter((x) => x !== t.k))} />
                          <span><span className="font-mono font-semibold">{t.k}</span><span className="block text-[11px] text-text-muted">{t.d}</span></span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <Field label="Observaciones de recepción"><textarea rows={2} className={areaCls} value={f.obsMuestra} onChange={(e) => set("obsMuestra", e.target.value)} placeholder="Ej. Cantidad suficiente, recipiente estéril" /></Field>
              <Banner tone="blue">Examen directo, cultivos, identificación{prof ? " y resultados de inmunodiagnóstico" : ""} se cargan durante el análisis, en la pantalla «Carga de resultados».</Banner>
            </div>
          </Section>
        </div>

        {/* ─── Rail ─── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-md border border-border-light bg-surface">
            <div className="border-b border-border-light px-4 py-2.5 text-[11px] font-bold tracking-[0.06em] text-pendiente-text uppercase">Progreso</div>
            <ol className="m-0 flex list-none flex-col gap-0.5 p-2">
              {titulos.map((t, i) => {
                const st = status(i);
                return (
                  <li key={t}>
                    <a href={`#sec-${i + 1}`} className={`flex items-center gap-2.5 rounded px-2 py-1.5 text-[12.5px] no-underline ${st === "locked" ? "text-text-muted" : "text-text-primary hover:bg-bg"} ${st === "active" ? "bg-[#eff6ff] font-semibold" : ""}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${st === "done" ? "bg-validado-text text-white" : st === "active" ? "bg-accent text-white" : "bg-border-light text-text-muted"}`}>{st === "done" ? "✓" : i + 1}</span>
                      {t}
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-md border border-border-light bg-surface p-4">
            <div className="mb-3 text-[11px] font-bold tracking-[0.06em] text-pendiente-text uppercase">Análisis a generar</div>
            <dl className="m-0 flex flex-col gap-2.5 text-[12.5px]">
              <Row k="N.º de registro"><span className="font-mono font-semibold text-accent">{nextId}</span></Row>
              <Row k="Paciente">{p ? `${p.apellido}, ${p.nombre}` : "—"}</Row>
              <Row k="Ficha">{f.naturaleza ? (sup ? "Superficiales y cutáneas" : "Profundas") : "—"}</Row>
              <Row k="Tipo de análisis">{cls && (prof || f.sitio) ? cls.tipoAnalisis : "—"}</Row>
              <Row k="Muestra">{cls && f.material ? <MuestraBadge tipo={cls.tipoMuestra} /> : "—"}</Row>
              <Row k="Estado inicial">Pendiente</Row>
            </dl>
          </div>

          {faltantes.length > 0 && (
            <div className="rounded-md border border-[#fde68a] bg-enproceso-bg px-4 py-3 text-[12px] text-enproceso-text">
              <div className="mb-1 font-semibold">Para continuar falta:</div>
              <ul className="m-0 flex flex-col gap-0.5 pl-4">{faltantes.slice(0, 5).map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}

          <Btn variant="primary" className="h-10 w-full justify-center text-[13px]" disabled={!s6} onClick={registrar} title={s6 ? "" : "Complete todas las secciones obligatorias"}>
            Registrar consulta y generar análisis
          </Btn>
          {esAT && <p className="m-0 text-[11.5px] text-text-muted">Al registrar, el paciente deja de estar en «Alta temprana» y pasa a Activo con los datos completados.</p>}
        </aside>
      </div>
    </PageShell>
  );
}

/* ─── Subcomponentes ─── */
function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{k}</dt>
      <dd className="m-0 text-right font-medium text-text-primary">{children}</dd>
    </div>
  );
}

function Choice({ on, onClick, title, desc, compact }: { on: boolean; onClick: () => void; title: string; desc: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex cursor-pointer flex-col gap-1 rounded-md border-2 text-left ${compact ? "px-3 py-2.5" : "px-4 py-3"} ${on ? "border-accent bg-[#eff6ff]" : "border-border-light bg-surface hover:border-border"}`}
    >
      <span className="flex items-center gap-2 text-[13px] font-bold text-text-primary">
        <span className={`h-3.5 w-3.5 rounded-full border-2 ${on ? "border-accent bg-accent shadow-[inset_0_0_0_2px_#fff]" : "border-border"}`} />
        {title}
      </span>
      <span className="text-[11.5px] text-text-secondary">{desc}</span>
    </button>
  );
}

function SiNoField({ label, v, d, onV, onD }: { label: string; v: SiNo; d: string; onV: (v: SiNo) => void; onD: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label={label} required>
        <Seg value={v} options={["No", "Sí"] as const} onChange={onV} />
      </Field>
      {v === "Sí" && (
        <div className="min-w-[260px] flex-1">
          <Field label="Droga, dosis y duración" required><input className={inputCls} value={d} onChange={(e) => onD(e.target.value)} placeholder="Ej. Terbinafina 250 mg/día, 6 semanas" /></Field>
        </div>
      )}
    </div>
  );
}

function PacienteCard({ p, onCambiar, reg, setReg }: { p: Paciente; onCambiar: () => void; reg: Reg; setReg: (r: Reg) => void }) {
  const est = estadoPaciente(p);
  const e = edad(p.nacimiento);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[16px] font-bold text-text-primary">{p.apellido}, {p.nombre}</div>
          <div className="font-mono text-[12px] text-text-secondary">DNI {p.dni}</div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={EST_TONE[est]}>{est}</Pill>
          <Btn variant="ghost" onClick={onCambiar}>Cambiar</Btn>
        </div>
      </div>
      {!p.activo && <Banner tone="dark">Paciente inactivo: no se pueden iniciar consultas.</Banner>}
      {p.altaTemprana ? (
        <>
          <Banner tone="blue">
            Alta temprana recibida del {p.altaTemprana.origen.toLowerCase()} el {p.altaTemprana.recibido}. Complete los datos faltantes para registrar al paciente.
          </Banner>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Celular"><div className="flex h-8 items-center font-mono text-[12.5px]">{p.telefono}</div></Field>
            <Field label="Fecha de nacimiento" required error={reg.nacimiento > HOY_ISO ? "No puede ser futura." : undefined}>
              <input type="date" max={HOY_ISO} className={inputCls} value={reg.nacimiento} onChange={(x) => setReg({ ...reg, nacimiento: x.target.value })} />
            </Field>
            <Field label="Sexo" required>
              <Seg value={reg.sexo} options={["Femenino", "Masculino", "X"] as const} onChange={(v) => setReg({ ...reg, sexo: v })} />
            </Field>
            <Field label="Ocupación"><input className={inputCls} value={reg.ocupacion} onChange={(x) => setReg({ ...reg, ocupacion: x.target.value })} /></Field>
            <Field label="Domicilio"><input className={inputCls} value={reg.direccion} onChange={(x) => setReg({ ...reg, direccion: x.target.value })} /></Field>
            <Field label="Obra social"><input className={inputCls} value={reg.obraSocial} onChange={(x) => setReg({ ...reg, obraSocial: x.target.value })} /></Field>
          </div>
        </>
      ) : (
        <dl className="m-0 grid grid-cols-4 gap-x-4 gap-y-3 border-t border-border-light pt-3">
          {[
            ["Edad", e !== null ? `${e} años` : "—"],
            ["Sexo", p.sexo || "—"],
            ["Teléfono", p.telefono || "—"],
            ["Obra social", p.obraSocial || "—"],
            ["Ocupación", p.ocupacion || "—"],
            ["Domicilio", p.direccion || "—"],
          ].map(([k, v]) => (
            <div key={k} className={k === "Domicilio" ? "col-span-2" : ""}>
              <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">{k}</dt>
              <dd className="m-0 mt-0.5 text-[13px]">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
