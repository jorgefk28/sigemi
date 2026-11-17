# 04 — Recepción: Gestión de Pacientes y Turnos

Objetivo: implementar el subsistema de Gestión de Pacientes (módulos **Gestión de Turnos y
Atención** y **Gestión de Pacientes**), que hoy está al 0 %. Rama de trabajo: por carril,
`feat/rec-<task>`. Estrategia de entrega: `ask-on-risk`. Runner: `pytest` desde `backend/`;
`npm test` desde `frontend/`.

Estado del diseño: pasos 0-2 del plan de diseño hechos (`odd/design/rec-draft.md`).
Paso 3 (especificación por pantalla) y paso 4 (revisión humana) pendientes.

---

## Specs

Los `S#` citan el nivel 1 textualmente donde el texto importa. El respaldo de cada uno es
el UCE que lo define.

### S1 — Agendamiento de turnos por Agente IA (RF-01)

«El sistema debe permitir a los pacientes solicitar y agendar turnos interactuando con un
Agente IA exclusivamente a través de la plataforma de mensajería WhatsApp. Tras concretar
el agendamiento, el sistema debe enviar automáticamente un mensaje confirmando el turno,
el cual incluirá la información necesaria para la visita.»

Respaldo: UCE–REC-01. **Canal del paciente: no genera pantalla de back-office.**

### S2 — Envío de indicaciones médicas (RF-02)

«El sistema debe enviar al paciente las indicaciones correspondientes para su análisis a
través del mismo chat de WhatsApp utilizado por el Agente IA.» «Las indicaciones enviadas
serán de carácter estático y estarán predefinidas en el sistema, aún así existirá la
funcionalidad de editar las indicaciones.»

Respaldo: UCE–REC-10 a 13 (ABM de indicaciones, back-office) y el envío por chat.

### S3 — Reagendación automática de turno liberado (RF-03)

«Ante la cancelación o liberación de un turno, el sistema debe notificar vía WhatsApp al
paciente que posea el turno asignado más postergado (el más lejano en el calendario) para
ofrecerle adelantar su cita. El paciente notificado dispondrá de un plazo estricto de
horas para confirmar la reagendación.»

Respaldo: UCE–REC-04. Requiere `oferta_reagendacion` (existe en el nivel 3) y la lista de
espera para los pacientes sin turno.

### S4 — Cancelación y reprogramación de turnos (RF-04)

«El sistema debe permitir al paciente gestionar la reprogramación o cancelación de su
turno asignado comunicándose con el Agente IA a través de WhatsApp.»

Respaldo: UCE–REC-02, 03 (paciente), UCE–REC-21, 22 (manual, back-office).

### S5 — Gestión de pacientes

Registro, modificación, consulta, búsqueda y baja lógica de pacientes. Respaldo:
UCE–REC-16, 17, 18, 19, S-01, 09 (alta temprana), 15 (completar datos demográficos).
Reglas textuales que se conservan: «El paciente ya se encuentra registrado» (excepción del
paso 4 de UCE–REC-16) y «Paciente no encontrado» (excepción del paso 4 de UCE–REC-19).

### S6 — Gestión de agenda

Configuración de parámetros (días hábiles, horarios, duración, cupos), bloqueo y
desbloqueo de días y franjas, y consulta de la agenda. Respaldo: UCE–REC-06, 07, 08, 27.

### S7 — Turnos manuales y serie de turnos

Alta, cancelación y reprogramación manual de turnos, y alta de series de turnos
«vinculados entre sí». Respaldo: UCE–REC-20, 21, 22, 24.

### S8 — Lista de espera

Alta, baja y consulta de la lista de espera, ordenada «por prioridad (fecha de solicitud y
tipo de análisis)». Respaldo: UCE–REC-23, 28, 29. Depende de la tabla `lista_espera`
agregada por la enmienda de L2.

### S9 — Registro de asistencia

«Presente» y «Ausente» sobre el turno del día; el primero cambia el estado a «Atendido» y
registra la hora; el segundo pide un motivo opcional, cambia a «No Asistió», libera el
bloque y dispara UCE–REC-04. Respaldo: UCE–REC-15.

### S10 — Cancelación por vencimiento y asistencia temprana

Respaldo: UCE–REC-14 (cancelación automática por vencimiento) y UCE–REC-09 (alta temprana
de paciente desde el Agente IA).

### S11 — Enmienda del nivel 3 autorizada por el dueño

El esquema congelado no soportaba tres pantallas y tenía una FK obligatoria que ningún UCE
satisface. La enmienda aplicada, con su justificación, está en L2. Es prerrequisito de
T2 y de toda la implementación.

---

## Screens

Inventario derivado en `odd/design/rec-draft.md` (pasos 0-2): **28 UCE**, de los cuales
**19 generan pantalla** y **9 no** (6 son WhatsApp puro, 2 automáticos, 1 sin secuencia
derivable). Resultado: **11 pantallas únicas**.

Inventario definitivo, fusionado desde `odd/design/rec-draft.md` §3 (pasos 0-2). Corrige
el reparto previo de la tabla: **REC-U04 es reprogramar turno**, y la asistencia
(REC-15) no es pantalla propia — es un diálogo dentro de REC-U01 más el modo «completar»
de REC-U05.

| Pantalla | Nombre | Patrón | UCE que cubre |
|---|---|---|---|
| **REC-U01** | Gestión de Agenda (grilla de turnos) | P7 | 06, 08, 27, 15 (1-3), 20 (1), 21 (1-4), 22 (1-3) |
| **REC-U02** | Alta de turno manual | P3 | 20 (2-12) |
| **REC-U03** | Alta de serie de turnos | P3 | 24 (1-8) |
| **REC-U04** | Reprogramar turno | P3 | 22 (4-13) |
| **REC-U05** | Formulario de paciente (alta/edición) | P3 | 16 (2-6), 17 (6-11), 15 (6) |
| **REC-U06** | Listado de pacientes | P1 | 18 (1-5), 17 (1-5), 19 (1-4), S-01 (4b) |
| **REC-U07** | Detalle de paciente | P2 | 18 (6), 19 (5-11) |
| **REC-U08** | Formulario de indicación médica | P3 | 10 (2-7), 11 (2-5) |
| **REC-U09** | Listado de indicaciones médicas | P1 | 13 (1-4), 12 (1-6), 11 (1), 10 (1) |
| **REC-U10** | Configuración de agenda | P3 | 07 (1-9) |
| **REC-U11** | Lista de espera | P1 | 29 (1-4), 28 (1-7) |

**Orden de especificación** (plan §9: primero las dos pantallas que fijan patrón):
REC-U06 (P1) y REC-U05 (P3), después REC-U07 (P2). `## Screens` se completa por
iteración; **ninguna pantalla se implementa sin su especificación aprobada** (paso 4).

