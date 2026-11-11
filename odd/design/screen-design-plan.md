# Plan de diseño de pantallas y sus reglas

Procedimiento para diseñar una pantalla y sus reglas antes de implementarla.
Vive en este repo porque es procedimiento de implementación, no un requisito.

## 1. Principio

Una pantalla no se dibuja: se deriva. Cada elemento responde a una regla del nivel 1
o a una restricción del nivel 3. **Si una decisión de la pantalla no puede citar su
origen, no es diseño: es invención.**

No existen especificaciones previas de pantallas no entregadas. No hay guía que
reutilizar, ni prototipo que copiar, ni inventario heredado. Todo se deriva.

## 2. Orden de trabajo por subsistema

| Paso | Qué se hace | Salida |
|---|---|---|
| 0 | Leer los UCE del subsistema, los RF/RNF que citan, las entidades del nivel 3 y los roles del nivel 2 §6.2 | Insumos, sin interpretar todavía |
| 1 | Derivar el inventario: qué pantallas exige cada UCE | Tabla `UCE → pantalla → patrón` |
| 2 | Clasificar cada pantalla en un patrón (§3) | Patrón asignado |
| 3 | Especificar cada pantalla con la plantilla (§4) | Sección `## Screens` del feature doc |
| 4 | Revisión humana de 3 minutos por pantalla, sobre 3 campos (§6) | Aprobación registrada en `## Log` |
| 5 | Implementar la primera pantalla de cada patrón | Patrón construido |
| 6 | Instanciar el resto del mismo patrón | Sin rediseño |

El paso 1 **no inventa pantallas**. Si un UCE no nombra una pantalla, no hay pantalla.
Si una pantalla "hace falta" pero ningún UCE la respalda, es un requisito faltante:
se reporta, no se diseña.

## 3. Los seis patrones

| Código | Patrón | Cuándo |
|---|---|---|
| P1 | Listado con filtros, tabla y acciones por fila | El UCE dice "el sistema lista" / "busca" |
| P2 | Detalle de solo lectura con acciones | "El sistema muestra el detalle" |
| P3 | Formulario de alta/edición con validación | "El sistema solicita los datos" |
| P4 | Flujo multi-paso con estado persistido | El UCE describe estados sucesivos (muestra → ejecución → validación) |
| P5 | Panel de KPIs | "Resumen", "panel", "indicadores" |
| P6 | Catálogo simple (tabla + alta/edición en línea) | Tablas de catálogo del nivel 3 |

Una pantalla que no encaja en ningún patrón es señal de alarma: o son dos pantallas,
o el patrón falta. En ese caso se decide explícitamente y se anota la justificación,
no se fuerza el encaje.

## 4. Plantilla de especificación

Obligatoria. Una pantalla sin estos campos no está diseñada.

```markdown
### SEG-U01 · Listado de usuarios

- **Patrón**: P1
- **Respaldo**: UCE-SEG-02, pasos 1-3 (L2367-2376); RF-13
- **Actor y permiso**: administrador. Backend: `require_roles("administrador")`
- **Ruta y entrada**: Sidebar → Administración → Usuarios y Roles
- **Zonas**: header con breadcrumb y acciones; barra de filtros; tabla; paginación

**Datos** (nombre exacto del nivel 3)

| Columna | Campo | Origen |
|---|---|---|
| Nombre y apellido | `nombre` + `apellido` | `usuario` |
| Correo | `correo_electronico` | `usuario` |
| Rol | `rol.nombre` vía `usuario_rol` | `rol` |
| Estado | `estado` (activo / inactivo) | `usuario` |

**Acciones**

| Acción | Endpoint | Habilitada cuando | Efecto |
|---|---|---|---|
| Nuevo usuario | `POST /usuarios` | siempre (admin) | abre SEG-U02 |
| Editar | `PATCH /usuarios/{id}` | siempre (admin) | abre SEG-U02 |
| Desactivar | `POST /usuarios/{id}/baja` | `id != usuario_actual.id` | `estado = inactivo` |

**Estados**

| Estado | Qué se muestra |
|---|---|
| Vacío | "Sin usuarios registrados" + acción Nuevo |
| Cargando | esqueleto de tabla, nunca números |
| Error | "No se pudieron cargar los usuarios" + Reintentar |
| Sin permiso | redirección al inicio, no un 403 crudo |

**Reglas y excepciones**

| Regla | Clase | Origen | Dónde se aplica |
|---|---|---|---|
| Correo único | R3 | UCE-SEG-02 exc. paso 6 | backend 409 + mensaje en campo |
| El admin no puede desactivarse a sí mismo | R1 | UCE-SEG-02 exc. paso 7 | backend 400 + acción oculta |
| Solo administrador accede | R2 | Nivel 2 §6.2 | `require_roles` |

**Fuera de alcance**: crear o editar roles (son cerrados, UCE-SEG-02 comentarios).
```

