"""User and role administration endpoints (UCE-SEG-02, RF-13 + RF-14).

Every route is ``administrador``-only, because the whole module is the access
control panel itself. Every mutation writes exactly one audit record with its
field-level changes, and the baja is logical: ``estado`` becomes ``inactivo``
and the row is never deleted (S1).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import client_ip, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.access import Rol, Usuario, UsuarioRol
from app.models.enums import AccionAuditoria, EstadoActivo
from app.schemas.access import (
    RolesUpdate,
    UsuarioCreate,
    UsuarioList,
    UsuarioRead,
    UsuarioUpdate,
)
from app.services.access import (
    roles_de_usuario,
    serializar_usuario,
    serializar_usuarios,
)
from app.services.audit import registrar_auditoria
from app.services.usuarios import (
    ReglaDeUsuario,
    asignar_roles,
    normalizar_texto,
    resolver_roles,
    validar_contrasena,
    validar_estado,
)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

MODULO = "seguridad"
ENTIDAD = "usuario"

#: Repository convention recorded in AGENTS.md ("Response contract").
LIMITE_POR_DEFECTO = 20
LIMITE_MAXIMO = 100


def _rechazo(regla: ReglaDeUsuario) -> JSONResponse:
    """Answer ``400`` with the field-scoped body the SPA expects."""
    contenido: dict[str, str] = {"detail": regla.detail}
    if regla.campo is not None:
        contenido["campo"] = regla.campo
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content=contenido)


def _obtener(db: Session, usuario_id: uuid.UUID) -> Usuario:
    """Return the user or raise ``404``."""
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return usuario


def _correo_en_uso(db: Session, correo: str, excluir: uuid.UUID | None = None) -> bool:
    """Whether *correo* already belongs to a user, ignoring *excluir*."""
    statement = select(Usuario.id).where(
        func.lower(Usuario.correo_electronico) == correo
    )
    if excluir is not None:
        statement = statement.where(Usuario.id != excluir)
    return db.scalar(statement) is not None


def _escape_like(texto: str) -> str:
    """Escape the LIKE wildcards so ``q`` matches them literally."""
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _condiciones(
    q: str | None,
    correo_electronico: str | None,
    estado: str | None,
    rol: str | None,
):
    """Build the WHERE conditions shared by the listing and its count."""
    condiciones = []

    if q and q.strip():
        patron = f"%{_escape_like(q.strip())}%"
        condiciones.append(
            or_(
                Usuario.nombre.ilike(patron, escape="\\"),
                Usuario.apellido.ilike(patron, escape="\\"),
                Usuario.correo_electronico.ilike(patron, escape="\\"),
            )
        )

    if correo_electronico and correo_electronico.strip():
        condiciones.append(
            func.lower(Usuario.correo_electronico) == correo_electronico.strip().lower()
        )

    if estado:
        condiciones.append(Usuario.estado == estado)

    if rol:
        condiciones.append(
            Usuario.id.in_(
                select(UsuarioRol.usuario_id)
                .join(Rol, Rol.id == UsuarioRol.rol_id)
                .where(Rol.codigo == rol)
            )
        )

    return condiciones


@router.get("", response_model=UsuarioList)
def listar_usuarios(
    q: str | None = None,
    correo_electronico: str | None = None,
    estado: str | None = None,
    rol: str | None = None,
    limit: int = Query(LIMITE_POR_DEFECTO, ge=1),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("administrador")),
) -> UsuarioList:
    """List users (UCE-SEG-02, paso 2) with the pinned pagination envelope."""
    limite = min(limit, LIMITE_MAXIMO)
    condiciones = _condiciones(q, correo_electronico, estado, rol)

    total = (
        db.scalar(select(func.count()).select_from(Usuario).where(*condiciones)) or 0
    )
    usuarios = list(
        db.scalars(
            select(Usuario)
            .where(*condiciones)
            .order_by(
                Usuario.apellido,
                Usuario.nombre,
                Usuario.correo_electronico,
            )
            .limit(limite)
            .offset(offset)
        ).all()
    )

    return UsuarioList(
        items=serializar_usuarios(db, usuarios),
        total=total,
        limit=limite,
        offset=offset,
    )


@router.get("/{usuario_id}", response_model=UsuarioRead)
def obtener_usuario(
    usuario_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: Usuario = Depends(require_roles("administrador")),
) -> UsuarioRead:
    """Return one user's profile."""
    return serializar_usuario(db, _obtener(db, usuario_id))