**Pantallas cuya especificación no se puede cerrar todavía**:

| Pantalla | Bloqueo |
|---|---|
| REC-U01 Gestión de Agenda | G10 (solapamiento `periodo_inhabilitado` / `bloqueo_agenda`), G11-G12 (columnas y tablas de agenda sin UCE que las gobierne) |
| REC-U10 Configuración de agenda | G10: no está decidido qué escribe `configuracion_agenda` y qué `periodo_inhabilitado` |
| REC-U11 Lista de espera | G8: la vía manual de REC-23 no tiene secuencia; sólo se especifica consultar y quitar |
| REC-U02, U03, U04 | dependen de `configuracion_agenda` (REC-U10) para calcular disponibilidad |

### Paso 3 — especificaciones

#### REC-U06 · Listado de pacientes

- **Patrón**: P1
- **Respaldo**: UCE-REC-18 pasos 1-5 (L1369-1380); UCE-REC-17 pasos 1-5 (L1346-1350);
  UCE-REC-19 pasos 1-4 (L1400-1403); UCE-REC-S-01 paso 4b (L1613); RF-05
- **Actor y permiso**: Bioquímico/Doctor o Administrador (precondición de REC-18, L1374).
  Backend: `require_roles("bioquimico", "administrador")`
- **Ruta y entrada**: Sidebar → Pacientes. Es además el «Buscar Paciente» de REC-17 y
  REC-19 (S-01), no una pantalla aparte.
- **Zonas**: header con breadcrumb y acción «Nuevo Paciente»; barra de filtros; tabla;
  paginación.

**Datos** (nombre exacto del nivel 3). Toda columna es un campo que el nivel 1 nombra: los
del formulario de REC-16 paso 2 o los del filtro de REC-18 paso 3.

| Columna | Campo | Origen |
|---|---|---|
| DNI | `dni` | `paciente` (REC-16 paso 2) |
| Apellido y nombre | `apellido` + `nombre` | `paciente` (REC-16 paso 2) |
| Fecha de nacimiento | `fecha_nacimiento` | `paciente` (REC-16 paso 2) |
| Teléfono | `telefono` | `paciente` (REC-16 paso 2) |
| Estado | `estado` (Activo / Inactivo) | `paciente` (REC-18 paso 3) |

**Filtros**

| Filtro | Parámetro | Origen |
|---|---|---|
| Búsqueda libre por DNI, nombre o apellido | `q` | S-01 paso 1 (L1609) |
| DNI, coincidencia exacta | `dni` | REC-18 paso 3; S-01 comentarios (L1622) |
| Nombre, coincidencia parcial | `nombre` | idem |
| Apellido, coincidencia parcial | `apellido` | idem |
| Estado | `estado` = `activo` \| `inactivo` | REC-18 paso 3 (L1378) |
| Paginación | `limit` 20 por defecto, tope 100; `offset` | convención del repositorio |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Nuevo Paciente | `POST /api/v1/pacientes` (vía REC-U05) | siempre | abre REC-U05 en modo alta (REC-16 paso 1) |
| Ver | `GET /api/v1/pacientes/{id}` | siempre | abre REC-U07 (REC-18 paso 5) |
| Editar | `PATCH /api/v1/pacientes/{id}` (vía REC-U05) | siempre | abre REC-U05 en modo edición (REC-17 pasos 1-6) |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Vacío | «No hay pacientes registrados» + acción Nuevo Paciente (REC-18 exc. paso 4) |
| Sin coincidencias | «No se encontraron pacientes con los criterios ingresados» + Limpiar filtros (REC-18 exc. paso 4) |
| Cargando | esqueleto de tabla, nunca números inventados |
| Error | «No se pudieron cargar los pacientes» + Reintentar |
| Una sola coincidencia | se resalta la fila y se ofrece el acceso al detalle; **no** navega sola (S-01 paso 4a devuelve el dato al UCE invocante, que acá es el listado) |
| Sin permiso | redirección al inicio, no un 403 crudo (R2) |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Sólo Bioquímico/Doctor o Administrador | R2 | precondición REC-18 (L1374) | `require_roles` |
| DNI coincide exacto; nombre y apellido, parciales | R3 | S-01 comentarios (L1622) | backend |
| La edad se calcula al vuelo desde `fecha_nacimiento`, no se persiste | R4 | REC-18 comentarios (L1391) | UI |
| El listado incluye inactivos; el filtro `estado` los separa | R3 | REC-18 paso 3 | backend |
| «Edad» no es columna de la tabla | R4 | REC-18 paso 6 nombra «Datos Personales», no edad | UI |

**Fuera de alcance**: la baja (vive en REC-U07, REC-19 pasos 4-5); el alta desde el Agente
IA (REC-09, WhatsApp); `sexo` (hueco G13: ningún UCE lo pide).

#### REC-U05 · Formulario de paciente (alta y edición)

- **Patrón**: P3
- **Respaldo**: UCE-REC-16 pasos 2-6 (L1323-1327); UCE-REC-17 pasos 6-11 (L1352-1356);
  UCE-REC-15 paso 6 (L1295, modo «completar»); RF-05
- **Actor y permiso**: Bioquímico/Doctor o Administrador. Backend:
  `require_roles("bioquimico", "administrador")`
- **Ruta y entrada**: REC-U06 → «Nuevo Paciente» (alta) o «Editar» (edición); REC-U07 →
  «Editar»; REC-U01 → registrar asistencia con datos incompletos (REC-15 paso 6)
- **Zonas**: header con título según modo; formulario de una columna; acciones Guardar /
  Cancelar

**Datos** (orden de REC-16 paso 2, L1323)

| Campo | Columna | Obligatorio | Origen |
|---|---|---|---|
| DNI | `dni` | sí | REC-16 paso 2 |
| Nombre | `nombre` | sí | REC-16 paso 2 |
| Apellido | `apellido` | sí | REC-16 paso 2 |
| Fecha de nacimiento | `fecha_nacimiento` | sí | REC-16 paso 2 |
| Teléfono | `telefono` | sí | REC-16 paso 2 |
| Correo electrónico | `correo_electronico` | no | REC-16 paso 2 + nivel 2 decisión 7 |
| Dirección | `domicilio` | no | REC-16 paso 2 + nivel 2 decisión 7 |
| Obra social | `obra_social` | no | REC-16 paso 2 + nivel 2 decisión 7 |

