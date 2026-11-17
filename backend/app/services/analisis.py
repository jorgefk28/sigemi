"""Business rules for mycological analyses (UCE-DIAG-02 a DIAG-14).

The state machine is the one UCE-DIAG-03 paso 5 and UCE-DIAG-04 fijan:

    pendiente -> en_proceso -> terminado -> validado (only through validation)
    pendiente | en_proceso -> invalidado (invalidation or sample rejection)

Anything else is rejected: «el sistema valida que la transición de estado sea la
siguiente en el flujo» and «un análisis invalidado no puede reanudarse sin una
nueva muestra».

The catalog of finding types does not exist in any level; it is A-05 in
``odd/DECISIONES-AUTONOMAS.md`` and lives only here.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access import Profesional, Usuario
from app.models.catalogs import TipoAnalisis, TipoMuestra
from app.models.clinical import (
    AnalisisMicologico,
    FichaClinica,
    HallazgoAnalisis,
    InformeResultados,
    Muestra,
    VersionAnalisis,
)
from app.services.usuarios import ReglaDeUsuario

PENDIENTE = "pendiente"
EN_PROCESO = "en_proceso"
TERMINADO = "terminado"
VALIDADO = "validado"
INVALIDADO = "invalidado"

#: Type of finding, declared in A-05. The form renders from this tuple.
TIPOS_HALLAZGO: tuple[tuple[str, str], ...] = (
    ("examen_directo", "Examen directo"),
    ("cultivo", "Cultivo"),
    ("identificacion", "Identificación"),
    ("observacion", "Observación"),
    ("otro", "Otro"),
)

CLAVES_HALLAZGO = tuple(clave for clave, _ in TIPOS_HALLAZGO)

#: Transitions allowed by DIAG-03 paso 5. ``validado`` only through validation,
#: and the exception of that step rejects ``pendiente`` -> ``terminado`` directly.
TRANSICIONES = {
    PENDIENTE: (EN_PROCESO,),
    EN_PROCESO: (TERMINADO,),
}

#: States from which an analysis can be invalidated or rejected (DIAG-08, DIAG-14).
INVALIDABLES = (PENDIENTE, EN_PROCESO)


def etiqueta_hallazgo(clave: str) -> str:
    for codigo, texto in TIPOS_HALLAZGO:
        if codigo == clave:
            return texto
    return clave


def validar_hallazgos(hallazgos: list[dict[str, object]]) -> list[dict[str, object]]:
    """Validate the findings of one update (A-05)."""
    normalizados: list[dict[str, object]] = []
    for hallazgo in hallazgos:
        tipo = str(hallazgo.get("tipo_hallazgo", "")).strip()
        if tipo not in CLAVES_HALLAZGO:
            raise ReglaDeUsuario(
                f"Tipo de hallazgo desconocido: «{tipo}»", "tipo_hallazgo"
            )
        dato = str(hallazgo.get("dato", "")).strip()
        if not dato:
            raise ReglaDeUsuario("El dato del hallazgo no puede estar vacío", "dato")
        estado = hallazgo.get("estado_alcanzado")
        normalizados.append(
            {
                "tipo_hallazgo": tipo,
                "dato": dato,
                "estado_alcanzado": str(estado).strip() if estado else None,
            }
        )
    return normalizados


def validar_transicion(actual: str, nuevo: str) -> None:
    """Reject a transition the flow does not allow (DIAG-03 paso 5)."""
    if nuevo == VALIDADO:
        raise ReglaDeUsuario(
            "El estado «validado» sólo se alcanza validando el análisis", "estado"
        )
    if nuevo == INVALIDADO:
        raise ReglaDeUsuario(
            "Para invalidar un análisis hay que registrar el motivo", "estado"
        )
    permitidos = TRANSICIONES.get(actual, ())
    if nuevo not in permitidos:
        raise ReglaDeUsuario(f"No se puede pasar de «{actual}» a «{nuevo}»", "estado")


def resolver_profesional(db: Session, actor: Usuario) -> Profesional:
    """The professional profile of the session (A-03)."""
    profesional = db.scalar(
        select(Profesional).where(Profesional.usuario_id == actor.id)
    )
    if profesional is None:
        raise ReglaDeUsuario(
            "El usuario no tiene perfil profesional; pedile al administrador que lo cargue",
            "profesional",
        )
    return profesional


def ficha_vigente(
    db: Session, paciente_id: uuid.UUID, ficha_id: uuid.UUID | None
) -> FichaClinica:
    """The record the analysis hangs from (A-13)."""
    if ficha_id is not None:
        ficha = db.get(FichaClinica, ficha_id)
        if ficha is None or ficha.paciente_id != paciente_id:
            raise ReglaDeUsuario(
                "La ficha clínica no corresponde al paciente", "ficha_clinica_id"
            )
        return ficha

    ficha = db.scalar(
        select(FichaClinica)
        .where(FichaClinica.paciente_id == paciente_id)
        .order_by(FichaClinica.fecha_consulta.desc())
        .limit(1)
    )
    if ficha is None:
        raise ReglaDeUsuario(
            "El paciente no tiene ficha clínica: registrá la consulta antes de ingresar la muestra",
            "ficha_clinica_id",
        )
    return ficha


def combinar_admitida(
    db: Session, tipo_analisis_id: uuid.UUID, tipo_muestra_id: uuid.UUID
) -> None:
    """Enforce the N:N rule of level 3 (L224-233) only when the catalog has pairs.

    The rule says a combination must be admitted. With an empty relation the
    application cannot prove it, so it does not block: an empty catalog would
    otherwise make the whole clinical flow unusable. Recorded as A-15.
    """
    from app.models.catalogs import TipoAnalisisTipoMuestra

    pares = db.scalar(select(TipoAnalisisTipoMuestra.id).limit(1))
    if pares is None:
        return

    admitido = db.scalar(
        select(TipoAnalisisTipoMuestra.id).where(
            TipoAnalisisTipoMuestra.tipo_analisis_id == tipo_analisis_id,
            TipoAnalisisTipoMuestra.tipo_muestra_id == tipo_muestra_id,
        )
    )
    if admitido is None:
        raise ReglaDeUsuario(
            "La combinación de tipo de análisis y tipo de muestra no está admitida",
            "tipo_muestra_id",
        )


def addendum_vigente(db: Session, analisis_id: uuid.UUID) -> dict[str, str] | None:
    """The last addendum of an analysis, read from its latest version (DIAG-13)."""
    version = db.scalar(
        select(VersionAnalisis)
        .where(VersionAnalisis.analisis_id == analisis_id)
        .order_by(VersionAnalisis.numero_version.desc())
        .limit(1)
    )
    if version is None:
        return None
    addendum = (version.datos_nuevos or {}).get("addendum")
    return addendum if isinstance(addendum, dict) else None


def serializar(
    db: Session, analisis: list[AnalisisMicologico]
) -> list[dict[str, object]]:
    """Shape analyses with patient, types, professionals, findings and addendum."""
    if not analisis:
        return []

    from app.models.access import Usuario
    from app.models.clinical import Paciente

    ids = {fila.id for fila in analisis}
    fichas = {
        fila.id: fila
        for fila in db.scalars(
            select(FichaClinica).where(
                FichaClinica.id.in_({f.ficha_clinica_id for f in analisis})
            )
        )
    }
    pacientes = {
        fila.id: fila
        for fila in db.scalars(
            select(Paciente).where(
                Paciente.id.in_({f.paciente_id for f in fichas.values()})
            )
        )
    }
    tipos_analisis = {
        fila.id: fila.nombre
        for fila in db.scalars(
            select(TipoAnalisis).where(
                TipoAnalisis.id.in_({f.tipo_analisis_id for f in analisis})
            )
        )
    }
    muestras = {
        fila.id: fila
        for fila in db.scalars(
            select(Muestra).where(Muestra.id.in_({f.muestra_id for f in analisis}))
        )
    }
    tipos_muestra = {
        fila.id: fila.nombre
        for fila in db.scalars(
            select(TipoMuestra).where(
                TipoMuestra.id.in_({m.tipo_muestra_id for m in muestras.values()})
            )
        )
    }
    profesionales = {
        fila.id: fila
        for fila in db.scalars(
            select(Profesional).where(
                Profesional.id.in_(
                    {f.profesional_responsable_id for f in analisis}
                    | {
                        f.profesional_validador_id
                        for f in analisis
                        if f.profesional_validador_id
                    }
                )
            )
        )
    }
    usuarios = {
        fila.id: fila
        for fila in db.scalars(
            select(Usuario).where(
                Usuario.id.in_({p.usuario_id for p in profesionales.values()})
            )
        )
    }
    hallazgos: dict[uuid.UUID, list[HallazgoAnalisis]] = {
        analisis_id: [] for analisis_id in ids
    }
    for hallazgo in db.scalars(
        select(HallazgoAnalisis)
        .where(HallazgoAnalisis.analisis_id.in_(ids))
        .order_by(HallazgoAnalisis.fecha)
    ):
        hallazgos[hallazgo.analisis_id].append(hallazgo)

    def nombre(profesional_id: uuid.UUID | None) -> str | None:
        if profesional_id is None:
            return None
        profesional = profesionales.get(profesional_id)
        usuario = usuarios.get(profesional.usuario_id) if profesional else None
        return f"{usuario.nombre} {usuario.apellido}" if usuario else None

    resultado: list[dict[str, object]] = []
    for fila in analisis:
        ficha = fichas[fila.ficha_clinica_id]
        paciente = pacientes[ficha.paciente_id]
        muestra = muestras[fila.muestra_id]
        resultado.append(
            {
                "id": fila.id,
                "ficha_clinica_id": fila.ficha_clinica_id,
                "paciente_id": paciente.id,
                "paciente_apellido": paciente.apellido,
                "paciente_nombre": paciente.nombre,
                "paciente_dni": paciente.dni,
                "tipo_analisis_id": fila.tipo_analisis_id,
                "tipo_analisis_nombre": tipos_analisis.get(fila.tipo_analisis_id, ""),
                "muestra_id": fila.muestra_id,
                "tipo_muestra_nombre": tipos_muestra.get(muestra.tipo_muestra_id, ""),
                "profesional_responsable_id": fila.profesional_responsable_id,
                "profesional_responsable_nombre": nombre(
                    fila.profesional_responsable_id
                )
                or "",
                "profesional_validador_id": fila.profesional_validador_id,
                "profesional_validador_nombre": nombre(fila.profesional_validador_id),
                "version_actual": fila.version_actual,
                "estado": fila.estado,
                "fecha_creacion": fila.fecha_creacion,
                "fecha_validacion": fila.fecha_validacion,
                "motivo_invalidacion": fila.motivo_invalidacion,
                "hallazgos": hallazgos[fila.id],
                "addendum": addendum_vigente(db, fila.id),
            }
        )
    return resultado


def serializar_uno(db: Session, analisis: AnalisisMicologico) -> dict[str, object]:
    return serializar(db, [analisis])[0]


def informe_descargado(db: Session, analisis_id: uuid.UUID) -> bool:
    """Whether an ``informe_resultados`` row exists for the analysis (DIAG-12)."""
    return (
        db.scalar(
            select(InformeResultados.id).where(
                InformeResultados.analisis_id == analisis_id
            )
        )
        is not None
    )
