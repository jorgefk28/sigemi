"""Bounded values for the ``estado`` and categorical columns.

Level 3 (`modelo_esquema_bd_sigemi.md`, "Convenciones") stores these as
``VARCHAR`` with the value set bounded by the application, not by a native
``ENUM``. This module is the single source of truth for those value sets; every
schema, service and test must import them from here instead of repeating string
literals.
"""

from __future__ import annotations

from enum import StrEnum


class EstadoActivo(StrEnum):
    """Generic ``activo`` / ``inactivo`` lifecycle used by catalog tables."""

    ACTIVO = "activo"
    INACTIVO = "inactivo"


class EstadoIndicacion(StrEnum):
    """``indicacion_medica.estado`` (level 3: activa / inactiva)."""

    ACTIVA = "activa"
    INACTIVA = "inactiva"


class RolCodigo(StrEnum):
    """Closed role catalog (level 2/3 decision: roles are prefixed and closed)."""

    BIOQUIMICO = "bioquimico"
    PROFESOR = "profesor"
    ADMINISTRADOR = "administrador"


class NivelRegistro(StrEnum):
    """Patient record completeness: created by the AI agent vs. full record."""

    TEMPRANO = "temprano"
    COMPLETO = "completo"


class TurnoEstado(StrEnum):
    CONFIRMADO = "confirmado"
    PENDIENTE = "pendiente"
    CANCELADO = "cancelado"
    ATENDIDO = "atendido"
    NO_ASISTIO = "no_asistio"


class ListaEsperaEstado(StrEnum):
    """State of a `lista_espera` entry (level 3, amendment S11)."""

    PENDIENTE = "pendiente"
    ASIGNADO = "asignado"
    RETIRADO = "retirado"


class AnalisisEstado(StrEnum):
    """Lifecycle of a mycological analysis (RF-06)."""

    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    TERMINADO = "terminado"
    VALIDADO = "validado"
    INVALIDADO = "invalidado"


class TipoEspacio(StrEnum):
    CONSULTORIO = "consultorio"
    BOX_TOMA_MUESTRA = "box_toma_muestra"


class Recurrencia(StrEnum):
    NINGUNA = "ninguna"
    SEMANAL = "semanal"
    ANUAL = "anual"


class MotivoLiberacion(StrEnum):
    """Why a booked slot was freed (UC-REC-04)."""

    AUSENCIA = "ausencia"
    CANCELACION = "cancelacion"
    NO_ASISTIO = "no_asistio"
    VENCIMIENTO = "vencimiento"


class OfertaEstado(StrEnum):
    PENDIENTE = "pendiente"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    EXPIRADA = "expirada"


class TipoMovimiento(StrEnum):
    INGRESO = "ingreso"
    RETIRO = "retiro"
    DEVOLUCION = "devolucion"


class LoteEstado(StrEnum):
    ACTIVO = "activo"
    AGOTADO = "agotado"
    VENCIDO = "vencido"


class EquipoEstado(StrEnum):
    OPERATIVO = "operativo"
    EN_MANTENIMIENTO = "en_mantenimiento"
    FUERA_SERVICIO = "fuera_servicio"
    INACTIVO = "inactivo"


class CriticidadEquipo(StrEnum):
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    CRITICA = "critica"


class TipoMantenimiento(StrEnum):
    PREVENTIVO = "preventivo"
    CORRECTIVO = "correctivo"
    CALIBRACION = "calibracion"


class AccionAuditoria(StrEnum):
    CREAR = "crear"
    MODIFICAR = "modificar"
    ELIMINAR = "eliminar"
    CONSULTAR = "consultar"
    ACCEDER = "acceder"
    BLOQUEAR = "bloquear"


class FormatoArchivo(StrEnum):
    PDF = "pdf"
    XLSX = "xlsx"
    CSV = "csv"


class DiaSemana(StrEnum):
    """Single-letter weekday codes used by agenda configuration."""

    LUNES = "L"
    MARTES = "M"
    MIERCOLES = "X"
    JUEVES = "J"
    VIERNES = "V"
    SABADO = "S"
    DOMINGO = "D"


__all__ = [
    "AccionAuditoria",
    "AnalisisEstado",
    "CriticidadEquipo",
    "DiaSemana",
    "EquipoEstado",
    "EstadoActivo",
    "EstadoIndicacion",
    "FormatoArchivo",
    "LoteEstado",
    "MotivoLiberacion",
    "NivelRegistro",
    "OfertaEstado",
    "Recurrencia",
    "RolCodigo",
    "TipoEspacio",
    "TipoMantenimiento",
    "TipoMovimiento",
    "TurnoEstado",
]
