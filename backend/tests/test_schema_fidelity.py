"""Level-3 fidelity contract for the persistence layer (specs S3-S7).

Every assertion here restates what `Diagramas/modelo_esquema_bd_sigemi.md`
(level 3) declares, not what the models happen to do. If a model and this file
disagree, the model is the defect.

Metadata-level (compiled with the PostgreSQL dialect): no live database needed.
"""

from __future__ import annotations

import pytest
from sqlalchemy import DateTime, Enum, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

import app.models  # noqa: F401  (registers every table)
from app.db.base import Base

LEVEL3_COLUMNS: dict[str, set[str]] = {
    "paciente": {
        "id",
        "numero_registro",
        "dni",
        "nombre",
        "apellido",
        "fecha_nacimiento",
        "sexo",
        "domicilio",
        "telefono",
        "correo_electronico",
        "obra_social",
        "nivel_registro",
        "estado",
        "fecha_ingreso",
    },
    "ficha_clinica": {
        "id",
        "paciente_id",
        "profesional_id",
        "fecha_consulta",
        "version_actual",
        "estado",
    },
    "dato_clinico": {"id", "ficha_clinica_id", "campo", "valor", "tipo_dato"},
    "version_ficha_clinica": {
        "id",
        "ficha_clinica_id",
        "numero_version",
        "datos_previos",
        "datos_nuevos",
        "usuario_id",
        "fecha_modificacion",
        "motivo",
    },
    "turno": {
        "id",
        "paciente_id",
        "indicacion_medica_id",
        "tipo_analisis_id",
        "profesional_id",
        "espacio_id",
        "serie_id",
        "fecha_hora",
        "telefono_contacto",
        "estado",
        "reprogramaciones",
        "motivo_cancelacion",
        "motivo_reprogramacion",
        "motivo_inasistencia",
        "fecha_creacion",
        "fecha_atencion",
    },
    # S11 (level-3 amendment, L2): the waiting list has no table before it.
    "lista_espera": {
        "id",
        "paciente_id",
        "tipo_analisis_id",
        "fecha_solicitud",
        "estado",
        "usuario_id",
        "observaciones",
    },
    "indicacion_medica": {
        "id",
        "titulo",
        "contenido",
        "tipo_analisis_id",
        "estado",
        "fecha_creacion",
        "fecha_modificacion",
    },
    "muestra": {
        "id",
        "paciente_id",
        "tipo_muestra_id",
        "usuario_id",
        "fecha_ingreso",
        "observaciones",
    },
    "analisis_micologico": {
        "id",
        "ficha_clinica_id",
        "tipo_analisis_id",
        "muestra_id",
        "profesional_responsable_id",
        "profesional_validador_id",
        "version_actual",
        "estado",
        "fecha_creacion",
        "fecha_validacion",
        "motivo_invalidacion",
    },
    "hallazgo_analisis": {
        "id",
        "analisis_id",
        "tipo_hallazgo",
        "dato",
        "estado_alcanzado",
        "fecha",
    },
    "version_analisis": {
        "id",
        "analisis_id",
        "numero_version",
        "datos_previos",
        "datos_nuevos",
        "usuario_id",
        "fecha_modificacion",
        "motivo",
    },
    "informe_resultados": {
        "id",
        "analisis_id",
        "ruta_archivo",
        "fecha_generacion",
        "hash_archivo",
    },
    "otp": {
        "id",
        "analisis_id",
        "codigo",
        "fecha_generacion",
        "fecha_expiracion",
        "usado",
        "fecha_uso",
    },
    "usuario": {
        "id",
        "nombre",
        "apellido",
        "correo_electronico",
        "contrasena_hash",
        "estado",
        "intentos_fallidos",
        "bloqueado_hasta",
        "fecha_registro",
    },
    "rol": {"id", "codigo", "nombre", "descripcion"},
    "usuario_rol": {"id", "usuario_id", "rol_id"},
    "profesional": {"id", "usuario_id", "matricula", "especialidad", "estado"},
    "tipo_analisis": {"id", "nombre", "descripcion", "estado"},
    "tipo_muestra": {"id", "nombre", "descripcion", "estado"},
    "tipo_analisis_tipo_muestra": {"id", "tipo_analisis_id", "tipo_muestra_id"},
    "espacio_atencion": {
        "id",
        "nombre",
        "tipo_espacio",
        "capacidad_paralela",
        "grupo_espacio_id",
        "descripcion",
        "estado",
    },
    "grupo_espacio": {"id", "nombre", "descripcion"},
    "tipo_bloqueo": {"id", "nombre", "descripcion"},
    "configuracion_agenda": {
        "id",
        "dias_habiles",
        "horario_inicio_manana",
        "horario_fin_manana",
        "horario_inicio_tarde",
        "horario_fin_tarde",
        "duracion_turno",
        "intervalo_entre_turnos",
        "max_turnos_por_franja",
        "usuario_modificacion_id",
        "fecha_modificacion",
    },
    "periodo_inhabilitado": {
        "id",
        "tipo_bloqueo_id",
        "usuario_id",
        "fecha_inicio",
        "fecha_fin",
        "hora_inicio",
        "hora_fin",
        "motivo",
        "recurrencia",
        "estado",
    },
    "bloqueo_agenda": {
        "id",
        "tipo_bloqueo_id",
        "espacio_id",
        "grupo_espacio_id",
        "usuario_id",
        "fecha_inicio",
        "fecha_fin",
        "hora_inicio",
        "hora_fin",
        "motivo",
        "estado",
    },
    "disponibilidad_profesional": {
        "id",
        "profesional_id",
        "dia_semana",
        "horario_inicio_manana",
        "horario_fin_manana",
        "horario_inicio_tarde",
        "horario_fin_tarde",
        "max_turnos_por_franja",
        "estado",
    },
    "ausencia_profesional": {
        "id",
        "profesional_id",
        "usuario_id",
        "fecha_inicio",
        "fecha_fin",
        "hora_inicio",
        "hora_fin",
        "motivo",
        "reprogramacion_aplicada",
        "estado",
    },
    "oferta_reagendacion": {
        "id",
        "turno_id",
        "paciente_ofertado_id",
        "motivo_liberacion",
        "ausencia_id",
        "fecha_oferta",
        "fecha_vencimiento",
        "estado",
        "pausa_nocturna",
    },
    "categoria_insumo": {"id", "nombre", "descripcion", "estado"},
    "ubicacion_almacenamiento": {"id", "nombre", "descripcion", "estado"},
    "insumo": {
        "id",
        "nombre",
        "descripcion",
        "unidad_medida",
        "categoria_id",
        "ubicacion_id",
        "umbral_minimo",
        "dias_alerta_vencimiento",
        "estado",
        "fecha_creacion",
    },
    "lote": {
        "id",
        "insumo_id",
        "numero_lote",
        "fecha_ingreso",
        "fecha_vencimiento",
        "cantidad_inicial",
        "cantidad_actual",
        "estado",
    },
    "movimiento_inventario": {
        "id",
        "lote_id",
        "usuario_id",
        "ubicacion_id",
        "analisis_id",
        "devolucion_referencia_id",
        "tipo_movimiento",
        "cantidad",
        "practica_educativa",
        "fecha",
    },
    "categoria_residuo": {
        "id",
        "nombre",
        "clase_peligrosidad",
        "descripcion",
        "estado",
    },
    "instruccion_almacenamiento": {
        "id",
        "categoria_residuo_id",
        "paso",
        "instruccion",
    },
    "residuo_quimico": {
        "id",
        "categoria_residuo_id",
        "usuario_id",
        "analisis_id",
        "disposicion_final_id",
        "fecha_hora",
        "volumen",
        "peso",
        "descripcion",
    },
    "disposicion_final": {
        "id",
        "usuario_id",
        "fecha",
        "metodo_tratamiento",
        "descripcion",
    },
    "reporte_residuos": {
        "id",
        "usuario_id",
        "mes_anio",
        "rango_fecha_inicio",
        "rango_fecha_fin",
        "ruta_archivo",
        "fecha_generacion",
    },
    "reporte_inventario": {
        "id",
        "usuario_id",
        "rango_fecha_inicio",
        "rango_fecha_fin",
        "ruta_archivo",
        "fecha_generacion",
    },
    "tipo_equipo": {"id", "nombre", "descripcion", "criticidad"},
    "equipo": {
        "id",
        "tipo_equipo_id",
        "numero_serie",
        "nombre",
        "marca",
        "proveedor",
        "fecha_adquisicion",
        "garantia_inicio",
        "garantia_fin",
        "ubicacion_id",
        "estado",
        "requisitos_uso",
    },
    "mantenimiento_equipo": {
        "id",
        "equipo_id",
        "prestador",
        "tipo_mantenimiento",
        "fecha",
        "descripcion",
        "proximo_mantenimiento",
    },
    "auditoria": {
        "id",
        "usuario_id",
        "fecha_hora",
        "direccion_ip",
        "modulo",
        "accion",
        "entidad_afectada",
        "entidad_id",
    },
    "cambio_auditoria": {
        "id",
        "auditoria_id",
        "campo",
        "valor_anterior",
        "valor_nuevo",
    },
    "reporte": {
        "id",
        "usuario_id",
        "tipo_reporte",
        "rango_fecha_inicio",
        "rango_fecha_fin",
        "ruta_archivo",
        "formato_archivo",
        "fecha_generacion",
        "mes_anio",
    },
}

