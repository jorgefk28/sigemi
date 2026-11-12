# 02 — Acceso y seguridad: autenticación, roles y auditoría

**Objetivo**: habilitar el acceso autenticado al sistema con el catálogo cerrado de roles y la traza de auditoría que exige RF-14. Es la dependencia de **todos** los endpoints de los cinco subsistemas.

**Rama**: `main`.
**Estrategia de entrega**: commits por work unit en `main` (repo sin remoto).
**Runner**: `pytest` (backend, `.venv`).

---

## Specs

### S1 — Gestión de cuentas y autenticación (RF-13)

> El sistema debe gestionar el registro, la modificación y la baja de cuentas de usuario, centralizando el proceso de autenticación en la plataforma.

Criterio: login por correo + contraseña, token JWT firmado, y baja lógica (`estado = inactivo`), nunca delete físico.

### S2 — Registro automático de auditoría (RF-14)

> El sistema debe registrar de manera automática y cronológica cada evento significativo o crítico, almacenando el usuario responsable, la fecha, la hora, la dirección IP y el cambio específico realizado.

Criterio: el servicio de auditoría crea `auditoria` + N `cambio_auditoria`, y es **append-only** (no expone update ni delete).

### S3 — Roles prefijados y cerrados (nivel 2 §6.2, nivel 3 §`usuario`/`rol`/`usuario_rol`/`profesional`)

> los roles son **prefijados y cerrados** (`Profesional`, `Profesor`, `Administrador`) y **acumulables** (un `Usuario` opera con uno o más). El usuario no modela roles propios ni modifica privilegios.

Criterio: `rol.codigo` ∈ {`bioquimico`, `profesor`, `administrador`}, sembrado por migración de datos, y un usuario acumula N roles vía `usuario_rol`.

### S4 — Seguridad de credenciales (manifiesto §1)

> Autenticación **JWT**: tokens firmados; contraseñas con hash (BCrypt/argon2)

Criterio: bcrypt con costo 12; nunca se persiste ni se loguea la contraseña en claro; el token expira según `ACCESS_TOKEN_EXPIRE_MINUTES`.

### S5 — Contraseñas y bloqueo por intentos

Bloqueo temporal tras `LOGIN_MAX_FAILED_ATTEMPTS` intentos fallidos, por `LOGIN_LOCK_MINUTES` minutos, usando `usuario.intentos_fallidos` y `usuario.bloqueado_hasta` (columnas del nivel 3).

### S6 — Fortaleza de contraseñas (supuesto declarado)

> Pedido del usuario, 2026-11-11: «Define tu propuesta de "fortaleza de contraseña" pero que el minimo sea 8 carácteres.»

El nivel 1 exige validar la fortaleza (UCE-SEG-02 paso 6, UCE-SEG-08 paso 7) sin definirla. Se adopta este criterio, aplicado en el alta y en el cambio de contraseña:

- **Mínimo 8 caracteres.**
- **Máximo 72 bytes.** `hash_password` trunca a 72 bytes (bcrypt): sin tope superior, dos contraseñas distintas después del byte 72 producen el mismo hash. El tope se valida en **bytes UTF-8**, no en caracteres.
- **Al menos una letra y al menos un dígito.**
- **No se exigen símbolos ni mayúsculas.** La longitud protege más que la composición (NIST SP 800-63B), y las reglas de composición empujan a patrones predecibles del tipo `Password1!`.
- Rechazo con `400` y mensaje en español que nombre la regla incumplida.
- La validación vive en el backend; el frontend muestra el mensaje pero no decide.

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Primitivas de seguridad (bcrypt, JWT), servicio de auditoría append-only, migración de datos del catálogo de roles, fixtures de test con rollback | S2, S3, S4 | delegated (2 en paralelo) | ✅ |
| T2 | API de autenticación: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `get_current_user`, `require_roles`, wiring del router | S1, S4, S5 | delegated | ✅ |
| T3 | CRUD de usuarios y asignación de roles (solo `administrador`), con auditoría de cada alta/baja/modificación | S1, S2, S3, S6 | — | ⏳ |
| T4 | Inventario y especificación de las pantallas de SEG (pasos 1-4 de `odd/design/screen-design-plan.md`) | S1, S6 | — | ⏳ |
| T5 | Implementación de las pantallas de SEG aprobadas en T4 (patrones P1 y P3) | S1, S6 | — | ⏳ |

---

## Log

### L1 — Origen

