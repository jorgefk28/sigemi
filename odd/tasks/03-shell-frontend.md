# 03 — Shell del frontend: autenticación real y layout de la SPA

**Objetivo**: habilitar la entrada real al sistema desde el navegador — login contra el backend ya testeado, restauración de sesión, cierre de sesión, y el armazón de navegación (sidebar + header + cuerpo) con el Panel de Control como pantalla de aterrizaje, según el prototipo de Figma.
**Rama**: `main`.
**Estrategia de entrega**: commits por work unit en `main` (repo sin remoto).
**Runner**: `vitest` (frontend) + `tsc --noEmit` + `vite build`.

---

## Specs

### S1 — Scaffold de la SPA

React + TypeScript + Vite en `frontend/`, con Tailwind 4 (el prototipo de diseño lo usa: `"tailwindcss": "^4.0.0"`, `"@tailwindcss/vite": "^4.0.0"`). Proxy de desarrollo `/api` → `http://localhost:8000` y base configurable por `VITE_API_BASE_URL` (default `/api/v1`). No se persisten secretos en el bundle.

### S2 — Login real (nivel 1: UC-SEG-01, RF-13)

> **UC‑SEG‑01 Iniciar Sesión** — *Postcondiciones*: "El sistema valida las credenciales y redirige al usuario al panel principal (dashboard) con las opciones habilitadas segǧn su rol predefinido."

El contrato del backend (ya testeado, `backend/app/api/v1/auth.py`) es **form-urlencoded**, no JSON:

- `POST /api/v1/auth/login` con `OAuth2PasswordRequestForm`: campos `username` (correo) y `password`.
- Respuesta `Token`: `{ "access_token": str, "expires_in": int }` (segundos).
- `GET /api/v1/auth/me` → `UsuarioRead`: `id`, `nombre`, `apellido`, `correo_electronico`, `estado`, `roles: list[str]`.

Mensajes al usuario, exactamente los del backend cuando exista `detail`:

| Estado | `detail` del backend |
|---|---|
| 401 | `Credenciales inválidas` |
| 403 | `Usuario inactivo` |
| 423 | `Usuario bloqueado temporalmente` |

Sin conexión: `No se pudo conectar con el servidor`. Durante el envío: `Ingresando...`.

### S3 — Restauración y expiración de sesión

Al arrancar, si hay token guardado se consulta `GET /api/v1/auth/me`; si responde 401/403 se descarta el token y se muestra el login. El token vive en `sessionStorage` (no `localStorage`): se pierde al cerrar la pestaña y no queda en disco.

### S4 — Cerrar sesión (nivel 1: UC‑SEG‑03)

> *Postcondiciones*: "El sistema invalida la sesion, cerrando el acceso a las pantallas internas y redirigiando al usuario a la pantalla de inicio de sesión."

El cierre es local (descarta token y usuario, vuelve al login). **Limitación conocida**: el backend todavía no expone revocación ni `logout` (work unit 02, advisory 4: "JWT sin `jti` ni revocación"); el token emitido sigue siendo válido hasta su expiración. Se documenta, no se simula.

### S5 — Gating de navegación por rol (nivel 1 + nivel 2 §6.2)

Roles cerrados del backend: `bioquimico`, `profesor`, `administrador`. El prototipo define `PAGES_BY_ROLE` con nombres visibles; la implementación mapea **códigos** a las mismas páginas:

| Rol | Páginas visibles |
|---|---|
| `administrador` | todas |
| `bioquimico` | Panel de Control, Agenda y Turnos, Pacientes, Análisis, Resultados, Insumos y Stock, Control de Residuos, Reportes y Estadísticas |
| `profesor` | Insumos y Stock, Control de Residuos |

Verificado contra nivel 1: el Profesor solo participa en casos de uso de insumos y residuos (ACT‑02 y UC de retiro/devolución/disposición); no aparece en agenda, pacientes ni análisis. El gating es de presentación: la autorización real es del backend.

**Página agregada por el nivel 1 (2026-11-16)**: `Lista de Espera` (`/lista-espera`, grupo
`Principal`, `roles: []` → sólo administrador). No está en el prototipo porque el prototipo no
tiene esa pantalla, pero UCE-REC-29 la exige y su precondición es el rol administrador, que ya
ve todas las páginas: la tabla de arriba sigue siendo correcta y ningún otro rol cambia. La
derivación está en `04-recepcion-turnos.md` §`Screens` (REC-U11) y L6 de su Log.

### S6 — Armazón visual (autoridad de presentación: Figma `X7mBlw5ZzuvAIyZXb1UVdG`, nodo `1:3`)