# S3: every column the level-3 document declares as `text`.
LEVEL3_TEXT_COLUMNS: dict[str, set[str]] = {
    "dato_clinico": {"valor"},
    "indicacion_medica": {"contenido"},
    "lista_espera": {"observaciones"},
    "muestra": {"observaciones"},
    "hallazgo_analisis": {"dato"},
    "tipo_analisis": {"descripcion"},
    "tipo_muestra": {"descripcion"},
    "espacio_atencion": {"descripcion"},
    "grupo_espacio": {"descripcion"},
    "tipo_bloqueo": {"descripcion"},
    "categoria_insumo": {"descripcion"},
    "ubicacion_almacenamiento": {"descripcion"},
    "insumo": {"descripcion"},
    "categoria_residuo": {"descripcion"},
    "instruccion_almacenamiento": {"instruccion"},
    "residuo_quimico": {"descripcion"},
    "disposicion_final": {"descripcion"},
    "tipo_equipo": {"descripcion"},
    "equipo": {"requisitos_uso"},
    "mantenimiento_equipo": {"descripcion"},
    "cambio_auditoria": {"valor_anterior", "valor_nuevo"},
}

# S7: "Indices sugeridos" + "Indices (Equipos)" + "Indices (Transversales)".
LEVEL3_INDEXES: dict[str, list[tuple[str, ...]]] = {
    "paciente": [("dni",), ("apellido", "nombre")],
    "turno": [("fecha_hora",), ("paciente_id",), ("profesional_id",), ("espacio_id",)],
    # S11: the two indexes the amendment declares for the waiting list.
    "lista_espera": [("estado",), ("fecha_solicitud",)],
    "analisis_micologico": [("estado",), ("muestra_id",)],
    "otp": [("analisis_id",)],
    "ficha_clinica": [("paciente_id",)],
    "dato_clinico": [("ficha_clinica_id",)],
    "tipo_analisis_tipo_muestra": [("tipo_analisis_id",), ("tipo_muestra_id",)],
    "disponibilidad_profesional": [("profesional_id",)],
    "ausencia_profesional": [("profesional_id",)],
    "bloqueo_agenda": [("espacio_id",), ("grupo_espacio_id",)],
    "oferta_reagendacion": [("turno_id",), ("estado",)],
    "lote": [("insumo_id",), ("fecha_vencimiento",)],
    "movimiento_inventario": [("lote_id",), ("fecha",)],
    "insumo": [("categoria_id",), ("umbral_minimo",)],
    "residuo_quimico": [("fecha_hora",), ("categoria_residuo_id",)],
    "instruccion_almacenamiento": [("categoria_residuo_id",)],
    "muestra": [("paciente_id",), ("tipo_muestra_id",)],
    "version_analisis": [("analisis_id",)],
    "usuario_rol": [("usuario_id",), ("rol_id",)],
    "equipo": [("tipo_equipo_id",), ("ubicacion_id",), ("numero_serie",)],
    "mantenimiento_equipo": [("equipo_id", "fecha")],
    "auditoria": [("fecha_hora",), ("entidad_afectada", "entidad_id"), ("usuario_id",)],
    "cambio_auditoria": [("auditoria_id",)],
    "reporte": [("usuario_id",), ("fecha_generacion",)],
}

