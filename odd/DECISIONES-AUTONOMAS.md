# Registro de decisiones autónomas — 2026-11-16/17

El dueño delegó explícitamente la autoridad de decisión («tienes autoridad, solo que las
decisiones autoritativas que tomes debes registrarlas en un documento») y pidió terminar las
pantallas del frontend durante la noche del 2026-11-16.

Este documento es el registro. Cada decisión dice **qué se decidió**, **por qué**, **en qué
fuente se apoya**, **qué desbloquea o bloquea** y **si necesita confirmación del dueño**. Todo
lo que se decida después se agrega acá, con fecha.

Precedencia: este registro **no** puede contradecir los niveles 1-3 ni `AGENTS.md`. Cuando una
decisión se apoya en un supuesto (porque la fuente calla), se marca **SUPUESTO** y se dice qué
haría falta para cerrarlo.

---

## A-01 — Alcance: qué significa «terminar todas las pantallas»

**Decisión.** Se implementan todas las pantallas que (a) tienen respaldo en el nivel 1, (b)
tienen su tabla en el nivel 3 y (c) no dependen de un servicio externo no aprobado. Quedan
fuera, con motivo escrito: SEG-U06 y SEG-U07 (dependen de D5 + envío SMTP), DIAG-U07 (portal
público: depende de generación de PDF y WhatsApp), y el subsistema LAB completo (necesita
ediciones a los niveles 1-3 que `AGENTS.md` prohíbe hacer desde este repo).

**Por qué.** «Terminar» no puede significar dibujar pantallas que no pueden funcionar: el
repositorio prohíbe inventar contenido y una pantalla contra un endpoint inexistente es un
placeholder disfrazado.

**Fuente.** Nivel 1 §2.8 (secuencias y precondiciones); `AGENTS.md` §Scope guard y §Screen and
design authority; `diag-draft.md` §5; `02-seguridad-acceso.md` §4 D5; `04-recepcion-turnos.md`
§Screens.

**Impacto.** De 41 pantallas inventariadas se apuntan **35 implementables**; 4 quedan
bloqueadas por servicios externos y 11 de LAB por decisión documental.

**Confirmación del dueño.** Sí, para LAB y para SEG-U06/U07: son decisiones de alcance, no
técnicas.

---

## A-02 — Catálogo clínico: reglas de unicidad y baja

**Decisión.** El nombre se compara **sin distinguir mayúsculas** al validar unicidad; la baja
es lógica, sin motivo y **idempotente**; la descripción opcional se limpia enviando `''`, no
`null`.

**Por qué.** El nivel 3 declara `nombre unique` y nada más; «Cultivo de uñas» y «cultivo de
uñas» son el mismo tipo para quien lo usa, y el correo de `usuario` ya se normaliza con ese
criterio. La baja sin motivo es lo que dice la UCE: los motivos obligatorios están donde el
nivel 1 los pide explícitamente (REC-19, DIAG-08, DIAG-14) y DIAG-10 no lo pide.

**Fuente.** Nivel 3 L204-233; UCE-DIAG-10 excepción del paso 6; hallazgo F-001 de la revisión
del frontend.

**Impacto.** `POST /tipos-analisis`, `PATCH`, `/baja` y el mismo trío para `tipos-muestra`.

**Confirmación del dueño.** No. Es coherente con el nivel 3 y con el patrón del repo.

---

## A-03 — El profesional se resuelve desde la sesión, nunca desde el cliente

**Decisión.** Toda operación que necesita `profesional_id` (ficha clínica, análisis) lo resuelve
a partir del **usuario autenticado** (`profesional.usuario_id`). Si el usuario no tiene fila en
`profesional`, responde `400` con `detail = "El usuario no tiene perfil profesional"` y
`campo = "profesional"`. **No** se crea la fila automáticamente.

**Por qué.** `ficha_clinica.profesional_id` y `analisis_micologico.profesional_responsable_id`
son NOT NULL, y `profesional` guarda `matricula` y `especialidad`, que son datos reales que no
se pueden inventar. Aceptar un `profesional_id` del cliente permitiría firmar un análisis con
la identidad de otro.

