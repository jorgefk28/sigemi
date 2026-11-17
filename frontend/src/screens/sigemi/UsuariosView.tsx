import { useMemo, useState } from "react";
import { PageShell, Panel, Btn, Banner, Pill, Table, tr, td, tdMono, inputCls, Field, Modal, type Tone } from "../components/ui";
import {
  createStore, useRol, currentUser, toast, logAudit, auditStore, AUD_TONE, useCarga, EstadoSwitch, Skeleton, ErrorState,
  EmptyBox, Check, selCls, Drawer, KpiCard, Pager, NoAccess, Info, type Rol,
} from "./core";

type Estado = "Activo" | "Inactivo" | "Bloqueado Temporal";
interface Usuario {
  id: number; nombre: string; apellido: string; correo: string; rol: Rol; estado: Estado;
  ultimoAcceso: string; registro: string; intentos: number; bloqueadoHasta: string;
  matricula?: string; especialidad?: string;
}
const ESTADO_TONE: Record<Estado, Tone> = { Activo: "green", Inactivo: "gray", "Bloqueado Temporal": "red" };
const ROLES: Rol[] = ["Administrador", "Bioquímico/Doctor", "Profesor"];

const SEED: [string, string, string, Rol, Estado, string, string, string?][] = [
  ["Claudia B.", "Ramírez", "cramirez", "Bioquímico/Doctor", "Activo", "19/10/2026 08:12", "02/03/2026", "MP-12345"],
  ["Martín", "Sosa", "msosa", "Profesor", "Activo", "19/10/2026 07:58", "10/03/2026"],
  ["Laura", "Benítez", "lbenitez", "Administrador", "Activo", "19/10/2026 08:30", "01/02/2026"],
  ["Pablo", "Gómez", "pgomez", "Profesor", "Inactivo", "—", "15/04/2026"],
  ["Ana", "Ferreyra", "aferreyra", "Bioquímico/Doctor", "Bloqueado Temporal", "12/10/2026 17:20", "20/05/2026", "MP-13877"],
  ["Julieta", "Acosta", "jacosta", "Profesor", "Activo", "18/10/2026 14:05", "13/10/2026"],
  ["Ricardo", "Medina", "rmedina", "Bioquímico/Doctor", "Activo", "18/10/2026 16:44", "05/03/2026", "MP-11092"],
  ["Silvia", "Kowalski", "skowalski", "Bioquímico/Doctor", "Activo", "17/10/2026 09:20", "07/03/2026", "MP-10456"],
  ["Diego", "Pereyra", "dpereyra", "Profesor", "Activo", "16/10/2026 10:02", "12/03/2026"],
  ["Mariela", "Duarte", "mduarte", "Bioquímico/Doctor", "Activo", "18/10/2026 11:37", "14/03/2026", "MP-12988"],
  ["Hernán", "Villalba", "hvillalba", "Administrador", "Activo", "15/10/2026 08:05", "01/02/2026"],
  ["Lucía", "Romero", "lromero", "Profesor", "Inactivo", "—", "20/03/2026"],
  ["Gustavo", "Olivera", "golivera", "Bioquímico/Doctor", "Activo", "19/10/2026 07:40", "22/03/2026", "MP-13201"],
  ["Natalia", "Szymanski", "nszymanski", "Profesor", "Activo", "14/10/2026 15:12", "02/04/2026"],
];
const usersStore = createStore<Usuario[]>(
  SEED.map((s, i) => ({
    id: i + 1, nombre: s[0], apellido: s[1], correo: `${s[2]}@unam.edu.ar`, rol: s[3], estado: s[4],
    ultimoAcceso: s[5], registro: s[6], intentos: s[4] === "Bloqueado Temporal" ? 5 : 0,
    bloqueadoHasta: s[4] === "Bloqueado Temporal" ? "19/10/2026 18:20" : "—",
    matricula: s[7], especialidad: s[7] ? "Micología" : undefined,
  })),
);
const fullName = (u: Usuario) => `${u.apellido}, ${u.nombre}`;
const isSelf = (u: Usuario) => fullName(u) === currentUser();
const isLastAdmin = (u: Usuario) =>
  u.rol === "Administrador" && usersStore.get().filter((x) => x.rol === "Administrador" && x.estado === "Activo").length <= 1;