# S5: business unique keys.
LEVEL3_UNIQUES: dict[str, list[tuple[str, ...]]] = {
    "rol": [("codigo",)],
    "usuario_rol": [("usuario_id", "rol_id")],
    "profesional": [("usuario_id",)],
    "paciente": [("numero_registro",)],
    "tipo_analisis": [("nombre",)],
    "tipo_muestra": [("nombre",)],
    "tipo_bloqueo": [("nombre",)],
    "categoria_insumo": [("nombre",)],
    "categoria_residuo": [("nombre",)],
    "tipo_equipo": [("nombre",)],
    "tipo_analisis_tipo_muestra": [("tipo_analisis_id", "tipo_muestra_id")],
    "instruccion_almacenamiento": [("categoria_residuo_id", "paso")],
}

# S3/S6: foreign keys and their nullability as the document states them.
LEVEL3_FOREIGN_KEYS: dict[tuple[str, str], tuple[str, bool]] = {
    ("ficha_clinica", "paciente_id"): ("paciente", False),
    ("ficha_clinica", "profesional_id"): ("profesional", False),
    ("dato_clinico", "ficha_clinica_id"): ("ficha_clinica", False),
    ("version_ficha_clinica", "ficha_clinica_id"): ("ficha_clinica", False),
    ("version_ficha_clinica", "usuario_id"): ("usuario", False),
    ("turno", "indicacion_medica_id"): ("indicacion_medica", True),
    # S11: profesional and espacio are assigned after booking, so neither is
    # required at creation (level-2 decision 5).
    ("turno", "espacio_id"): ("espacio_atencion", True),
    ("turno", "profesional_id"): ("profesional", True),
    ("turno", "tipo_analisis_id"): ("tipo_analisis", True),
    # S11: level 1 (UCE-REC-10) requires the analysis type, so it stops being nullable.
    ("indicacion_medica", "tipo_analisis_id"): ("tipo_analisis", False),
    ("lista_espera", "paciente_id"): ("paciente", False),
    ("lista_espera", "tipo_analisis_id"): ("tipo_analisis", True),
    ("lista_espera", "usuario_id"): ("usuario", True),
    ("muestra", "paciente_id"): ("paciente", False),
    ("muestra", "tipo_muestra_id"): ("tipo_muestra", False),
    ("muestra", "usuario_id"): ("usuario", False),
    ("analisis_micologico", "muestra_id"): ("muestra", False),
    ("analisis_micologico", "profesional_responsable_id"): ("profesional", False),
    ("analisis_micologico", "profesional_validador_id"): ("profesional", True),
    ("hallazgo_analisis", "analisis_id"): ("analisis_micologico", False),
    ("version_analisis", "analisis_id"): ("analisis_micologico", False),
    ("informe_resultados", "analisis_id"): ("analisis_micologico", False),
    ("otp", "analisis_id"): ("analisis_micologico", False),
    ("espacio_atencion", "grupo_espacio_id"): ("grupo_espacio", True),
    ("periodo_inhabilitado", "tipo_bloqueo_id"): ("tipo_bloqueo", False),
    ("bloqueo_agenda", "espacio_id"): ("espacio_atencion", True),
    ("bloqueo_agenda", "grupo_espacio_id"): ("grupo_espacio", True),
    ("oferta_reagendacion", "turno_id"): ("turno", False),
    ("oferta_reagendacion", "ausencia_id"): ("ausencia_profesional", True),
    ("insumo", "categoria_id"): ("categoria_insumo", False),
    ("movimiento_inventario", "analisis_id"): ("analisis_micologico", True),
    ("movimiento_inventario", "devolucion_referencia_id"): (
        "movimiento_inventario",
        True,
    ),
    ("residuo_quimico", "analisis_id"): ("analisis_micologico", True),
    ("residuo_quimico", "disposicion_final_id"): ("disposicion_final", True),
    ("cambio_auditoria", "auditoria_id"): ("auditoria", False),
}