Campos que la pantalla **no** pide porque el sistema los completa: `numero_registro`
(lo genera la aplicación, nivel 2 decisión 7), `estado` = activo (REC-16 paso 5),
`fecha_ingreso` (alta) y `nivel_registro` = `completo` (alta de back-office; `temprano` es
sólo la vía del Agente IA, REC-09).

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Guardar (alta) | `POST /api/v1/pacientes` | todos los obligatorios con valor | crea, vuelve a REC-U06 (REC-16 paso 6) |
| Guardar cambios (edición) | `PATCH /api/v1/pacientes/{id}` | idem | actualiza, audita, vuelve a REC-U07 (REC-17 pasos 9-11) |
| Cancelar | — | siempre | vuelve sin escribir |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Error de campo | mensaje bajo el campo, tomado del `400` con `campo` (R3) |
| DNI ya registrado (alta) | «El paciente ya se encuentra registrado» + acceso directo al existente en modo edición (REC-16 exc. paso 4) |
| DNI de otro paciente (edición) | «El DNI ingresado ya corresponde a otro paciente» (REC-17 exc. paso 8) |
| Guardando | botón deshabilitado, sin doble submit |
| Error de red | mensaje de reintento, nunca «DNI duplicado» |
| Fecha de nacimiento bloqueada | campo deshabilitado con la razón a la vista (REC-17 comentarios, L1367) |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| DNI único | R1 | REC-16 paso 4 (L1325) | backend `400` + `campo="dni"` |
| DNI de otro paciente al editar | R1 | REC-17 exc. paso 8 (L1360) | backend `400` + `campo="dni"` |
| `fecha_nacimiento` no se modifica si el paciente tiene análisis | R1 | REC-17 comentarios (L1367) | backend `400` + `campo="fecha_nacimiento"` + campo deshabilitado |
| Formato de DNI y de teléfono | R3 | REC-17 paso 8 (L1353) | backend `400` + `campo` |
| Correo con formato de buzón, cuando viene | R3 | REC-17 paso 8 | backend `400` + `campo="correo_electronico"` |
| Un error de base de datos aborta sin datos parciales | R1 | REC-16 exc. paso 5 (L1331) | backend: una transacción |
| El alta no audita; la edición sí | R1 | REC-17 paso 11 vs. REC-16 (hueco G16) | backend |

**Fuera de alcance**: `sexo` (hueco G13: ningún UCE lo pide, no se agrega sin respaldo);
`numero_registro` editable.

#### REC-U07 · Detalle de paciente

- **Patrón**: P2
- **Respaldo**: UCE-REC-18 paso 6 (L1381); UCE-REC-19 pasos 4-11 (L1403-1410); RF-05
- **Actor y permiso**: Bioquímico/Doctor o Administrador; «Desactivar» sólo Administrador
  (precondición de REC-19, L1398). Backend: lectura con
  `require_roles("bioquimico","administrador")`, baja con `require_roles("administrador")`
- **Ruta y entrada**: REC-U06 → seleccionar una fila
- **Zonas**: header con breadcrumb y acciones (Volver, Editar, Desactivar); ficha de datos
  personales; historial de consultas; análisis micológicos; resultados

**Datos**

| Sección | Campos | Origen |
|---|---|---|
| Datos personales | los ocho campos del formulario + `estado` + `fecha_ingreso` | REC-18 paso 6 (L1381); `paciente` |
| Historial de consultas | `ficha_clinica` (versión vigente y fecha) | REC-18 paso 6 |
| Análisis micológicos | `analisis_micologico.estado` + `tipo_analisis` + fecha de la muestra | REC-18 paso 6 |
| Resultados | `informe_resultados` | REC-18 paso 6 |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Volver | — | siempre | vuelve a REC-U06 **conservando filtros y página** (estado de vista, no ruta) |
| Editar | abre REC-U05 en edición | siempre | navegación (REC-17 paso 6) |
| Desactivar | `POST /api/v1/pacientes/{id}/baja` | rol `administrador` **y** `estado == activo` | abre el diálogo de motivo |

**Diálogo de desactivación** (REC-19 pasos 6-7)

| Campo | Obligatorio | Origen |
|---|---|---|
| Motivo | sí, texto libre | REC-19 paso 6 (L1405) |

Botones Confirmar (deshabilitado sin motivo) y Cancelar. El motivo viaja en el cuerpo y se
persiste en `cambio_auditoria` con `campo = "motivo_baja"` (nivel 2 decisión 9).

**Estados**

| Estado | Qué se muestra |
|---|---|
| Paciente inactivo | badge «Inactivo»; «Desactivar» oculto |
| Sin análisis | «Sin análisis registrados» (nunca datos de ejemplo) |
| Turnos vigentes al desactivar | `400` del backend con el mensaje; la pantalla informa el hecho (REC-19 exc. paso 8) |
| Error | «No se pudo cargar el paciente» + Reintentar |
| Sin permiso para desactivar | acción oculta (R2) |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Desactivar sólo Administrador | R2 | precondición REC-19 (L1398) | `require_roles("administrador")` |
| Motivo obligatorio | R3 | REC-19 paso 6 | backend `400` + `campo="motivo"` + botón deshabilitado |
| No se desactiva con turnos vigentes futuros | R1 | REC-19 paso 8 (L1407) | backend `400` |
| La baja es lógica; el historial queda intacto | R1 | REC-19 comentarios (L1421) | backend |
| El motivo va a la auditoría, no a una columna mutable | R1 | REC-19 paso 10 + nivel 2 decisión 9 | backend |
| Volver conserva los filtros del listado | R4 | REC-17 pasos 1-5 | UI (estado de vista) |

**Fuera de alcance**: iniciar la consulta (`UC–DIAG-01`, dependencia D4); listar los turnos
vigentes del paciente en la excepción del paso 8 — requiere el endpoint de turnos (T4b).

#### REC-U11 · Lista de espera

- **Patrón**: P1
- **Respaldo**: UCE-REC-29 pasos 1-4 («El Administrador ingresa a la lista de espera», «lo
  ordena por prioridad», «aplica filtros opcionales (tipo de análisis, fecha de solicitud)»);
  UCE-REC-28 pasos 1-7 («selecciona el paciente y presiona Quitar», «el sistema solicita
  confirmación», «registra el evento en auditoría»); RF-03
- **Actor y permiso**: `administrador` (precondición de REC-29: «sesión activa con rol de
  Administrador»). Backend: `require_roles("administrador")`
- **Ruta y entrada**: Sidebar → Principal → Lista de Espera (`/lista-espera`). La página no
  estaba en el inventario del prototipo: la exige el nivel 1 y su permiso es exclusivo del
  administrador, que ve todas las páginas; la divergencia se registra en el Log (L6).
- **Zonas**: header con breadcrumb; barra de filtros; tabla; paginación

**Datos** (nombre exacto del nivel 3)

| Columna | Campo | Origen |
|---|---|---|
| Paciente | `paciente_apellido` + `paciente_nombre` (resueltos) | `lista_espera`, `paciente` |
| DNI | `paciente_dni` (resuelto) | `paciente` |
| Fecha de solicitud | `fecha_solicitud` (`dd/MM/yyyy HH:mm`) | `lista_espera` |
| Estado | `estado` (`pendiente` \| `asignado` \| `retirado`) | `lista_espera` |
| Observaciones | `observaciones` (nullable, se muestra «—») | `lista_espera` |

