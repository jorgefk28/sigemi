# Borrador de diseño de pantallas — REC (Gestión de Pacientes y Turnos)

> Estado: pasos 0-2 del plan de diseño. Pendiente: paso 3 (especificación por pantalla)
> y paso 4 (revisión humana). No es la sección `## Screens` del feature doc.

## 1. Alcance y fuentes

Este borrador cubre **sólo los pasos 0, 1 y 2** de `odd/design/screen-design-plan.md`
para el subsistema REC. No especifica pantallas (paso 3), no implementa nada y no
propone layouts. Su única salida es el inventario derivado y su clasificación.

### 1.1 Fuentes leídas y de dónde sale cada dato

| Nivel | Archivo | Sección / líneas | Qué se tomó |
|---|---|---|---|
| 1 | `TF_2026_Requerimientos_KLUKA_JORGE.md` | §2.5 Requisitos Funcionales, L181-307 | RF-01..RF-21 (sólo se citan los que respaldan UCE-REC) |
| 1 | idem | §2.6 Requisitos No Funcionales, L308-338 | RNF-01 (agente 24/7), RNF-03 (mobile-first del portal), RNF-04 (retención 10 años) |
| 1 | idem | §2.7.2 Definición de Actores, L351-370 | ACT-01 Bioquímico/Doctor, ACT-02 Profesor, ACT-03 Administrador, ACT-04 Paciente |
| 1 | idem | §2.7.3.1 Subsistema Gestión de Pacientes, L373-604 | Tabla de UC–REC-01..24, 27, 28, 29, S-01 (pre/postcondiciones) |
| 1 | idem | §2.8.1 Casos de Uso Extendidos, L938-1622 | Secuencias normales, excepciones, rendimiento, frecuencia de los 28 UCE–REC |
| 2 | `Diagramas/modelo_dominio_sigemi_unificado.md` | §6.2 (L214-217) | Roles cerrados y acumulables |
| 3 | `Diagramas/modelo_esquema_bd_sigemi.md` | §Tablas L32-198; §Catálogos L200-230; §Agenda y Atención L231-345; §Índices L349-368; `auditoria`/`cambio_auditoria` L572-601 | Nombres exactos de tablas y columnas |

### 1.2 Los roles (nivel 2 §6.2)

> «los roles son **prefijados y cerrados** (`Profesional`, `Profesor`, `Administrador`)
> y **acumulables** (un `Usuario` opera con uno o más). El usuario no modela roles
> propios ni modifica privilegios.» (L217)

**Divergencia de nomenclatura, a resolver antes del paso 3.** El mismo rol aparece con
tres nombres: nivel 1 ACT-01 dice «Bioquímico / Doctor» (L352), nivel 2 §6.2 dice
`Profesional` (L217) y `AGENTS.md` fija el catálogo `bioquimico` / `profesor` /
`administrador`. En este borrador se escribe **Bioquímico/Doctor** para nombrar al
actor y se deja constancia de que la especificación de pantalla necesita el string
exacto del catálogo cerrado (`bioquimico`), no una traducción libre.

### 1.3 Conteo real de UCE

El subsistema REC tiene **28 UCE, no 30**. `UC-REC-25` y `UC-REC-26` **no existen** en
el nivel 1: la numeración salta de 24 a 27 tanto en la tabla (§2.7.3.1) como en los
extendidos (§2.8.1). No se inventan dos filas para completar la serie.

Los 28 son: 01-24, 27, 28, 29 y S-01. De ellos, **9 no generan pantalla** (§2), y 19
se reparten en **11 pantallas únicas** (§3).

## 2. Inventario derivado (UCE → pantalla → patrón)

**Cómo leer la tabla.** Una fila por UCE. La columna `excepciones` **transcribe el texto
del nivel 1 sin reescribirlo**; el número indica el paso al que pertenece y `·` separa
excepciones distintas. Las comillas internas son las del documento original. Las líneas
entre paréntesis remiten al bloque del UCE en §2.8.1 (L938-1622), que es donde están las
excepciones; las pre/postcondiciones se contrastaron con §2.7.3.1 (L373-604).

`pantalla: ninguna` significa que el UCE no nombra ni implica una pantalla. No es un
hueco: es el canal del UCE (WhatsApp o proceso automático).