# S11: level-3 amendment for REC (L2 of the feature document).
# `paciente` declared no requiredness before it, which made UCE-REC-15 step 6
# ("datos demográficos incompletos") undecidable.
PACIENTE_REQUIRED_COLUMNS: set[str] = {
    "numero_registro",
    "dni",
    "nombre",
    "apellido",
    "fecha_nacimiento",
    "telefono",
    "estado",
    "fecha_ingreso",
    "nivel_registro",
}
PACIENTE_OPTIONAL_COLUMNS: set[str] = {
    "sexo",
    "domicilio",
    "correo_electronico",
    "obra_social",
}


def _indexed_column_tuples(table) -> set[tuple[str, ...]]:
    tuples = {tuple(column.name for column in index.columns) for index in table.indexes}
    for constraint in table.constraints:
        if isinstance(constraint, UniqueConstraint):
            tuples.add(tuple(column.name for column in constraint.columns))
    return tuples


def _is_covered(wanted: tuple[str, ...], available: set[tuple[str, ...]]) -> bool:
    """A composite index also serves its leftmost prefixes (S7 functional reading)."""

    return any(candidate[: len(wanted)] == wanted for candidate in available)


@pytest.mark.parametrize("table_name", sorted(LEVEL3_COLUMNS))
def test_columns_match_level_3(table_name: str) -> None:
    table = Base.metadata.tables[table_name]
    assert {column.name for column in table.columns} == LEVEL3_COLUMNS[table_name]