**Filtros**

| Filtro | Parámetro | Origen |
|---|---|---|
| Estado | `estado` = `pendiente` \| `asignado` \| `retirado`; por defecto `pendiente` | REC-29 paso 3 |
| Fecha desde / hasta | `fecha_desde`, `fecha_hasta` sobre `fecha_solicitud` | REC-29 paso 3 |
| Paginación | `limit` 20 por defecto, tope 100; `offset` | convención del repositorio |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Quitar | `POST /api/v1/lista-espera/{id}/quitar` | `estado != retirado` | pide confirmación (REC-28 paso 4) y, al confirmar, deja `estado = retirado` y audita el cambio |

El orden de la lista lo fija el backend (prioridad derivada: `fecha_solicitud` y
`tipo_analisis_id` ascendentes, decisión A9). La UI no reordena.

**Estados**

| Estado | Qué se muestra |
|---|---|
| Vacío | «No hay pacientes en lista de espera» (excepción del paso 2, textual) |
| Sin coincidencias | «No se encontraron entradas con esos filtros» + Limpiar filtros |
| Cargando | esqueleto de tabla, nunca números |
| Error | «No se pudo cargar la lista de espera» + Reintentar |
| Confirmación cancelada | no se modifica nada (excepción del paso 4) |
| Sin permiso | redirección al inicio, no un 403 crudo (R2) |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Sólo `administrador` consulta y quita | R2 | precondición REC-29 | `require_roles("administrador")` |
| Quitar exige confirmación explícita | R1 | REC-28 paso 4 y exc. | diálogo; sin confirmación no hay request |
| Quitar es lógico y audita `modificar` | R1 | REC-28 pasos 6-7 + decisión A8 | backend |
| Quitar dos veces no duplica la auditoría | R1 | idempotencia del endpoint | backend |
| El orden de prioridad es del backend | R4 | REC-29 paso 2 + A9 | UI no reordena |

**Pantalla sin la mitad de su alcance, declarada**: el filtro «tipo de análisis» de REC-29
paso 3 no se implementa todavía porque `lista_espera` expone `tipo_analisis_id` sin nombre y
**no hay endpoint de catálogo de tipos de análisis** (`UC-DIAG-10`, subsistema DIAG sin
especificar). Mostrar un UUID crudo o inventar un nombre sería peor que la ausencia del
filtro: se registra como dependencia, no se simula.

**Fuera de alcance**: la vía manual de alta en la lista (REC-23, hueco G8); la asignación
automática de turno liberado (REC-27, proceso del sistema, sin pantalla).

#### REC-U08 · Formulario de indicación médica (alta y edición)

- **Patrón**: P3
- **Respaldo**: UCE-REC-10 pasos 1-7 (crear), UCE-REC-11 pasos 1-5 (modificar); RF-02
- **Actor y permiso**: Bioquímico/Doctor o Administrador (precondición idéntica en las dos
  UCE). Backend: `require_roles("bioquimico", "administrador")`
- **Ruta y entrada**: REC-U09 → «Nueva Indicación» o «Editar»; `/indicaciones/nueva` y
  `/indicaciones/:id/editar`
- **Zonas**: header con título según modo; formulario de una columna; acciones Guardar /
  Cancelar

**Datos** (UCE-REC-10 paso 2 los nombra los tres)

| Campo | Columna | Obligatorio | Origen |
|---|---|---|---|
| Título | `titulo` | sí | REC-10 paso 2 |
| Contenido | `contenido` | sí | REC-10 paso 2 |
| Tipo de análisis asociado | `tipo_analisis_id` | sí | REC-10 paso 2 + nivel 3 (NOT NULL) |

El selector de tipo de análisis se llena con `GET /tipos-analisis` (T1 de
`05-laboratorio-bioquimico.md`), no con una lista escrita en la pantalla.

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Guardar (alta) | `POST /api/v1/indicaciones-medicas` | los tres campos con valor | crea y vuelve a REC-U09 (REC-10 paso 7) |
| Guardar cambios (edición) | `PATCH /api/v1/indicaciones-medicas/{id}` | idem | actualiza y vuelve a REC-U09 (REC-11 paso 5) |
| Cancelar | — | siempre | vuelve sin escribir |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Error de campo | mensaje bajo el campo, del `400` con `campo` (R3) |
| Catálogo vacío | «No hay tipos de análisis cargados» + acceso a Catálogos Clínicos si el rol lo permite |
| Guardando | botón deshabilitado, sin doble submit |
| Error de red | «No se pudo conectar con el servidor» + Reintentar, nunca un error de validación |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Los tres campos son obligatorios | R3 | REC-10 paso 4 y su excepción | backend `400` + `campo`; la UI avisa antes de enviar |
| El tipo de análisis debe existir | R3 | derivado del paso 5 (vincular) | backend `400` + `campo="tipo_analisis_id"` |
| Editar no cambia el estado | R4 | REC-11 no lo menciona; dar de baja es REC-12 | el formulario no ofrece estado |

**Fuera de alcance**: el envío al paciente por WhatsApp (REC-09, Agente IA).

#### REC-U09 · Listado de indicaciones médicas

- **Patrón**: P1
- **Respaldo**: UCE-REC-13 pasos 1-4 (consultar y filtrar), UCE-REC-12 pasos 1-6 (eliminar),
  UCE-REC-11 paso 1 y UCE-REC-10 paso 1 (puntos de entrada); RF-02
- **Actor y permiso**: Bioquímico/Doctor o Administrador. Backend:
  `require_roles("bioquimico", "administrador")`
- **Ruta y entrada**: Sidebar → Principal → Indicaciones Médicas (`/indicaciones`). Página
  agregada por el nivel 1: dos UCE dicen «ingresa al módulo de Indicaciones Médicas» y el
  prototipo no la tenía (divergencia registrada en el Log).
- **Zonas**: header con breadcrumb y acción «Nueva Indicación»; barra de filtros; tabla;
  paginación

**Datos** (REC-13 paso 3 nombra las cuatro columnas)

| Columna | Campo | Origen |
|---|---|---|
| Título | `titulo` | `indicacion_medica` |
| Contenido | `contenido` (recortado con «Ver más» si es largo) | `indicacion_medica` |
| Tipo de análisis | `tipo_analisis_nombre` (resuelto por el backend) | `tipo_analisis` vía FK |
| Estado | `estado` (Activa / Inactiva) | `indicacion_medica` |

**Filtros** (REC-13 paso 4)