**Fuente.** Nivel 3 L53-63, L131-144, L193-203; nivel 2 §6.2 (el perfil profesional aplica sólo
al rol `bioquimico`).

**Estado del entorno.** Verificado: la base de desarrollo tiene **0 filas** en `profesional`, así
que hoy ningún bioquímico puede registrar una ficha hasta que exista el alta de perfil
profesional (no hay UCE que la pida: es un requisito faltante, se reporta).

**Impacto.** Bloquea funcionalmente todas las pantallas clínicas hasta que exista ese perfil,
pero **no bloquea la construcción**: las pantallas se pueden probar con usuarios que sí lo
tengan (los tests lo crean).

**Confirmación del dueño.** Sí: hay que decidir cómo se carga la matrícula de un bioquímico.

---

## A-04 — SUPUESTO: catálogo de campos clínicos de la ficha

**Decisión.** Se adopta este catálogo de claves para `dato_clinico`, todas de tipo `texto` y
todas opcionales salvo las tres primeras:

| Clave (`campo`) | Etiqueta visible | Obligatorio |
|---|---|---|
| `motivo_consulta` | Motivo de consulta | sí |
| `sintomas` | Síntomas | sí |
| `tiempo_evolucion` | Tiempo de evolución | no |
| `antecedentes` | Antecedentes | no |
| `tratamiento_previo` | Tratamiento previo | no |
| `observaciones` | Observaciones | no |

**Por qué.** Es el hueco **G1** de `diag-draft.md` §5.1: `dato_clinico` es clave-valor y
**ningún nivel enumera las claves posibles**, mientras que UCE-DIAG-01 paso 5 pide «campos
clínicos obligatorios». Sin esta lista no hay formulario que especificar.

**Fuente.** Nivel 3 L64-72 (forma de la tabla); UCE-DIAG-01 pasos 4-5; hueco G1.

**Riesgo declarado.** Es **contenido clínico**, no presentación: la lista es mía y el dueño
—bioquímico— puede querer otras claves. Por eso el catálogo vive en **un solo lugar por lado**
(`backend/app/services/fichas.py` y `frontend/src/api/fichas.ts`) y cambiar la lista no toca
ni una pantalla. La pantalla renderiza lo que el endpoint declara, no una lista hardcodeada.

**Confirmación del dueño.** **Sí, es la más importante de este registro.** Si cambia la lista,
se cambia en dos archivos y listo.

---

## A-05 — SUPUESTO: valores de `tipo_hallazgo`

**Decisión.** Los hallazgos de un análisis admiten cinco tipos: `examen_directo`,
`cultivo`, `identificacion`, `observacion` y `otro`. `dato` es texto libre y obligatorio;
`tipo_hallazgo` no admite otro valor.

**Por qué.** Hueco **G2**: la columna es `varchar` libre y la UCE-DIAG-03 paso 3 pide «carga los
parámetros, resultados parciales y observaciones» sin enumerarlos. Sin una lista, el formulario
no tiene control que ofrecer.

**Fuente.** Nivel 3 L146-155; UCE-DIAG-03 pasos 3-4.

**Riesgo.** Igual que A-04: contenido del dominio. Se centraliza en un enum del backend y en un
mapa del frontend.

**Confirmación del dueño.** Sí, junto con A-04.

---

## A-06 — Las observaciones del análisis no inventan columna

**Decisión.** Una observación de UCE-DIAG-03 se guarda como `hallazgo_analisis` con
`tipo_hallazgo = "observacion"`. **No** se agrega una columna `observaciones` a
`analisis_micologico`.

**Por qué.** Hueco **G3**: la UCE pide guardar observaciones y el nivel 3 no tiene dónde, más
allá de los hallazgos. Agregar una columna es DDL sobre el modelo congelado (`AGENTS.md`
§Frozen schema contract) y no corresponde al integrador de la aplicación. La fila de hallazgo
es el mecanismo que el propio nivel 3 ofrece.