Del code layer del prototipo, tal cual:

- Sidebar fija de **220 px**, fondo `#1e2433`, borde derecho `#2d3650`, marca: cuadrado 28×28 `#2563eb` con "S", título `SIGEMI` 13 px bold blanco, subtítulo `Lab. Micología · UNaM` 10 px `#6b7587`.
- Grupos del menú con etiqueta 10 px, `600`, uppercase, `letter-spacing: 0.08em`, color `#6b7587`.
- Ítem: 12.5 px, padding `7px 16px`, color `#c9d1e0`; activo con fondo `#2d3650`, texto blanco `600` y borde izquierdo 2 px `#2563eb`.
- Header de **48 px** (`h-12`) sobre superficie blanca, con breadcrumb `sección / título` a la izquierda y acciones a la derecha.
- Cuerpo `flex-1 overflow-auto p-6` sobre fondo general; contenido centrado con ancho máximo 1200 px.
- Estructura del armazón: `PageShell` = sidebar + columna con header y `main` scrolleable.

### S7 — Aterrizaje: Panel de Control sin datos fabricados

El prototipo muestra KPIs, turnos y alertas con datos mock. El backend **todavía no expone** endpoints de agenda, análisis, inventario ni residuos, así que el shell renderiza el marco del panel (título, fecha, botón `Actualizar`, tarjetas de Turnos de hoy, Carga de trabajo, Próximos turnos, Alertas de stock) con **estados vacíos explícitos** (`Sin datos todavía`), nunca con números inventados. Cuando existan los endpoints, cada tarjeta se cablea sin cambiar el layout.

### S8 — Idioma

UI y mensajes al usuario en español (es‑AR). Identificadores, tipos, comentarios y nombres de archivo en inglés.

### S9 — Pruebas

Vitest + Testing Library. Como mínimo: codificación `form-urlencoded` del login, mapeo 401/403/423 a mensajes, restauración de sesión con `/me`, descarte del token ante 401, redirección a login sin sesión, y visibilidad del menú para los tres roles.

### S10 — Verde

`npx tsc --noEmit`, `npm test` y `npm run build` sin errores.

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Scaffold (Vite/TS/Tailwind), cliente de auth, store de sesión, pantalla de login, ruta protegida | S1, S2, S3, S4, S8, S9 | delegated (gentle-ai-worker) | ✅ |
| T2 | Primitivas de UI, `PageShell` (sidebar + header), gating por rol, Panel de Control con estados vacíos | S5, S6, S7, S8, S9 | delegated (gentle-ai-worker) | ✅ |
| T3 | Verificación independiente y commit del work unit | S1-S10 | delegated (gentle-ai-verify) | ✅ |

**Risk**: item 5 — se agrega un stack de build completo (Vite, React, Tailwind, Vitest) como dependencias nuevas del monorepo.

---

## Log

### L1 — Origen (verificado 2026-11-10)

> "TAREA 2: work unit 03 — shell del frontend. Figma Design file: fileKey X7mBlw5ZzuvAIyZXb1UVdG, nodo 1:3 "Back-office laboratory dashboard" (1280x1080). El MCP lo lee con create_session + get_design_context. El diseño es autoridad de PRESENTACIÓN, no de requisitos. Si contradice los niveles 1-3, gana la documentación y me lo reportás. Stack: React + TypeScript + Vite. Login real contra POST /api/v1/auth/login y GET /api/v1/auth/me (ya existen y están testeados)."

### L2 — Lectura del diseño

`get_design_context` (sesión `a70f8c5d-f043-49da-97cb-26acd38240aa`) devolvió el **code layer** del nodo `1:3`: `src/App.tsx`, `src/components/{SharedLayout,PanelControlView,AgendaView,PacientesView,FichaClinicaView,DetalleAnalisisView,ResultadosView,ui}.tsx`, `src/sigemi/{core,InsumosView,ResiduosView,ReportesView,UsuariosView,AuditoriaView}.tsx`, `RESUMEN_NAVEGACION.md` y `BRIEF_DISENO_UX_UI_SIGEMI.md`. `get_screenshot` falla: el nodo pertenece a un archivo Figma Make y la herramienta no lo soporta. La referencia visual es el code layer.

### L3 — Divergencias diseño vs fuentes de verdad (a reportar, no a "arreglar")