| uce | nombre | actor | canal | pasos | excepciones | postcondición | entidades | pantalla | patrón |
|---|---|---|---|---|---|---|---|---|---|
| REC-01 (L939-964) | Agendar Turno | Paciente (ACT-04) | WhatsApp/paciente | 1 pide turno; 2 agente pide DNI y Nombre Completo; 3 ingresa datos; 4 consulta agenda y bloquea 10 min; 5 elige horario; 6 registra y reserva; 7 confirma y envía indicaciones; 8 encola recordatorio | 3: Si el formato del DNI es inválido, el sistema solicita su reingreso iterando este paso. · 5: Si transcurren más de 10 minutos sin respuesta, el sistema libera el bloqueo horario y notifica la cancelación de la solicitud. · 4: Si no hay turnos disponibles, el sistema informa y ofrece suscribirse a alertas de cancelación. | turno registrado y reservado; confirmación e indicaciones enviadas; recordatorio encolado | `paciente`, `turno`, `espacio_atencion`, `configuracion_agenda`, `indicacion_medica` | ninguna | — |
| REC-02 (L966-986) | Cancelar Turno | Paciente (ACT-04) | WhatsApp/paciente | 1 solicita cancelación; 2 agente pide DNI; 3 elige turno; 4 estado "Cancelado" y libera bloque; 5 confirma; 6 dispara REC-04 | 1: Si el turno es dentro de las próximas 24 horas, el sistema informa la imposibilidad de cancelación por políticas del laboratorio y aborta el flujo. | turno "Cancelado", espacio liberado, REC-04 disparado | `turno`, `oferta_reagendacion` | ninguna | — |
| REC-03 (L988-1011) | Reprogramar Turno | Paciente (ACT-04) | WhatsApp/paciente | 1 solicita reprogramar; 2 valida políticas y lista turnos; 3 elige turno; 4 muestra disponibilidad, bloquea 10 min; 5 elige fecha/hora; 6 actualiza y libera original; 7 confirma; 8 dispara REC-04 | 2: Si el turno está a menos de 24 hs, o ya se reprogramó 2 veces, el sistema informa el rechazo por políticas internas y finaliza la acción. · 5: Si hay Timeout (10 min) en la elección, el sistema cancela el flujo sin modificar el turno original. | turno original liberado, nuevo bloque asignado | `turno`, `oferta_reagendacion` | ninguna | — |
| REC-04 (L1013-1035) | Reasignación Automática de Turno Liberado | Sistema (sin actor) | sistema/automático | 1 busca turno más lejano válido; 2 valida ventana nocturna 22:00-08:00; 3 envía oferta; 4 temporizador 2 horas; 5 paciente acepta; 6 reprograma y libera hueco lejano; 7 recursión | 2: Si es horario nocturno, el sistema pausa la ejecución y programa el envío del mensaje para las 08:00 AM del día siguiente. · 5: Si el paciente rechaza o expira el plazo (2 horas), el sistema registra la negativa y reenvía la oferta al siguiente paciente lejano. | turno reprogramado con confirmación, o negativa registrada y oferta reenviada | `turno`, `oferta_reagendacion`, `paciente` | ninguna | — |
| REC-05 (L1037-1055) | Consultar Turno | Paciente (ACT-04) | WhatsApp/paciente | 1 solicita información; 2 agente pide DNI; 3 recupera turnos; 4 emite resumen y reenvía indicaciones | 3: Si el DNI ingresado no posee turnos vigentes, el Agente IA informa la inexistencia de registros activos y ofrece agendar uno nuevo. | resumen emitido; estado sin modificaciones (sólo lectura) | `turno`, `paciente`, `indicacion_medica` | ninguna | — |
| REC-06 (L1057-1075) | Consultar Agenda | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 ingresa a Gestión de Agenda; 2 consulta bloques ocupados y libres; 3 renderiza grilla diaria/semanal/mensual; 4 aplica filtros DNI y estado | ninguna | grilla presentada con filtros; lectura con acciones de gestión | `turno`, `paciente`, `espacio_atencion`, `bloqueo_agenda`, `periodo_inhabilitado`, `configuracion_agenda` | **REC-U01** | no encaja (§5 G15) |
| REC-07 (L1077-1100) | Configurar Parámetros de Agenda | Administrador (ACT-03) | back-office | 1 Gestión de Agenda → "Configuración"; 2 despliega formulario con valores actuales; 3 define días y horarios; 4 duración e intervalo; 5 períodos de receso; 6 "Guardar Configuración"; 7 valida y persiste; 8 audita; 9 "Configuración guardada exitosamente" | 7: Si los horarios ingresados son inconsistentes (ej. hora de fin menor a hora de inicio), el sistema muestra una alerta de validación y no persiste los cambios. | parámetros almacenados y aplicados al cálculo de disponibilidad | `configuracion_agenda`, `periodo_inhabilitado`, `tipo_bloqueo`, `usuario`, `auditoria` | **REC-U10** | P3 |
| REC-08 (L1102-1124) | Bloquear Días y Franjas Horarias | Administrador (ACT-03) | back-office | 1 calendario → "Bloquear Día/Franja"; 2 muestra calendario mensual; 3 selecciona día o rango; 4 elige día completo o franja; 5 motivo y "Confirmar Bloqueo"; 6 valida sin turnos activos; 7 marca NO DISPONIBLE; 8 audita | 6: Si existen turnos activos en el período, el sistema notifica al Administrador y ofrece opciones para cancelar o reprogramar los turnos afectados antes de aplicar el bloqueo. | días o franjas marcados NO DISPONIBLES | `bloqueo_agenda`, `tipo_bloqueo`, `turno`, `usuario`, `auditoria` | **REC-U01** (modo bloqueo) | no encaja (§5 G15) |
| REC-27 (L1126-1148) | Desbloquear Días y Franjas Horarias | Administrador (ACT-03) | back-office | 1 calendario → "Desbloquear Día/Franja"; 2 muestra calendario con bloqueos; 3 selecciona día o rango; 4 elige día completo o franja; 5 "Confirmar Desbloqueo"; 6 valida que esté bloqueado; 7 marca DISPONIBLE; 8 audita | 6: Si el día o franja no está bloqueado, el sistema informa y no realiza cambios. | días o franjas nuevamente DISPONIBLES | `bloqueo_agenda`, `usuario`, `auditoria` | **REC-U01** (modo desbloqueo) | no encaja (§5 G15) |
| REC-09 (L1150-1172) | Alta Temprana de Paciente | Paciente (ACT-04) vía Agente IA | WhatsApp/paciente | 1 agente pide DNI y Nombre Completo; 2 ingresa datos; 3 valida formato DNI; 4 confirma que no existe; 5 crea paciente "Activo"; 6 audita; 7 retorna a REC-01 | 3: Si el formato del DNI es inválido, el sistema solicita su reingreso. · 4: Si el DNI ya existe, el sistema retorna el paciente existente a UC-REC-01 y no crea un duplicado. | paciente creado con DNI y Nombre Completo, estado "Activo" | `paciente`, `auditoria` | ninguna | — |
| REC-10 (L1175-1196) | Crear Indicación Médica | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 módulo → "Nueva Indicación"; 2 formulario Título, Contenido, Tipo de Análisis; 3 completa y "Guardar"; 4 valida obligatorios; 5 vincula tipo de análisis; 6 persiste; 7 "Indicación creada exitosamente" | 4: Si el contenido está vacío o no se seleccionó un Tipo de Análisis, el sistema muestra una alerta de validación y no persiste. | indicación registrada y disponible para turnos futuros | `indicacion_medica`, `tipo_analisis` | **REC-U08** (alta) | P3 |
| REC-11 (L1198-1217) | Modificar Indicación Médica | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 módulo y selecciona del listado; 2 formulario prepoblado; 3 modifica y "Guardar Cambios"; 4 valida y actualiza; 5 "Indicación actualizada exitosamente" | 4: Si el contenido queda vacío, el sistema rechaza la modificación y notifica al usuario. | indicación actualizada con el nuevo contenido | `indicacion_medica`, `tipo_analisis` | **REC-U08** (edición) | P3 |
| REC-12 (L1219-1239) | Eliminar Indicación Médica | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 módulo y selecciona del listado; 2 "Eliminar"; 3 sistema pide confirmación; 4 usuario confirma; 5 estado INACTIVA; 6 "Indicación eliminada exitosamente" | 4: Si el usuario cancela la confirmación, el sistema aborta la operación sin modificar el registro. | indicación marcada INACTIVA (baja lógica) | `indicacion_medica` | **REC-U09** (acción de fila) | P1 |
| REC-13 (L1241-1259) | Consultar Indicaciones Médicas | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 módulo de Indicaciones Médicas; 2 recupera todas; 3 tabla paginada Título, Contenido, Tipo de Análisis, Estado; 4 filtros por estado y tipo | 2: Si no existen indicaciones registradas, la interfaz muestra el mensaje "No hay indicaciones médicas registradas" y habilita el botón para crear una nueva. | listado paginado presentado; sólo lectura | `indicacion_medica`, `tipo_analisis` | **REC-U09** | P1 |
| REC-14 (L1261-1281) | Cancelar Turno por Vencimiento | Sistema (sin actor) | sistema/automático | 1 temporizador dispara rutina diaria al cierre; 2 recupera turnos vencidos "Confirmado"/"Pendiente"; 3 marca "No Asistió"; 4 libera bloque; 5 audita; 6 dispara REC-04 | 2: Si no hay turnos en esas condiciones, la rutina finaliza sin realizar cambios. | turnos vencidos en "No Asistió", bloques liberados | `turno`, `oferta_reagendacion`, `auditoria` | ninguna | — |
| REC-15 (L1283-1313) | Registrar Asistencia a Turno | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 localiza turno del día; 2 selecciona y "Registrar Asistencia"; 3 diálogo "Presente"/"Ausente"; 4 elige; 5 "Atendido" y hora; 6 formulario ligero si faltan datos demográficos; 7 audita; 8 habilita consulta | 2: Si el turno ya fue marcado previamente, el sistema informa y bloquea la acción. | turno "Atendido" o "No Asistió" según corresponda | `turno`, `paciente`, `auditoria` | **REC-U01** (diálogo) + **REC-U05** (modo completar) | no encaja (U01) / P3 (U05) |
| REC-16 (L1315-1337) | Registrar Paciente | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 módulo "Pacientes" → "Nuevo Paciente"; 2 formulario DNI, Nombre, Apellido, Fecha de Nacimiento, Teléfono, Correo Electrónico, Dirección, Obra Social; 3 completa obligatorios y "Guardar"; 4 valida DNI único; 5 persiste "Activo"; 6 "Paciente registrado exitosamente" | 4: Si el DNI ya existe, el sistema notifica "El paciente ya se encuentra registrado", muestra los datos existentes y ofrece modificarlos (REC-17) o cancelar. · 5: Si ocurre un error de conexión con la base de datos, el sistema muestra un error 500 y aborta la transacción sin guardar datos parciales. | paciente registrado "Activo", disponible para turnos y consultas | `paciente` | **REC-U05** (alta) | P3 |
| REC-17 (L1339-1367) | Modificar Paciente | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 "Buscar Paciente"; 2 ejecuta S-01 (DNI, Nombre o Apellido); 3 ingresa criterio; 4 consulta; 5 listado paginado si hay múltiples; 6 formulario prepoblado; 7 modifica y "Guardar Cambios"; 8 valida; 9 actualiza; 10 "Datos actualizados exitosamente"; 11 audita | 4: Si no se encuentra ningún paciente con el criterio ingresado, el sistema muestra "Paciente no encontrado" y ofrece crear uno nuevo (REC-16). · 8: Si el DNI modificado ya pertenece a otro paciente, el sistema rechaza el cambio y notifica "El DNI ingresado ya corresponde a otro paciente". · 9: Si hay error de base de datos, se aborta la transacción sin guardar cambios parciales. | datos del paciente actualizados; cambio auditado | `paciente`, `auditoria` | **REC-U05** (edición) + **REC-U06** (búsqueda) | P3 |
| REC-18 (L1369-1391) | Consultar Paciente | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 módulo "Pacientes"; 2 listado paginado de todos; 3 filtros DNI, Nombre, Apellido, Estado; 4 consulta; 5 selecciona paciente; 6 vista detallada: Datos Personales, Historial de Consultas, Análisis Micológicos, Resultados | 4: Si no hay pacientes registrados, la interfaz muestra "No hay pacientes registrados" y habilita el botón para crear uno nuevo (REC-16). · 4: Si ningún paciente coincide con los filtros, se muestra "No se encontraron pacientes con los criterios ingresados". | perfil completo presentado; sólo lectura | `paciente`, `ficha_clinica`, `dato_clinico`, `analisis_micologico`, `hallazgo_analisis`, `informe_resultados` | **REC-U06** + **REC-U07** | P1 + P2 |
| REC-19 (L1393-1421) | Desactivar Paciente | Administrador (ACT-03) | back-office | 1 "Buscar Paciente"; 2 ejecuta S-01; 3 ingresa criterio; 4 recupera y muestra; 5 "Desactivar Paciente"; 6 diálogo pide motivo obligatorio; 7 ingresa motivo y confirma; 8 verifica sin turnos vigentes futuros; 9 estado "Inactivo"; 10 audita con usuario, fecha, motivo, paciente; 11 "Paciente desactivado exitosamente" | 4: Si el paciente no existe, el sistema informa "Paciente no encontrado" y finaliza. · 8: Si el paciente tiene turnos vigentes futuros, el sistema muestra la lista de turnos activos y solicita al Administrador cancelarlos antes de permitir la desactivación. · 9: Si ocurre un error de base de datos, se aborta la transacción sin modificar el estado del paciente. | paciente "Inactivo"; historial conservado; no admite nuevos turnos | `paciente`, `turno`, `auditoria` | **REC-U07** (acción) + **REC-U06** (búsqueda) | P2 + P1 |
| REC-20 (L1423-1450) | Agendar Turno Manualmente | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 Gestión de Agenda → "Nuevo Turno"; 2 sistema pide DNI; 3 ingresa DNI; 4 busca paciente; 5 muestra grilla de disponibilidad; 6 selecciona fecha, horario, tipo de análisis; 7 "Confirmar Turno"; 8 registra "Confirmado"; 9 notifica WhatsApp; 10 encola recordatorio; 11 audita; 12 "Turno registrado exitosamente" | 4: Si el DNI no existe en el sistema, se dispara la extensión UC-REC-16 (Registrar Paciente). Al completar el registro exitosamente, se retorna al paso 5. · 6: Si la franja seleccionada fue ocupada entre la consulta y la confirmación, el sistema notifica "El horario seleccionado ya no está disponible" y muestra la grilla actualizada. | turno registrado, reservado y paciente notificado | `turno`, `paciente`, `espacio_atencion`, `configuracion_agenda`, `indicacion_medica`, `auditoria` | **REC-U02** (desde REC-U01) | P3 |
| REC-21 (L1452-1478) | Cancelar Turno Manualmente | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 Gestión de Agenda; 2 localiza turno en calendario o buscador DNI; 3 selecciona y "Cancelar Turno"; 4 diálogo "¿Está seguro de cancelar el turno de [Paciente] el [fecha] a las [hora]?"; 5 confirma; 6 "Cancelado"; 7 libera bloque; 8 notifica WhatsApp; 9 ejecuta REC-04; 10 audita; 11 "Turno cancelado exitosamente" | 2: Si el turno está a menos de 24 horas de su horario, el sistema muestra una advertencia y requiere confirmación explícita adicional. · 5: Si el usuario cancela la confirmación, se aborta la operación sin modificar el turno. | turno cancelado, bloque liberado, paciente notificado, REC-04 disparado | `turno`, `oferta_reagendacion`, `auditoria` | **REC-U01** (diálogo) | no encaja (§5 G15) |
| REC-22 (L1480-1508) | Reprogramar Turno Manualmente | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 Gestión de Agenda; 2 localiza turno en calendario o buscador; 3 selecciona y "Reprogramar"; 4 verifica no más de 2 reprogramaciones; 5 muestra grilla de disponibilidad; 6 elige nueva fecha y hora; 7 valida franja; 8 actualiza; 9 libera bloque original; 10 notifica WhatsApp; 11 ejecuta REC-04; 12 audita; 13 "Turno reprogramado exitosamente" | 4: Si el turno ya fue reprogramado 2 veces, el sistema muestra una advertencia y requiere confirmación del Administrador. · 7: Si la nueva franja fue ocupada entre la consulta y la confirmación, el sistema notifica y solicita una nueva selección. | turno actualizado, bloque original liberado, paciente notificado | `turno`, `espacio_atencion`, `oferta_reagendacion`, `auditoria` | **REC-U04** (desde REC-U01) | P3 |
| REC-23 (L1510-1532) | Agregar Paciente a Lista de Espera | Paciente (ACT-04) vía Agente IA | WhatsApp/paciente | 1 solicita turno; 2 agente no encuentra disponibilidad; 3 informa y ofrece lista de espera; 4 paciente acepta; 5 registra con fecha de solicitud; 6 audita; 7 confirma inscripción | 4: Si el paciente rechaza, el sistema finaliza el flujo sin registrarlo. · 5: Si el paciente ya está en la lista, el sistema informa y no duplica el registro. | paciente en lista de espera con fecha de solicitud y prioridad | — (sin tabla, §5 G1) | ninguna | — |
| REC-24 (L1534-1557) | Agendar Serie de Turnos | Bioquímico/Doctor o Administrador (ACT-01/03) | back-office | 1 Gestión de Agenda → "Nuevo Turno Seriado"; 2 pide DNI y tipo de análisis; 3 ingresa datos y cantidad de tomas; 4 calcula disponibilidad por toma; 5 selecciona fechas y horarios; 6 registra y vincula; 7 confirma y envía indicaciones; 8 audita | 4: Si no hay disponibilidad para alguna toma, el sistema informa y solicita ajustar las fechas. · 6: Si una franja se ocupa entre la consulta y la confirmación, el sistema rechaza la serie y solicita una nueva selección. | turnos de la serie registrados y vinculados entre sí | `turno`, `paciente`, `espacio_atencion`, `indicacion_medica`, `auditoria` | **REC-U03** | P3 |
| REC-28 (L1559-1580) | Quitar Paciente de Lista de Espera | Administrador (ACT-03) | back-office | 1 ingresa a la lista de espera; 2 muestra lista por prioridad; 3 selecciona y "Quitar"; 4 sistema pide confirmación; 5 confirma; 6 quita; 7 audita | 4: Si el Administrador cancela la confirmación, el sistema no modifica la lista. | paciente fuera de la lista de espera | — (sin tabla, §5 G1) | **REC-U11** (acción de fila) | P1 |
| REC-29 (L1582-1600) | Consultar Lista de Espera | Administrador (ACT-03) | back-office | 1 ingresa a la lista de espera; 2 consulta y ordena por prioridad; 3 filtros por tipo de análisis y fecha de solicitud; 4 muestra lista actualizada | 2: Si la lista está vacía, el sistema informa "No hay pacientes en lista de espera". | lista de espera presentada; sólo lectura | — (sin tabla, §5 G1) | **REC-U11** | P1 |
| REC-S-01 (L1602-1622) | Buscar Paciente | sin actor propio (include-only) | back-office | 1 sistema pide criterio (DNI, Nombre o Apellido); 2 usuario ingresa; 3 consulta; 4a una coincidencia, retorna; 4b múltiples, listado paginado y retorna la elegida | 3: Si ningún paciente coincide con el criterio ingresado, el sistema informa "Paciente no encontrado" al caso de uso invocante para que maneje la situación (ofrecer crear uno nuevo, buscar de nuevo, etc.). · 3: Si ocurre un error de conexión con la base de datos, se retorna un error al caso de uso invocante. | datos del paciente seleccionado retornados al UCE invocante | `paciente` | ninguna (reusa **REC-U06**) | — |