**Fuente.** Nivel 3 L131-155; UCE-DIAG-03 paso 3; `AGENTS.md` §Frozen schema contract.

**Impacto.** La pantalla de detalle muestra los hallazgos agrupados por tipo, con
«Observaciones» como uno más.

**Confirmación del dueño.** No.

---

## A-07 — El filtro «bioquímico de la última acción» sale de la auditoría

**Decisión.** El filtro de UCE-DIAG-09 paso 3 se resuelve con una subconsulta a `auditoria`
(`entidad_afectada = "analisis_micologico"` y `entidad_id` = id del análisis), quedándose con el
`usuario_id` del último evento. Si no hay evento, el análisis no aparece bajo ese filtro.

**Por qué.** Hueco **G4**: `analisis_micologico` guarda responsable y validador, no «última
acción», y ninguna columna del nivel 3 lo expone. La auditoría ya registra cada actualización
con su usuario (UCE-DIAG-03 paso 7), así que es la única fuente real.

**Fuente.** Nivel 3 L131-144 y L593-622; UCE-DIAG-03 paso 7; UCE-DIAG-09 paso 3.

**Costo.** Un `JOIN` lateral por página; con el volumen de un laboratorio es irrelevante.

**Confirmación del dueño.** No.

---

## A-08 — El ingreso de muestra pide tipo de análisis además de tipo de muestra

**Decisión.** `POST /muestras` recibe `tipo_muestra_id`, `tipo_analisis_id` y
`observaciones`, y crea la muestra **y** el primer análisis en estado `pendiente` en una sola
transacción.

**Por qué.** Hueco **G5**: UCE-DIAG-02 paso 3 pide «Tipo de Muestra» y observaciones, pero
`analisis_micologico.tipo_analisis_id` es NOT NULL y la nota del nivel 3 exige que la
combinación `tipo_analisis × tipo_muestra` esté admitida. O el formulario pide los dos, o el
ingreso de muestra no puede persistir nada.

**Fuente.** Nivel 3 L118-144 y L224-233; UCE-DIAG-02 pasos 3-6.

**Divergencia registrada.** Se agrega un campo que el nivel 1 no nombra, y se reporta: es la
única forma de satisfacer el esquema sin cambiar el esquema.

**Confirmación del dueño.** Sí, para que quede en el nivel 1 como paso explícito.

---

## A-09 — La agenda (REC-U01 a U04, U10) no se implementa

**Decisión.** No se construyen las cinco pantallas de agenda ni su backend.

**Por qué.** Dependen de G10 (qué escribe `configuracion_agenda` y qué `periodo_inhabilitado`),
G11 y G12 (columnas y tablas de agenda sin UCE que las gobierne). Resolverlos exige editar los
niveles 1-3, y `AGENTS.md` dice que este repo no edita la documentación fuente. Inventar la
semántica de la configuración de agenda produciría una grilla que agenda turnos mal.

**Fuente.** `04-recepcion-turnos.md` §Screens (tabla de bloqueos); `rec-draft.md` §5.

**Impacto.** REC queda en 6 de 11 pantallas. El sidebar ya muestra «Agenda y Turnos» con su
placeholder explícito.

**Confirmación del dueño.** Sí: es la decisión de mayor impacto de este registro.

---

## A-10 — Reportes: el detalle de un indicador es navegación, y el generador exporta CSV

**Decisión.** (1) REP-U03 no es una pantalla: seleccionar un indicador navega al módulo que lo
gobierna (Turnos → Agenda, Análisis → Panel de Análisis, Insumos → Inventario, Residuos →
Registro de residuos). (2) REP-U01 exporta **CSV** con una lista declarada de columnas
anonimizadas para el reporte Clínico; no se genera XLSX.