1. **El diseño no incluye pantalla de login.** El prototipo arranca logueado con un selector de rol mock. La pantalla de login es derivada, no diseñada; se construye con los mismos tokens del prototipo.
2. **El prototipo fabrica datos** (15 análisis, 5 turnos, 3 alertas, IPs, usuarios). El nivel 1 exige indicadores reales, pero no hay endpoints todavía: se implementan estados vacíos explícitos.
3. **El prototipo simula sesión** (`roleStore`, `SESSION_USERS`) con nombres y roles mock. Se reemplaza por `/auth/me`; el selector de rol desaparece.
4. Los nombres visibles de rol del prototipo (`Bioquímico/Doctor`) se mantienen en la UI, pero el gating usa los códigos cerrados del backend (`bioquimico`, `profesor`, `administrador`).

### L4 — Estado de partida

`frontend/` solo tenía `README.md`. 317 tests de backend verdes; los 4 commits previos con RDD quedaron revisados y con authority quemada.

### L5 — Evidencia de T2

- `npx vitest run`: **23 passed** (8 `api/auth`, 7 `session/auth`, 8 `roleGating`). `npx tsc --noEmit`: exit 0. `npm run build`: `✓ built`.
- Archivos: `components/{PageShell,Sidebar,Panel,Kpi,Btn,EmptyState}.tsx`, `features/navigation/{navigation.ts,roleGating.test.tsx}`, `features/dashboard/DashboardPage.tsx`, `features/placeholder/PlaceholderPage.tsx`, `features/shell/Shell.tsx`.
- Desvíos de presentación aceptados y su motivo: (a) el pie del sidebar usa un botón directo `Cerrar sesión` en lugar del menú desplegable del prototipo, porque el test de sesión de T1 exige ese botón accesible sin abrir un menú; (b) el breadcrumb usa el título de la página (`Estado operativo del laboratorio`) y no la etiqueta del menú, para no duplicar el texto que el test de T1 busca por coincidencia única; (c) el rótulo de la banda del panel es `Resumen`, no especificado por el diseño.
- Decisión derivada de S5 sobre el diseño: para `profesor` el aterrizaje es `Insumos y Stock`, no `Panel de Control`, porque el nivel 1 (UC-REP-02) reserva el panel a Bioquímico y Administrador. El prototipo siempre aterriza en el panel; gana la documentación.

### L6 — Verificación independiente de T3

Verificador independiente sobre el árbol de trabajo (baseline `ef51e70`). **Sin bloqueantes.** S1–S10 pass. Backend intacto: `git diff ef51e70 -- backend/` vacío; `pytest` **317 passed** en el baseline.

Probes observados:
- **Live end-to-end** contra PostgreSQL (`sigemi-db:5433`) y `uvicorn` real: JSON → 422; form con `email` → 422; `login()` real del módulo del frontend → 200 con `access_token` + `expires_in`; `/me` con Bearer → 200 con el perfil y `roles: ["bioquimico"]`; token inválido → 401 `Credenciales inválidas`; contraseña incorrecta → 401; usuario inactivo → 403 `Usuario inactivo`; bloqueado → 423 `Usuario bloqueado temporalmente`. Usuario y filas de auditoría del probe eliminados; 0 residuos.
- **Discriminación por mutación** en copia scratch: JSON en vez de form → 2 tests fallan; quitar `Bearer ` → 2 fallan; no descartar la sesión ante 401/403 → 3 fallan; desactivar el bypass de `administrador` → 1 falla.
- Scratch del verificador: `C:\Users\Jorge Kluka\AppData\Local\Temp\opencode\scratch-verifier-d13b731e` (se elimina fuera del repo).

Probes durables incorporados: `backend/tests/test_auth_contract.py` (3 tests) y `frontend/src/api/auth.contract.test.ts` (1 test).

Cierre de gates: `pytest` **320 passed**; `vitest` **24 passed**; `tsc --noEmit` exit 0; `vite build` ✓.

### L7 — Riesgo declarado

`Risk: item 5` — el work unit agrega un stack de build completo (Vite, React, Tailwind 4, Vitest) como dependencias nuevas del monorepo. Por eso llevó verificador independiente.

### L8 — Entrega y RDD del work unit

El commit original se partió en tres slices porque el nativo rechazó el candidato completo con `lens_context_budget_exceeded` (5422 líneas, de las cuales 3813 son el `package-lock.json` generado); la continuación indicada por el nativo fue rebanar en commits más chicos.

| Commit | Contenido | Líneas | Assess | Review |
|---|---|---|---|---|
| `4041ef0` | toolchain + lockfile | 3918 | medium | **approved**, 0 hallazgos |
| `b055617` | login, sesión y ruta protegida | 705 | high | **approved**, 9 hallazgos informativos |
| `dadf0ee` | shell con gating y panel | 799 | medium / `under_budget` | no requerida |