**Reparto por canal**: back-office 20 UCE (06, 07, 08, 27, 10, 11, 12, 13, 15, 16, 17,
18, 19, 20, 21, 22, 24, 28, 29, S-01) · WhatsApp/paciente 6 (01, 02, 03, 05, 09, 23) ·
sistema/automático 2 (04, 14).

**Reparto por pantalla**: 19 UCE generan o tocan pantalla; **9 quedan en `ninguna`**
(01, 02, 03, 04, 05, 09, 14, 23, S-01).

**Los 6 UCE exclusivamente WhatsApp** son REC-01, 02, 03, 05, 09 y 23. Ninguno tiene
pantalla de back-office: el paciente chatea, y el alta temprana (REC-09) es un
`<<include>>` de REC-01, no un flujo de operador. Esto es la mitad del alcance del
subsistema y **no produce ninguna pantalla**.

**Verificación de no invención.** Cada `pantalla` de la tabla puede citar el paso que la
nombra: REC-U01 en REC-06 paso 1 («ingresa al módulo de Gestión de Agenda en la
interfaz web») y paso 3 («renderiza la grilla»); REC-U02 en REC-20 paso 1 («presiona
"Nuevo Turno"»); REC-U03 en REC-24 paso 1 («selecciona "Nuevo Turno Seriado"»);
REC-U04 en REC-22 paso 3-5 («"Reprogramar"» → «muestra la grilla de disponibilidad»);
REC-U05 en REC-16 paso 2 y REC-17 paso 6 («formulario de registro» / «formulario
pre-poblado»); REC-U06 en REC-18 paso 2 («listado paginado»); REC-U07 en REC-18 paso 6
(«vista detallada»); REC-U08 en REC-10 paso 2 y REC-11 paso 2 («formulario»);
REC-U09 en REC-13 paso 3 («tabla paginada»); REC-U10 en REC-07 paso 2 («formulario de
configuración»); REC-U11 en REC-29 paso 4 («muestra la lista»).