| Filtro | Parámetro | Origen |
|---|---|---|
| Texto libre sobre título y contenido | `q` | REC-13 paso 4 (lectura) + convención del repo |
| Estado | `estado` = `activa` \| `inactiva` | REC-13 paso 4 (textual) |
| Tipo de análisis | `tipo_analisis_id` | REC-13 paso 4 (textual) |
| Paginación | `limit` 20, tope 100; `offset` | convención del repositorio |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Nueva Indicación | `POST` vía REC-U08 | siempre | abre REC-U08 en modo alta |
| Editar | `PATCH` vía REC-U08 | siempre | abre REC-U08 en modo edición |
| Eliminar | `POST /api/v1/indicaciones-medicas/{id}/baja` | `estado == activa` | pide confirmación (REC-12 paso 3) y deja `inactiva` |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Vacío | «No hay indicaciones médicas registradas» (excepción del paso 2, textual) + Nueva Indicación |
| Sin coincidencias | «No se encontraron indicaciones con esos filtros» + Limpiar filtros |
| Confirmación cancelada | no se modifica nada (excepción del paso 4) |
| Cargando | esqueleto de tabla |
| Error | «No se pudieron cargar las indicaciones» + Reintentar |
| Sin permiso | redirección al inicio, no un 403 crudo (R2) |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Sólo bioquímico o administrador | R2 | precondición de las cuatro UCE | `require_roles` |
| Eliminar es baja lógica, no `DELETE` | R1 | REC-12 paso 5 y su comentario (turnos históricos) | backend `estado=inactiva` |
| Eliminar exige confirmación | R1 | REC-12 paso 3 y su excepción | diálogo; sin confirmar no hay request |
| Una indicación inactiva no ofrece Eliminar | R4 | REC-12 selecciona del listado y el paso 5 la deja inactiva | acción oculta |

**Fuera de alcance**: asignar la indicación a un turno (REC-01 paso 7, Agente IA).

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Enmienda del nivel 2/3 para REC: `lista_espera`, `turno.tipo_analisis_id` / `serie_id` / `motivo_inasistencia`, `profesional_id` y `espacio_id` nullable, `indicacion_medica.tipo_analisis_id` obligatorio, obligatoriedad de `paciente` | S11 | inline (integrador) | ✅ (L2) |
| T2 | Migración aditiva + modelos SQLAlchemy de la enmienda, con test de fidelidad contra el nivel 3 | S11 | delegated | ✅ (L3, integrada en `580232f`) |
| T3 | Diseño paso 3: especificación de las 11 pantallas con la plantilla del plan | S1-S10 | — | ⏳ (L4: REC-U05, U06 y U07 especificadas) |
| T4a | Backend REC de pacientes y lista de espera: REC-16/17/18/19, S-01 y REC-28/29 | S5, S8 | delegated (carril `feat/rec-t4-pacientes`) | ✅ (L5, integrada en `f2076ea`) |
| T4b | Backend REC de agenda, turnos y asistencia | S6, S7, S9 | — | ⏳ bloqueada por G10-G12 |
| T5 | Pantallas REC: P1 (REC-U06) y P3 (REC-U05) primero, después las demás instancias | S1-S10 | — | ✅ REC-U05, U06, U07, U08, U09 y U11 (L6, L7) |
| T6 | Integración con el Agente IA y WhatsApp: requiere decisión de proveedor | S1, S2, S3, S4 | — | ⛔ bloqueada |

**Risk**: ítem 1 (cambio de esquema persistido) e ítem 3 (contrato que consumen los otros
subsistemas). T1 no ejecuta DDL sobre datos: la migración es T2. **T4a**: ítem 3 (contrato
de API nuevo que van a consumir las pantallas REC-U05/U06/U07/U11); no toca esquema ni datos
existentes.

---

## Log

### L1 — Origen

Pedido del dueño, textual:

> «Hola, verifica estados de worktrees, si estan integrados. En que estado de implementación está el sistema, y que falta implementar. Haz un plan de implementación por worktrees y sigamos avanzando con el desarrollo de este sistema.»

El dueño eligió, entre las opciones presentadas, seguir con **REC (Gestión de Pacientes y
Turnos)** y no con LAB ni con cerrar SEG.

### L2 — Enmienda del nivel 3 autorizada por el dueño (2026-11-16)

**Autorización, textual**: «Enmienda acotada del nivel 3 + migración (Recomendado)» —
opción elegida por el dueño sobre la propuesta de enmienda quirúrgica limitada a REC.
Es una autorización explícita sobre la documentación fuente, que `AGENTS.md` prohíbe
editar desde este repositorio por defecto. Queda registrada acá porque cambia la política
aplicada, igual que L24 de `02-seguridad-acceso.md`.

**Evidencia que la motivó** (verificada por el integrador contra las fuentes, no sólo
reportada por el carril de diseño):

| Hueco | Verificación | Consecuencia si no se corrige |
|---|---|---|
| No existe `lista_espera` | 0 apariciones en el nivel 3 | 3 UCE sin almacenamiento y **RF-03 inimplementable** |
| `turno` sin `tipo_analisis_id` | tabla `turno`, L87-101 | UCE–REC-20 paso 6 y UCE–REC-24 paso 2 piden un dato que no se puede guardar |
| `turno.profesional_id` y `espacio_id` obligatorios | L94-95 | ningún UCE los asigna al crear: el `INSERT` no puede cumplir el esquema |
| `indicacion_medica.tipo_analisis_id` nullable | L110 | UCE–REC-10 lo exige obligatorio; nivel 1 gana |
| `paciente` sin obligatoriedad declarada | L34-49 | UCE–REC-15 paso 6 («datos demográficos incompletos») es indecidible |

**Cambios aplicados al nivel 3** (`Diagramas/modelo_esquema_bd_sigemi.md`):

1. **Nueva tabla `lista_espera`** (`paciente_id`, `tipo_analisis_id` nullable,
   `fecha_solicitud`, `estado`, `usuario_id` nullable, `observaciones`) con dos reglas:
   `prioridad` no se persiste, y la tabla existe porque UCE–REC-23/28/29 y UCE–REC-04 la
   necesitan. Índices `lista_espera(estado)` y `lista_espera(fecha_solicitud)`.
2. **`turno`**: se agregan `tipo_analisis_id` (nullable), `serie_id` (nullable, sin FK) y
   `motivo_inasistencia`; `profesional_id` y `espacio_id` pasan a nullable.
3. **`indicacion_medica.tipo_analisis_id`** pasa a obligatorio.
4. **`paciente`**: regla de obligatoriedad — `NOT NULL` en `numero_registro`, `dni`,
   `nombre`, `apellido`, `fecha_nacimiento`, `telefono`, `estado`, `fecha_ingreso`,
   `nivel_registro`; nullable `sexo`, `domicilio`, `correo_electronico`, `obra_social`.
   `numero_registro` lo genera la aplicación.