Los tres reviews se corrieron con consentimiento por candidato y `acknowledge-approved` exacto; autoridad quemada en cada uno. Un revisor (`risk`, slice `b055617`) devolvió `reviewer_result_not_admissible` en el primer intento; el STATUS reofreció el mismo slot y se relanzó una sola vez.

**Advisories aceptadas del review de `b055617`** (no bloqueantes, trabajo posterior):
1. El token vive en `sessionStorage`: legible por JavaScript del mismo origen. Se eligió sobre `localStorage` por vida útil; una cookie `httpOnly` queda como endurecimiento futuro, requiere cambio de backend.
2. `logout()` no revoca en servidor: limitación ya documentada en S4.
3. Si `/me` falla con error de red o 5xx al arrancar, se descarta la sesión visible pero el token queda guardado y el reintento se repite en cada recarga.
4. `sessionStorage` no está envuelto en `try/catch`: almacenamiento bloqueado o lleno puede romper el arranque o el login.
5. El mensaje de fallback para estados no mapeados (`Error inesperado del servidor`) no tiene test propio.
6. `loadUser` está exportado sin uso: el `USER_KEY` se escribe y nunca se lee.

**Divergencia de presentación pendiente de tu decisión**: el pie del sidebar del prototipo abre un menú desplegable; la implementación usa un botón directo `Cerrar sesión` (razón en L5).

### L9 — Navegación por URL y menú de cuenta (2026-11-16)

**Qué cambió y por qué**: la pantalla activa vivía en `useState` (`Shell`), así que recargar
volvía al Panel de Control, el botón Atrás salía del sistema y **ninguna pantalla tenía enlace
directo**. Con 31 pantallas derivadas y ~30 sub-rutas (un formulario, un detalle por registro)
eso no se sostiene, y hay una necesidad dura: SEG-U07 llega desde un enlace de correo con el
token en la URL, imposible sin router.

**Dependencia nueva**: `react-router-dom@^7` (~13 kB gzip). Requería aprobación por
`AGENTS.md` §Application conventions; el dueño la dio el 2026-11-16, junto con la autorización
para rediseñar la navegación.

**Forma elegida**:

| Pieza | Decisión |
|---|---|
| Rutas | `App.tsx` declara la tabla completa; `Shell` es una ruta de layout con `<Outlet/>` |
| Permiso | `Shell` resuelve la página por **prefijo de path** y redirige al inicio si el rol no la ve; un sub-ruteo hereda el permiso de su módulo sin declararlo otra vez |
| Path por página | `NavPage.path` en `features/navigation/navigation.ts` (`/panel-control`, `/pacientes`, …) |
| Login | `/login` es la única entrada anónima; con sesión activa redirige al aterrizaje del rol |
| Ruta desconocida | ruta splat → redirección al aterrizaje, nunca una pantalla vacía |
| Cuenta | `ACCOUNT_ROUTES` (`/perfil`, `/perfil/contrasena`): no son páginas del sidebar, son de la cuenta (D3) |

**Sin cambios de comportamiento** en gating por rol: las mismas páginas y los mismos grupos
para los tres roles; el test de S5 sigue verde sin modificarse.

**Menu de usuario (D3)**: `components/UserMenu.tsx` en el encabezado, con `Mi perfil`.
«Cerrar sesión» se queda en el pie del sidebar, donde T1 lo fijó con prueba (razón completa en
L28 de `02-seguridad-acceso.md`).

**Evidencia observada** desde `frontend/`: `npx tsc --noEmit` → exit 0; `npm run lint` → exit
0; `npm test` → **103 passed**; `npm run build` → `✓ built`. Casos nuevos de esta unidad:
`routes/routing.test.tsx` (4): enlace directo en carga fría, ruta desconocida al inicio, ruta
prohibida al inicio sin 403 crudo y Atrás del navegador.

**Deuda declarada**: el formulario de usuario (SEG-U03) y el detalle de auditoría (SEG-U05)
siguen siendo estado de vista dentro de su página, no rutas propias. No es un defecto de esta
unidad —su contrato no exige enlace directo a un registro— pero cuando se pida, el costo es
una ruta más y un `GET /usuarios/{id}`; el endpoint ya existe.

### L10 — Endurecimiento del arranque de la SPA (2026-11-16)

Cierra los advisories 3, 4, 5 y 6 del review de T1 (L8), más tres defectos de accesibilidad
que un back-office siente a diario.