## 3. Agrupación: pantallas únicas y qué UCE cubre cada una

**11 pantallas únicas** para 19 UCE con pantalla. Ninguna pantalla se dedujo de un
resumen, de un conteo ni de un artefacto previo: todas salen de un paso que la nombra.

| Pantalla | Nombre | Patrón | UCE que cubre | Actor que entra |
|---|---|---|---|---|
| **REC-U01** | Gestión de Agenda (grilla de turnos) | **P7** (resuelto, §5 G15) | REC-06 (1-4), REC-08 (1-8), REC-27 (1-8), REC-15 (1-3), REC-20 (1), REC-21 (1-4), REC-22 (1-3) | Bioquímico/Doctor o Administrador; el bloqueo/desbloqueo sólo Administrador |
| **REC-U02** | Alta de turno manual | P3 | REC-20 (2-12) | Bioquímico/Doctor o Administrador |
| **REC-U03** | Alta de serie de turnos | P3 | REC-24 (1-8) | Bioquímico/Doctor o Administrador |
| **REC-U04** | Reprogramar turno | P3 | REC-22 (4-13) | Bioquímico/Doctor o Administrador |
| **REC-U05** | Formulario de paciente (alta/edición) | P3 | REC-16 (2-6), REC-17 (6-11), REC-15 (6, modo completar) | Bioquímico/Doctor o Administrador |
| **REC-U06** | Listado de pacientes | P1 | REC-18 (1-5), REC-17 (1-5), REC-19 (1-4), REC-S-01 (4b) | Bioquímico/Doctor o Administrador |
| **REC-U07** | Detalle de paciente | P2 | REC-18 (6), REC-19 (5-11) | Bioquímico/Doctor o Administrador; desactivar sólo Administrador |
| **REC-U08** | Formulario de indicación médica (alta/edición) | P3 | REC-10 (2-7), REC-11 (2-5) | Bioquímico/Doctor o Administrador |
| **REC-U09** | Listado de indicaciones médicas | P1 | REC-13 (1-4), REC-12 (1-6), REC-11 (1), REC-10 (1) | Bioquímico/Doctor o Administrador |
| **REC-U10** | Configuración de agenda | P3 | REC-07 (1-9) | Administrador |
| **REC-U11** | Lista de espera | P1 | REC-29 (1-4), REC-28 (1-7) | Administrador |

