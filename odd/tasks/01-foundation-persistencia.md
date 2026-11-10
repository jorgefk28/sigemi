# 01 — Fundación del monorepo y capa de persistencia

**Objetivo**: dejar el monorepo `sigemi/` creado con el entorno reproducible (Docker Compose), la configuración por variables de entorno, y **la totalidad del esquema relacional del nivel 3** materializado en modelos SQLAlchemy + migración Alembic verificada contra PostgreSQL 16.

**Rama**: `main` (repo nuevo, primer commit).
**Estrategia de entrega**: `single-pr` no aplica (repo nuevo); los work units se commitean directo en `main` hasta que exista un remoto.
**Runner**: `pytest` (backend, desde `backend/` con `.venv`).

---

## Specs

### S1 — Estructura del repositorio

El manifiesto (§4) fija:

> **Monorepo único** — un repo con `frontend/` y `backend/`

y la estructura referencial:

```
sigemi/
├── backend/          # FastAPI + Celery + Alembic
├── frontend/         # React + TypeScript
├── docker-compose.yml
├── .env.example
└── docs/             # documentación técnica y manifiesto
```

Criterio de aceptación: existen `backend/`, `frontend/`, `docker-compose.yml`, y una plantilla de entorno versionada (`env.example`; el archivo `.env` real está ignorado por git).

### S2 — Stack (manifiesto §1, decisiones firmes)

> Backend **FastAPI** (Python) · Frontend **React** (TypeScript) · Base de datos **PostgreSQL** · Cola **Celery** · Broker/cache **Redis** · Scheduler **Celery Beat** · ORM **SQLAlchemy** · Migraciones **Alembic** · Autenticación **JWT** (contraseñas con hash BCrypt/argon2) · Claves primarias **UUID** generadas en la aplicación · Versionado de ficha clínica en **jsonb** · `version_actual` **persistido**.

Criterio de aceptación: `docker-compose.yml` define `db` (postgres:16), `redis`, `api`, `worker` (celery worker) y `beat` (celery beat). Toda la configuración sale de variables de entorno; no hay credenciales ni URLs hardcodeadas en el código.

### S3 — Esquema completo (nivel 3)

`Diagramas/modelo_esquema_bd_sigemi.md` declara 45 tablas. Todas deben existir con exactamente las columnas, tipos, claves foráneas y unicidades que el nivel 3 lista:

`paciente`, `ficha_clinica`, `dato_clinico`, `version_ficha_clinica`, `muestra`, `analisis_micologico`, `hallazgo_analisis`, `version_analisis`, `informe_resultados`, `otp`, `usuario`, `rol`, `usuario_rol`, `profesional`, `turno`, `indicacion_medica`, `espacio_atencion`, `grupo_espacio`, `tipo_bloqueo`, `configuracion_agenda`, `periodo_inhabilitado`, `bloqueo_agenda`, `disponibilidad_profesional`, `ausencia_profesional`, `oferta_reagendacion`, `tipo_analisis`, `tipo_muestra`, `tipo_analisis_tipo_muestra`, `categoria_insumo`, `ubicacion_almacenamiento`, `insumo`, `lote`, `movimiento_inventario`, `categoria_residuo`, `instruccion_almacenamiento`, `residuo_quimico`, `disposicion_final`, `reporte_residuos`, `reporte_inventario`, `tipo_equipo`, `equipo`, `mantenimiento_equipo`, `auditoria`, `cambio_auditoria`, `reporte`.

Criterio de aceptación: `set(Base.metadata.tables) == ` las 45 tablas; ninguna tabla extra; ninguna faltante.

### S4 — Convenciones del nivel 3

> PK = `UUID`, generada en la aplicación (no `uuid_generate_v4()` servidor, para portabilidad). Fechas/timestamps en **UTC**. `estado` como `VARCHAR` con valores acotados por la aplicación. Borrado lógico, **nunca** delete físico sobre datos clínicos.

