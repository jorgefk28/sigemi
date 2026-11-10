"""Agenda and scheduling models.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``,
section "Agenda / Atención" (tables: turno, indicacion_medica, espacio_atencion,
grupo_espacio, tipo_bloqueo, configuracion_agenda, periodo_inhabilitado,
bloqueo_agenda, disponibilidad_profesional, ausencia_profesional,
oferta_reagendacion).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from sqlalchemy import ARRAY, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow
from app.models.enums import (
    EstadoActivo,
    EstadoIndicacion,
    OfertaEstado,
    Recurrencia,
    TurnoEstado,
)


class GrupoEspacio(UUIDPrimaryKeyMixin, Base):
    """Logical grouping of care spaces (e.g. a floor, wing, or functional area)."""

    __tablename__ = "grupo_espacio"

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)


class EspacioAtencion(UUIDPrimaryKeyMixin, Base):
    """Physical or virtual care space where appointments take place."""

    __tablename__ = "espacio_atencion"

    nombre: Mapped[str] = mapped_column(nullable=False)
    tipo_espacio: Mapped[str] = mapped_column(nullable=False)
    capacidad_paralela: Mapped[int] = mapped_column(nullable=False, default=1)
    grupo_espacio_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("grupo_espacio.id"), nullable=True
    )
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class TipoBloqueo(UUIDPrimaryKeyMixin, Base):
    """Catalog of reasons for blocking agenda slots."""

    __tablename__ = "tipo_bloqueo"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_tipo_bloqueo_nombre"),
    )

    nombre: Mapped[str] = mapped_column(nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text(), nullable=True)


class IndicacionMedica(UUIDPrimaryKeyMixin, Base):
    """Medical instruction template that can be associated with appointments."""

    __tablename__ = "indicacion_medica"

    titulo: Mapped[str] = mapped_column(nullable=False)
    contenido: Mapped[str] = mapped_column(Text(), nullable=False)
    tipo_analisis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tipo_analisis.id"), nullable=True
    )
    estado: Mapped[str] = mapped_column(
        nullable=False, default=EstadoIndicacion.ACTIVA.value
    )
    fecha_creacion: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    fecha_modificacion: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow, onupdate=utcnow
    )


class Turno(UUIDPrimaryKeyMixin, Base):
    """Patient appointment booked into the agenda."""

    __tablename__ = "turno"
    __table_args__ = (
        Index("ix_turno_fecha_hora", "fecha_hora"),
        Index("ix_turno_paciente_id", "paciente_id"),
        Index("ix_turno_profesional_id", "profesional_id"),
        Index("ix_turno_espacio_id", "espacio_id"),
    )

    paciente_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("paciente.id"), nullable=False
    )
    indicacion_medica_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("indicacion_medica.id"), nullable=True
    )
    profesional_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profesional.id"), nullable=False
    )
    espacio_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("espacio_atencion.id"), nullable=False
    )
    fecha_hora: Mapped[datetime] = mapped_column(nullable=False)
    telefono_contacto: Mapped[str] = mapped_column(nullable=False)
    estado: Mapped[str] = mapped_column(
        nullable=False, default=TurnoEstado.PENDIENTE.value
    )
    reprogramaciones: Mapped[int] = mapped_column(nullable=False, default=0)
    motivo_cancelacion: Mapped[str | None] = mapped_column(nullable=True)
    motivo_reprogramacion: Mapped[str | None] = mapped_column(nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    fecha_atencion: Mapped[datetime | None] = mapped_column(nullable=True)


class ConfiguracionAgenda(UUIDPrimaryKeyMixin, Base):
    """Global agenda configuration (business hours, slot duration, etc.)."""

    __tablename__ = "configuracion_agenda"

    dias_habiles: Mapped[list[str]] = mapped_column(
        PG_ARRAY(String()), nullable=False
    )
    horario_inicio_manana: Mapped[time] = mapped_column(nullable=False)
    horario_fin_manana: Mapped[time] = mapped_column(nullable=False)
    horario_inicio_tarde: Mapped[time | None] = mapped_column(nullable=True)
    horario_fin_tarde: Mapped[time | None] = mapped_column(nullable=True)
    duracion_turno: Mapped[int] = mapped_column(nullable=False)
    intervalo_entre_turnos: Mapped[int] = mapped_column(nullable=False, default=0)
    max_turnos_por_franja: Mapped[int] = mapped_column(nullable=False)
    usuario_modificacion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_modificacion: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow, onupdate=utcnow
    )


class PeriodoInhabilitado(UUIDPrimaryKeyMixin, Base):
    """Recurring or one-off period during which agenda is unavailable."""

    __tablename__ = "periodo_inhabilitado"

    tipo_bloqueo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tipo_bloqueo.id"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_inicio: Mapped[date] = mapped_column(nullable=False)
    fecha_fin: Mapped[date] = mapped_column(nullable=False)
    hora_inicio: Mapped[time | None] = mapped_column(nullable=True)
    hora_fin: Mapped[time | None] = mapped_column(nullable=True)
    motivo: Mapped[str] = mapped_column(nullable=False)
    recurrencia: Mapped[str] = mapped_column(
        nullable=False, default=Recurrencia.NINGUNA.value
    )
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class BloqueoAgenda(UUIDPrimaryKeyMixin, Base):
    """Explicit agenda block applied to a space or group of spaces."""

    __tablename__ = "bloqueo_agenda"
    __table_args__ = (
        Index("ix_bloqueo_agenda_espacio_id", "espacio_id"),
        Index("ix_bloqueo_agenda_grupo_espacio_id", "grupo_espacio_id"),
    )

    tipo_bloqueo_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tipo_bloqueo.id"), nullable=False
    )
    espacio_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("espacio_atencion.id"), nullable=True
    )
    grupo_espacio_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("grupo_espacio.id"), nullable=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_inicio: Mapped[date] = mapped_column(nullable=False)
    fecha_fin: Mapped[date] = mapped_column(nullable=False)
    hora_inicio: Mapped[time | None] = mapped_column(nullable=True)
    hora_fin: Mapped[time | None] = mapped_column(nullable=True)
    motivo: Mapped[str] = mapped_column(nullable=False)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class DisponibilidadProfesional(UUIDPrimaryKeyMixin, Base):
    """Weekly availability schedule for a professional."""

    __tablename__ = "disponibilidad_profesional"
    __table_args__ = (
        Index("ix_disponibilidad_profesional_profesional_id", "profesional_id"),
    )

    profesional_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profesional.id"), nullable=False
    )
    dia_semana: Mapped[str] = mapped_column(nullable=False)
    horario_inicio_manana: Mapped[time | None] = mapped_column(nullable=True)
    horario_fin_manana: Mapped[time | None] = mapped_column(nullable=True)
    horario_inicio_tarde: Mapped[time | None] = mapped_column(nullable=True)
    horario_fin_tarde: Mapped[time | None] = mapped_column(nullable=True)
    max_turnos_por_franja: Mapped[int] = mapped_column(nullable=False)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class AusenciaProfesional(UUIDPrimaryKeyMixin, Base):
    """Recorded absence of a professional that may trigger rescheduling."""

    __tablename__ = "ausencia_profesional"
    __table_args__ = (
        Index("ix_ausencia_profesional_profesional_id", "profesional_id"),
    )

    profesional_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profesional.id"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_inicio: Mapped[date] = mapped_column(nullable=False)
    fecha_fin: Mapped[date] = mapped_column(nullable=False)
    hora_inicio: Mapped[time | None] = mapped_column(nullable=True)
    hora_fin: Mapped[time | None] = mapped_column(nullable=True)
    motivo: Mapped[str] = mapped_column(nullable=False)
    reprogramacion_aplicada: Mapped[bool] = mapped_column(nullable=False, default=False)
    estado: Mapped[str] = mapped_column(nullable=False, default=EstadoActivo.ACTIVO.value)


class OfertaReagendacion(UUIDPrimaryKeyMixin, Base):
    """Rescheduling offer sent to a patient when their slot is freed."""

    __tablename__ = "oferta_reagendacion"
    __table_args__ = (
        Index("ix_oferta_reagendacion_turno_id", "turno_id"),
        Index("ix_oferta_reagendacion_estado", "estado"),
    )

    turno_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("turno.id"), nullable=False
    )
    paciente_ofertado_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("paciente.id"), nullable=False
    )
    motivo_liberacion: Mapped[str] = mapped_column(nullable=False)
    ausencia_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ausencia_profesional.id"), nullable=True
    )
    fecha_oferta: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)
    fecha_vencimiento: Mapped[datetime] = mapped_column(nullable=False)
    estado: Mapped[str] = mapped_column(
        nullable=False, default=OfertaEstado.PENDIENTE.value
    )
    pausa_nocturna: Mapped[bool] = mapped_column(nullable=False, default=False)


__all__ = [
    "AusenciaProfesional",
    "BloqueoAgenda",
    "ConfiguracionAgenda",
    "DisponibilidadProfesional",
    "EspacioAtencion",
    "GrupoEspacio",
    "IndicacionMedica",
    "OfertaReagendacion",
    "PeriodoInhabilitado",
    "TipoBloqueo",
    "Turno",
]