**Reparto por patrón**: P3 ×6 (U02, U03, U04, U05, U08, U10) · P1 ×3 (U06, U09, U11) ·
P2 ×1 (U07) · P7 ×1 (U01). **P4, P5 y P6 no aparecen en REC.**

### 3.1 Decisiones de clasificación, con su justificación

1. **REC-U01 no encaja en ninguno de los seis patrones y no se fuerza.** P1 describe
   «tabla y acciones por fila»; REC-06 paso 3 pide literalmente «la grilla de turnos
   (vista diaria/semanal/mensual)» y REC-08 paso 2 pide «el calendario mensual con los
   turnos existentes». Una grilla temporal no es una tabla: el eje es el tiempo, no una
   fila paginada. Se reporta como hueco de patrón (§5 G15) y no se implementa hasta que
   se decida. Forzarla a P1 produciría una tabla que el requisito no pide.

2. **Alta y edición comparten pantalla, no se duplican.** P3 se define como
   «formulario de alta/edición»; REC-16 y REC-17 usan el mismo conjunto de campos
   (`paciente`). Se cuentan como una sola pantalla en dos modos. La única regla que
   depende del modo es de REC-17: la Fecha de Nacimiento no se edita si el paciente ya
   tiene análisis (L1367).

3. **REC-U02 y REC-U03 son pantallas distintas con el mismo patrón.** REC-24 entra por
   «Nuevo Turno Seriado», un botón distinto del «Nuevo Turno» de REC-20, y agrega
   «cantidad de tomas requeridas» con N selecciones de horario. Es una instancia P3 con
   grupo de campos repetible, no un patrón nuevo. Si al especificar el paso 3 resulta
   ser la misma pantalla en dos modos, se fusiona sin costo: el patrón ya está construido.

