# SIGEMI

Sistema de Gestión de Laboratorio Micológico — módulo de Bioquímica y Farmacia, UNaM.

Monorepo con `backend/` (FastAPI + SQLAlchemy + Alembic + Celery) y `frontend/`
(React 19 + Vite + TypeScript + Tailwind 4).

## Estado

| Capa | Estado |
|---|---|
| Infraestructura reproducible (Docker Compose) | ✅ |
| Configuración por variables de entorno | ✅ |
| Esquema relacional completo (45 tablas) + migración inicial | ✅ |
| Autenticación / autorización por roles | ✅ |
| API de subsistemas (pacientes, análisis, fichas, catálogos, usuarios, auditoría, reportes) | ✅ |
| Frontend back-office (12 módulos) | ✅ |
| Integración frontend ↔ backend | ✅ sesión, pacientes, auditoría · ⏳ el resto (ver abajo) |

## Fuentes de verdad

Este repositorio **implementa**, no define. Las definiciones viven en el repo de documentación, en orden de autoridad:

1. `TF_2026_Requerimientos_KLUKA_JORGE.md` — qué necesita el negocio.
2. `Diagramas/modelo_dominio_sigemi_unificado.md` — qué conceptos existen.
3. `Diagramas/modelo_esquema_bd_sigemi.md` — cómo se guardan.

Si el código contradice un nivel superior, el código es el defectuoso.

## Puesta en marcha (desarrollo)

Requisitos: Python 3.13, Docker Desktop, Node 24.

Todo se corre **nativo** contra la base y Redis en contenedores. Son tres terminales.

### 1. Base de datos y Redis (una sola vez)

```powershell
docker compose up -d db redis
```

- PostgreSQL en `localhost:5433` (mapeado para no chocar con un PostgreSQL local en 5432).
- Redis en `localhost:6380`.

> Nunca corras `docker compose down -v`: borra el volumen `pgdata` y con él las cuentas
> cargadas a mano.

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item ..\env.example ..\.env      # opcional: los defaults ya apuntan a docker compose
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Documentación interactiva: `http://localhost:8000/docs` (el OpenAPI vive en `/api/v1/openapi.json`)
- Health: `http://localhost:8000/health`

### 3. Frontend

```powershell
cd frontend
npm ci
npm run dev
```

- SPA: `http://localhost:5173`
- Vite hace proxy de `/api` a `http://localhost:8000`, así que no hay que configurar CORS ni
  una URL absoluta. Para apuntar a otra API: `VITE_API_BASE_URL=http://host:puerto/api/v1`.

### 4. Primer acceso

**No hay autorregistro** y `POST /usuarios` exige un administrador ya autenticado, así que una
base recién migrada no se puede entrar. La cuenta se crea con un script (no con una migración:
`AGENTS.md` prohíbe credenciales y hashes dentro de una migración):

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\crear_admin.py --correo admin@sigemi.local --contrasena Secreta123
```

Es idempotente. Si el correo ya existe sólo lo informa; para recuperar una contraseña olvidada
(o reactivar una cuenta bloqueada) agregá `--reset-contrasena`:

```powershell
.\.venv\Scripts\python.exe scripts\crear_admin.py --correo admin@sigemi.local --contrasena NuevaClave123 --reset-contrasena
```

La regla de contraseña es la misma que aplica la API: 8 caracteres como mínimo, una letra y un
número. Iniciás sesión en `http://localhost:5173` con ese correo y esa contraseña.

## Verificación

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
```

Frontend:

```powershell
cd frontend
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Los tests estructurales del esquema no necesitan base de datos: compilan cada tabla con el dialecto
PostgreSQL y verifican que las 45 tablas del nivel 3 existan, tengan PK UUID generada en la
aplicación y resuelvan todas sus claves foráneas. El resto sí usa la base de `docker compose`.

> Si `pytest` falla en `tests/test_usuarios.py` con conteos de fila (`3 == 2`), no es una
> regresión: esas pruebas asumen una tabla `usuario` vacía y la base de desarrollo ya tiene la
> cuenta del primer acceso.

## Entorno completo en contenedores

```powershell
docker compose up --build
```

Levanta `db`, `redis`, `api`, `worker` (Celery) y `beat` (Celery Beat). El servicio `api` aplica
`alembic upgrade head` antes de arrancar. El frontend no se sirve desde acá: se corre con Vite en
desarrollo o se publica el contenido de `frontend/dist` (`npm run build`) en un servidor estático.

## Qué hay implementado

El detalle por subsistema, con sus specs, supuestos y evidencia de checks, está en `odd/tasks/`.
Las decisiones autónomas y su fundamento están en `odd/DECISIONES-AUTONOMAS.md`.

| Módulo | Datos | Backend |
|---|---|---|
| Login, sesión, roles | reales | `POST /auth/login`, `GET /auth/me` |
| Pacientes (listado, alta, edición, baja) | reales | `/pacientes` |
| Auditoría (listado y detalle) | reales | `/auditoria` |
| Panel de Control, Agenda, Análisis, Ficha Clínica, Detalle, Carga de Resultados, Resultados | demo | — (ver A-17) |
| Insumos, Residuos, Reportes y Estadísticas, Usuarios y Roles | demo | — (ver A-17) |

Las pantallas con datos demo conservan el dataset de la entrega y las filas reales del backend se
muestran por encima de él, deduplicadas por su clave natural. El motivo de cada caso está en la
decisión **A-17**.

## Estructura

```
sigemi/
├── backend/
│   ├── alembic/            # migraciones versionadas
│   ├── app/
│   │   ├── api/v1/         # un router por subsistema
│   │   ├── core/           # configuración, seguridad
│   │   ├── db/             # base declarativa y sesión
│   │   ├── models/         # 45 tablas del nivel 3, por subsistema
│   │   ├── schemas/        # contratos de entrada y salida
│   │   └── services/       # reglas de negocio
│   ├── scripts/            # crear_admin.py (primer acceso)
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/            # clientes tipados de /api/v1
│       ├── data/           # puentes API ↔ stores de pantalla
│       ├── screens/        # las 12 pantallas del back-office
│       ├── session/        # token, restauración y logout
│       └── test/           # setup y fixtures
├── odd/
│   ├── tasks/              # documentos de trabajo por feature
│   ├── design/
│   └── DECISIONES-AUTONOMAS.md
├── docker-compose.yml
└── env.example
```