const blockReason = (u: Usuario) =>
  isSelf(u) ? "No puede desactivar su propia cuenta." : isLastAdmin(u) ? "Debe existir al menos un Administrador activo." : "";
const updateUser = (id: number, fn: (u: Usuario) => Usuario) => usersStore.set((l) => l.map((u) => (u.id === id ? fn(u) : u)));

function desbloquear(u: Usuario) {
  updateUser(u.id, (x) => ({ ...x, estado: "Activo", intentos: 0, bloqueadoHasta: "—" }));
  logAudit({ modulo: "Usuarios", accion: "MODIFICAR", entidad: "Usuario", entidadId: String(u.id), resumen: `Desbloqueo de ${fullName(u)}`, cambios: [{ campo: "estado", antes: "Bloqueado Temporal", despues: "Activo" }, { campo: "intentos_fallidos", antes: String(u.intentos), despues: "0" }] });
  toast("Usuario desbloqueado exitosamente.");
}
function reactivar(u: Usuario) {
  updateUser(u.id, (x) => ({ ...x, estado: "Activo" }));
  logAudit({ modulo: "Usuarios", accion: "MODIFICAR", entidad: "Usuario", entidadId: String(u.id), resumen: `Reactivación de ${fullName(u)}`, cambios: [{ campo: "estado", antes: "Inactivo", despues: "Activo" }] });
  toast("Usuario reactivado exitosamente.");
}

/* ─── Contenedor ────────────────────────────────────────── */
type Nav = (p: string, params?: Record<string, unknown>) => void;
type Vista = { k: "lista" } | { k: "detalle"; id: number } | { k: "roles" };
export default function UsuariosView({ onNavigate }: { onNavigate: Nav; params?: Record<string, unknown> }) {
  const rol = useRol();
  const [vista, setVista] = useState<Vista>({ k: "lista" });
  const [form, setForm] = useState<{ id?: number } | null>(null);
  const [baja, setBaja] = useState<number | null>(null);
  const [reactivarId, setReactivarId] = useState<number | null>(null);
  if (rol !== "Administrador")
    return <PageShell activePage="Usuarios y Roles" onNavigate={onNavigate} section="Administración" title="Usuarios y Roles"><NoAccess onNavigate={onNavigate} /></PageShell>;
  const handlers = { onEdit: (id?: number) => setForm({ id }), onBaja: setBaja, onReactivar: setReactivarId };
  return (
    <>
      {vista.k === "lista" && <Listado onNavigate={onNavigate} onVer={(id) => setVista({ k: "detalle", id })} onRoles={() => setVista({ k: "roles" })} {...handlers} />}
      {vista.k === "detalle" && <Detalle id={vista.id} onNavigate={onNavigate} onBack={() => setVista({ k: "lista" })} {...handlers} />}
      {vista.k === "roles" && <RolesPermisos onNavigate={onNavigate} onBack={() => setVista({ k: "lista" })} />}
      {form && <FormUsuario id={form.id} onClose={() => setForm(null)} />}
      {baja !== null && <Desactivacion id={baja} onClose={() => setBaja(null)} />}
      {reactivarId !== null && <ConfirmReactivar id={reactivarId} onClose={() => setReactivarId(null)} />}
    </>
  );
}
type H = { onEdit: (id?: number) => void; onBaja: (id: number) => void; onReactivar: (id: number) => void };