def test_no_extra_tables_beyond_level_3() -> None:
    assert set(Base.metadata.tables) == set(LEVEL3_COLUMNS)


@pytest.mark.parametrize(
    ("table_name", "column_name"),
    sorted((t, c) for t, cols in LEVEL3_TEXT_COLUMNS.items() for c in cols),
)
def test_text_columns_use_text_type(table_name: str, column_name: str) -> None:
    column = Base.metadata.tables[table_name].c[column_name]
    assert isinstance(column.type, Text), (
        f"{table_name}.{column_name} is {column.type!r}, level 3 says text"
    )


def test_jsonb_columns() -> None:
    for table_name in ("version_ficha_clinica", "version_analisis"):
        for column_name in ("datos_previos", "datos_nuevos"):
            column = Base.metadata.tables[table_name].c[column_name]
            assert isinstance(column.type, JSONB), f"{table_name}.{column_name}"


def test_dias_habiles_is_varchar_array() -> None:
    column = Base.metadata.tables["configuracion_agenda"].c.dias_habiles
    assert isinstance(column.type, ARRAY)
    assert isinstance(column.type.item_type, String)


@pytest.mark.parametrize("table_name", sorted(LEVEL3_COLUMNS))
def test_conventions_uuid_pk_tz_aware_no_native_enum(table_name: str) -> None:
    table = Base.metadata.tables[table_name]
    primary_key = list(table.primary_key.columns)
    assert [column.name for column in primary_key] == ["id"]
    assert isinstance(primary_key[0].type, PG_UUID)
    assert getattr(primary_key[0].default.arg, "__name__", "") == "uuid4"
    for column in table.columns:
        if isinstance(column.type, DateTime):
            assert column.type.timezone, (
                f"{table_name}.{column.name} must be timezone-aware"
            )
        assert not isinstance(column.type, Enum), (
            f"{table_name}.{column.name} must not use a native ENUM"
        )