Deriva de RF-13 y RF-14 (nivel 1), de los roles cerrados (nivel 2 §6.2) y de las tablas `usuario`/`rol`/`usuario_rol`/`profesional`/`auditoria`/`cambio_auditoria` (nivel 3).

### L2 — Evidencia de T1

- `pytest`: **299 passed**.
- `alembic upgrade head` → `8f5956edf3e4 -> c1bf7c1dd493, seed closed role catalog`.
- `select codigo from rol order by 1` → `administrador`, `bioquimico`, `profesor`.
- Fixtures: `db` abre una conexión y revierte la transacción al final de cada test (`join_transaction_mode="create_savepoint"`); `client` reemplaza la dependencia `get_db` por esa misma sesión, así los tests de API no ensucian la base de desarrollo.

### L3 — Corte de la sesión (2026-11-10)

El work unit quedó **partido a propósito**: T1 commiteado y verde, T2 no iniciado. Motivo: el modelo configurado para `gentle-ai-worker` (Claude Sonnet vía cliproxyapi) agotó su cuota (HTTP 429, reset en ~4h35m) y el subagente de T2 se canceló sin escribir archivos.

**Estado exacto al retomar**: HEAD = commit de T1; `git status` limpio; T2 arranca desde cero. El contrato de T2 ya está definido en el prompt de esa tarea (deps + router + tests) y las piezas que consume (`security.py`, `audit.py`, `roles_de_usuario`, `serializar_usuario`, `conftest.client`) ya existen y están testeadas.

### L4 — Evidencia de T2

- `pytest tests/test_auth.py`: **9 passed**. `pytest` completo: **308 passed** (299 + 9), sin regresiones.
- Rutas registradas: `/health`, `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/openapi.json`, `/docs`, `/redoc`.
- Decisión: el contrato de la firma de `login` era inválido en Python (`request: Request` no puede ir después de un parámetro con default). Se reordenó a `(request, form=Depends(), db=Depends(get_db))`; FastAPI inyecta `Request` por anotación, la semántica no cambia.
- Decisión: todas las respuestas 401 de login llevan `WWW-Authenticate: Bearer`, no solo las de `get_current_user`, para que el desafío OAuth2 sea consistente.
- Orden de reglas del login (fijado y testeado): desconocido → 401; inactivo → 403; bloqueado → 423; contraseña incorrecta → 401 + contador; correcta → token.

### L5 — Verificación independiente de T2

Verificador independiente sobre `2084dad`. **Sin bloqueantes.** S1, S2, S4 y S5 pass; S3 sigue vigente.

Probes observados: `pytest` 308 passed; token manipulado / firmado con otro secreto / expirado / `sub` no-UUID / usuario inexistente → 401; usuario inactivo → 403; `require_roles("administrador")` con rol `bioquimico` → 403 y con `administrador` → 200; `require_roles()` sin argumentos falla cerrado → 403; bloqueo persistente a través de requests separados, 423 con contraseña correcta estando bloqueado, y liberación al vencer; exactamente una fila de auditoría por login exitoso y una por bloqueo, **ninguna** por intento fallido suelto; ninguna respuesta expone `contrasena_hash` ni el token.

Se incorporaron los probes como `backend/tests/test_auth_security.py` (9 tests). `pytest`: **317 passed**.

**Advisories aceptadas / diferidas**:
1. **Enumeración por estado**: una cuenta inactiva responde 403 y un correo inexistente 401. Es consecuencia directa del contrato (S1 lo exige para dar un mensaje útil). Se acepta; si el cliente prioriza no revelar existencia de cuentas, se unifica a 401 y se mueve la explicación al correo de contacto.
2. **Enumeración por tiempo**: con correo inexistente no se ejecuta bcrypt (~150 ms de diferencia). Diferido: mitigar con un hash dummy constante si se decide cerrar el canal.
3. **`direccion_ip` detrás de proxy inverso**: `request.client.host` devuelve la IP del proxy si el despliegue va detrás de Nginx/Traefik. **RF-14 exige la IP real**, así que esto debe resolverse en el work unit de despliegue (`uvicorn --proxy-headers --forwarded-allow-ips=<proxy>` o middleware de proxy confiable). No es un defecto del endpoint, es configuración de entorno.
4. **JWT sin `jti` ni revocación**: `get_current_user` revalida estado y roles contra la base en cada request, así que desactivar un usuario surte efecto inmediato. La revocación de un token individual queda para cuando exista un logout real.

### L6 — Supuesto de política de contraseñas (2026-11-11)