4. **REC-U11 no es P6 aunque sea «lista».** P6 es «catálogo simple (tabla + alta/edición
   en línea)» para tablas de catálogo del nivel 3. La lista de espera no es catálogo
   —además no existe como tabla (§5 G1)— y su operación es ordenar por prioridad y
   quitar, no editar en línea. Es P1.

5. **REC-U09 no es P6.** `indicacion_medica` no es una tabla de catálogo: la referencia
   `turno.indicacion_medica_id`, tiene baja lógica y su alta/edición vive en pantalla
   propia (REC-10/11 pasos 1-2). Listado P1 + formulario P3, igual que pacientes.

6. **REC-U10 es P3 y no P6.** `configuracion_agenda` es un singleton («la config es un
   singleton que "rige" la agenda», nivel 3 L290), no una tabla con N filas. Un
   formulario de edición con validación es P3.

7. **Ninguna pantalla es P4.** P4 exige «estados sucesivos (muestra → ejecución →
   validación)», es decir, una entidad que persiste su avance. Ningún UCE-REC lo hace:
   el asistente de REC-20 y el de REC-24 son formularios con revelación progresiva
   dentro de una sesión, sin estado persistido entre pasos. Declarar P4 aquí
   duplicaría el patrón sin necesidad.

8. **Ninguna pantalla es P5.** El «panel de control» de RF-09 y RF-15 pertenece al
   subsistema de Reportes y Estadísticas (UC de §2.7.3.5), no a REC. No se importa.

## 4. Dependencias externas

REC no puede especificarse ni implementarse aislado. Cada dependencia se declara con su
origen; ninguna se asume resuelta.

