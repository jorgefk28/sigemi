import { useState } from "react";
import { StatusPill, type Estado } from "./SharedLayout";
import { PageShell, Panel, Btn, Banner, Pill, Table, tr, td, tdMono, inputCls, Field, Empty, Modal, type Tone } from "./ui";
import { pacientesStore, estadoPaciente, edad, type Paciente, type EstadoPaciente } from "./clinica";
import { logAudit, toast as toastGlobal } from "../sigemi/core";
import { darDeBajaPaciente, guardarPaciente, mensajeDeError } from "../../data/pacientes";

const EST_TONE: Record<EstadoPaciente, Tone> = { "Alta temprana": "blue", Activo: "green", Inactivo: "dark" };

const CONSULTAS = [
  { fecha: "10/09/2026", diagnostico: "Onicomicosis subungueal distal", institucion: "Lab. Micología · UNaM" },
  { fecha: "15/03/2026", diagnostico: "Tiña capitis", institucion: "Hospital Madariaga" },
];
const ANALISIS: { id: string; fecha: string; tipo: string; muestra: string; estado: Estado }[] = [
  { id: "MIC-2026-0341", fecha: "10/09/2026", tipo: "Micosis ungueal", muestra: "Uñas", estado: "Terminado y validado" },
  { id: "MIC-2026-0198", fecha: "15/03/2026", tipo: "Micosis superficial", muestra: "Cabello", estado: "En Proceso" },
];

type Vista = { kind: "list" } | { kind: "perfil"; dni: string } | { kind: "form"; dni?: string; from: "list" | "perfil" };
const EMPTY: Paciente = { dni: "", nombre: "", apellido: "", nacimiento: "", sexo: "", ocupacion: "", telefono: "", correo: "", direccion: "", obraSocial: "", registro: "", activo: true };
const PAGE = 8;