| Cambio | Antes | Ahora |
|---|---|---|
| Servidor caído al arrancar | se veía como sesión cerrada y el token quedaba guardado sin explicación | estado `unavailable`: el token se conserva, la pantalla dice «No se pudo conectar con el servidor» y ofrece Reintentar |
| `sessionStorage` bloqueado o lleno | rompía el arranque o el login | cada acceso va en guarda; sin almacenamiento la sesión vive en memoria y el login no falla |
| Error de render | pantalla en blanco | `ErrorBoundary` con mensaje accionable y `Recargar`, y el error queda en consola |
| Título del documento | fijo, `SIGEMI` | `<pantalla> · SIGEMI`, derivado de la ruta |
| Foco tras navegar | quedaba en el menú | va al `<main>`, así el siguiente Tab entra en el contenido nuevo |
| Navegación por teclado | había que tabular todo el sidebar | enlace «Ir al contenido» |

**Evidencia**: 9 casos nuevos en `routes/sessionHardening.test.tsx` (token conservado y
Reintentar, recuperación al segundo intento, `401` que sí descarta, arranque y login con
`Storage` que lanza, título por pantalla, foco en `main`, enlace de salto, y pantalla de error
en lugar de blanco). Suite completa: **121 passed** (15 archivos), `tsc` 0, `lint` 0, `build`
verde.

**Nota de alcance**: `/me` con 5xx o error de red deja el token guardado a propósito. Es la
diferencia entre «no sé si la sesión vale» y «la sesión no vale»; solo el `401`/`403`
descarta.

### L11 — Revisión adversarial del frontend y lote de corrección (2026-11-16)

Revisión independiente sobre `99498e4..93609f0` (40 archivos de `frontend/`), contrastada
contra los schemas y endpoints reales del backend en modo lectura. **CAT1 (defectos de
corrección que rompen el flujo) = 0**; 4 CAT2 (alto) y 5 CAT3 (medio), todos confirmados.

| ID | Hallazgo | Corrección |
|---|---|---|
| F-001 | Vaciar un campo opcional en edición no persistía: el formulario enviaba `null` y `PATCH /pacientes` lo descarta con `exclude_none=True` | se envía `''`, que sobrevive el filtro y `normalizar_optional`/`normalizar_correo` convierten en `NULL` |
| F-002 | Quitar la última fila de una página dejaba el `offset` fuera de rango: vacío falso («No hay pacientes…») sin paginación para volver | ambos listados retroceden una página cuando el refetch vuelve vacío con `offset > 0` |
| F-003 | Un `401` de una pantalla mostraba el error genérico con un «Reintentar» que nunca podía funcionar; sólo el arranque manejaba la expiración | señal única en `api/unauthorized.ts`: la capa HTTP la emite en `401` con token y el proveedor de sesión cierra la sesión |
| F-004 | El test de enlace directo aprobaba por la razón equivocada: el listado fallaba y sólo se verificaba el `h1` | el test mockea el listado y exige una fila renderizada |
| F-005 | `Dialog` declaraba `aria-modal` sin focus trap, prometía cierre por backdrop sin handler y no devolvía el foco | atrapa `Tab`, cierra por backdrop (sólo si el target es el backdrop) y restaura el foco del que abrió |
| F-006 | Cambiar el select de estado aplicaba también el texto a medio escribir sin enviar | el select aplica sólo su propio valor sobre lo ya aplicado |
| F-007 | `navigate(..., { state: { created } })` que nadie leía | eliminado |
| F-008 | `/login` con token sin verificar pedía credenciales en vez de ofrecer reintento | `SessionUnavailable` compartido por `RequireAuth` y `LoginRoute` |
| F-009 | La oferta «Abrir la ficha del paciente existente» sobrevivía a la edición del DNI | se limpia al cambiar el DNI |

**Lo que la revisión no encontró**: fugas de autorización en la UI (el gating coincide con
`require_roles` en las tres rutas sensibles), spinners eternos, rechazos no capturados, y
ninguna discrepancia de contrato fuera de F-001 (nombres de query params, envelope,
`204` de `/auth/password` y `400 + campo` coinciden con el backend).

**Evidencia observada** desde `frontend/` sobre el árbol corregido (`b284d80`): `npx tsc
--noEmit` exit 0; `npm run lint` exit 0; `npm test` → **131 passed** (16 archivos; antes 121/15);
`npm run build` → `✓ built`. Diez casos nuevos, uno por hallazgo verificable.

**Límite de la verificación**: el rechequeo acotado pedido al mismo revisor fue **denegado por
el sistema de permisos** (`permission.rejected: subagent`). El rechequeo de los nueve
hallazgos lo hizo el integrador leyendo el diff y los tests que los pinnean, no un revisor
independiente: se registra como spot check propio, no como segunda opinión externa.
