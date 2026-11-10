# SIGEMI

Sistema de Gestión de Laboratorio Micológico — módulo de Bioquímica y Farmacia, UNaM.

Monorepo con `backend/` (FastAPI + SQLAlchemy + Alembic + Celery) y `frontend/` (React + TypeScript).

## Estado

| Capa | Estado |
|---|---|
| Infraestructura reproducible (Docker Compose) | ✅ |
| Configuración por variables de entorno | ✅ |
| Esquema relacional completo (45 tablas) + migración inicial | ✅ |
| Autenticación / autorización por roles | ⏳ |
| API de subsistemas | ⏳ |
| Frontend | ⏳ |

## Fuentes de verdad

Este repositorio **implementa**, no define. Las definiciones viven en el repo de documentación, en orden de autoridad:

1. `TF_2026_Requerimientos_KLUKA_JORGE.md` — qué necesita el negocio.
2. `Diagramas/modelo_dominio_sigemi_unificado.md` — qué conceptos existen.
3. `Diagramas/modelo_esquema_bd_sigemi.md` — cómo se guardan.

Si el código contradice un nivel superior, el código es el defectuoso.

## Puesta en marcha (desarrollo)

Requisitos: Python 3.13, Docker Desktop, Node 24 (para el frontend).

```powershell
# 1. Base de datos y Redis
docker compose up -d db redis

# 2. Entorno de Python
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt

# 3. Configuración local (opcional: los defaults ya apuntan a docker compose)
Copy-Item ..\env.example ..\.env

# 4. Migraciones
.\.venv\Scripts\alembic.exe upgrade head

# 5. API
.\.venv\Scripts\uvicorn.exe app.main:app --reload
```

- API: http://localhost:8000 — documentación OpenAPI en `/docs`.
- PostgreSQL: `localhost:5433` (mapeado para no chocar con un PostgreSQL local en 5432).
- Redis: `localhost:6380`.

## Verificación

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

Los tests estructurales del esquema no necesitan base de datos: compilan cada tabla con el dialecto PostgreSQL y verifican que las 45 tablas del nivel 3 existan, tengan PK UUID generada en la aplicación y resuelvan todas sus claves foráneas.

## Entorno completo en contenedores

```powershell
docker compose up --build
```

Levanta `db`, `redis`, `api`, `worker` (Celery) y `beat` (Celery Beat). El servicio `api` aplica `alembic upgrade head` antes de arrancar.

## Estructura

```
sigemi/
├── backend/
│   ├── alembic/            # migraciones versionadas
│   ├── app/
│   │   ├── core/           # configuración, seguridad
│   │   ├── db/             # base declarativa y sesión
│   │   └── models/         # 45 tablas del nivel 3, por subsistema
│   ├── tests/
│   └── requirements*.txt
├── frontend/
├── odd/tasks/              # documentos de trabajo por feature
├── docker-compose.yml
└── env.example
```