@pytest.mark.parametrize(("table_name", "wanted"), sorted(LEVEL3_INDEXES.items()))
def test_listed_indexes_exist(table_name: str, wanted: list[tuple[str, ...]]) -> None:
    available = _indexed_column_tuples(Base.metadata.tables[table_name])
    for columns in wanted:
        assert _is_covered(columns, available), f"missing index {table_name}{columns}"


@pytest.mark.parametrize(("table_name", "wanted"), sorted(LEVEL3_UNIQUES.items()))
def test_business_uniques_exist(table_name: str, wanted: list[tuple[str, ...]]) -> None:
    table = Base.metadata.tables[table_name]
    uniques = {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    for columns in wanted:
        assert columns in uniques, f"missing UNIQUE {table_name}{columns}"


@pytest.mark.parametrize(("key", "expected"), sorted(LEVEL3_FOREIGN_KEYS.items()))
def test_foreign_keys_point_at_level_3_targets(
    key: tuple[str, str], expected: tuple[str, bool]
) -> None:
    table_name, column_name = key
    target, nullable = expected
    column = Base.metadata.tables[table_name].c[column_name]
    targets = {fk.target_fullname for fk in column.foreign_keys}
    assert f"{target}.id" in targets, f"{table_name}.{column_name} -> {targets}"
    assert column.nullable is nullable, f"{table_name}.{column_name} nullability"


def test_modeling_decisions_s6() -> None:
    insumo = Base.metadata.tables["insumo"]
    assert "stock_actual" not in insumo.c

    equipo = Base.metadata.tables["equipo"]
    assert equipo.c.numero_serie.unique is not True
    assert _is_covered(("numero_serie",), _indexed_column_tuples(equipo))

    auditoria = Base.metadata.tables["auditoria"]
    assert not auditoria.c.entidad_id.foreign_keys

    muestra = Base.metadata.tables["muestra"]
    assert "muestra_id" not in muestra.c
    assert "muestra_id" in Base.metadata.tables["analisis_micologico"].c

    tables = set(Base.metadata.tables)
    assert {"reporte", "reporte_residuos", "reporte_inventario"} <= tables

    assert isinstance(
        Base.metadata.tables["configuracion_agenda"].c.dias_habiles.type, ARRAY
    )
    assert "version_actual" in Base.metadata.tables["ficha_clinica"].c
    assert "version_actual" in Base.metadata.tables["analisis_micologico"].c


# S11: the requiredness rule the amendment added to `paciente`.


def test_paciente_required_columns_are_not_null() -> None:
    table = Base.metadata.tables["paciente"]
    nullable = {name for name in PACIENTE_REQUIRED_COLUMNS if table.c[name].nullable}
    assert nullable == set(), f"paciente columns still nullable: {sorted(nullable)}"


def test_paciente_optional_demographics_stay_nullable() -> None:
    table = Base.metadata.tables["paciente"]
    required = {
        name for name in PACIENTE_OPTIONAL_COLUMNS if not table.c[name].nullable
    }
    assert required == set(), f"paciente columns became NOT NULL: {sorted(required)}"


def test_turno_serie_id_is_a_plain_uuid_without_foreign_key() -> None:
    """A series is a shared value, not an entity: level 3 declares no FK for it."""

    column = Base.metadata.tables["turno"].c["serie_id"]
    assert isinstance(column.type, PG_UUID)
    assert column.nullable is True
    assert not column.foreign_keys, f"turno.serie_id -> {column.foreign_keys}"


def test_lista_espera_estado_defaults_to_pendiente() -> None:
    column = Base.metadata.tables["lista_espera"].c["estado"]
    assert column.nullable is False
    assert column.default is not None
    assert column.default.arg == "pendiente"