Nivel 1 exige "validar la fortaleza de la contraseña" en UCE-SEG-02 (paso 6, línea 2379) y UCE-SEG-08 (paso 7, línea 2449) sin definir qué significa. Consultados los tres niveles, ninguno fija un mínimo, un máximo ni reglas de composición.

Se registra **S6** como supuesto explícito, decidido por el usuario, para que T3 tenga contra qué testear. El mínimo de 8 caracteres lo fijó el usuario; la exigencia de letra y dígito, y el tope de 72 bytes, se derivan de la implementación vigente (`hash_password` trunca a 72 bytes) y de NIST SP 800-63B.

**Consecuencia sobre T3**: la especificación de la tarea pasa de `S1, S2, S3` a `S1, S2, S3, S6`. Si el cliente pide otra política, se reescribe S6 y se reabre solo T3.

### L7 — Corrección de estado de las pantallas (2026-11-11)

**Se revirtió** la decisión de tratar `OPENCODE-ARTIFACTS/Pantallas/` como autoridad de presentación. El dueño del repositorio la declaró **obsoleta**: no contiene diseños válidos de pantallas no entregadas. `AGENTS.md` ahora la excluye explícitamente como fuente de diseño, inventario o reglas.

**Estado real**: no existe ninguna especificación de pantalla para las pantallas no entregadas. No hay inventario. No hay prototipo utilizable más allá del armazón ya implementado (S6/S7 de `03-shell-frontend.md`) y la única pieza del archivo Figma (`X7mBlw5ZzuvAIyZXb1UVdG`, nodo `1:3`), que es una copia generada desde el código.

**Procedimiento adoptado**: `odd/design/screen-design-plan.md`. Se agregaron **T4** (inventario + especificación) y **T5** (implementación), ambas pendientes y sin ruta asignada.

**Dependencias**: T3 es backend y no depende de T4. T5 sí depende de T4 aprobada. El orden recomendado es T3 → T4 → T5.

### L8 — Base de instrucciones y reparto en carriles (2026-11-11)

**Corte**: `0050940` — `docs: pin the agent instruction base and parallel execution policy`. Antes de este commit, `AGENTS.md`, `odd/design/screen-design-plan.md`, `.atl/skill-registry.md` y `skills-lock.json` estaban **sin trackear**, y este documento no tenía S6, T4, T5, L6 ni L7. Un `git worktree add` materializa `HEAD`, no el working tree: cualquier worktree creado antes de este commit nacía sin las reglas del repositorio. Ese era el bloqueante real para trabajar en paralelo, no git.

**Política adoptada**: `AGENTS.md`, sección `## Parallel execution (git worktrees)`. Fija las cuatro precondiciones de un carril, el stack único de infraestructura, una base de datos por carril, el dueño único de cada recurso compartido y las reglas de corrida larga.

**Reparto**:

| Carril | Tarea | Escribe | No toca |
|---|---|---|---|
| Backend (`feat/seg-t3-usuarios`) | T3 | `backend/app/api/v1/usuarios.py`, `app/schemas/`, `app/services/`, `app/cli/`, `backend/tests/test_usuarios*.py`, `## Tasks` fila T3 y `## Log` de este documento | `frontend/`, `alembic/versions/`, `## Screens` |
| Pantallas (`feat/seg-t4-inventario`) | T4 | `odd/design/seg-screens-draft.md` | Todo lo demás (lectura permitida) |
| Integrador (`main`) | merge y cierre | `## Screens` final tras revisión humana, `alembic/versions/`, suite completa | — |

T5 queda bloqueada hasta que T4 esté aprobada, y entonces escribe solo `frontend/src/**`.

T3 **no requiere migración**: las tablas de `usuario`/`rol`/`usuario_rol`/`auditoria` existen desde `8f5956edf3e4` y el catálogo se sembró en `c1bf7c1dd493`. Por eso el carril backend cumple las cuatro precondiciones sin pedirle nada al integrador.

**Precondiciones no satisfechas al momento del corte**:

1. Docker Desktop estaba apagado (`docker ps` no conecta al named pipe). El stack se levanta una sola vez desde este árbol antes de correr pruebas.
2. `.agents/` sigue en `.gitignore`, así que los cuatro skills de alcance proyecto (`impeccable`, `vercel-composition-patterns`, `vercel-react-best-practices`, `web-design-guidelines`) **no existen** en un worktree. Los 18 skills de alcance usuario sí, porque viven en el perfil. Afecta solo a T5.
3. `impeccable` está instalado en `.agents/skills` pero **no figura en `skills-lock.json`**, contra la regla de `AGENTS.md` §Skills: fijar la fuente en el repositorio. Pendiente de decisión del dueño.

