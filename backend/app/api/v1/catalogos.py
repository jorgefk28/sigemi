"""Clinical catalog endpoints (UCE-DIAG-10, RF-16).

Both catalogs answer the same envelope and the same rules. Read is open to the
roles that need the selectors (a biochemist registers a sample and writes an
indication); writing is administrator-only, exactly as the UCE precondition
says.

Deactivating is a logical ``estado = inactivo``: level 3 keeps the row so that
historical analyses and appointments still resolve their type, and UCE-DIAG-10
excepción del paso 6 says so explicitly.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.db.session import get_db
from app.models.access import Usuario
from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.enums import AccionAuditoria, EstadoActivo
from app.schemas.catalogos import (
    TipoAnalisisCreate,
    TipoAnalisisList,
    TipoAnalisisRead,
    TipoAnalisisUpdate,
    TipoMuestraCreate,
    TipoMuestraList,
    TipoMuestraRead,
    TipoMuestraUpdate,
)
from app.services.audit import registrar_auditoria
from app.services.catalogos import (
    limpiar_descripcion,
    nombre_en_uso,
    normalizar_nombre,
    rechazo_carrera_de_unicidad,
    rechazo_nombre_duplicado,
)
from app.services.usuarios import ReglaDeUsuario

router = APIRouter(tags=["catalogos"])

MODULO = "catalogos"

#: Repository convention recorded in AGENTS.md ("Response contract").
LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100

ENTIDAD_TIPO_ANALISIS = "tipo_analisis"
ENTIDAD_TIPO_MUESTRA = "tipo_muestra"

LECTURA = ("bioquimico", "administrador")
ESCRITURA = ("administrador",)


def _rechazo(regla: ReglaDeUsuario) -> JSONResponse:
    """Answer ``400`` with the field-scoped body the SPA expects."""
    contenido: dict[str, str] = {"detail": regla.detail}
    if regla.campo is not None:
        contenido["campo"] = regla.campo
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=contenido)


def _condiciones(modelo, q: str | None, estado: str | None) -> list:
    """Filters shared by both catalogs: free text on the name, and the state."""
    condiciones = []
    if q and q.strip():
        condiciones.append(modelo.nombre.ilike(f"%{q.strip()}%"))
    if estado:
        if estado not in {EstadoActivo.ACTIVO.value, EstadoActivo.INACTIVO.value}:
            raise ValueError(estado)
        condiciones.append(modelo.estado == estado)
    return condiciones


def _listar(
    db: Session, modelo, q: str | None, estado: str | None, limit: int, offset: int
):
    limite = min(limit, LIMITE_MAXIMO)
    condiciones = _condiciones(modelo, q, estado)

    total = db.scalar(select(func.count()).select_from(modelo).where(*condiciones)) or 0
    filas = list(
        db.scalars(
            select(modelo)
            .where(*condiciones)
            .order_by(modelo.nombre)
            .limit(limite)
            .offset(offset)
        ).all()
    )
    return filas, total, limite


# --------------------------------------------------------------------------
# Tipos de análisis
# --------------------------------------------------------------------------


@router.get("/tipos-analisis", response_model=TipoAnalisisList)
def listar_tipos_analisis(
    q: str | None = None,
    estado: str | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> TipoAnalisisList:
    """List the analysis catalog, ordered by name (UCE-DIAG-10 paso 2)."""
    try:
        filas, total, limite = _listar(db, TipoAnalisis, q, estado, limit, offset)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estado debe ser activo o inactivo",
        ) from None

    return TipoAnalisisList(
        items=[TipoAnalisisRead.model_validate(fila) for fila in filas],
        total=total,
        limit=limite,
        offset=offset,
    )


@router.post(
    "/tipos-analisis",
    response_model=TipoAnalisisRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_tipo_analisis(
    request: Request,
    datos: TipoAnalisisCreate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> TipoAnalisisRead | JSONResponse:
    """Create an analysis type (UCE-DIAG-10, subflujo Crear)."""
    try:
        nombre = normalizar_nombre(datos.nombre)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    if nombre_en_uso(db, TipoAnalisis, nombre):
        return _rechazo(rechazo_nombre_duplicado(nombre))

    tipo = TipoAnalisis(
        nombre=nombre,
        descripcion=limpiar_descripcion(datos.descripcion),
        estado=EstadoActivo.ACTIVO.value,
    )
    db.add(tipo)
    try:
        db.flush()
    except IntegrityError:
        return _rechazo(rechazo_carrera_de_unicidad())

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.CREAR,
        entidad_afectada=ENTIDAD_TIPO_ANALISIS,
        entidad_id=tipo.id,
        direccion_ip=client_ip(request),
        cambios=[("nombre", None, nombre)],
    )
    db.commit()

    return TipoAnalisisRead.model_validate(tipo)


@router.patch("/tipos-analisis/{tipo_id}", response_model=TipoAnalisisRead)
def actualizar_tipo_analisis(
    request: Request,
    tipo_id: uuid.UUID,
    datos: TipoAnalisisUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> TipoAnalisisRead | JSONResponse:
    """Modify an analysis type (UCE-DIAG-10, subflujo Modificar)."""
    tipo = db.get(TipoAnalisis, tipo_id)
    if tipo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de análisis no encontrado",
        )

    enviados = datos.model_dump(exclude_unset=True, exclude_none=True)
    if not enviados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron campos para modificar",
        )

    cambios: list[tuple[str, str | None, str | None]] = []

    if "nombre" in enviados:
        try:
            nombre = normalizar_nombre(enviados["nombre"])
        except ReglaDeUsuario as regla:
            return _rechazo(regla)
        if nombre_en_uso(db, TipoAnalisis, nombre, excluir=tipo.id):
            return _rechazo(rechazo_nombre_duplicado(nombre))
        if tipo.nombre != nombre:
            cambios.append(("nombre", tipo.nombre, nombre))
            tipo.nombre = nombre

    if "descripcion" in enviados:
        descripcion = limpiar_descripcion(enviados["descripcion"])
        if tipo.descripcion != descripcion:
            cambios.append(("descripcion", tipo.descripcion, descripcion))
            tipo.descripcion = descripcion

    if not cambios:
        return TipoAnalisisRead.model_validate(tipo)

    try:
        db.flush()
    except IntegrityError:
        return _rechazo(rechazo_carrera_de_unicidad())

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD_TIPO_ANALISIS,
        entidad_id=tipo.id,
        direccion_ip=client_ip(request),
        cambios=cambios,
    )
    db.commit()

    return TipoAnalisisRead.model_validate(tipo)


@router.post("/tipos-analisis/{tipo_id}/baja", response_model=TipoAnalisisRead)
def dar_de_baja_tipo_analisis(
    request: Request,
    tipo_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> TipoAnalisisRead | JSONResponse:
    """Deactivate an analysis type (UCE-DIAG-10 excepción del paso 6)."""
    tipo = db.get(TipoAnalisis, tipo_id)
    if tipo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de análisis no encontrado",
        )

    if tipo.estado == EstadoActivo.INACTIVO.value:
        # Idempotent: a second click is not an error and adds no audit row.
        return TipoAnalisisRead.model_validate(tipo)

    anterior = tipo.estado
    tipo.estado = EstadoActivo.INACTIVO.value
    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD_TIPO_ANALISIS,
        entidad_id=tipo.id,
        direccion_ip=client_ip(request),
        cambios=[("estado", anterior, tipo.estado)],
    )
    db.commit()

    return TipoAnalisisRead.model_validate(tipo)


# --------------------------------------------------------------------------
# Tipos de muestra
# --------------------------------------------------------------------------


@router.get("/tipos-muestra", response_model=TipoMuestraList)
def listar_tipos_muestra(
    q: str | None = None,
    estado: str | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles(*LECTURA)),
) -> TipoMuestraList:
    """List the sample catalog, ordered by name (UCE-DIAG-10 paso 2)."""
    try:
        filas, total, limite = _listar(db, TipoMuestra, q, estado, limit, offset)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estado debe ser activo o inactivo",
        ) from None

    return TipoMuestraList(
        items=[TipoMuestraRead.model_validate(fila) for fila in filas],
        total=total,
        limit=limite,
        offset=offset,
    )


@router.post(
    "/tipos-muestra",
    response_model=TipoMuestraRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_tipo_muestra(
    request: Request,
    datos: TipoMuestraCreate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> TipoMuestraRead | JSONResponse:
    """Create a sample type (UCE-DIAG-10, subflujo Crear)."""
    try:
        nombre = normalizar_nombre(datos.nombre)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    if nombre_en_uso(db, TipoMuestra, nombre):
        return _rechazo(rechazo_nombre_duplicado(nombre))

    tipo = TipoMuestra(
        nombre=nombre,
        descripcion=limpiar_descripcion(datos.descripcion),
        estado=EstadoActivo.ACTIVO.value,
    )
    db.add(tipo)
    try:
        db.flush()
    except IntegrityError:
        return _rechazo(rechazo_carrera_de_unicidad())

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.CREAR,
        entidad_afectada=ENTIDAD_TIPO_MUESTRA,
        entidad_id=tipo.id,
        direccion_ip=client_ip(request),
        cambios=[("nombre", None, nombre)],
    )
    db.commit()

    return TipoMuestraRead.model_validate(tipo)


@router.patch("/tipos-muestra/{tipo_id}", response_model=TipoMuestraRead)
def actualizar_tipo_muestra(
    request: Request,
    tipo_id: uuid.UUID,
    datos: TipoMuestraUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> TipoMuestraRead | JSONResponse:
    """Modify a sample type (UCE-DIAG-10, subflujo Modificar)."""
    tipo = db.get(TipoMuestra, tipo_id)
    if tipo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de muestra no encontrado",
        )

    enviados = datos.model_dump(exclude_unset=True, exclude_none=True)
    if not enviados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron campos para modificar",
        )

    cambios: list[tuple[str, str | None, str | None]] = []

    if "nombre" in enviados:
        try:
            nombre = normalizar_nombre(enviados["nombre"])
        except ReglaDeUsuario as regla:
            return _rechazo(regla)
        if nombre_en_uso(db, TipoMuestra, nombre, excluir=tipo.id):
            return _rechazo(rechazo_nombre_duplicado(nombre))
        if tipo.nombre != nombre:
            cambios.append(("nombre", tipo.nombre, nombre))
            tipo.nombre = nombre

    if "descripcion" in enviados:
        descripcion = limpiar_descripcion(enviados["descripcion"])
        if tipo.descripcion != descripcion:
            cambios.append(("descripcion", tipo.descripcion, descripcion))
            tipo.descripcion = descripcion

    if not cambios:
        return TipoMuestraRead.model_validate(tipo)

    try:
        db.flush()
    except IntegrityError:
        return _rechazo(rechazo_carrera_de_unicidad())

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD_TIPO_MUESTRA,
        entidad_id=tipo.id,
        direccion_ip=client_ip(request),
        cambios=cambios,
    )
    db.commit()

    return TipoMuestraRead.model_validate(tipo)


@router.post("/tipos-muestra/{tipo_id}/baja", response_model=TipoMuestraRead)
def dar_de_baja_tipo_muestra(
    request: Request,
    tipo_id: uuid.UUID,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles(*ESCRITURA)),
) -> TipoMuestraRead | JSONResponse:
    """Deactivate a sample type (UCE-DIAG-10 excepción del paso 6)."""
    tipo = db.get(TipoMuestra, tipo_id)
    if tipo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de muestra no encontrado",
        )

    if tipo.estado == EstadoActivo.INACTIVO.value:
        return TipoMuestraRead.model_validate(tipo)

    anterior = tipo.estado
    tipo.estado = EstadoActivo.INACTIVO.value
    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD_TIPO_MUESTRA,
        entidad_id=tipo.id,
        direccion_ip=client_ip(request),
        cambios=[("estado", anterior, tipo.estado)],
    )
    db.commit()

    return TipoMuestraRead.model_validate(tipo)