Criterio de aceptación: toda tabla tiene `id` UUID PK con `default=uuid.uuid4`; todos los timestamps usan `DateTime(timezone=True)`; ningún `estado` usa `ENUM` nativo; los valores acotados viven en `app/models/enums.py`.

> Traducción documentada: `usuario_rol` e `instruccion_almacenamiento` no listan `id` en el nivel 3 pero sí una unicidad de negocio; se les agrega `id` UUID PK siguiendo la convención de PK y el patrón de `tipo_analisis_tipo_muestra`, conservando la unicidad listada.

### S5 — Unicidades de negocio

- `rol.codigo` UNIQUE (catálogo cerrado: `bioquimico` | `profesor` | `administrador`).
- `usuario_rol` UNIQUE(`usuario_id`, `rol_id`).
- `profesional.usuario_id` UNIQUE (1:1 con `usuario`; aplica solo al rol `bioquimico`).
- `paciente.numero_registro` UNIQUE.
- `tipo_analisis.nombre` UNIQUE; `tipo_muestra.nombre` UNIQUE; `tipo_bloqueo.nombre` UNIQUE; `categoria_insumo.nombre` UNIQUE; `categoria_residuo.nombre` UNIQUE; `tipo_equipo.nombre` UNIQUE.
- `tipo_analisis_tipo_muestra` UNIQUE(`tipo_analisis_id`, `tipo_muestra_id`).
- `instruccion_almacenamiento` UNIQUE(`categoria_residuo_id`, `paso`).

### S6 — Decisiones explícitas del nivel 3 que el modelo no debe contradecir

- `insumo.stock_actual` **no existe** como columna: el stock se deriva de Σ `lote.cantidad_actual`.
- `equipo.numero_serie` va **indexado, no unique** (el proveedor no siempre lo garantiza).
- `muestra` es tabla propia; `analisis_micologico.muestra_id` es obligatorio (1:N muestra→análisis).
- `reporte` es la tabla genérica; `reporte_residuos` y `reporte_inventario` son especializadas y **no** se fusionan.
- `auditoria` es append-only; `entidad_id` es UUID **sin** FK (polimórfico).
- `movimiento_inventario.devolucion_referencia_id` es auto-FK nullable.
- `residuo_quimico.disposicion_final_id` y `residuo_quimico.analisis_id` son nullable.
- `configuracion_agenda.dias_habiles` es `varchar[]` → `ARRAY(String)` de PostgreSQL.
- `version_ficha_clinica` y `version_analisis` guardan `datos_previos`/`datos_nuevos` como `jsonb`.

### S7 — Índices sugeridos (nivel 3)

Deben existir los índices de la sección "Índices sugeridos" del nivel 3 (paciente, turno, análisis, otp, ficha, catálogos, agenda, oferta, lote, movimiento, insumo, residuo, instrucción, muestra, versiones, usuario_rol) más los de Equipos y Transversales.

### S8 — Verificación