**Cambios aplicados al nivel 2** (`Diagramas/modelo_dominio_sigemi_unificado.md` §6):
decisiones **5** (profesional y espacio se asignan después de agendar), **6**
(`indicacion_medica.tipo_analisis` obligatorio), **7** (obligatoriedad de `paciente`),
**8** (`lista_espera.prioridad` derivada) y **9** (el motivo de la baja de un paciente va
a `cambio_auditoria`, no a una columna mutable de `paciente`).

**Lo que la enmienda NO hizo, a propósito**: no borró ni "arregló" las tablas de agenda sin
UCE que las gobierne (`disponibilidad_profesional`, `ausencia_profesional`,
`espacio_atencion`, `grupo_espacio`, `tipo_bloqueo`) ni resolvió el solapamiento entre
`periodo_inhabilitado` y `bloqueo_agenda` (G10, G11, G12). Son huecos de requisito, no de
esquema: agregar una columna no crea el caso de uso que la use.

**Estado de las ediciones**: quedan **sin commitear en el árbol de trabajo de `Docs`**, que
ya tenía cambios propios del dueño sin commitear. No se commitean desde acá: mezclar
autores en un mismo commit oculta quién decidió qué.

**Próximo paso**: T2, migración aditiva y modelos, con test de fidelidad contra el nivel 3.

### L3 — T2: migración y modelos de la enmienda (2026-11-16)

**Carril**: rama `feat/rec-t2-esquema`, worktree `C:\work\sigemi-rec-t2`, base de datos
propia `sigemi_rec2`. Merge en `main`: `580232f`.

**Revisión Alembic creada**: `d4e2a91f7b30` (`rec amendment: lista_espera and
nullability`), encadenada a `c1bf7c1dd493`. Las dos revisiones ya aplicadas quedaron
intactas: el historial no se reescribió.

**Qué materializó**: `lista_espera` con sus dos índices y sus tres FK; `turno` con
`tipo_analisis_id` (FK), `serie_id` (uuid sin FK) y `motivo_inasistencia`, y con
`profesional_id` y `espacio_id` opcionales; `indicacion_medica.tipo_analisis_id`
obligatorio; y las nueve columnas obligatorias de `paciente`.

**Decisión de diseño de la migración**: cada `SET NOT NULL` va precedido por una cuenta
de filas con NULL y aborta nombrando `tabla.columna` y la cantidad. Un `ALTER` que falla a
mitad de la migración deja el esquema en un estado que nadie declaró, y el error nativo de
PostgreSQL no dice cuántas filas ni cuál columna. El `downgrade` aplica el mismo guard al
restaurar `NOT NULL` sobre `turno`, porque el esquema nuevo permite filas que el viejo
rechazaba.

**Corrección del integrador sobre el trabajo del carril**: `ListaEspera.estado` se había
escrito con el literal `"pendiente"`, porque `app/models/enums.py` estaba fuera de la
superficie de edición del worker. El resto de los estados del modelo son `StrEnum` de ese
archivo (`TurnoEstado`, `EstadoIndicacion`, `OfertaEstado`), así que se agregó
`ListaEsperaEstado` (`pendiente` / `asignado` / `retirado`) y el modelo lo usa. Un conjunto
cerrado escrito como literal se desincroniza en cuanto alguien escribe el segundo valor a
mano.

**Evidencia observada sobre `main`, con la base creada desde cero**

- `alembic upgrade head` sobre una base vacía → `8f5956edf3e4` → `c1bf7c1dd493` →
  `d4e2a91f7b30`, `current` = `d4e2a91f7b30 (head)`. La cadena completa aplica desde cero.
- `pytest` completo → **397 passed, 1 warning in 112.66 s**, exit 0 (baseline `00fabec`:
  378).
- `ruff check .` → `All checks passed!`; `ruff format --check .` → `51 files already
  formatted`.
- En el carril: `alembic downgrade -1` y vuelta a `upgrade head` sin error, y el snapshot
  de esquema antes y después del ida y vuelta es idéntico por hash.

**RED/GREEN del carril**: RED de 19 fallos (`KeyError: lista_espera`, columnas faltantes en
`turno`, migración inexistente); GREEN de los mismos archivos, 293 passed. Suite del
carril: 396 (378 + 18 tests nuevos), más 1 test del integrador para el enum → 397.

**Limitaciones registradas, no corregidas**

- El modo offline de Alembic (`upgrade --sql`) quedaría roto por el guard, que necesita una
  conexión real. `env.py` lo soporta y nadie lo usa en el repositorio.
- El test del guard siembra la fila bloqueante dentro de una transacción con rollback en
  lugar de re-ejecutar `upgrade()` completo, porque la revisión ya está aplicada a la base
  del carril. El cableado dentro de `upgrade()` queda cubierto por el ida y vuelta y por el
  test de completitud de `NOT_NULL_TARGETS`.

**Próximo paso**: T3, especificación de las 11 pantallas (paso 3 del plan de diseño). Antes
hay que decidir G15: el patrón de calendario que REC-U01 necesita y los seis patrones
actuales no cubren.

### L4 — T3: `## Screens` fusionada desde el borrador y tres pantallas especificadas (2026-11-16)

**Pedido del dueño, textual**: «Revisa el estado de la sesión que escribía el subsistema
REC, continúa su trabajo.»

**Estado encontrado**: la sesión de REC había cerrado `68bcdfa` (evidencia de T2) y
`133f393` (patrón P7 en el plan + REC-U01 clasificada) y se detuvo antes del paso 3. El
inventario de `## Screens` había quedado **desactualizado respecto de
`odd/design/rec-draft.md` §3**: decía REC-U04 = indicaciones médicas, REC-U08 = lista de
espera, REC-U11 = baja de paciente, y daba a la asistencia (REC-15) pantalla propia.

**Qué se corrigió en `## Screens`**

1. La tabla se reemplazó por la de `rec-draft.md` §3, que es la derivación verificada:
   REC-U04 es **reprogramar turno**; las indicaciones son **U08 (formulario) + U09
   (listado)**; **U10** es configuración de agenda; **U11** es lista de espera; y la
   asistencia (REC-15) no tiene pantalla propia — es un diálogo dentro de U01 más el modo
   «completar» de U05.
2. Se agregó la tabla de pantallas cuya especificación **no se puede cerrar todavía**, con
   el hueco que la bloquea (G10-G12 para U01 y U10; G8 para el alta de U11; U02-U04 dependen
   de U10 para calcular disponibilidad).
3. Se especificaron las tres pantallas del primer patrón, en el orden que fija el plan §9:
   **REC-U06 (P1)**, **REC-U05 (P3)** y **REC-U07 (P2)**.

**Decisiones de especificación registradas** (las tres son R4, no cambian backend):