**Por qué.** Hueco **R2**: la UCE no dice qué contiene el detalle, y el módulo dueño del dato ya
existe; una pantalla intermedia sin requisito es una invención. Hueco **R1**: la anonimización
no enumera campos, así que se declara la lista mínima (sin nombre, sin apellido, sin DNI, sin
contacto; con un identificador opaco). XLSX exige una dependencia nueva (`openpyxl`) y
`AGENTS.md` prohíbe agregar dependencias sin aprobación; CSV no.

**Fuente.** UCE-REP-01 pasos 2-9; UCE-REP-02 pasos 4-5; `rep-draft.md` §6 R1-R2; `AGENTS.md`
§Application conventions.

**Confirmación del dueño.** Sí: qué columnas exactas se publican en el reporte clínico es
decisión suya (privacidad de pacientes, Ley 25.326).

---

## A-11 — Navegación: dos páginas nuevas, ambas con respaldo del nivel 1

**Decisión.** Se agregan al sidebar `Indicaciones Médicas` (UCE-REC-13 paso 1: «ingresa al
módulo de Indicaciones Médicas»; bioquímico y administrador) y `Catálogos Clínicos` (UCE-DIAG-10
paso 1: «módulo de Catálogos Clínicos»; sólo administrador).

**Por qué.** El prototipo de Figma no las tiene, pero el nivel 1 exige un módulo para cada uno,
y `AGENTS.md` manda implementar el flujo del requisito y reportar la divergencia contra la
autoridad de presentación. Es el mismo criterio con el que se agregó `Lista de Espera`.

**Fuente.** UCE-REC-13 paso 1; UCE-DIAG-10 paso 1; `03-shell-frontend.md` S5 (nota agregada).

**Confirmación del dueño.** No.

---

## A-12 — Pantallas de escritura clínica: rol del administrador

**Decisión.** El administrador **consulta** ficha y análisis y **puede invalidar** (UCE-DIAG-08
lo nombra como actor), pero **no** crea fichas, no ingresa muestras, no actualiza estados, no
valida ni agrega addendum: esas cinco son exclusivas del bioquímico.

**Por qué.** UCE-DIAG-04 comentarios: «Solo el rol Bioquímico/Doctor puede validar». UCE-DIAG-08
lista al administrador explícitamente; las otras no. La UI oculta lo que el backend rechaza, y
el backend rechaza con `require_roles`.

---

# Integración del frontend back-office — 2026-11-17

El dueño entregó un repositorio con un frontend casi completo y pidió que **ese** sea el frontend
del sistema, integrado con el backend, y que los datos sigan viéndose aunque sean mockeados, con
autoridad para conciliar las inconsistencias contra las fuentes de verdad. Detalle completo en
`odd/tasks/07-frontend-backoffice.md`.

## A-13 — El frontend de la entrega reemplaza a la interfaz anterior

**Decisión.** Las pantallas, el shell y los tokens visuales del repositorio entregado pasan a ser
la interfaz del proyecto (`frontend/src/screens/`). Se retiran las páginas, el shell y las pruebas
de la interfaz anterior; se conservan la sesión, la capa HTTP y sus pruebas.

**Por qué.** Es una instrucción explícita del dueño y no una decisión técnica.

**Fuente.** Pedido del 2026-11-17 (L1 de `07-frontend-backoffice.md`).

**Impacto.** El sistema de diseño anterior (`components/`, `features/`) deja de existir. La prueba
de sesión sigue cubriendo login, restauración y logout porque `App` sigue siendo su raíz.

**Confirmación del dueño.** Ya dada.

## A-14 — `paciente.sexo` se expone en la API

**Decisión.** `sexo` se agrega a `PacienteRead`, `PacienteCreate` y `PacienteUpdate`. No hay
migración: la columna ya existe en el modelo y en el nivel 3.

**Por qué.** El esquema (nivel 3, tabla `paciente`) **sí** tiene `sexo varchar`, el ORM también, y
la API lo ocultaba citando el hueco G13. El nivel 3 gana: la pantalla de pacientes lo pide como
campo obligatorio y sin exponerlo el formulario guardaría un paciente sin el dato que el operador
cargó. Se mantiene nullable, como el nivel 3 y como UC-REC-15 paso 6.