- `pytest` verde en `backend/` (tests estructurales del esquema + smoke de la API).
- `alembic upgrade head` contra PostgreSQL 16 real, sin errores, creando las 45 tablas.
- `alembic downgrade base` limpio (reversibilidad de la migración inicial).

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Esqueleto del monorepo: `.gitignore`, `env.example`, `docker-compose.yml`, `backend/Dockerfile`, `requirements*.txt`, `app/core/config.py`, `app/db/base.py`, `app/db/session.py`, `app/models/enums.py`, `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `app/main.py`, `app/worker.py`, `pytest.ini`, tests base | S1, S2, S4 | inline | ✅ |
| T2 | Modelos del núcleo clínico (`clinical.py`) y de personas/acceso (`access.py`) | S3, S4, S5, S6 | delegated | ✅ |
| T3 | Modelos de agenda/atención (`agenda.py`) y catálogos de análisis (`catalogs.py`) | S3, S4, S5, S6 | delegated | ✅ |
| T4 | Modelos de inventario (`inventory.py`), residuos (`waste.py`), equipos (`equipment.py`), auditoría (`audit.py`) y reportes (`reports.py`) | S3, S4, S5, S6 | delegated | ✅ |
| T5 | `app/models/__init__.py`, migración inicial Alembic, `alembic upgrade head` + `downgrade base` sobre Postgres real, `pytest` verde | S3, S7, S8 | inline | ✅ |
| T6 | Verificación independiente del esquema contra el nivel 3 | S3–S8 | delegated | ⏳ |

---

## Log

### L1 — Pedido original del usuario (2026-11-10)

> Hoy es el gran dia. Vamos a comenzar con el desarrollo de este sistema. Asegurate de utilizar subagentes para la tarea. Necesito que empieces a programar el sistema SIGEMI siguiendo lo dicho en Agents.md y el manifiesto de infraestructura. Deberas partir de los diseños del sigueinte Figma: https://www.figma.com/make/SIvLdiMlY2bVQ6tPmRIlyw/Back-office-laboratory-dashboard--copia-?t=MI4vnhkVLjZQhpOw-1 Recuerda que es una guia, pero habran incosistencias con nuestra documentación, y es ahi donde deberas hacer caso a nuestra documentación.

### L2 — Análisis inicial y alcance de este work unit

- Repo de código creado como **repo hermano** de `Docs/`: `TF 2026/sigemi/` (monorepo del manifiesto §4). El repo `Docs/` queda solo con documentación.
- Alcance del primer work unit: **infraestructura reproducible + capa de persistencia completa**. Es la dependencia de todos los subsistemas; no tiene sentido programar endpoints antes de que el esquema exista y migre.
- El diseño de Figma (`figma.com/make/...`) **no es legible** por el MCP de Figma ("This tool is not supported for Make files") ni por HTTP directo (403). Queda pendiente de resolución para el work unit de frontend; no bloquea la persistencia.
- Decisión de implementación (no contradice el manifiesto): SQLAlchemy **síncrono** + `psycopg` v3, para compartir el mismo patrón de engine/sesión entre FastAPI y los workers Celery sin duplicar configuración asíncrona. FastAPI ejecuta los handlers síncronos en su threadpool.
- Decisión de implementación: sin `relationship()` en esta capa; las tablas se declaran puras y los servicios resuelven sus joins explícitamente. Evita ciclos de import y FKs ambiguas.
- Decisión de implementación: `UNIQUE(ficha_clinica_id, numero_version)` y `UNIQUE(analisis_id, numero_version)` en las dos tablas de versionado. El nivel 3 no las lista explícitamente, pero el número de versión duplicado para el mismo objeto sería una corrupción del mecanismo de inmutabilidad; se agrega como traducción fiel del versionado, no como requisito nuevo.
- Decisión de implementación: `configuracion_agenda.horario_inicio_tarde`/`horario_fin_tarde` quedan nullable (agenda de solo mañana); las franjas de la mañana son obligatorias.

### L3 — Evidencia de T1–T5 (2026-11-10)

- `pytest` en `backend/`: **95 passed** (46 tests de DDL por tabla + 45 de PK + 4 estructurales + smoke de `/health`). El test estructural detectó que el nivel 3 declara **45** tablas, no 46: la spec S3 se corrigió.
- `alembic upgrade head` sobre PostgreSQL 16 (contenedor `sigemi-db`, host 5433): **45 tablas creadas**, `EXIT=0`.
- `alembic downgrade base`: **0 tablas de aplicación** restantes, `EXIT=0`. `upgrade head` posterior vuelve a 45. Migración reversible.
- Migración generada: `backend/alembic/versions/1851f84f7605_initial_sigemi_schema.py` (43 KB, 45 `create_table`).
- `docker compose up -d db` operativo; `env_file` de Compose marcado `required: false` para que el entorno arranque sin `.env` local.
- El venv de desarrollo vive en `backend/.venv` (git-ignored).