export default function PacientesView({
  onNavigate,
  onNuevaConsulta,
  isAdmin = true,
}: {
  onNavigate: (page: string) => void;
  onNuevaConsulta: (dni: string) => void;
  isAdmin?: boolean;
}) {
  const pacientes = pacientesStore.use();
  const [vista, setVista] = useState<Vista>({ kind: "list" });
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const [desactivar, setDesactivar] = useState<Paciente | null>(null);
  const [motivo, setMotivo] = useState("");

  const toISO = (d: string) => d.split("/").reverse().join("-");
  const filtered = pacientes.filter((p) => {
    const s = applied.toLowerCase();
    if (s && !`${p.dni.replace(/\./g, "")} ${p.dni} ${p.nombre} ${p.apellido}`.toLowerCase().includes(s)) return false;
    if (estado && estadoPaciente(p) !== estado) return false;
    if (desde && (!p.registro || toISO(p.registro) < desde)) return false;
    if (hasta && (!p.registro || toISO(p.registro) > hasta)) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  };

  const altas = pacientes.filter((p) => p.altaTemprana);

  /* ─── Perfil ─── */
  if (vista.kind === "perfil") {
    const p = pacientes.find((x) => x.dni === vista.dni)!;
    if (p.altaTemprana) {
      const at = p.altaTemprana;
      return (
        <PageShell
          activePage="Pacientes"
          onNavigate={onNavigate}
          section="Pacientes"
          title={`${p.apellido}, ${p.nombre}`}
          actions={
            <>
              <Btn onClick={() => setVista({ kind: "list" })}>← Listado</Btn>
              <Btn onClick={() => setVista({ kind: "form", dni: p.dni, from: "perfil" })}>Completar registro</Btn>
              <Btn variant="primary" onClick={() => onNuevaConsulta(p.dni)}>+ Nueva Consulta</Btn>
            </>
          }
        >
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
            {toast && <Banner tone="green">{toast}</Banner>}
            <div className="flex items-end justify-between border-b-2 border-text-primary pb-3">
              <div>
                <div className="font-mono text-[12px] text-text-secondary">DNI {p.dni}</div>
                <h1 className="m-0 mt-1 text-[28px] leading-none font-bold tracking-[-0.02em]">{p.apellido}, {p.nombre}</h1>
              </div>
              <Pill tone="blue">Alta temprana</Pill>
            </div>
            <Banner tone="blue">
              Paciente recibido desde el <strong>{at.origen.toLowerCase()}</strong> con datos mínimos. El registro se completa al iniciar la primera consulta (fecha de nacimiento, sexo, domicilio…) o desde «Completar registro».
            </Banner>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Panel title="Datos del alta temprana">
                <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3">
                  {[["Nombre", p.nombre], ["Apellido", p.apellido], ["DNI", p.dni], ["Celular", p.telefono]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">{k}</dt>
                      <dd className={`m-0 mt-0.5 text-[13px] ${k === "DNI" || k === "Celular" ? "font-mono text-[12.5px]" : ""}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Panel title="Turno reservado">
                <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3">
                  {[["Fecha y hora", at.turno], ["Origen", at.origen], ["Recibido", at.recibido], ["Faltan datos", "Nacimiento, sexo, domicilio, obra social"]].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">{k}</dt>
                      <dd className={`m-0 mt-0.5 text-[13px] ${k === "Fecha y hora" || k === "Recibido" ? "font-mono text-[12.5px]" : ""}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
            <Panel title="Historial de consultas y análisis">
              <Empty title="Sin consultas registradas">
                <span className="text-[12px] text-text-secondary">Inicie la primera consulta para registrar la ficha clínica y la muestra.</span>
                <Btn variant="primary" className="mt-2" onClick={() => onNuevaConsulta(p.dni)}>+ Nueva Consulta</Btn>
              </Empty>
            </Panel>
          </div>
        </PageShell>
      );
    }
    return (
      <PageShell
        activePage="Pacientes"
        onNavigate={onNavigate}
        section="Pacientes"
        title={`${p.apellido}, ${p.nombre}`}
        actions={
          <>
            <Btn onClick={() => setVista({ kind: "list" })}>← Listado</Btn>
            <Btn disabled={!p.activo} onClick={() => setVista({ kind: "form", dni: p.dni, from: "perfil" })}>
              Editar
            </Btn>
            {isAdmin && p.activo && (
              <Btn variant="danger" onClick={() => setDesactivar(p)}>
                Desactivar
              </Btn>
            )}
            <Btn variant="primary" disabled={!p.activo} title={p.activo ? "" : "No se puede iniciar consulta con un paciente inactivo."} onClick={() => onNuevaConsulta(p.dni)}>
              + Nueva Consulta
            </Btn>
          </>
        }
      >
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
          {toast && <Banner tone="green">{toast}</Banner>}
          {!p.activo && (
            <Banner tone="dark">
              ⚠ Este paciente se encuentra <strong>INACTIVO</strong>. No se pueden agendar nuevos turnos ni iniciar consultas. El historial permanece accesible.
            </Banner>
          )}

          <div className="flex items-end justify-between border-b-2 border-text-primary pb-3">
            <div>
              <div className="font-mono text-[12px] text-text-secondary">DNI {p.dni}</div>
              <h1 className="m-0 mt-1 text-[28px] leading-none font-bold tracking-[-0.02em]">
                {p.apellido}, {p.nombre}
              </h1>
            </div>
            <Pill tone={p.activo ? "green" : "dark"}>{p.activo ? "Activo" : "Inactivo"}</Pill>
          </div>

          <Panel title="Datos personales">
            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              {[
                ["F. Nacimiento", p.nacimiento, true],
                ["Edad", `${edad(p.nacimiento) ?? "—"} años`, false],
                ["Sexo", p.sexo || "—", false],
                ["Ocupación", p.ocupacion || "—", false],
                ["Teléfono", p.telefono, true],
                ["Correo", p.correo || "—", false],
                ["Dirección", p.direccion || "—", false],
                ["Obra social", p.obraSocial || "—", false],
                ["Fecha de registro", p.registro, true],
              ].map(([k, v, mono]) => (
                <div key={k as string}>
                  <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-text-muted uppercase">{k}</dt>
                  <dd className={`m-0 mt-0.5 text-[13px] ${mono ? "font-mono text-[12.5px]" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Historial de consultas" meta="Orden cronológico" flush>
            <Table head={["Fecha", "Diagnóstico presuntivo", "Institución", ""]}>
              {CONSULTAS.map((c) => (
                <tr key={c.fecha} className={tr}>
                  <td className={tdMono}>{c.fecha}</td>
                  <td className={td}>{c.diagnostico}</td>
                  <td className={`${td} text-text-secondary`}>{c.institucion}</td>
                  <td className={`${td} text-right`}>
                    <Btn variant="ghost" onClick={() => onNavigate("Ficha Clínica")}>Ver ficha completa →</Btn>
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>

          <Panel title="Análisis micológicos" flush>
            <Table head={["ID", "Fecha", "Tipo de análisis", "Muestra", "Estado", "Resultado"]}>
              {ANALISIS.map((a) => (
                <tr key={a.id} className={tr}>
                  <td className={`${tdMono} font-medium text-accent`}>{a.id}</td>
                  <td className={tdMono}>{a.fecha}</td>
                  <td className={td}>{a.tipo}</td>
                  <td className={td}>{a.muestra}</td>
                  <td className={td}><StatusPill estado={a.estado} /></td>
                  <td className={td}>
                    {a.estado === "Terminado y validado" ? (
                      <Btn variant="ghost" onClick={() => onNavigate("Resultados")}>Ver informe →</Btn>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>

        {desactivar && (
          <Modal
            title="Desactivar paciente"
            onClose={() => setDesactivar(null)}
            footer={
              <>
                <Btn onClick={() => setDesactivar(null)}>Cancelar</Btn>
                <Btn
                  variant="primary"
                  className="!border-[#b91c1c] !bg-[#b91c1c]"
                  disabled={motivo.trim().length < 5}
                  onClick={() => {
                    const paciente = desactivar;
                    const razon = motivo;
                    setDesactivar(null);
                    setMotivo("");
                    darDeBajaPaciente(paciente, razon)
                      .then(() =>
                        flash("Paciente desactivado. La acción quedó registrada en Auditoría."),
                      )
                      .catch((error: unknown) => toastGlobal(mensajeDeError(error), "red"));
                  }}
                >
                  Confirmar desactivación
                </Btn>
              </>
            }
          >
            <div className="flex flex-col gap-4 text-[12.5px]">
              <p className="m-0">
                Vas a desactivar a <strong>{desactivar.apellido}, {desactivar.nombre}</strong> (<span className="font-mono">DNI {desactivar.dni}</span>). Es una baja lógica:
              </p>
              <ul className="m-0 flex flex-col gap-1 pl-4 text-text-secondary">
                <li>No podrá recibir nuevos turnos ni consultas.</li>
                <li>Los turnos futuros confirmados serán cancelados.</li>
                <li>El historial clínico y los análisis permanecen accesibles.</li>
              </ul>
              <Field label="Motivo de desactivación" required hint="Mínimo 5 caracteres. Se registra en Auditoría.">
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className={`${inputCls} h-auto py-2`} />
              </Field>
            </div>
          </Modal>
        )}
      </PageShell>
    );
  }

  /* ─── Registro / Edición ─── */
  if (vista.kind === "form") {
    return (
      <PacienteForm
        initial={vista.dni ? pacientes.find((p) => p.dni === vista.dni)! : EMPTY}
        editing={!!vista.dni}
        completing={!!(vista.dni && pacientes.find((p) => p.dni === vista.dni)?.altaTemprana)}
        existing={pacientes.map((p) => p.dni.replace(/\./g, ""))}
        onNavigate={onNavigate}
        onCancel={() => setVista(vista.from === "perfil" && vista.dni ? { kind: "perfil", dni: vista.dni } : { kind: "list" })}
        onSave={(p) => {
          const prev = vista.dni ? pacientes.find((x) => x.dni === vista.dni) : undefined;
          const mensaje = prev?.altaTemprana
            ? "Registro completado. El paciente pasó a estado Activo."
            : vista.dni
              ? "Datos del paciente actualizados."
              : "Paciente registrado correctamente.";
          guardarPaciente(p, vista.dni)
            .then(() => {
              if (prev?.altaTemprana) {
                logAudit({
                  modulo: "Pacientes",
                  accion: "MODIFICAR",
                  entidad: "Paciente",
                  entidadId: p.dni,
                  resumen: `Registro completo de ${p.apellido}, ${p.nombre} (desde alta temprana)`,
                  cambios: [{ campo: "estado", antes: "Alta temprana", despues: "Activo" }],
                });
              }
              flash(mensaje);
              setVista({ kind: "perfil", dni: p.dni });
            })
            .catch((error: unknown) => toastGlobal(mensajeDeError(error), "red"));
        }}
      />
    );
  }

  /* ─── Listado ─── */
  return (
    <PageShell
      activePage="Pacientes"
      onNavigate={onNavigate}
      section="Principal"
      title="Pacientes"
      actions={<Btn variant="primary" onClick={() => setVista({ kind: "form", from: "list" })}>+ Nuevo Paciente</Btn>}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
        {toast && <Banner tone="green">{toast}</Banner>}
        {altas.length > 0 && (
          <Banner
            tone="blue"
            action={estado === "Alta temprana" ? <Btn onClick={() => { setEstado(""); setPage(1); }}>Ver todos</Btn> : <Btn onClick={() => { setEstado("Alta temprana"); setPage(1); }}>Ver altas tempranas</Btn>}
          >
            <strong>{altas.length} pacientes con alta temprana</strong> recibidos del sistema de turnos. Solo tienen nombre, apellido, DNI y celular; el registro se completa al iniciar su consulta.
          </Banner>
        )}
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border border-border-light bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(q.trim().length >= 2 ? q.trim() : "");
            setPage(1);
          }}
        >
          <div className="min-w-[240px] flex-[2]">
            <Field label="Buscar" hint="DNI, nombre o apellido · mín. 2 caracteres">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. 27384901 o Ramírez" className={inputCls} />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Estado">
              <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }} className={inputCls}>
                <option value="">Todos</option>
                <option>Alta temprana</option>
                <option>Activo</option>
                <option>Inactivo</option>
              </select>
            </Field>
          </div>
          <div className="w-40">
            <Field label="Registro desde">
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Registro hasta">
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-2 pb-[18px]">
            <Btn type="submit" variant="primary" disabled={q.trim().length === 1}>Buscar</Btn>
            <Btn type="button" onClick={() => { setQ(""); setApplied(""); setEstado(""); setDesde(""); setHasta(""); setPage(1); }}>
              Limpiar
            </Btn>
          </div>
        </form>

        <Panel flush>
          {filtered.length === 0 ? (
            <Empty title="No se encontraron pacientes con los criterios ingresados">
              <span className="text-[12px] text-text-secondary">Ajustá los filtros o registrá un nuevo paciente.</span>
            </Empty>
          ) : (
            <Table head={["DNI", "Apellido", "Nombre", "Edad", "Teléfono", "Registro", "Estado", ""]}>
              {rows.map((p) => (
                <tr key={p.dni} className={`${tr} cursor-pointer ${p.activo ? "" : "text-text-muted [&_td]:text-text-muted"}`} onClick={() => setVista({ kind: "perfil", dni: p.dni })}>
                  <td className={tdMono}>{p.dni}</td>
                  <td className={`${td} font-semibold`}>{p.apellido}</td>
                  <td className={td}>{p.nombre}</td>
                  <td className={tdMono}>{edad(p.nacimiento) ?? "—"}</td>
                  <td className={tdMono}>{p.telefono}</td>
                  <td className={tdMono}>{p.registro || <span className="text-text-muted" title={`Turno: ${p.altaTemprana?.turno}`}>Turno {p.altaTemprana?.turno.slice(0, 5)}</span>}</td>
                  <td className={td}><Pill tone={EST_TONE[estadoPaciente(p)]}>{estadoPaciente(p)}</Pill></td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {p.altaTemprana ? (
                      <Btn variant="primary" className="!h-7 !px-2.5" onClick={(e) => { e.stopPropagation(); onNuevaConsulta(p.dni); }}>+ Nueva consulta</Btn>
                    ) : (
                      <Btn variant="ghost">Ver →</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <div className="flex items-center justify-between border-t border-border-light px-4 py-2.5 text-[11.5px] text-text-secondary">
            <span>
              Mostrando {filtered.length ? (page - 1) * PAGE + 1 : 0}–{Math.min(page * PAGE, filtered.length)} de {filtered.length} pacientes
            </span>
            <div className="flex gap-1">
              <Btn className="!h-7 !px-2.5" disabled={page === 1} onClick={() => setPage(page - 1)}>◀</Btn>
              {Array.from({ length: pages }, (_, i) => (
                <Btn key={i} className="!h-7 !px-2.5" variant={page === i + 1 ? "primary" : "secondary"} onClick={() => setPage(i + 1)}>
                  {i + 1}
                </Btn>
              ))}
              <Btn className="!h-7 !px-2.5" disabled={page === pages} onClick={() => setPage(page + 1)}>▶</Btn>
            </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function PacienteForm({
  initial,
  editing,
  completing,
  existing,
  onNavigate,
  onCancel,
  onSave,
}: {
  initial: Paciente;
  editing: boolean;
  completing?: boolean;
  existing: string[];
  onNavigate: (page: string) => void;
  onCancel: () => void;
  onSave: (p: Paciente) => void;
}) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Paciente) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = () => {
    const e: Record<string, string> = {};
    const dni = f.dni.replace(/\./g, "");
    if (!/^\d{7,8}$/.test(dni)) e.dni = "El DNI debe tener 7 u 8 dígitos numéricos.";
    else if (!editing && existing.includes(dni)) e.dni = "Ya existe un paciente registrado con este DNI.";
    if (!f.nombre.trim()) e.nombre = "Campo obligatorio.";
    if (!f.apellido.trim()) e.apellido = "Campo obligatorio.";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(f.nacimiento)) e.nacimiento = "Formato dd/mm/aaaa.";
    if (!f.telefono.trim()) e.telefono = "Campo obligatorio.";
    if (!f.sexo) e.sexo = "Campo obligatorio.";
    if (f.correo && !/^\S+@\S+\.\S+$/.test(f.correo)) e.correo = "Formato de correo inválido.";
    setErrors(e);
    if (Object.keys(e).length === 0) onSave({ ...f, dni: editing ? f.dni : dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".") });
  };

  const input = (k: keyof Paciente, ph = "", disabled = false) => (
    <input
      value={f[k] as string}
      onChange={set(k)}
      placeholder={ph}
      disabled={disabled}
      className={`${inputCls} ${errors[k] ? "!border-[#ef4444]" : ""} ${disabled ? "bg-bg font-mono text-text-secondary" : ""}`}
    />
  );

  return (
    <PageShell
      activePage="Pacientes"
      onNavigate={onNavigate}
      section="Pacientes"
      title={completing ? "Completar registro" : editing ? "Edición de Paciente" : "Registro de Paciente"}
      actions={<Btn onClick={onCancel}>✕ Cerrar</Btn>}
    >
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        <div className="border-b-2 border-text-primary pb-3">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase">{completing ? "Alta temprana · Completar registro" : editing ? "REC-17 · Modificar paciente" : "REC-16 · Registrar paciente"}</div>
          <h1 className="m-0 mt-1 text-[28px] leading-none font-bold tracking-[-0.02em]">{editing ? `${initial.apellido}, ${initial.nombre}` : "Nuevo paciente"}</h1>
        </div>
        {completing && <Banner tone="blue">Nombre, apellido, DNI y celular fueron recibidos del sistema de turnos. Complete el resto para registrar al paciente.</Banner>}
        {Object.keys(errors).length > 0 && <Banner tone="red">Revisá los campos marcados antes de guardar.</Banner>}
        <Panel title="Datos personales" meta="Campos obligatorios marcados con *" footer={
          <div className="flex justify-between">
            <Btn onClick={onCancel}>Cancelar</Btn>
            <Btn variant="primary" onClick={submit}>Guardar</Btn>
          </div>
        }>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="DNI" required error={errors.dni} hint={editing ? "El DNI no puede modificarse." : "Sin puntos, 7 u 8 dígitos."}>
              {input("dni", "27384901", editing)}
            </Field>
            <Field label="Fecha de nacimiento" required error={errors.nacimiento}>{input("nacimiento", "dd/mm/aaaa")}</Field>
            <Field label="Nombre" required error={errors.nombre}>{input("nombre")}</Field>
            <Field label="Apellido" required error={errors.apellido}>{input("apellido")}</Field>
            <Field label="Teléfono" required error={errors.telefono}>{input("telefono", "376-4xxx-xxx")}</Field>
            <Field label="Sexo" required error={errors.sexo}>
              <select value={f.sexo} onChange={(e) => setF({ ...f, sexo: e.target.value as Paciente["sexo"] })} className={`${inputCls} ${errors.sexo ? "!border-[#ef4444]" : ""}`}>
                <option value="">Seleccione…</option>
                <option>Femenino</option>
                <option>Masculino</option>
                <option>X</option>
              </select>
            </Field>

            <Field label="Correo" error={errors.correo}>{input("correo", "nombre@mail.com")}</Field>
            <Field label="Dirección">{input("direccion")}</Field>
            <Field label="Obra social">{input("obraSocial")}</Field>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