## 5. Las cuatro clases de regla

Toda regla de una pantalla pertenece a una de estas clases, y cada clase tiene un
lugar distinto donde se aplica y se prueba. Si una regla no se puede clasificar, la
especificación está incompleta: se pregunta, no se asume.

| Clase | Qué es | Dónde se aplica | Cómo se prueba |
|---|---|---|---|
| **R1 — Negocio** | Una excepción o postcondición del UCE | Backend manda; la UI la refleja | Test de backend sobre la regla |
| **R2 — Permiso** | Quién puede ver o hacer | Backend `require_roles`; la UI solo oculta | Test de autorización (403) |
| **R3 — Validación de dato** | Formato, longitud, unicidad, obligatoriedad | Backend valida; la UI muestra el mensaje por campo | Test de backend con el valor inválido |
| **R4 — Presentación** | Orden, formato de fecha, texto de estado vacío | Solo UI | Test de comportamiento (texto/visibilidad) |

Dos corolarios que se olvidan siempre:

- **La UI nunca es la autoridad de una regla R1, R2 o R3.** Ocultar un botón no es
  autorizar: el backend valida igual.
- **Una regla R4 no se testea como negocio.** Si sentís que hay que testear "que el
  botón esté azul", es R4 y no importa.

## 6. Revisión humana: 3 minutos por pantalla

Solo se leen tres campos. Si esos tres están bien, la pantalla está bien.

1. **Respaldo** — ¿cita un UCE con paso o un RF? Si no, se rechaza.
2. **Reglas y excepciones** — ¿aparecen todas las excepciones del UCE? Si falta una,
   es un agujero funcional.
3. **Acciones** — ¿cada acción tiene endpoint o está declarada fuera de alcance? Si
   hay un botón sin regla, se rechaza.

Lo demás (layout, colores, espaciado) se resuelve con los componentes existentes y no
necesita revisión: ya está decidido.

## 7. Anti-patrones

- **Botón sin regla**: "queda útil". Se elimina o se reporta el requisito faltante.
- **Pantalla sin actor**: si no sabés quién la usa, no sabés qué permisos lleva.
- **Estado vacío con datos de ejemplo**: nunca. El vacío se muestra vacío.
- **Diseñar 30 pantallas antes de implementar una**: cascada. Se diseña por iteración.
- **Copiar una guía o prototipo viejo**: está prohibido por `AGENTS.md`.
- **Regla sin clase R1-R4**: está sin definir.

## 8. Dónde vive y cómo se aprueba

- La especificación va en `odd/tasks/<feature>.md`, sección `## Screens`, entre
  `## Specs` y `## Tasks`.
- La aprobación es explícita del usuario y se registra en `## Log` con fecha.
- Una pantalla aprobada no se rediseña durante la implementación. Si aparece un
  problema, se reporta y se decide: no se "ajusta sobre la marcha".

## 9. Secuencia recomendada

Por iteración: **dos pantallas** que definan el patrón (una P1 y una P3, por ejemplo).
Se implementan, se corrigen los defectos del patrón, y recién entonces se instancian
las demás del mismo patrón sin volver a diseñar.

El primer patrón es el más caro y el más importante: define la tabla, el formulario,
los mensajes de error y los estados que después se repiten treinta veces.