### L9 — Evidencia del arranque de carriles (2026-11-11)

**Infraestructura**: Docker Desktop estaba apagado y se encendió. `docker compose up -d db redis` se corrió **una sola vez desde el árbol principal**. `sigemi-db` healthy en `5433`, `sigemi-redis` healthy en `6380`. La base de desarrollo `sigemi` quedó intacta: `alembic_version = c1bf7c1dd493`, 3 roles, 0 usuarios.

**Worktrees**: `C:\work\sigemi-t3` en `feat/seg-t3-usuarios` y `C:\work\sigemi-t4` en `feat/seg-t4-inventario`, ambos sobre `5d78048`. El carril de pantallas no necesita bootstrap; el backend tiene su `.venv` propio con `requirements-dev.txt` instalado. `backend/.venv` y `frontend/node_modules` **no** se copiaron entre worktrees.

**Base por carril**: `sigemi_t3` creada sobre el servidor compartido. `alembic upgrade head` ejecutado desde el worktree del carril → `c1bf7c1dd493` + 3 roles. La base de desarrollo `sigemi` no recibió ningún cambio.

**Respaldo**: `C:\work\sigemi-2026-11-11.bundle` (`git bundle create --all`), verificado con `git bundle verify` → «records a complete history».

**Evidencia del carril backend**: `pytest` desde `C:\work\sigemi-t3\backend` con `DATABASE_URL` apuntando a `sigemi_t3` → **320 tests, 0 failures, 0 errors, 0 skipped, 48.33 s** (junit). El aislamiento funciona: al terminar, `sigemi_t3` quedó con 0 usuarios, porque el fixture revierte cada transacción.

**Corrección de baseline**: L5 registró **317**. El conteo real es **320**. El criterio de T3 pasa a «≥ 320 sobre la base actual», no «≥ 317».

**Hallazgo — probe flaky preexistente**. `tests/test_auth_security.py::test_tampered_token_is_rejected` (commit `ef51e70`) altera el último carácter del token:

```python
tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
```

La firma HS256 son 32 bytes → 43 caracteres base64url. El último carácter solo aporta **4 bits significativos**: reemplazarlo por `A` deja los bytes decodificados **idénticos** en aproximadamente 1 de cada 16 casos (medido sobre 300 tokens: **19 coincidencias**). Cuando coincide, el token sigue siendo válido, `/api/v1/auth/me` responde `200` y el test falla.

No es un defecto de seguridad: es un defecto del probe. Consecuencia operativa: la suite falla ~6 % de las corridas sin que nada esté roto, y el carril de T3 la va a correr muchas veces. **Acción**: corregir el probe alterando un byte de la firma de forma determinista, en un commit de test propio antes o junto con T3.

### L10 — Endurecimiento de la base (2026-11-12)

**Pedido del usuario, textual**: «Si, confio. Además quiero que los comentarios de los commits se hagam en español.»

Eso **contradice** el contrato de idioma previo de `AGENTS.md` («commit messages stay English»). Se resolvió a favor del dueño y se dejó escrito, no aplicado en silencio: `AGENTS.md` §Language contract ahora exige descripción en español, con el tipo y el scope del Conventional Commit en inglés por ser tokens estructurales. Los commits anteriores a 2026-11-12 quedan en inglés y **no se reescribe historia**.

**Aprobado en el mismo pedido**: normalización de finales de línea, linters como gate, y fijar las dos formas que T3 está por inventar.

**1. `.gitattributes`** (commit `8f62f3e`): `* text=auto eol=lf`, scripts de Windows en CRLF, binarios marcados. El índice y el working tree ya estaban en LF, así que `git add --renormalize .` fue **no-op**: el atributo previene la deriva futura sin tocar un solo blob. Antes de esto, cada `git add` avisaba «LF will be replaced by CRLF», y con dos carriles eso es diff de archivo completo y conflicto por bytes que nadie editó.

**2. Ruff como gate del backend** (commit `042bde2`): configuración en `backend/pyproject.toml` con `select = [E4, E7, E9, F, I, B, UP]`, `B008` ignorado (FastAPI expresa la inyección de dependencias como llamada en un argumento por diseño) y `alembic/versions` excluido, porque el formateador quería reescribir una migración **ya aplicada** y eso viola el contrato de esquema congelado. 29 hallazgos iniciales → 16 corregidos y 15 archivos reformateados. `ruff==0.17.4` fijado en `requirements-dev.txt`.