| ID | Decisión | Por qué |
|---|---|---|
| A6 | En REC-U06, una búsqueda con una sola coincidencia resalta la fila y ofrece el acceso al detalle; **no navega sola** | S-01 paso 4a devuelve el dato al UCE invocante; REC-U06 existe para listar, y navegar sola le quitaría el listado que REC-18 paso 2 pide |
| A7 | `sexo` no aparece en el formulario de REC-U05 | Ningún UCE lo pide (hueco G13): se reporta, no se inventa |
| A8 | El diálogo de desactivación de REC-U07 no lista los turnos vigentes todavía | Listarlos exige el endpoint de turnos (T4b); el mensaje informa el hecho y la lista llega con esa tarea |

**Pendiente del paso 3**: REC-U01, U02, U03, U04, U08, U09, U10 y U11. El paso 4 (revisión
humana de 3 minutos por pantalla) no empezó: **ninguna de las tres está aprobada**.

### L5 — T4a: backend de pacientes y lista de espera (2026-11-16)

**Carril**: rama `feat/rec-t4-pacientes`, worktree `C:\work\sigemi-rec-t4`, base propia
`sigemi_rec_t4` migrada desde cero. Merge en `main`: `f2076ea`.

**Por qué se partió T4 en T4a y T4b**: la agenda depende de G10 (solapamiento
`periodo_inhabilitado` / `bloqueo_agenda`), G11-G12 (tablas de agenda sin UCE que las
gobierne) y de la configuración de agenda que todavía no está especificada. Construirla hoy
sería inventar reglas. Pacientes y lista de espera no dependen de ningún hueco abierto.

**Entregado** (7 endpoints, `/api/v1`): `POST /pacientes` (REC-16), `GET /pacientes`
(REC-18, S-01), `GET /pacientes/{id}` (REC-18), `PATCH /pacientes/{id}` (REC-17),
`POST /pacientes/{id}/baja` (REC-19), `GET /lista-espera` (REC-29) y
`POST /lista-espera/{id}/quitar` (REC-28). Sin alta manual de lista de espera: hueco G8.

**Decisiones nuevas registradas**

| ID | Decisión | Por qué |
|---|---|---|
| A9 | `numero_registro` = `PAC-` + los primeros 8 hex del UUID de la fila, en mayúscula | El nivel 1 no lo pide y el nivel 3 lo declara único y generado por la aplicación. Un correlativo exige una secuencia, es decir una migración; el UUID da unicidad por construcción y el identificador es inmutable aunque se edite el DNI |
| A10 | `dni`, `telefono` y `fecha_nacimiento` se validan en el servicio con mensaje de campo; el correo del paciente reusa `validar_correo` de SEG | REC-17 paso 8 pide validar «formato de DNI, teléfono, etc.» sin fijar el formato. Se fija lo mínimo defendible: DNI de 7-8 dígitos normalizado (sin puntos ni espacios), teléfono de 6-20 con el juego de caracteres de un número, fecha no futura |
| A11 | El alta de paciente **no** audita; la edición, la baja y el quitar de lista **sí** | REC-16 no incluye la auditoría como paso y REC-17/19/28 sí (hueco G16: el silencio no se deduce, cada pantalla lo declara) |
| A12 | «Quitar» de la lista de espera es baja lógica (`estado = "retirado"`), no borrado | El nivel 3 ya declara ese estado; el registro histórico de la cola se conserva |

**Evidencia observada**

- En el carril: `pytest -q` → **437 passed**, exit 0. `ruff check .` → `All checks passed!`;
  `ruff format --check .` → `59 files already formatted`.
- Sobre `main` con el carril integrado: `pytest -q` → **437 passed, 0 failed, 0 errors**
  (baseline `133f393`: 397). `ruff check .` y `ruff format --check .` verdes.
- Tests nuevos: 39 (28 de pacientes + 11 de lista de espera), todos por la interfaz pública
  con las fixtures `client` y `db`.

**Corrección del integrador sobre el trabajo del carril**: el filtro `dni` del listado
comparaba el valor tal como se tipeaba, mientras el alta lo normaliza; buscar por
`30.123.456` no encontraba al paciente guardado como `30123456`. Se extrajo `limpiar_dni` y
se usa en ambos lados, con un test que lo pinnea.

**Bloqueo reportado, no resuelto (migración del integrador)**: `paciente.dni` es único por
regla de negocio (REC-16 paso 4, REC-17 exc. paso 8), pero el nivel 3 sólo declara
`ix_paciente_dni`, **no único**. Hoy la unicidad se valida en el servicio y queda una ventana
entre el `SELECT` y el `INSERT`: dos altas concurrentes con el mismo DNI pueden pasar las
dos. La corrección es una migración aditiva con `UniqueConstraint("dni")` más la traducción
del `IntegrityError` a `400` + `campo="dni"`, el mismo patrón que ya usa el correo de
`usuario`. No se ejecutó: es DDL y pertenece al integrador.

**Estado de la base de desarrollo**: `sigemi` estaba en `c1bf7c1dd493` (una revisión atrás).
Se corrió `alembic upgrade head` → `d4e2a91f7b30`. La suite fallaba 13 tests con
`relation "lista_espera" does not exist` hasta hacerlo: era estado de entorno, no un defecto
del código.

**Próximo paso**: T4b queda bloqueada por G10-G12. Lo que sigue sin bloqueo es terminar el
paso 3 (REC-U08, U09) y la revisión humana de las tres pantallas ya especificadas.

### L6 — T5a: REC-U06, REC-U05 y REC-U07 en el frontend (2026-11-16)

**Qué se entregó** (`frontend/src`, sobre `main`, commits `bbbe091` + `c03066b`):

| Pantalla | Ruta | Archivo |
|---|---|---|
| REC-U06 · Listado de pacientes (P1) | `/pacientes` | `features/recepcion/PacientesListPage.tsx` |
| REC-U05 · Formulario de paciente (P3) | `/pacientes/nuevo` · `/pacientes/:id/editar` | `features/recepcion/PacienteFormPage.tsx` |
| REC-U07 · Detalle de paciente (P2) | `/pacientes/:id` | `features/recepcion/PacienteDetallePage.tsx` |

Las tres consumen los endpoints de T4a (`pacientes.py`, L5) sin tocar el backend. Se
apoyan en las primitivas que el subsistema comparte con SEG: `DataTable` (con
`highlightedRowKey` para la única coincidencia), `FilterBar`, `Pagination`, `FormField`
con `campo` y `Dialog`.

**Decisiones de presentación registradas**:

1. **Una sola coincidencia se resalta y no navega** (S-01 paso 4a). El listado muestra el
   aviso «Una sola coincidencia: usá «Ver» para abrir la ficha» y la fila resaltada. Navegar
   solo rompería el contrato de S-01: el dato tiene que volver al UCE invocante.
