# 05 — Laboratorio Bioquímico (DIAG): catálogos, ficha clínica, análisis y resultados

**Objetivo**: implementar el subsistema DIAG (13 UCE) empezando por lo que no depende de
ninguna decisión pendiente: el catálogo clínico, que además desbloquea el selector de «tipo
de análisis» de REC y DIAG.
**Rama**: `main` (repo sin remoto).
**Estrategia de entrega**: commits por work unit.
**Runner**: `pytest` + `ruff check` + `ruff format --check` (backend); `vitest` + `tsc --noEmit`
+ `vite build` (frontend).

**Estado**: abierto el 2026-11-16. Inventario y clasificación de pantallas en
`odd/design/diag-draft.md` (pasos 0-2). T1 entregada; T2 en curso; el resto bloqueado por
huecos de esquema registrados en el borrador §5.

---

## Specs

### S1 — Catálogo clínico: tipos de análisis y tipos de muestra

> **UCE–DIAG-10** (nivel 1, §2.8.2): «El Administrador gestiona el catálogo de tipos de
> análisis micológicos y de tipos de muestra disponibles en el sistema (crear, modificar,
> desactivar)». Precondición: «sesión activa con rol de Administrador». Excepción del paso 6:
> «Si se intenta desactivar un tipo con análisis históricos, el sistema aplica baja lógica
> conservando los registros». Postcondición: «Los tipos desactivados no pueden seleccionarse en
> nuevos análisis, pero se preservan en registros históricos». RF-16, IRQ-05.

Nivel 3 (`modelo_esquema_bd_sigemi.md` L204-233): `tipo_analisis` y `tipo_muestra` tienen la
misma forma —`nombre varchar unique`, `descripcion text`, `estado varchar` (activo/inactivo)—
y `tipo_analisis_tipo_muestra` es la relación N:N que habilita la combinación admitida.

**Endpoints** (`/api/v1`):

| Método | Ruta | Rol | UCE |
|---|---|---|---|
| `GET` | `/tipos-analisis` | bioquimico, administrador | 10 pasos 1-2 (selector y listado) |
| `POST` | `/tipos-analisis` | administrador | 10 subflujo Crear |
| `PATCH` | `/tipos-analisis/{id}` | administrador | 10 subflujo Modificar |
| `POST` | `/tipos-analisis/{id}/baja` | administrador | 10 subflujo Desactivar |
| `GET`·`POST`·`PATCH`·`POST /baja` | `/tipos-muestra` | idem | idem |

**Reglas y su aplicación**:

| Regla | Clase | Origen | Dónde |
|---|---|---|---|
| Sólo administrador escribe | R2 | precondición de UCE-DIAG-10 | `require_roles("administrador")` |
| Bioquímico y administrador leen | R2 | UCE-DIAG-02 (selector de muestra) y REC-10 (selector de tipo) | `require_roles("bioquimico","administrador")` |
| El nombre no puede estar vacío | R3 | paso 5 («coherencia de los datos») | `400` + `campo="nombre"` |
| El nombre es único en su catálogo | R3 | nivel 3 `unique`; paso 5 y su excepción | pre-check + traducción del `IntegrityError` a `400` + `campo="nombre"`, insensible a mayúsculas |
| La baja es lógica | R1 | excepción del paso 6 y postcondición | `estado = inactivo`, la fila queda |
| Desactivar dos veces no duplica auditoría | R1 | idempotencia | segunda llamada responde `200` sin fila nueva |
| Listado con sobre y orden estable | R4 | contrato de `AGENTS.md` | `{items,total,limit,offset}`, ordenado por nombre |

**Supuestos registrados** (el nivel 1 no los fija):

- **A1** — La unicidad del nombre se compara sin distinguir mayúsculas. El nivel 3 sólo dice
  `unique`; se adopta el mismo criterio que el correo de `usuario` (normalización, no colación),
  porque «Cultivo de uñas» y «cultivo de uñas» son el mismo tipo para quien lo usa. Decide: el
  integrador, 2026-11-16.
- **A2** — La baja no exige motivo. UCE-DIAG-10 no lo pide (a diferencia de REC-19 o DIAG-08,
  que sí lo exigen explícitamente); agregarlo sería inventar una regla.
- **A3** — `descripcion` es opcional y se limpia mandando cadena vacía, no `null`: el `PATCH`
  serializa con `exclude_none=True` y descartaría el `null` en silencio.
- **A4** — Auditoría: `crear` al alta, `modificar` a la edición y a la baja, con
  `modulo="catalogos"`. RF-14 pide eventos «significativos o críticos» y un cambio de catálogo
  lo es.

**Fuera de alcance**: la relación N:N `tipo_analisis_tipo_muestra` (la exige UCE-DIAG-02 para
registrar un análisis, no este catálogo); reactivar un tipo desactivado (ninguna UCE lo pide).

### S2 — Ficha clínica (pendiente, bloqueada por G1)

No se especifica hasta que se resuelva qué claves admite `dato_clinico` (`diag-draft.md` §5.1).

---

## Screens

Inventario y clasificación completos en `odd/design/diag-draft.md` §3: **7 pantallas únicas**
sobre 13 UCE.

| Pantalla | Nombre | Patrón | Estado |
|---|---|---|---|
| **DIAG-U01** | Panel de Análisis | P1 | sin especificar (depende de G4) |
| **DIAG-U02** | Detalle de análisis | P2 con acciones | sin especificar (depende de G2, G3) |
| **DIAG-U03** | Ficha clínica (alta/edición) | P3 | **bloqueada por G1** |
| **DIAG-U04** | Ficha clínica (detalle) | P2 | bloqueada por G1 |
| **DIAG-U05** | Ingreso de muestra | P3 | sin especificar (depende de G5) |
| **DIAG-U06** | Catálogo clínico | **P6** | especificación en T2 |
| **DIAG-U07** | Portal de resultados (público) | P3 | bloqueada por WhatsApp/PDF |