**3. ESLint como gate del frontend** (commit `febe264`): flat config con `typescript-eslint`, `js.configs.recommended` y `react-hooks`. Un solo hallazgo en todo el árbol (`_init` sin usar en `test/fixtures.ts`), resuelto en la configuración con `argsIgnorePattern: '^_'`, no tocando el fixture. Script `npm run lint`.

**Contrato de respuesta fijado** en `AGENTS.md` §Response contract: `{"detail": "<mensaje>"}` en todo 4xx/5xx; `{"detail", "campo"}` con `400` para validación por campo (regla R3); el `422` automático de FastAPI no es contrato de usuario; los listados devuelven `{items, total, limit, offset}`, con filtros nombrados como la columna del nivel 3 y `q` para búsqueda libre.

**Supuesto declarado**: `limit` por defecto 20 y tope 100. No viene del nivel 1: es convención de repositorio, decidida dentro de este pedido, y vive en un solo lugar para poder revisarla sin reabrir tareas.

**Evidencia observada**: backend `ruff check` limpio y `ruff format --check` con 41 archivos OK; `pytest` **320 passed** (junit, 31.5 s). Frontend `eslint` limpio, `tsc --noEmit` exit 0, `vitest` **24 passed**, `build` OK.

**Hallazgo operativo**: el primer `pytest` posterior a ruff falló con `psycopg.OperationalError: ... Socket is not connected`. No era el cambio: Docker Desktop se había apagado al dormir la máquina (la fecha cambió a 2026-11-12). Levantado el stack, ambas bases persistieron (`sigemi` y `sigemi_t3`) y la suite volvió a 320. `AGENTS.md` §Long unattended runs ahora lo fija: un error de conexión es infraestructura, no regresión, y no se concluye nada hasta que la base responda.

### L11 — Skills de alcance proyecto: qué se fija y qué no (2026-11-12)

**Pregunta del dueño**: «lo necesita? si es así hazlo.»

**Respuesta**: T5 necesita **tres** de los cuatro; `impeccable` no.

**Por qué los tres**: T5 no construye dos pantallas, construye **el patrón que después se instancia en unas treinta**. `web-design-guidelines` aporta lo que una tabla con filtros y un formulario de alta necesitan sí o sí: etiquetas asociadas, foco, navegación por teclado, semántica de formulario. `vercel-composition-patterns` ataca exactamente el problema de un `DataTable`/`FormField` reusado: composición por compound components en vez de proliferación de props. `vercel-react-best-practices` es el que menos aporta —la mitad de sus reglas son de Next.js y este proyecto es una SPA de Vite— pero está fijado por `skills-lock.json` y sus reglas de React sí aplican.

**Por qué `impeccable` no**: son 2.24 MB de los 2.5 totales, 63 archivos y **5 scripts** (`live-browser.js`, `live-browser-session.js`, `live-browser-dom.js`, `live-browser-ignores.js`, `modern-screenshot.umd.js`): un arnés de captura de browser, no documentación. `AGENTS.md` §Skills obliga a rechazar todo skill que pida red, credenciales o escrituras fuera del repositorio sin aprobación explícita. Además no hace falta para implementar pantallas: es un flujo de captura y auditoría de diseño. Sigue disponible en el árbol principal, fuera del repo.

**Coherencia con lo ya decidido**: el argumento que usamos para fijar `pyproject.toml` y `eslint.config.js` —que el resultado no dependa de configuración ambiente de la máquina— vale igual para los skills. Un skill fuera de `HEAD` es una dependencia ambiente. Los tres que se fijan coinciden **exactamente** con los que `skills-lock.json` ya declaraba, así que queda cumplida la regla de fijar la fuente en el repositorio; `impeccable` era el único instalado por fuera del lock, y ahora se documenta su exclusión en vez de dejarla implícita.

**Consecuencia**: `.gitignore` ya no ignora `.agents/` entero, solo `/.agents/skills/impeccable/`. Cualquier worktree creado desde este commit trae los tres skills y el carril de T5 es autosuficiente.

**Defecto conocido del registry**: `vercel-composition-patterns` figura indexado con descripción vacía («—») porque su `SKILL.md` usa un `description:` en escalar plegado que el generador no parsea. No afecta al uso —la ruta está indexada y se pasa explícita— pero el skill no se va a seleccionar por descripción.


