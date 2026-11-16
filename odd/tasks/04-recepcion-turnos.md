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

| Pantalla | Patrón | UCE |
|---|---|---|
| REC-U01 Gestión de Agenda | **sin patrón** (hueco G15) | 06, 07, 08, 27 |
| REC-U02 Nuevo Turno | P3 | 20 |
| REC-U03 Turno Seriado | P3 | 24 |
| REC-U04 Indicaciones Médicas | P1 + P3 | 10, 11, 12, 13 |
| REC-U05 Formulario de Paciente | P3 | 16, 17, 15 |
| REC-U06 Listado de Pacientes | P1 | 18, S-01 |
| REC-U07 Detalle de Paciente | P2 | 18 |
| REC-U08 Lista de Espera | P1 | 29, 28 |
| REC-U09 Configuración de Agenda | P3 | 07 |
| REC-U10 Registro de Asistencia | P3 | 15 |
| REC-U11 Baja de Paciente | P3 | 19 |

**Pendiente el paso 3**: la especificación completa de cada pantalla con la plantilla de
`odd/design/screen-design-plan.md` §4. Ninguna pantalla se implementa sin esa
especificación aprobada (paso 4).

Huecos abiertos que afectan pantallas: G8 (REC-23 sin secuencia manual), G10 (solapamiento
`periodo_inhabilitado` / `bloqueo_agenda`), G11 y G12 (tablas de agenda sin UCE que las
gobierne), G15 (falta el patrón de calendario).

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Enmienda del nivel 2/3 para REC: `lista_espera`, `turno.tipo_analisis_id` / `serie_id` / `motivo_inasistencia`, `profesional_id` y `espacio_id` nullable, `indicacion_medica.tipo_analisis_id` obligatorio, obligatoriedad de `paciente` | S11 | inline (integrador) | ✅ (L2) |
| T2 | Migración aditiva + modelos SQLAlchemy de la enmienda, con test de fidelidad contra el nivel 3 | S11 | delegated | ✅ (L3, integrada en `580232f`) |
| T3 | Diseño paso 3: especificación de las 11 pantallas con la plantilla del plan | S1-S10 | — | ⏳ |
| T4 | Backend REC: pacientes, agenda, turnos, lista de espera, asistencia | S5-S9 | — | ⏳ |
| T5 | Pantallas REC: P1 (REC-U06) y P3 (REC-U05) primero, después las demás instancias | S1-S10 | — | ⏳ |
| T6 | Integración con el Agente IA y WhatsApp: requiere decisión de proveedor | S1, S2, S3, S4 | — | ⛔ bloqueada |

**Risk**: ítem 1 (cambio de esquema persistido) e ítem 3 (contrato que consumen los otros
subsistemas). T1 no ejecuta DDL sobre datos: la migración es T2.

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