| # | Dependencia | Qué necesita REC | Origen |
|---|---|---|---|
| D1 | **Agente IA + WhatsApp Business API** | Es el único canal de REC-01, 02, 03, 05, 09, 23. Sin él, 6 de 28 UCE no existen. Además REC-20, 21, 22 y 24 **envían notificación** por ese canal como postcondición. | RF-01 (L185), RF-04 (L203), RNF-01 (L313) |
| D2 | **Catálogo `tipo_analisis` y `tipo_muestra`** | REC-10 (paso 2) exige «Tipo de Análisis asociado (obligatorio)»; REC-20 (paso 6) y REC-24 (paso 2) seleccionan tipo de análisis. Ese catálogo lo gobierna RF-16 / UC-DIAG-10, del subsistema clínico, que **no tiene feature doc todavía**. | RF-16 (L275), nivel 3 L202-229 |
| D3 | **`auditoria` / `cambio_auditoria`** | 14 de los 28 UCE escriben auditoría (07, 08, 27, 09, 14, 15, 17, 19, 20, 21, 22, 23, 24, 28). El catálogo cerrado de `accion` es de SEG. | RF-14 (L263), nivel 3 L572-600 |
| D4 | **UC-DIAG-01 (iniciar consulta)** | REC-15 paso 8 «habilita el botón para iniciar la consulta (UC-DIAG-01)». La pantalla de agenda entrega el control a otro subsistema. | L1297 |
| D5 | **`informe_resultados`, `hallazgo_analisis`, `analisis_micologico`** | REC-18 paso 6 muestra «Análisis Micológicos con su estado, Resultados». REC es de sólo lectura sobre ellos. | L1381, nivel 3 L127-188 |
| D6 | **`usuario` con rol** | Toda pantalla de back-office exige sesión y rol. REC-19, 28, 29, 07, 08, 27 son Administrador; el resto, Bioquímico/Doctor o Administrador. | Nivel 2 §6.2, ACT-01/03 |

## 5. Huecos y requisitos faltantes

**16 huecos.** Se separan por naturaleza: lo que falta en el esquema, lo que falta en el
nivel 1, las contradicciones entre niveles y el hueco de patrón. Ninguno se resuelve
aquí; se reportan.

### 5.1 Huecos de esquema (nivel 3 no tiene la tabla o columna)

| # | Hueco | UCE afectado | Evidencia |
|---|---|---|---|
| **G1** | No existe tabla de **lista de espera**. REC-23, 28 y 29 operan sobre «la lista de espera» con «fecha de solicitud y prioridad», y el nivel 3 no tiene `lista_espera` ni equivalente. | REC-23, 28, 29 | L1514, L1563, L1586; nivel 3 L32-198 (ausente) |
| **G2** | `turno` **no tiene `tipo_analisis_id`**. REC-20 paso 6 hace seleccionar «fecha, horario disponible, tipo de análisis» y REC-24 paso 2 «el DNI del paciente y el tipo de análisis». El tipo sólo sería alcanzable vía `indicacion_medica.tipo_analisis_id`, que es nullable y no es lo mismo que el estudio del turno. | REC-20, REC-24 | L1435, L1542; nivel 3 L87-101 |
| **G3** | No hay vínculo de **serie de turnos**. REC-24 postcondición: «vinculados entre sí». `turno` no tiene `serie_id` ni tabla de grupo. | REC-24 | L1549; nivel 3 L87-101 |
| **G4** | **`prioridad` no está definida.** REC-23, 28 y 29 ordenan «por prioridad (fecha de solicitud y tipo de análisis)» pero ningún nivel define el cálculo ni la columna. | REC-23, 28, 29 | L1524, L1567, L1586 |
| **G5** | El **motivo obligatorio de desactivación** del paciente no tiene dónde guardarse. `paciente` no tiene columna de motivo y `auditoria` no tiene campo de texto libre (`cambio_auditoria` sólo guarda `campo`/`valor_anterior`/`valor_nuevo`). | REC-19 | L1405, L1409; nivel 3 L34-49, L572-600 |
| **G6** | El **motivo de inasistencia** (opcional) no tiene columna. `turno` tiene `motivo_cancelacion` y `motivo_reprogramacion`, ninguno nombrado para inasistencia. | REC-15 | L1301; nivel 3 L100 |
| **G7** | **`turno.profesional_id` es obligatorio y ningún UCE-REC lo asigna.** REC-01/20/24 crean turnos sin elegir profesional; `disponibilidad_profesional` existe pero no hay paso que la use. | REC-01, 20, 24 | nivel 3 L94; L946-953, L1429-1441, L1540-1546 |

### 5.2 Requisitos faltantes (nivel 1 silencioso, nivel 3 con tabla)

| # | Hueco | Evidencia |
|---|---|---|
| **G8** | **REC-23 tiene una vía manual sin secuencia.** La descripción dice «El Administrador puede agregar manualmente a un paciente que lo solicite por teléfono o en el laboratorio» (L1514, L566) pero la secuencia normal es 100% del Agente IA. Sin pasos no hay pantalla derivable: no se inventa un alta manual en REC-U11. | L1514, L1516-1523 |
| **G9** | **No se sabe qué columnas de `paciente` son opcionales.** REC-15 paso 6 dispara un «formulario ligero» si faltan «dirección, obra social, etc.», y el nivel 3 no marca NOT NULL en ninguna columna de `paciente`. «Datos demográficos incompletos» es hoy indecidible. | L1295; nivel 3 L34-49 |
| **G10** | **`periodo_inhabilitado` y `bloqueo_agenda` se solapan sin criterio.** REC-07 paso 5 hace definir «períodos de receso o inhábiles (feriados fijos, receso académico)» y REC-08 bloquea «días completos o franjas». Dos tablas para «inhabilitar agenda», sin regla de cuál escribe cada pantalla. | L1088, L1106-1116; nivel 3 L277-304 |
| **G11** | **`bloqueo_agenda.espacio_id` y `grupo_espacio_id` no tienen UCE que los use.** REC-08 bloquea días y franjas, nunca espacios. Capacidad del nivel 3 sin respaldo en el nivel 1. | nivel 3 L298-299; L1111-1113 |
| **G12** | **Cinco tablas de agenda no tienen UCE que las gobierne**: `disponibilidad_profesional`, `ausencia_profesional`, `espacio_atencion`, `grupo_espacio`, `tipo_bloqueo`. `ausencia_profesional.reprogramacion_aplicada` («si ya disparó la oferta de reagendación») implica un flujo de ausencias que el nivel 1 no tiene. No se construye: se reporta. | nivel 3 L233-330 |
| **G13** | **`numero_registro` y `sexo` no aparecen en ningún UCE.** `numero_registro` es `unique` y el formulario de REC-16 no lo pide; `sexo` existe en la tabla y no en los campos del formulario. | nivel 3 L39, L43; L1323 |

