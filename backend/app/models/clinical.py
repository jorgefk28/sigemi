"""ORM models for the clinical core.

Source: ``Diagramas/modelo_esquema_bd_sigemi.md``, sections
"Área: Gestión clínica del paciente" and "Área: Análisis micológico" (level 3).

Tables: ``paciente``, ``ficha_clinica``, ``dato_clinico``,
``version_ficha_clinica``, ``muestra``, ``analisis_micologico``,
``hallazgo_analisis``, ``version_analisis``, ``informe_resultados``, ``otp``.

Foreign keys to ``usuario``, ``profesional``, ``tipo_analisis``, and
``tipo_muestra`` are declared as strings; those tables are owned by other
modules (``access.py``, ``catalogs.py``) and are resolved by SQLAlchemy at
metadata-bind time.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utcnow
from app.models.enums import AnalisisEstado, EstadoActivo, NivelRegistro


class Paciente(UUIDPrimaryKeyMixin, Base):
    """Patient master record."""

    __tablename__ = "paciente"

    numero_registro: Mapped[str] = mapped_column(nullable=False)
    dni: Mapped[str] = mapped_column(nullable=False)
    nombre: Mapped[str] = mapped_column(nullable=False)
    apellido: Mapped[str] = mapped_column(nullable=False)
    fecha_nacimiento: Mapped[date | None] = mapped_column(nullable=True)
    sexo: Mapped[str | None] = mapped_column(nullable=True)
    domicilio: Mapped[str | None] = mapped_column(nullable=True)
    telefono: Mapped[str] = mapped_column(nullable=False)
    correo_electronico: Mapped[str | None] = mapped_column(nullable=True)
    obra_social: Mapped[str | None] = mapped_column(nullable=True)
    nivel_registro: Mapped[str] = mapped_column(
        nullable=False, default=NivelRegistro.TEMPRANO.value
    )
    estado: Mapped[str] = mapped_column(
        nullable=False, default=EstadoActivo.ACTIVO.value
    )
    fecha_ingreso: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )

    __table_args__ = (
        UniqueConstraint("numero_registro", name="uq_paciente_numero_registro"),
        Index("ix_paciente_dni", "dni"),
        Index("ix_paciente_apellido_nombre", "apellido", "nombre"),
    )


class FichaClinica(UUIDPrimaryKeyMixin, Base):
    """Clinical record header; versioned via ``version_ficha_clinica``."""

    __tablename__ = "ficha_clinica"

    paciente_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("paciente.id"), nullable=False
    )
    profesional_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profesional.id"), nullable=False
    )
    fecha_consulta: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )
    version_actual: Mapped[int] = mapped_column(nullable=False, default=1)
    estado: Mapped[str] = mapped_column(
        nullable=False, default=EstadoActivo.ACTIVO.value
    )

    __table_args__ = (
        Index("ix_ficha_clinica_paciente_id", "paciente_id"),
    )


class DatoClinico(UUIDPrimaryKeyMixin, Base):
    """Key-value clinical datum attached to a ``ficha_clinica``."""

    __tablename__ = "dato_clinico"

    ficha_clinica_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ficha_clinica.id"), nullable=False
    )
    campo: Mapped[str] = mapped_column(nullable=False)
    valor: Mapped[str] = mapped_column(Text(), nullable=False)
    tipo_dato: Mapped[str] = mapped_column(nullable=False, default="texto")

    __table_args__ = (
        Index("ix_dato_clinico_ficha_clinica_id", "ficha_clinica_id"),
    )


class VersionFichaClinica(UUIDPrimaryKeyMixin, Base):
    """Audit snapshot for a single ``ficha_clinica`` version transition."""

    __tablename__ = "version_ficha_clinica"

    ficha_clinica_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ficha_clinica.id"), nullable=False
    )
    numero_version: Mapped[int] = mapped_column(nullable=False)
    datos_previos: Mapped[dict] = mapped_column(JSONB, nullable=False)
    datos_nuevos: Mapped[dict] = mapped_column(JSONB, nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_modificacion: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )
    motivo: Mapped[str] = mapped_column(nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "ficha_clinica_id",
            "numero_version",
            name="uq_version_ficha_clinica_ficha_clinica_id_numero_version",
        ),
    )


class Muestra(UUIDPrimaryKeyMixin, Base):
    """Biological sample collected from a patient.

    Level-3 note: ``analisis_micologico.muestra_id`` references this table
    (1 muestra → N análisis).
    """

    __tablename__ = "muestra"

    paciente_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("paciente.id"), nullable=False
    )
    tipo_muestra_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tipo_muestra.id"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_ingreso: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )
    observaciones: Mapped[str | None] = mapped_column(Text(), nullable=True)

    __table_args__ = (
        Index("ix_muestra_paciente_id", "paciente_id"),
        Index("ix_muestra_tipo_muestra_id", "tipo_muestra_id"),
    )


class AnalisisMicologico(UUIDPrimaryKeyMixin, Base):
    """Mycological analysis linked to a sample, clinical record, and type."""

    __tablename__ = "analisis_micologico"

    ficha_clinica_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ficha_clinica.id"), nullable=False
    )
    tipo_analisis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tipo_analisis.id"), nullable=False
    )
    muestra_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("muestra.id"), nullable=False
    )
    profesional_responsable_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profesional.id"), nullable=False
    )
    profesional_validador_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profesional.id"), nullable=True
    )
    version_actual: Mapped[int] = mapped_column(nullable=False, default=1)
    estado: Mapped[str] = mapped_column(
        nullable=False, default=AnalisisEstado.PENDIENTE.value
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )
    fecha_validacion: Mapped[datetime | None] = mapped_column(nullable=True)
    motivo_invalidacion: Mapped[str | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_analisis_micologico_estado", "estado"),
        Index("ix_analisis_micologico_muestra_id", "muestra_id"),
    )


class HallazgoAnalisis(UUIDPrimaryKeyMixin, Base):
    """Single finding recorded within a mycological analysis."""

    __tablename__ = "hallazgo_analisis"

    analisis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analisis_micologico.id"), nullable=False
    )
    tipo_hallazgo: Mapped[str] = mapped_column(nullable=False)
    dato: Mapped[str] = mapped_column(Text(), nullable=False)
    estado_alcanzado: Mapped[str | None] = mapped_column(nullable=True)
    fecha: Mapped[datetime] = mapped_column(nullable=False, default=utcnow)


class VersionAnalisis(UUIDPrimaryKeyMixin, Base):
    """Audit snapshot for a single ``analisis_micologico`` version transition."""

    __tablename__ = "version_analisis"

    analisis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analisis_micologico.id"), nullable=False
    )
    numero_version: Mapped[int] = mapped_column(nullable=False)
    datos_previos: Mapped[dict] = mapped_column(JSONB, nullable=False)
    datos_nuevos: Mapped[dict] = mapped_column(JSONB, nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuario.id"), nullable=False
    )
    fecha_modificacion: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )
    motivo: Mapped[str] = mapped_column(nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "analisis_id",
            "numero_version",
            name="uq_version_analisis_analisis_id_numero_version",
        ),
        Index("ix_version_analisis_analisis_id", "analisis_id"),
    )


class InformeResultados(UUIDPrimaryKeyMixin, Base):
    """Generated report file for a completed analysis."""

    __tablename__ = "informe_resultados"

    analisis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analisis_micologico.id"), nullable=False
    )
    ruta_archivo: Mapped[str] = mapped_column(nullable=False)
    fecha_generacion: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )
    hash_archivo: Mapped[str] = mapped_column(nullable=False)


class Otp(UUIDPrimaryKeyMixin, Base):
    """One-time password for external report access."""

    __tablename__ = "otp"

    analisis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("analisis_micologico.id"), nullable=False
    )
    codigo: Mapped[str] = mapped_column(nullable=False)
    fecha_generacion: Mapped[datetime] = mapped_column(
        nullable=False, default=utcnow
    )
    fecha_expiracion: Mapped[datetime] = mapped_column(nullable=False)
    usado: Mapped[bool] = mapped_column(nullable=False, default=False)
    fecha_uso: Mapped[datetime | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_otp_analisis_id", "analisis_id"),
    )


__all__ = [
    "AnalisisMicologico",
    "DatoClinico",
    "FichaClinica",
    "HallazgoAnalisis",
    "InformeResultados",
    "Muestra",
    "Otp",
    "Paciente",
    "VersionAnalisis",
    "VersionFichaClinica",
]