@router.post("", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    request: Request,
    datos: UsuarioCreate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles("administrador")),
) -> UsuarioRead | JSONResponse:
    """Register a user (UCE-SEG-02, pasos 4-7)."""
    try:
        validar_contrasena(datos.contrasena)
        roles = resolver_roles(db, datos.roles)
        nombre = normalizar_texto("nombre", "El nombre", datos.nombre)
        apellido = normalizar_texto("apellido", "El apellido", datos.apellido)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    correo = datos.correo_electronico.strip().lower()
    if _correo_en_uso(db, correo):
        return _rechazo(
            ReglaDeUsuario(
                "Ya existe un usuario con ese correo electrónico",
                "correo_electronico",
            )
        )

    usuario = Usuario(
        nombre=nombre,
        apellido=apellido,
        correo_electronico=correo,
        contrasena_hash=hash_password(datos.contrasena),
        estado=EstadoActivo.ACTIVO.value,
    )
    db.add(usuario)
    db.flush()
    asignar_roles(db, usuario.id, roles)

    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.CREAR,
        entidad_afectada=ENTIDAD,
        entidad_id=usuario.id,
        direccion_ip=client_ip(request),
        cambios=[
            ("correo_electronico", None, correo),
            ("estado", None, usuario.estado),
            ("roles", None, ",".join(rol.codigo for rol in roles)),
        ],
    )
    db.commit()

    return serializar_usuario(db, usuario)


@router.patch("/{usuario_id}", response_model=UsuarioRead)
def actualizar_usuario(
    request: Request,
    usuario_id: uuid.UUID,
    datos: UsuarioUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles("administrador")),
) -> UsuarioRead | JSONResponse:
    """Modify a user, or deactivate it logically with ``estado = inactivo``."""
    usuario = _obtener(db, usuario_id)

    enviados = datos.model_dump(exclude_unset=True, exclude_none=True)
    if not enviados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron campos para modificar",
        )

    # Validate every field before touching the row: a rejected request must not
    # leave a half-applied change behind.
    normalizados: dict[str, str] = {}
    try:
        if "estado" in enviados:
            validar_estado(enviados["estado"])
            if (
                usuario.id == actor.id
                and enviados["estado"] == EstadoActivo.INACTIVO.value
            ):
                raise ReglaDeUsuario("No puede desactivar su propia cuenta", "estado")
            normalizados["estado"] = enviados["estado"]

        if "nombre" in enviados:
            normalizados["nombre"] = normalizar_texto(
                "nombre", "El nombre", enviados["nombre"]
            )

        if "apellido" in enviados:
            normalizados["apellido"] = normalizar_texto(
                "apellido", "El apellido", enviados["apellido"]
            )

        if "correo_electronico" in enviados:
            correo = enviados["correo_electronico"].strip().lower()
            if _correo_en_uso(db, correo, excluir=usuario.id):
                raise ReglaDeUsuario(
                    "Ya existe un usuario con ese correo electrónico",
                    "correo_electronico",
                )
            normalizados["correo_electronico"] = correo
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    cambios: list[tuple[str, str | None, str | None]] = []
    for campo, valor in normalizados.items():
        anterior = getattr(usuario, campo)
        if anterior == valor:
            continue
        setattr(usuario, campo, valor)
        cambios.append((campo, anterior, valor))

    if cambios:
        registrar_auditoria(
            db,
            usuario_id=actor.id,
            modulo=MODULO,
            accion=AccionAuditoria.MODIFICAR,
            entidad_afectada=ENTIDAD,
            entidad_id=usuario.id,
            direccion_ip=client_ip(request),
            cambios=cambios,
        )
    db.commit()

    return serializar_usuario(db, usuario)


@router.put("/{usuario_id}/roles", response_model=UsuarioRead)
def reemplazar_roles(
    request: Request,
    usuario_id: uuid.UUID,
    datos: RolesUpdate,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_roles("administrador")),
) -> UsuarioRead | JSONResponse:
    """Replace a user's role set with codes from the closed catalog (S3)."""
    usuario = _obtener(db, usuario_id)

    try:
        roles = resolver_roles(db, datos.roles)
    except ReglaDeUsuario as regla:
        return _rechazo(regla)

    anteriores = roles_de_usuario(db, usuario.id)
    nuevos = [rol.codigo for rol in roles]
    if anteriores == nuevos:
        return serializar_usuario(db, usuario)

    asignar_roles(db, usuario.id, roles)
    registrar_auditoria(
        db,
        usuario_id=actor.id,
        modulo=MODULO,
        accion=AccionAuditoria.MODIFICAR,
        entidad_afectada=ENTIDAD,
        entidad_id=usuario.id,
        direccion_ip=client_ip(request),
        cambios=[("roles", ",".join(anteriores) or None, ",".join(nuevos))],
    )
    db.commit()

    return serializar_usuario(db, usuario)
