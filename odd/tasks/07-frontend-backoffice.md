# 07 — Integración del frontend back-office como frontend de SIGEMI

Objective: replace the project frontend UI with the screens of the delivered
back-office repository, integrated against the real backend, keeping every mock
dataset the backend cannot serve.
Branch: `feat/frontend-backoffice`. Delivery: single PR slice per work unit.
Test runners: `npm test` / `npx tsc --noEmit` / `npm run lint` / `npm run build`
in `frontend/`; `pytest` and `ruff check .` in `backend/`.

## Specs

- **S1** — The frontend of the project is the UI from
  `Back-office laboratory dashboard (copia) (1).zip`. The previously built UI
  (features, pages, shell) is replaced. Verbatim: «No importa el trabajo que
  anteriormente se hizo de frontend, necesito las pantallas del repositorio que
  te pase como frontend del proyecto.»
- **S2** — Every screen of that repository is reachable and renders:
  Panel de Control, Agenda y Turnos, Pacientes (listado, perfil, alta, edición),
  Panel de Análisis, Ficha Clínica, Detalle de Análisis, Carga de Resultados,
  Resultados, Insumos y Stock, Control de Residuos, Reportes y Estadísticas,
  Usuarios y Roles, Auditoría.
- **S3** — The session is real: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`,
  bearer token kept across reloads, logout, and unauthenticated access never
  reaches an application screen.
- **S4** — Verbatim: «los datos que se muestran en el nuevo repositorio necesito
  que se muestren, no importa que sean datos hardcodeados o mockeados.» A screen
  with no backend endpoint keeps the prototype's seed data and stays fully
  interactive.
- **S5** — Verbatim: «integralo con el backend.» A screen whose subsystem has a
  v1 endpoint reads and writes through it: pacientes, análisis (ciclo de
  estados, validación), fichas clínicas, catálogos, usuarios, roles, auditoría
  and reportes clínicos.
- **S6** — Verbatim: «Si encuentras inconsistencias con las fuentes de verdad,
  tienes autoridad para tomar decisiones que concilien la documentación junto con
  el sistema.» Each reconciliation is recorded under Assumptions, citing the
  source-of-truth level it is consistent with.
- **S7** — Gates green and reported: `npx tsc --noEmit`, `npm run lint`,
  `npm test`, `npm run build` in `frontend/`; `pytest` and `ruff check .` in
  `backend/` when the backend changes.
- **S8** — Language contract: domain vocabulary and UI copy in Spanish (es-AR);
  identifiers, type names, comments and file names in English.

### Assumptions

- **A1** — `ocupacion` (patient occupation) has no column in level 3
  (`modelo_esquema_bd_sigemi.md`, table `paciente`). It is removed from the
  patient form instead of being shown as a field that cannot persist.
- **A2** — `sexo` **is** a level-3 column (`paciente.sexo`) and exists in
  `app/models/clinical.py`, but the API hid it citing gap G13. Level 3 wins, so
  the API exposes it additively (`PacienteRead` / `PacienteCreate` /
  `PacienteUpdate`) and the form persists it. No migration: the column already
  exists.
- **A3** — Agenda y Turnos, Insumos y Stock, Control de Residuos and Reportes y
  Estadísticas have no v1 endpoints (level 1 backs them, `app/models/agenda.py`,
  `inventory.py`, `waste.py`, `reports.py` exist, no router). They keep the
  prototype seed data per S4.
- **A4** — The prototype's fixed "today" (`19/10/2026`) is kept for mock-derived
  screens; screens fed by the backend use real dates.
- **A5** — The prototype's role-simulation switcher is replaced by the
  authenticated user's real roles; visibility per role keeps the prototype's
  `PAGES_BY_ROLE` mapping translated to the closed role catalog
  (`bioquimico`, `profesor`, `administrador`).

## Screens

Derived from the delivered repository (`src/App.tsx` + `src/sigemi/*`), backed
by UCE-REC, UCE-LAB, UCE-REP and UCE-SEG where a backend endpoint exists.

| Screen | Pattern | Data source |
|---|---|---|
| Login | formulario | `POST /auth/login`, `GET /auth/me` |
| Panel de Control | panel de KPIs | derived from `/analisis` + `/pacientes`; agenda mock |
| Agenda y Turnos | listado + detalle | mock (A3) |
| Pacientes | listado con filtros / detalle / formulario | `/pacientes` |
| Panel de Análisis | listado con filtros | `/analisis` |
| Ficha Clínica | flujo multi-paso | `/fichas-clinicas`, `/catalogos` |
| Detalle de Análisis | detalle + máquina de estados | `/analisis/{id}` |
| Carga de Resultados | formulario | `/analisis/{id}` |
| Resultados | listado | `/analisis` (informes/OTP mock) |
| Insumos y Stock | listado + stock | mock (A3) |
| Control de Residuos | listado + formulario | mock (A3) |
| Reportes y Estadísticas | panel de KPIs + historial | mock (A3) |
| Usuarios y Roles | listado / formulario | `/usuarios`, `/roles` |
| Auditoría | listado + detalle | `/auditoria` |

## Tasks

| ID | Spec | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1,S2,S4 — shell, screens, tokens, seed | inline | done | — |
| T2 | S3,S8 — real session in shell + sidebar | inline | done | — |
| T3 | S5 — patients read/write against `/pacientes` | inline | done | — |
| T4 | S5 — audit read + detail against `/auditoria` | inline | done | — |
| T5 | S5 — clinical pipeline + users wiring | inline | **blocked** (A-17): backend model gap, owner decision | — |
| T6 | S6,S7 — documentation and gates | inline | done | — |

## Log

### L1 — Original request (verbatim, 2026-11-17)

> en la siguiente dirección "C:\Users\Jorge Kluka\Documents\Facultad\TF 2026\Back-office laboratory dashboard (copia) (1).zip" tienes un repositorio con un Frontend CASI COMPLETO. Necesito que ese sea el frontend de mi sistema, entonces, necesito que integres ese frontend en mi sistema, integralo con el backend. No importa el trabajo que anteriormente se hizo de frontend, necesito las pantallas del repositorio que te pase como frontend del proyecto. Si encuentras inconsistencias con las fuentes de verdad, tienes autoridad para tomar decisiones que concilien la documentación junto con el sistema. NECESITO que integres el sistema, toma las decisiones necesarias. Asi mismo, los datos que se muestran en el nuevo repositorio necesiton que se muestren, no importa que sean datos hardcodeados o mockeados.

### L2 — Lectura de la entrega y del backend (2026-11-17)

La entrega es `figma-make-app` (React 19 + Vite + Tailwind 4, sin backend): 17 archivos de
pantalla, ~6.800 líneas, navegación por un único `activePage` y datos en stores globales
sembrados en memoria. Trae las 12 pantallas del menú (el `RESUMEN_NAVEGACION.md` que declara 5
pendientes está desactualizado: `src/sigemi/` ya contiene Insumos, Residuos, Reportes, Usuarios y
Auditoría).

El backend expone 11 routers (`auth`, `usuarios`, `roles`, `auditoria`, `pacientes`,
`lista-espera`, `catalogos`, `indicaciones-medicas`, `fichas-clinicas`, `analisis`, `reportes`)
con 134 rutas, y `frontend/src/api/` ya tenía los clientes tipados de todas ellas. Eso permite
integrar sin reescribir contratos.

La costura elegida es el store: cada pantalla lee un store global, así que un módulo
`frontend/src/data/` hidrata ese store desde la API y traduce entre los dos modelos, sin editar la
pantalla salvo en los puntos donde ya había un callback de escritura.

### L3 — Evidencia de los checks (2026-11-17)

Frontend (`frontend/`):

- `npx tsc --noEmit`: sin errores.
- `npm run lint`: sin errores.
- `npm test`: 4 archivos, 21 pruebas en verde (16 heredadas de la capa API/sesión y 5 nuevas de
  humo: panel inicial, listado de pacientes, auditoría, recorrido de los 12 módulos sin
  excepción y ocultamiento de Administración para un rol no administrador).
- `npm run build`: compila; 522 kB de bundle (aviso de tamaño, no error).

Backend (`backend/`):

- `pytest tests/test_rec_pacientes.py`: 30 pruebas en verde, incluidas las dos aserciones que
  fijaban la ausencia de `sexo` y la prueba nueva de ida y vuelta de `sexo` en alta y edición.
- `pytest` completo: 500 recolectadas, 491 en verde, 9 en rojo.
- `ruff check .` y `ruff format --check .`: sin errores, 80 archivos ya formateados.

**Las 9 fallas de `tests/test_usuarios.py` son ambientales, no una regresión de esta entrega.**
Todas son conteos de filas sobre `usuario` (`3 == 2`, `2 == 1`) y la base de desarrollo tiene una
fila ya comprometida fuera de las pruebas: `admin@sigemi.local`, creada en una sesión anterior para
poder entrar al sistema (no hay alta de primer administrador en la API). Verificado con el
`backend/` de esta rama revertido por `git stash`: `test_list_returns_pagination_envelope` falla
igual sin los cambios. La fila no se borra: es la cuenta con la que el dueño inicia sesión.

### L4 — Correcciones de comportamiento en la entrega (2026-11-17)

Dos defectos visibles del repositorio entregado se corrigieron, porque una pantalla que muestra un
control que no hace nada es peor que el demo:

1. El filtro por fecha del Panel de Análisis se renderizaba y nunca se leía: el predicado sólo
   miraba estado, muestra y bioquímico. Ahora compara `dd/mm/yyyy` contra el `yyyy-mm-dd` del
   `<input type="date">`.
2. El selector de rol del sidebar era una simulación del prototipo (`roleStore` con tres usuarios
   ficticios). Se reemplazó por los roles reales de `GET /auth/me` y la acción «Cerrar sesión».

### L5 — Puesta en marcha documentada y primer acceso (2026-11-17)

El `README.md` describía un monorepo sin frontend y sin forma de entrar al sistema. Se reescribió
con las tres terminales (base y Redis, backend, frontend), los puertos reales, los comandos de
verificación de ambos lados y una sección de primer acceso.

El primer acceso era un hueco real: no hay autorregistro y `POST /usuarios` exige un administrador
ya autenticado, así que una base recién migrada no se puede usar. Se agregó
`backend/scripts/crear_admin.py` (idempotente, con `--reset-contrasena` para recuperar una clave
olvidada o reactivar una cuenta bloqueada). No es una migración a propósito: `AGENTS.md` prohíbe
credenciales y hashes dentro de una migración.

Evidencia del script: se creó una cuenta de prueba, `POST /api/v1/auth/login` respondió `200`,
`GET /api/v1/auth/me` devolvió el usuario con `roles: ["administrador"]`, `--reset-contrasena`
cambió la clave y el login volvió a responder `200`. La cuenta de prueba se borró junto con sus
dos eventos de auditoría; la tabla `usuario` volvió a tener sólo `admin@sigemi.local`.

### L6 — Qué queda abierto (2026-11-17)

T5 queda bloqueada por decisión del dueño, no por capacidad: ver A-17 en
`odd/DECISIONES-AUTONOMAS.md`. Las dos extensiones que la cierran son (1) el catálogo clínico de
la ficha (A-04) y (2) el perfil profesional dentro de `UsuarioRead`. Ninguna de las dos se puede
tomar desde acá sin editar una fuente de verdad.
