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

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Primitivas de seguridad (bcrypt, JWT), servicio de auditoría append-only, migración de datos del catálogo de roles, fixtures de test con rollback | S2, S3, S4 | delegated (2 en paralelo) | ✅ |
| T2 | API de autenticación: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `get_current_user`, `require_roles`, wiring del router | S1, S4, S5 | delegated | ⏳ |
| T3 | CRUD de usuarios y asignación de roles (solo `administrador`), con auditoría de cada alta/baja/modificación | S1, S2, S3 | — | ⏳ |

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