**Fuente.** Nivel 3 §`paciente` (columna `sexo`, nullable); `app/models/clinical.py` (ya lo tenía);
pruebas `test_create_and_update_round_trip_sexo`.

**Impacto.** `test_rec_pacientes.py` cambia dos aserciones que fijaban la ausencia de `sexo`.

**Confirmación del dueño.** No: la fuente de verdad es explícita.

## A-15 — `paciente.ocupacion` se retira del formulario

**Decisión.** El campo «Ocupación» de la pantalla de pacientes se elimina.

**Por qué.** No existe columna `ocupacion` en el nivel 3 ni en el modelo; el prototipo la ofrecía
como texto libre que ninguna tabla podía guardar. Dejar el campo visible sería pedirle un dato al
operador y descartarlo en silencio.

**Fuente.** Nivel 3 §`paciente` (no hay columna).

**Confirmación del dueño.** No. Si la ocupación se considera un dato clínico necesario, se agrega
primero al nivel 3 y después al modelo.

## A-16 — Los datos de la entrega se muestran aunque la base esté vacía

**Decisión.** Cada pantalla que lee del backend **antepone las filas reales y conserva detrás el
dataset de la entrega** (`seed`), deduplicado por la clave natural de la pantalla (DNI en
pacientes). Una fila que todavía no tiene identidad en el backend se persiste en su primera
edición (`POST` antes de `PATCH`).

**Por qué.** Es literalmente lo pedido: «los datos que se muestran en el nuevo repositorio
necesito que se muestren, no importa que sean datos hardcodeados o mockeados». Además evita el
peor resultado de una integración: una demo con la base vacía que se ve vacía.

**Fuente.** Pedido del 2026-11-17; `AGENTS.md` §Scope guard (no se inventan endpoints).

**Riesgo.** Un demo que parece completo con datos de ejemplo mezclados con reales. Se acota
porque las filas reales van primero y navegan su propio ciclo; sólo los módulos sin endpoint del
nivel 1 (agenda, stock, residuos, reportes y KPIs) son 100 % seed.

**Confirmación del dueño.** Es su pedido; conviene que sepa que la mezcla existe.

## A-17 — Qué se integra y qué queda mockeado (estado real de la entrega)

**Integrado contra `/api/v1`:** sesión (`/auth/login`, `/auth/me`), pacientes (listado, alta,
edición, baja), auditoría (listado + detalle con cambios) y catálogos de roles.

**Mockeado, con la pantalla intacta:** Panel de Control, Agenda y Turnos, Panel de Análisis,
Ficha Clínica, Detalle de Análisis, Carga de Resultados, Resultados, Insumos y Stock, Control de
Residuos, Reportes y Estadísticas, Usuarios y Roles.

**Por qué, caso por caso.**

- *Agenda, Insumos, Residuos, Reportes y Estadísticas* no tienen router v1 (A-09 y sus
  consecuencias): son los mismos huecos ya registrados, no una regresión de esta entrega.
- *Ficha Clínica y el ciclo del análisis* no se pueden mapear sin pérdida: la entrega modela la
  ficha como formulario clínico rico (naturaleza, sitio, lesión, factores, material) y el backend
  la materializa como clave-valor con seis claves (A-04). Conectar la pantalla exigiría extender
  el catálogo clínico y las reglas de la UCE-DIAG-01, que es una decisión de contenido clínico
  reservada al dueño.
- *Usuarios y Roles* quedó mockeado a propósito: la API expone nombre, correo, estado y roles,
  pero no último acceso, intentos fallidos, fecha de registro ni el perfil profesional
  (matrícula, especialidad) que la pantalla muestra. Conectarla dejaría cuatro de las seis
  columnas y todo el bloque profesional en «—», que es peor que el demo para una defensa.

**Fuente.** `app/api/v1/`, A-04, A-09.

**Confirmación del dueño.** Sí, para priorizar las dos extensiones que cierran el mockeo:
catálogo clínico (A-04) y perfil profesional en `UsuarioRead`.