**P6 no existe todavía en el sistema**: `screen-design-plan.md` §3 lo define (catálogo simple:
tabla + alta/edición en línea) pero ninguna pantalla lo construyó. DIAG-U06 es la primera, así
que T2 fija el patrón.

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Backend del catálogo clínico: `tipos-analisis` y `tipos-muestra` con las cuatro operaciones, unicidad traducida a `400` + `campo`, baja lógica idempotente y auditoría | S1 | inline (integrador) | ✅ (L2) |
| T2 | DIAG-U06: especificación con la plantilla del plan y pantalla del catálogo (patrón P6, primeras dos tablas y el editor en línea) | S1 | — | ⏳ |
| T3 | Backend de ficha clínica y análisis | S2 | — | ⛔ bloqueada por G1-G3, G5 |
| T4 | DIAG-U01 Panel de Análisis (P1) y DIAG-U02 detalle con sus seis acciones | S1 | — | ⛔ bloqueada por G2-G4 |

**Risk**: T1 → **item 3** (contrato nuevo que consumen REC-U08/U09 y, después, las pantallas de
análisis). No toca esquema, datos existentes ni migraciones.

---

## Log

### L1 — Origen y decisión de por dónde entrar (2026-11-16)

El dueño pidió el frontend listo y delegó las decisiones de gate. Al cerrar la derivación de
los cinco subsistemas quedó claro que **casi ninguna pantalla restante se puede construir**:
LAB necesita ediciones a los niveles 1-3 que `AGENTS.md` prohíbe hacer desde este repo, DIAG
necesita cinco huecos de esquema y REP dos decisiones de negocio, y ninguno de los tres tiene
backend.

El único corte que no depende de nada es el **catálogo clínico**: `tipo_analisis` y
`tipo_muestra` existen en el nivel 3, su UCE está completa, no requiere migración (la tabla y
sus columnas ya están) y desbloquea tres cosas: el selector de tipo de análisis de REC-U08,
el de tipo de muestra de DIAG-U02, y el filtro que REC-U11 tuvo que dejar afuera.

Verificado antes de empezar: `SELECT count(*)` sobre `tipo_analisis` = **0** y sobre
`tipo_muestra` = **0** en la base de desarrollo. Sin catálogo cargado no hay forma de completar
un formulario que exige «tipo de análisis obligatorio», así que el backend va primero.

### L2 — T1: backend del catálogo clínico (2026-11-16)

**Superficie implementada** (`/api/v1`, autenticada):

| Método | Ruta | UCE-DIAG-10 |
|---|---|---|
| `GET` | `/tipos-analisis` · `/tipos-muestra` | pasos 1-2: listado con sobre, filtros `q` y `estado`, orden por nombre |
| `POST` | ídem | subflujo Crear: nombre normalizado, único, estado `activo` |
| `PATCH` | ídem `/{id}` | subflujo Modificar: sólo los campos enviados; `PATCH` vacío `400` |
| `POST` | ídem `/{id}/baja` | subflujo Desactivar: `estado=inactivo`, idempotente, la fila sobrevive |

**Archivos**: `app/schemas/catalogos.py`, `app/services/catalogos.py`,
`app/api/v1/catalogos.py`, `app/api/v1/router.py` (una línea de wiring),
`tests/test_rec_catalogos.py` (14 casos).

**Decisiones de contrato**:

1. **Un solo juego de schemas para dos catálogos**: nivel 3 les da la misma forma. Se reutilizan
   las reglas (`normalizar_nombre`, `nombre_en_uso`, `rechazo_nombre_duplicado`) en lugar de
   duplicarlas por catálogo.
2. **La unicidad se compara con `ilike`**, no con igualdad: «Cultivo de uñas» y «cultivo de
   uñas» son el mismo tipo para quien lo usa (A1). El pre-check evita el `500`; la carrera se
   traduce igual a `400` + `campo="nombre"`, con el mismo patrón que el correo de `usuario`.
3. **La baja es lógica e idempotente** (A2): la fila queda porque el nivel 3 dice que los tipos
   desactivados «se preservan en registros históricos», y una segunda llamada no agrega
   auditoría.
4. **Lectura para bioquímico y administrador, escritura sólo administrador**: el bioquímico
   necesita el catálogo para elegir el tipo de muestra (UCE-DIAG-02) y el de análisis
   (UCE-REC-10), pero no lo administra.
5. **`descripcion` se limpia con cadena vacía** (A3): mismo aprendizaje que el hallazgo F-001 de
   la revisión del frontend.

**Evidencia observada** desde `backend/`: `pytest tests/test_rec_catalogos.py` → **14 passed**;
`ruff check .` → `All checks passed!`; `ruff format --check .` → `64 files already formatted`.

**Suites completas y un hallazgo de entorno, no de código**: `pytest -q` sobre todo el backend
falla 9 casos de `tests/test_usuarios.py` porque **cuentan filas absolutas** (`total == 2`,
`count() == 2`) y en la base de desarrollo `sigemi` apareció una fila que no creó este cambio:
`admin@sigemi.local`, `fecha_registro = 2026-11-17 01:08`, con el árbol de trabajo sin tocar
`usuarios`. Es la base compartida que `AGENTS.md` describe; el suite asume una base limpia. No
se borró la fila (cuenta ajena, posiblemente sembrada a mano por el dueño) y no se ajustaron
los tests para tapar la diferencia: se reporta. Para un baseline limpio, el suite debe correr
contra la base de un carril (`database-per-lane`, `AGENTS.md` §Parallel execution).