### 5.3 Contradicciones entre niveles

| # | Contradicción | Resolución propuesta |
|---|---|---|
| **G14** | `indicacion_medica.tipo_analisis_id` es **nullable** en el nivel 3 (L110), pero REC-10 paso 2 lo exige **obligatorio** y su excepción rechaza el alta sin él (L1191). | Nivel 1 gana: la columna debe ser NOT NULL, o el formulario debe explicar por qué admite nulo. Es defecto del nivel 3. |

### 5.4 Hueco de patrón

| # | Hueco | Justificación |
|---|---|---|
| **G15** | **Falta el patrón «calendario / grilla temporal».** REC-U01 es la pantalla más cargada del subsistema (7 UCE) y no encaja en P1: su unidad de presentación es un bloque de tiempo con vistas diaria, semanal y mensual, no una fila de tabla. El plan §3 anticipa este caso («o el patrón falta») y manda decidirlo explícitamente. **Resuelto el 2026-11-16: ver §7.** | REC-06 paso 3, REC-08 paso 2 |

### 5.5 Observación menor (no bloquea)

**G16** — La auditoría no es uniforme entre UCE-REC: 14 la incluyen como paso explícito
y 14 no (01, 02, 03, 04, 05, 06, 10, 11, 12, 13, 16, 18, 29 y S-01). RF-14 pide registrar
«cada evento significativo o crítico», sin enumerarlos. Al especificar, cada pantalla
debe declarar si audita o no; no se deduce del silencio del UCE.

## 6. Patrones a construir primero

El plan §9 pide dos pantallas que definan el patrón (una P1 y una P3) antes de instanciar
el resto. Para REC el orden es:

1. **P1 — REC-U06 Listado de pacientes.** Es el patrón más reutilizado (3 pantallas:
   U06, U09, U11) y el que fija la convención de `{items, total, limit, offset}`,
   `limit` 20 / tope 100, filtros nombrados como la columna (`dni`, `nombre`, `apellido`,
   `estado`) y `q` para búsqueda libre. Además REC-U06 ya sirve a tres UCE distintos
   (18, 17, 19) vía REC-S-01, así que su contrato se valida solo.

2. **P3 — REC-U05 Formulario de paciente.** Es el patrón más numeroso (6 pantallas) y el
   que fija el mensaje por campo (`{"detail": "...", "campo": "..."}`), el 409 de unicidad de DNI
   («El paciente ya se encuentra registrado», L1330) y la regla de modo que sólo aplica
   en edición (Fecha de Nacimiento bloqueada si hay análisis, L1367). Es el formulario
   más exigente del subsistema: si soporta REC-16/17, los demás son instancias menores.

3. **P2 — REC-U07 Detalle de paciente.** Una sola instancia, pero es la que prueba que
   P2 puede hospedar acciones con permiso distinto (Editar para Bioquímico/Doctor y
   Administrador; Desactivar sólo Administrador, REC-19). Barato después de P1.

4. **REC-U01 Gestión de Agenda: no implementar hasta resolver G15.** Es la pantalla más
   costosa y su patrón no existe. Antes de escribir una línea hay que decidir si se
   agrega un séptimo patrón «calendario» o si el requisito admite una vista de tabla
   —decisión que el nivel 1 no autoriza a tomar por analogía, porque REC-06 paso 3 dice
   «grilla». Sin esa decisión, REC-15, 20, 21 y 22 quedan bloqueadas: todas entran por
   esa pantalla.

5. **REC-U11 Lista de espera: bloqueada por G1.** No hay tabla, no hay definición de
   prioridad y REC-23 no tiene secuencia manual. Diseñarla hoy sería inventar el modelo.

**Orden sugerido de instanciación después de los patrones**: U09 (P1, ya probado con
U06) → U08 (P3, ya probado con U05) → U10 (P3) → U02 y U04 (P3) → U03 (P3 con grupo
repetible, la única que agrega algo al patrón).

---

## 7. Resoluciones posteriores

### R1 — G15: se agrega el patrón P7 «grilla temporal» (2026-11-16)

`odd/design/screen-design-plan.md` §3 pasa de seis a siete patrones. **REC-U01 Gestión de
Agenda** se especifica como **P7**, no como P1 ni como dos pantallas.

- **Por qué un patrón nuevo y no P1**: la unidad de REC-U01 es un bloque de tiempo. Una
  tabla ordenada por fecha no responde la pregunta que la pantalla existe para responder
  («qué hay libre y qué está ocupado») y no puede expresar el bloqueo de una franja
  (UCE–REC-08), que es un rango sobre el eje temporal, no una fila.
- **Por qué no dos pantallas**: las vistas diaria, semanal y mensual son la misma pantalla
  con distinto zoom. Son un control, no dos pantallas distintas.
- **Qué comparte con P1**: los datos y las acciones por bloque. **Qué cambia**: el eje.