/* ─── 4.4.a Listado ─────────────────────────────────────── */
function Listado({ onNavigate, onVer, onRoles, onEdit, onBaja, onReactivar }: { onNavigate: Nav; onVer: (id: number) => void; onRoles: () => void } & H) {
  const users = usersStore.use();
  const { estado, setEstado, reintentar } = useCarga();
  const [q, setQ] = useState("");
  const [fRol, setFRol] = useState("");
  const [fEst, setFEst] = useState("");
  const [page, setPage] = useState(1);
  const SIZE = 10;
  const data = estado === "Vacío" ? [] : users;
  const filtered = data.filter(
    (u) => (!q || `${fullName(u)} ${u.correo}`.toLowerCase().includes(q.toLowerCase())) && (!fRol || u.rol === fRol) && (!fEst || u.estado === fEst),
  );
  const count = (e: Estado) => data.filter((u) => u.estado === e).length;
  const filtros = q || fRol || fEst;
  return (
    <PageShell
      activePage="Usuarios y Roles" onNavigate={onNavigate} section="Administración" title="Usuarios y Roles"
      actions={<><EstadoSwitch value={estado} onChange={setEstado} /><Btn onClick={onRoles}>Roles y permisos</Btn><Btn variant="primary" onClick={() => onEdit()}>+ Nuevo usuario</Btn></>}
    >
      {estado === "Cargando" ? <Skeleton kpis={3} rows={8} /> : estado === "Error" ? <ErrorState text="No se pudo cargar el listado de usuarios." onRetry={reintentar} /> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Activos" value={count("Activo")} tone="green" active={fEst === "Activo"} onClick={() => { setFEst(fEst === "Activo" ? "" : "Activo"); setPage(1); }} />
            <KpiCard label="Inactivos" value={count("Inactivo")} tone="gray" active={fEst === "Inactivo"} onClick={() => { setFEst(fEst === "Inactivo" ? "" : "Inactivo"); setPage(1); }} />
            <KpiCard label="Bloqueados" value={count("Bloqueado Temporal")} tone="red" sub="Por intentos fallidos" active={fEst === "Bloqueado Temporal"} onClick={() => { setFEst(fEst === "Bloqueado Temporal" ? "" : "Bloqueado Temporal"); setPage(1); }} />
          </div>
          <Panel flush>
            <div className="flex flex-wrap items-center gap-2 border-b border-border-light px-4 py-3">
              <input className={`${inputCls} max-w-[320px]`} placeholder="Buscar por nombre o correo..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
              <select className={selCls} value={fRol} onChange={(e) => { setFRol(e.target.value); setPage(1); }}>
                <option value="">Rol: todos</option>{ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <select className={selCls} value={fEst} onChange={(e) => { setFEst(e.target.value); setPage(1); }}>
                <option value="">Estado: todos</option><option>Activo</option><option>Inactivo</option><option>Bloqueado Temporal</option>
              </select>
              <div className="flex-1" />
              <Btn variant="ghost" disabled={!filtros} onClick={() => { setQ(""); setFRol(""); setFEst(""); }}>Limpiar filtros</Btn>
            </div>
            {data.length === 0 ? (
              <EmptyBox icon="◎" title="No hay usuarios registrados" action={<Btn variant="primary" onClick={() => onEdit()}>+ Nuevo usuario</Btn>} />
            ) : filtered.length === 0 ? (
              <EmptyBox icon="⌕" title="No se encontraron usuarios con los criterios ingresados." action={<Btn onClick={() => { setQ(""); setFRol(""); setFEst(""); }}>Limpiar filtros</Btn>} />
            ) : (
              <>
                <Table head={["Nombre y apellido", "Correo", "Rol", "Estado", "Último acceso", "Fecha registro", "Acciones"]}>
                  {filtered.slice((page - 1) * SIZE, page * SIZE).map((u) => {
                    const why = blockReason(u);
                    return (
                      <tr key={u.id} className={tr}>
                        <td className={`${td} font-medium`}>{fullName(u)}{isSelf(u) && <span className="ml-1.5 text-[11px] text-text-muted">(usted)</span>}</td>
                        <td className={tdMono}>{u.correo}</td>
                        <td className={td}>{u.rol}</td>
                        <td className={td}><Pill tone={ESTADO_TONE[u.estado]}>{u.estado}</Pill></td>
                        <td className={tdMono}>{u.ultimoAcceso}</td>
                        <td className={tdMono}>{u.registro}</td>
                        <td className={td}>
                          <div className="flex gap-3">
                            <Btn variant="ghost" onClick={() => onVer(u.id)}>Ver</Btn>
                            {u.estado !== "Inactivo" && <Btn variant="ghost" onClick={() => onEdit(u.id)}>Editar</Btn>}
                            {u.estado === "Bloqueado Temporal" && <Btn variant="ghost" onClick={() => desbloquear(u)}>Desbloquear</Btn>}
                            {u.estado === "Inactivo" ? (
                              <Btn variant="ghost" onClick={() => onReactivar(u.id)}>Reactivar</Btn>
                            ) : (
                              <span title={why}><Btn variant="ghost" disabled={!!why} className="text-cancelado-text disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onBaja(u.id)}>Desactivar</Btn></span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
                <Pager page={page} total={filtered.length} size={SIZE} onPage={setPage} noun="usuarios" />
              </>
            )}
          </Panel>
        </div>
      )}
    </PageShell>
  );
}

/* ─── 4.4.b Alta / Edición ──────────────────────────────── */
function FormUsuario({ id, onClose }: { id?: number; onClose: () => void }) {
  const orig = usersStore.get().find((u) => u.id === id);
  const [f, setF] = useState({
    nombre: orig?.nombre ?? "", apellido: orig?.apellido ?? "", correo: orig?.correo ?? "", rol: (orig?.rol ?? "Profesor") as Rol,
    pass: "", pass2: "", enviar: true, matricula: orig?.matricula ?? "", especialidad: orig?.especialidad ?? "Micología",
    estado: (orig?.estado ?? "Activo") as Estado,
  });
  const [ver, setVer] = useState(false);
  const [tried, setTried] = useState(false);
  const [resetPass, setResetPass] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const self = orig ? isSelf(orig) : false;
  const others = usersStore.get().filter((u) => u.id !== id);
  const errs: Record<string, string> = {};
  if (!f.nombre.trim()) errs.nombre = "Campo obligatorio.";
  if (!f.apellido.trim()) errs.apellido = "Campo obligatorio.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo)) errs.correo = "Ingrese un correo válido.";
  else if (others.some((u) => u.correo.toLowerCase() === f.correo.toLowerCase())) errs.correo = "El correo ya está registrado por otro usuario.";
  if (!orig) {
    if (!(f.pass.length >= 8 && /[a-z]/i.test(f.pass) && /\d/.test(f.pass))) errs.pass = "La contraseña debe tener al menos 8 caracteres, una letra y un número.";
    if (f.pass2 !== f.pass) errs.pass2 = "Las contraseñas no coinciden.";
  }
  if (f.rol === "Bioquímico/Doctor") {
    if (!f.matricula.trim()) errs.matricula = "Campo obligatorio para Bioquímico/Doctor.";
    else if (others.some((u) => u.matricula?.toLowerCase() === f.matricula.trim().toLowerCase())) errs.matricula = "La matrícula ya está registrada.";
  }
  const e = (k: string) => (tried || k === "pass2" || k === "correo" ? errs[k] : undefined);
  const ok = Object.keys(errs).length === 0;
  const guardar = () => {
    setTried(true);
    if (!ok) return;
    const data = { nombre: f.nombre.trim(), apellido: f.apellido.trim(), correo: f.correo.trim(), rol: f.rol, estado: f.estado,
      matricula: f.rol === "Bioquímico/Doctor" ? f.matricula.trim() : undefined, especialidad: f.rol === "Bioquímico/Doctor" ? f.especialidad : undefined };
    if (orig) {
      const cambios = (["nombre", "apellido", "correo", "rol", "estado", "matricula"] as const)
        .filter((k) => (orig[k] ?? "") !== (data[k] ?? ""))
        .map((k) => ({ campo: k, antes: String(orig[k] ?? "—"), despues: String(data[k] ?? "—") }));
      updateUser(orig.id, (u) => ({ ...u, ...data }));
      logAudit({ modulo: "Usuarios", accion: "MODIFICAR", entidad: "Usuario", entidadId: String(orig.id), resumen: `Edición de ${data.apellido}, ${data.nombre}`, cambios });
      toast("Usuario actualizado exitosamente.");
    } else {
      const nid = Math.max(...usersStore.get().map((u) => u.id)) + 1;
      usersStore.set((l) => [...l, { ...data, id: nid, estado: "Activo", ultimoAcceso: "—", registro: "19/10/2026", intentos: 0, bloqueadoHasta: "—" }]);
      logAudit({ modulo: "Usuarios", accion: "CREAR", entidad: "Usuario", entidadId: String(nid), resumen: `Alta de usuario ${data.apellido}, ${data.nombre} (${data.rol})`, cambios: [{ campo: "rol", antes: "—", despues: data.rol }, { campo: "estado", antes: "—", despues: "Activo" }] });
      toast("Usuario creado exitosamente.");
    }
    onClose();
  };
  const Sec = ({ children }: { children: string }) => <h3 className="mt-2 mb-3 text-[11px] font-semibold tracking-[0.06em] text-text-muted uppercase">{children}</h3>;
  return (
    <Drawer
      title={orig ? `Editar usuario — ${fullName(orig)}` : "Nuevo usuario"} onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" disabled={tried && !ok} onClick={guardar}>Guardar</Btn></>}
    >
      <div className="flex flex-col gap-3">
        <Sec>Datos personales</Sec>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" required error={e("nombre")}><input className={inputCls} value={f.nombre} onChange={(x) => set("nombre", x.target.value)} /></Field>
          <Field label="Apellido" required error={e("apellido")}><input className={inputCls} value={f.apellido} onChange={(x) => set("apellido", x.target.value)} /></Field>
        </div>
        <Field label="Correo institucional" required error={f.correo ? e("correo") : undefined} hint="Se usa como usuario de inicio de sesión.">
          <input className={inputCls} value={f.correo} placeholder="usuario@unam.edu.ar" onChange={(x) => set("correo", x.target.value)} />
        </Field>
        <Sec>Acceso</Sec>
        <Field label="Rol" required hint={self ? "No puede cambiar su propio rol." : undefined}>
          <select className={`${selCls} h-9 w-full`} disabled={self} title={self ? "No puede cambiar su propio rol." : undefined} value={f.rol} onChange={(x) => set("rol", x.target.value as Rol)}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        {orig && f.rol !== orig.rol && <Banner tone="amber">Al cambiar el rol, el usuario podría perder acceso a módulos que hoy utiliza.</Banner>}
        {orig ? (
          <div className="flex items-end justify-between gap-3">
            <Field label="Estado">
              <select className={`${selCls} h-9`} value={f.estado === "Inactivo" ? "Inactivo" : "Activo"} disabled={self || isLastAdmin(orig)} onChange={(x) => set("estado", x.target.value as Estado)}>
                <option>Activo</option><option>Inactivo</option>
              </select>
            </Field>
            <Btn onClick={() => setResetPass(true)}>Restablecer contraseña</Btn>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contraseña" required error={e("pass")}>
                <div className="flex gap-1"><input type={ver ? "text" : "password"} className={inputCls} value={f.pass} onChange={(x) => set("pass", x.target.value)} /><Btn onClick={() => setVer(!ver)} title="Mostrar u ocultar">{ver ? "Ocultar" : "Ver"}</Btn></div>
              </Field>
              <Field label="Confirmar contraseña" required error={f.pass2 ? e("pass2") : undefined}>
                <input type={ver ? "text" : "password"} className={inputCls} value={f.pass2} onChange={(x) => set("pass2", x.target.value)} />
              </Field>
            </div>
            <Check checked={f.enviar} onChange={(v) => set("enviar", v)}>Enviar credenciales por correo</Check>
            <Banner tone="blue">La contraseña debe tener al menos 8 caracteres, una letra y un número. Se almacena cifrada y nunca se muestra ni se registra en auditoría.</Banner>
          </>
        )}
        {f.rol === "Bioquímico/Doctor" && (
          <>
            <Sec>Datos profesionales</Sec>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Matrícula" required error={f.matricula ? e("matricula") ?? errs.matricula : e("matricula")}><input className={inputCls} value={f.matricula} placeholder="MP-00000" onChange={(x) => set("matricula", x.target.value)} /></Field>
              <Field label="Especialidad"><input className={inputCls} value={f.especialidad} onChange={(x) => set("especialidad", x.target.value)} /></Field>
            </div>
          </>
        )}
      </div>
      {resetPass && orig && <ResetPass u={orig} onClose={() => setResetPass(false)} />}
    </Drawer>
  );
}

function ResetPass({ u, onClose }: { u: Usuario; onClose: () => void }) {
  const [p, setP] = useState("");
  const [p2, setP2] = useState("");
  const weak = !(p.length >= 8 && /[a-z]/i.test(p) && /\d/.test(p));
  const ok = !weak && p === p2;
  return (
    <Modal title="Restablecer contraseña" onClose={onClose} width={460}
      footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" disabled={!ok} onClick={() => {
        logAudit({ modulo: "Usuarios", accion: "MODIFICAR", entidad: "Usuario", entidadId: String(u.id), resumen: `Restablecimiento de contraseña de ${fullName(u)}` });
        toast("Contraseña restablecida exitosamente."); onClose();
      }}>Restablecer</Btn></>}>
      <div className="flex flex-col gap-3">
        <div className="text-[12.5px] text-text-secondary">Usuario: <strong className="text-text-primary">{fullName(u)}</strong> — {u.correo}</div>
        <Field label="Nueva contraseña" required error={p && weak ? "La contraseña debe tener al menos 8 caracteres, una letra y un número." : undefined}><input type="password" className={inputCls} value={p} onChange={(e) => setP(e.target.value)} /></Field>
        <Field label="Confirmar contraseña" required error={p2 && p2 !== p ? "Las contraseñas no coinciden." : undefined}><input type="password" className={inputCls} value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
        <div className="text-[11.5px] text-text-muted">El cambio se registra en auditoría sin guardar el valor.</div>
      </div>
    </Modal>
  );
}

/* ─── 4.4.c Detalle ─────────────────────────────────────── */
function Detalle({ id, onNavigate, onBack, onEdit, onBaja, onReactivar }: { id: number; onNavigate: Nav; onBack: () => void } & H) {
  const u = usersStore.use().find((x) => x.id === id);
  const eventos = auditStore.use();
  const [resetPass, setResetPass] = useState(false);
  if (!u)
    return (
      <PageShell activePage="Usuarios y Roles" onNavigate={onNavigate} section="Usuarios y Roles" title="Usuario">
        <EmptyBox title="El usuario ya no existe." action={<Btn onClick={onBack}>Volver al listado</Btn>} />
      </PageShell>
    );
  const act = eventos.filter((e) => e.usuario === fullName(u)).slice(0, 8);
  const why = blockReason(u);
  return (
    <PageShell
      activePage="Usuarios y Roles" onNavigate={onNavigate} section="Usuarios y Roles" title={fullName(u)}
      actions={<>
        <Btn onClick={onBack}>← Volver</Btn>
        {u.estado !== "Inactivo" && <Btn onClick={() => onEdit(u.id)}>Editar</Btn>}
        {u.estado !== "Inactivo" && <Btn onClick={() => setResetPass(true)}>Restablecer contraseña</Btn>}
      </>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[13px]"><Pill tone={ESTADO_TONE[u.estado]}>{u.estado}</Pill><span className="text-text-secondary">— {u.rol}</span></div>
        {u.estado === "Inactivo" && <Banner tone="gray" action={<Btn onClick={() => onReactivar(u.id)}>Reactivar</Btn>}>Usuario inactivo. No puede iniciar sesión.</Banner>}
        {u.estado === "Bloqueado Temporal" && <Banner tone="red" action={<Btn onClick={() => desbloquear(u)}>Desbloquear</Btn>}>Cuenta bloqueada por intentos fallidos hasta {u.bloqueadoHasta}.</Banner>}
        <div className="grid grid-cols-2 gap-4">
          <Panel title="Datos personales">
            <div className="grid grid-cols-2 gap-4">
              <Info label="Nombre">{u.nombre}</Info><Info label="Apellido">{u.apellido}</Info>
              <Info label="Correo"><span className="font-mono text-[12px]">{u.correo}</span></Info><span />
              {u.rol === "Bioquímico/Doctor" && <><Info label="Matrícula">{u.matricula ?? "—"}</Info><Info label="Especialidad">{u.especialidad ?? "—"}</Info></>}
            </div>
          </Panel>
          <Panel title="Acceso">
            <div className="grid grid-cols-2 gap-4">
              <Info label="Rol">{u.rol}</Info><Info label="Estado"><Pill tone={ESTADO_TONE[u.estado]}>{u.estado}</Pill></Info>
              <Info label="Último acceso">{u.ultimoAcceso}</Info><Info label="Registrado">{u.registro}</Info>
              <Info label="Intentos fallidos">{u.intentos}</Info><Info label="Bloqueado hasta">{u.bloqueadoHasta}</Info>
            </div>
          </Panel>
        </div>
        <Panel title="Actividad reciente" footer={<Btn variant="ghost" onClick={() => onNavigate("Auditoría", { usuario: fullName(u) })}>Ver toda la actividad en Auditoría →</Btn>} flush>
          {act.length === 0 ? <EmptyBox title="Sin actividad registrada." /> : (
            <Table head={["Fecha/hora", "Acción", "Detalle"]}>
              {act.map((e) => (
                <tr key={e.id} className={tr}>
                  <td className={tdMono}>{e.fecha.slice(0, 5)} {e.hora.slice(0, 5)}</td>
                  <td className={td}><Pill tone={AUD_TONE[e.accion]}>{e.accion}</Pill></td>
                  <td className={td}>{e.entidadId && e.entidad !== "Usuario" ? `${e.entidadId} — ` : ""}{e.resumen}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
        {u.estado !== "Inactivo" && (
          <div className="flex justify-end"><span title={why}><Btn variant="danger" disabled={!!why} className="disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onBaja(u.id)}>Desactivar</Btn></span></div>
        )}
      </div>
      {resetPass && <ResetPass u={u} onClose={() => setResetPass(false)} />}
    </PageShell>
  );
}

/* ─── 4.4.d Desactivación ───────────────────────────────── */
const MOTIVOS = ["Egreso del laboratorio", "Licencia prolongada", "Cambio de rol", "Otro"];
function Desactivacion({ id, onClose }: { id: number; onClose: () => void }) {
  const u = usersStore.get().find((x) => x.id === id)!;
  const [motivo, setMotivo] = useState("");
  const [otro, setOtro] = useState("");
  const why = blockReason(u);
  const final = motivo === "Otro" ? otro.trim() : motivo;
  const ok = !!final && !why;
  return (
    <Modal title="Desactivar usuario" onClose={onClose} width={500}
      footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="danger" disabled={!ok} onClick={() => {
        updateUser(u.id, (x) => ({ ...x, estado: "Inactivo" }));
        logAudit({ modulo: "Usuarios", accion: "DESACTIVAR", entidad: "Usuario", entidadId: String(u.id), resumen: `Baja de ${fullName(u)} — ${final}`, cambios: [{ campo: "estado", antes: u.estado, despues: "Inactivo" }, { campo: "motivo", antes: "—", despues: final }] });
        toast("Usuario desactivado exitosamente."); onClose();
      }}>Desactivar</Btn></>}>
      <div className="flex flex-col gap-3">
        <div className="rounded border border-border-light bg-bg px-3 py-2.5 text-[12.5px]">
          <div><strong>{fullName(u)}</strong> — <span className="font-mono text-[12px]">{u.correo}</span></div>
          <div className="mt-1 flex items-center gap-2 text-text-secondary">Rol: {u.rol} · Estado: <Pill tone={ESTADO_TONE[u.estado]}>{u.estado}</Pill></div>
        </div>
        {why && <Banner tone="red">{isSelf(u) ? "No puede desactivar su propia cuenta." : "No se puede desactivar al último Administrador activo."}</Banner>}
        <Field label="Motivo de la baja" required>
          <select className={`${selCls} h-9 w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Seleccionar motivo</option>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        {motivo === "Otro" && <Field label="Especifique el motivo" required><input className={inputCls} value={otro} onChange={(e) => setOtro(e.target.value)} /></Field>}
        <Banner tone="amber">El usuario no podrá iniciar sesión y sus sesiones activas se cerrarán. Su historial de acciones se conserva.</Banner>
      </div>
    </Modal>
  );
}
function ConfirmReactivar({ id, onClose }: { id: number; onClose: () => void }) {
  const u = usersStore.get().find((x) => x.id === id)!;
  return (
    <Modal title="Reactivar usuario" onClose={onClose} width={440}
      footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={() => { reactivar(u); onClose(); }}>Reactivar</Btn></>}>
      <p className="m-0 text-[13px]">¿Reactivar a <strong>{fullName(u)}</strong> ({u.rol})? Podrá volver a iniciar sesión con su contraseña actual.</p>
    </Modal>
  );
}

/* ─── 4.4.e Roles y Permisos ────────────────────────────── */
type P = "L" | "LE" | "-";
const MATRIZ: [string, P, P, P][] = [
  ["Panel de Control", "L", "-", "L"], ["Agenda y Turnos", "LE", "-", "LE"], ["Pacientes", "LE", "-", "LE"],
  ["Análisis / Resultados", "LE", "-", "LE"], ["Inventario", "L", "L", "LE"], ["Registrar ingreso", "-", "-", "LE"],
  ["Retiro / Devolución", "LE", "LE", "LE"], ["Catálogos de inventario", "L", "-", "LE"], ["Umbrales de alerta", "-", "-", "LE"],
  ["Residuos (generación)", "LE", "LE", "LE"], ["Disposición final", "-", "-", "LE"], ["Reporte mensual de residuos", "-", "-", "LE"],
  ["Reportes y Estadísticas", "LE", "-", "LE"], ["Usuarios y Roles", "-", "-", "LE"], ["Auditoría", "-", "-", "L"],
];
const Cell = ({ p }: { p: P }) =>
  p === "-" ? <span className="text-text-muted">—</span> : <Pill tone={p === "LE" ? "green" : "blue"}>{p === "LE" ? "Leer / Escribir" : "Leer"}</Pill>;
function RolesPermisos({ onNavigate, onBack }: { onNavigate: Nav; onBack: () => void }) {
  const users = usersStore.use();
  const { estado, setEstado, reintentar } = useCarga();
  const n = useMemo(() => (r: Rol) => users.filter((u) => u.rol === r && u.estado !== "Inactivo").length, [users]);
  const cards: [Rol, string][] = [["Bioquímico/Doctor", "Clínica, agenda, pacientes e insumos"], ["Profesor", "Insumos y residuos (retiro / devolución)"], ["Administrador", "Acceso total"]];
  return (
    <PageShell activePage="Usuarios y Roles" onNavigate={onNavigate} section="Usuarios y Roles" title="Roles y permisos"
      actions={<><EstadoSwitch value={estado === "Vacío" ? "Con datos" : estado} onChange={setEstado} /><Btn onClick={onBack}>← Volver</Btn></>}>
      {estado === "Cargando" ? <Skeleton kpis={3} rows={10} /> : estado === "Error" ? <ErrorState text="No se pudo cargar la matriz de permisos." onRetry={reintentar} /> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {cards.map(([r, d]) => <KpiCard key={r} label={r} value={n(r)} sub={`usuarios · ${d}`} tone={r === "Administrador" ? "violet" : r === "Profesor" ? "amber" : "blue"} />)}
          </div>
          <Panel flush title="Matriz de permisos por módulo">
            <Table head={["Módulo / acción", "Bioquímico / Doctor", "Profesor", "Administrador"]}>
              {MATRIZ.map(([m, b, p, a]) => (
                <tr key={m} className={tr}><td className={`${td} font-medium`}>{m}</td><td className={td}><Cell p={b} /></td><td className={td}><Cell p={p} /></td><td className={td}><Cell p={a} /></td></tr>
              ))}
            </Table>
          </Panel>
          <Banner tone="blue">Los roles son prefijados. No se crean ni editan roles en esta versión.</Banner>
        </div>
      )}
    </PageShell>
  );
}