2. **`sexo` no aparece** (G13: ningún UCE lo pide) y **la edad no es columna** (REC-18 paso 6
   nombra «Datos Personales»). Tampoco se inventa `numero_registro`, `estado`, `fecha_ingreso`
   ni `nivel_registro`: los deriva la aplicación (nivel 2 decisión 7).
3. **La fecha de nacimiento no se deshabilita de antemano** en REC-U05, aunque el §Screens lo
   pide para el paciente con análisis. `PacienteRead` no expone si el paciente tiene análisis
   y no hay endpoint que lo diga, así que la UI no puede decidir ese estado sin inventarlo: el
   campo queda habilitado, con la regla como pista, y el `400` con `campo="fecha_nacimiento"`
   del backend se muestra en el campo. **Es un supuesto registrado, no una divergencia
   silenciosa**; se cierra cuando exista el endpoint de análisis (T4b/DIAG).
4. **«Desactivar» se ofrece sólo a `administrador`** (precondición de REC-19), con el motivo
   obligatorio en un diálogo y `Confirmar` deshabilitado sin motivo. Un `400` de negocio
   («turnos vigentes») se informa dentro del diálogo y lo deja abierto: no es un error de
   transporte.
5. **Las tres secciones de historial declaran su estado real.** Sin endpoint de ficha
   clínica ni de informes, la pantalla dice «Pendiente: todavía no hay endpoint…» y, para
   análisis, el vacío que el §Screens fija («Sin análisis registrados»). No se fabrican filas.
6. **Un DNI repetido en el alta ofrece abrir la ficha existente en modo edición**
   (REC-16 exc. paso 4): el formulario consulta `GET /pacientes?dni=…&limit=1` y navega.

**Fuera de alcance respetado**: la baja desde el listado (vive en REC-U07, REC-19), el alta
por WhatsApp (REC-09), `sexo`, y el listado de turnos vigentes dentro de la excepción del
paso 8 de REC-19 (necesita T4b).

**Evidencia observada** desde `frontend/`: `npx tsc --noEmit` → exit 0; `npm run lint` →
exit 0; `npm test` → **103 passed** (13 archivos); `npm run build` → `✓ built`. Casos nuevos:
25 (`pacientesListado.test.tsx` 9, `pacienteFormulario.test.tsx` 9,
`pacienteDetalle.test.tsx` 7). El comportamiento previo tocado —el listado de SEG y el
placeholder de las páginas sin pantalla— sigue verde: el caso que usaba «Pacientes» como
ejemplo de placeholder se movió a «Análisis», que es el que sigue sin especificación.

**Probe en vivo contra el backend real** (PostgreSQL de desarrollo en `5433`, `alembic
current` = `d4e2a91f7b30`, `uvicorn` en `127.0.0.1:8010`), con las URLs exactas que arma
`buildQuery`: **19 de 19 OK**, sin fallas. Cubre login form-urlencoded, `/auth/me`,
`/pacientes` sobre `{items,total,limit,offset}`, las columnas exactas de `PacienteRead`, los
filtros `q`, `dni` (exacto, el que usa el alta con DNI repetido) y `estado`, alta `201`, DNI
repetido `400` con `campo="dni"`, detalle, `PATCH` parcial, `PATCH` vacío `400`, baja lógica,
segunda baja `400`, `/lista-espera` con nombre y DNI resueltos, `quitar` → `retirado`, filtro
por `estado` y por rango de fechas, y `401` sin token. Usuario, 2 pacientes, 1 entrada y 4
filas de auditoría del probe se borraron: residuo verificado en **0** para las tres tablas.

**REC-U11 quedó especificada e implementada** (misma sesión, después de las tres anteriores): su
`## Screens` se escribió desde UCE-REC-29 pasos 1-4 y UCE-REC-28 pasos 1-7, que no estaban
especificadas —el §Screens sólo la clasificaba como P1 y limitaba el alcance a consultar y
quitar por el hueco G8—. Dos límites quedan declarados en la especificación, no simulados: el
filtro «tipo de análisis» no se ofrece porque `lista_espera` expone `tipo_analisis_id` sin
nombre y no hay endpoint de catálogo (`UC-DIAG-10`), y el orden es el del backend.

**Divergencia de navegación registrada**: `Lista de Espera` se agregó al sidebar, en el grupo
`Principal`, con `roles: []` (sólo administrador). No estaba en el inventario del prototipo que
fija S5 de `03-shell-frontend.md`; la exige el nivel 1 (UCE-REC-29, precondición de rol
administrador) y se implementa el flujo del requisito, reportando la divergencia contra la
autoridad de presentación, como manda `AGENTS.md` §Screen and design authority.

**Evidencia de REC-U11**: 9 casos en `listaEspera.test.tsx` (datos resueltos y ningún UUID
crudo, vista por defecto en `pendiente`, filtro por estado, filtro por rango de fechas, vacío
textual de REC-29, confirmación que se puede cancelar sin request, sin acción sobre una entrada
retirada, error con Reintentar, y redirección de un bioquímico). Con esa pantalla el suite
queda en **121 passed** (15 archivos), `tsc` 0, `lint` 0 y `build` verde. El backend ya estaba
probado en vivo para esos dos endpoints (probe de arriba).

### L7 — T5: indicaciones médicas, backend y pantallas (2026-11-17)

Cierra la última mitad de REC que no dependía de la agenda.

**Backend** (`/indicaciones-medicas`): listado con `q`, `estado` y `tipo_analisis_id`; detalle;
alta; `PATCH` parcial; `POST /{id}/baja`. Roles: `bioquimico` y `administrador` (las cuatro UCE
declaran esa precondición). El listado resuelve `tipo_analisis_nombre` en una consulta, así que
la tabla no pide una fila por request. La baja es lógica e idempotente porque los turnos
históricos siguen apuntando a la indicación que usaron (comentario de UCE-REC-12).

**Pantallas**: `IndicacionesListPage` (REC-U09, P1: las cuatro columnas de REC-13 paso 3,
filtros por estado y tipo, eliminar con confirmación, «No hay indicaciones médicas registradas»
textual) y `IndicacionFormPage` (REC-U08, P3: los tres campos obligatorios, selector alimentado
por el catálogo clínico y aviso explícito cuando el catálogo está vacío).

**Página nueva en el sidebar**: `Indicaciones Médicas` (A-11), porque UCE-REC-10 paso 1 y
REC-13 paso 1 dicen «módulo de Indicaciones Médicas» y el prototipo no lo tenía.

**Evidencia**: `backend/tests/test_rec_indicaciones.py` (9 casos);
`frontend/src/features/recepcion/indicaciones.test.tsx` (11 casos).

**Estado de REC**: **6 de 11 pantallas** implementadas (U05, U06, U07, U08, U09, U11). Las cinco
restantes (U01-U04, U10) son la agenda, bloqueada por G10-G12 y por la prohibición de editar
los niveles 1-3 desde este repo (A-09).