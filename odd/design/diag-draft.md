# Borrador de diseño de pantallas — DIAG (Laboratorio Bioquímico)

Pasos 0-2 de `odd/design/screen-design-plan.md`. Este documento **no es especificación**:
deriva el inventario y clasifica cada pantalla en un patrón. El paso 3 (especificación con
la plantilla) va a `odd/tasks/05-laboratorio-bioquimico.md`, sección `## Screens`, y se
escribe sólo para las pantallas cuyos huecos estén resueltos.

## 1. Alcance y fuentes

### 1.1 Fuentes leídas y de dónde sale cada dato

| Nivel | Archivo | Qué se tomó | Líneas |
|---|---|---|---|
| 1 | `TF_2026_Requerimientos_KLUKA_JORGE.md` §2.7.3.2 | los 13 UC del subsistema | L606-720 |
| 1 | idem §2.8.2 | las 13 UCE con su secuencia, precondición y excepciones | L1626-1958 |
| 1 | idem RF-05, RF-06, RF-07, RF-08, RF-16, RF-20, RF-21 | requisitos que citan las UCE | §2.5 |
| 2 | `modelo_dominio_sigemi_unificado.md` | relaciones `Paciente →posee→ Ficha →contiene→ Dato Clínico`, `Ficha →origina→ Análisis →contiene→ Hallazgo →genera→ Informe`; `Profesional →firma (valida)→ Informe` | L15-20, L81-91, L167, L210 |
| 3 | `modelo_esquema_bd_sigemi.md` | columnas exactas de las ocho tablas del subsistema | L53-193, L204-233 |

No hay prototipo ni pantallas previas para este subsistema: `OPENCODE-ARTIFACTS/Pantallas/`
está declarado obsoleto por el dueño y no se usó como entrada.

### 1.2 Los roles

| Rol | Participa en DIAG | Fuente |
|---|---|---|
| `bioquimico` (Bioquímico/Doctor) | las 13 UCE: registra ficha, ingresa muestra, actualiza estado, valida, invalida, reenvía OTP, agrega addendum y rechaza muestra | precondiciones de cada UCE |
| `administrador` | consulta el historial (DIAG-06), modifica la ficha (DIAG-07), invalida análisis (DIAG-08), mira el panel (DIAG-09), gestiona el catálogo (DIAG-10) | precondiciones de esas UCE |
| `profesor` | **ninguna** | ningún UCE de DIAG lo nombra |
| Paciente (sin sesión) | descarga su informe con OTP (DIAG-05) | ACT-04, comentario de UCE-DIAG-05 |

Dos asimetrías que hay que respetar al especificar, porque el nivel 1 las separa a propósito:

1. **Validar es sólo del bioquímico** (UCE-DIAG-04 comentarios: «Solo el rol
   Bioquímico/Doctor puede validar (control de calidad, RF-06)»). El administrador **no**
   valida.
2. **Invalidar sí admite administrador** (UCE-DIAG-08, actor explícito
   «Bioquímico/Doctor, Administrador»), aunque la fila de UC-DIAG-08 en §2.7 no lo liste:
   manda la UCE, que es la que tiene la secuencia.

### 1.3 Conteo real de UCE

**13, no 14.** La numeración del nivel 1 salta de `UC-DIAG-10` a `UC-DIAG-12`; no existe
`UC-DIAG-11` ni en la tabla de casos de uso (L606-720) ni en los extendidos (L1626-1958).
Contar por rango produce un caso de uso fantasma. Es el mismo defecto de numeración que
`rec-draft.md` §1.3 documentó para REC (28 en lugar de 30).

## 2. Inventario derivado (UCE → pantalla → patrón)

| UCE | Qué hace el usuario | Pantalla | Patrón |
|---|---|---|---|
| UCE–DIAG-01 | busca al paciente por DNI y completa la ficha clínica | **DIAG-U03** Ficha clínica (alta) | P3 |
| UCE–DIAG-02 | registra la muestra y crea el primer análisis | **DIAG-U05** Ingreso de muestra | P3 |
| UCE–DIAG-03 | carga hallazgos y avanza el estado | **DIAG-U02** Detalle de análisis | P2 + acción |
| UCE–DIAG-04 | emite el diagnóstico final y valida | **DIAG-U02** Detalle de análisis | P2 + acción |
| UCE–DIAG-05 | ingresa el OTP y descarga su PDF | **DIAG-U07** Portal de resultados | P3 público |
| UCE–DIAG-06 | ve las fichas previas y los análisis de un paciente | **DIAG-U04** Ficha clínica (detalle) + secciones de REC-U07 | P2 |
| UCE–DIAG-07 | corrige o amplía una ficha | **DIAG-U03** Ficha clínica (edición) | P3 |
| UCE–DIAG-08 | invalida un análisis con motivo | **DIAG-U02** Detalle de análisis | P2 + acción |
| UCE–DIAG-09 | ve el volumen de trabajo filtrable | **DIAG-U01** Panel de Análisis | P1 |
| UCE–DIAG-10 | crea, modifica y desactiva tipos | **DIAG-U06** Catálogo clínico | P6 |
| UCE–DIAG-12 | reenvía el OTP de un análisis validado | **DIAG-U02** Detalle de análisis | P2 + acción |
| UCE–DIAG-13 | agrega un addendum sin tocar el original | **DIAG-U02** Detalle de análisis | P2 + acción |
| UCE–DIAG-14 | rechaza una muestra con motivo | **DIAG-U02** Detalle de análisis | P2 + acción |

## 3. Agrupación: 7 pantallas únicas

| Pantalla | Nombre | Patrón | UCE que cubre | Rol |
|---|---|---|---|---|
| **DIAG-U01** | Panel de Análisis | P1 | 09 (1-4) | bioquimico, administrador |
| **DIAG-U02** | Detalle de análisis | P2 con acciones | 03 (1-8), 04 (1-6), 08 (1-9), 12 (1-6), 13 (1-7), 14 (1-8) | bioquimico (valida y agrega addendum sólo él), administrador (sólo invalida) |
| **DIAG-U03** | Ficha clínica (alta y edición) | P3 | 01 (1-9), 07 (1-8) | bioquimico; administrador sólo en la edición |
| **DIAG-U04** | Ficha clínica (detalle) | P2 | 06 (4-6) | bioquimico, administrador |
| **DIAG-U05** | Ingreso de muestra | P3 | 02 (1-7) | bioquimico |
| **DIAG-U06** | Catálogo clínico (tipos de análisis y de muestra) | P6 | 10 (1-7) | administrador |
| **DIAG-U07** | Portal de resultados (público) | P3 | 05 (1-9) | paciente anónimo |

**Ningún UCE de DIAG queda sin pantalla** y ninguna pantalla se inventa: las siete salen de
la tabla de arriba.

### 3.1 Decisiones de clasificación, con su justificación

1. **DIAG-U02 es una sola pantalla con seis acciones, no seis pantallas.** Las UCE 03, 04,
   08, 12, 13 y 14 entran todas por «accede al análisis / al detalle del análisis» (03 paso 1,
   04 paso 1, 08 paso 1, 12 paso 1, 13 paso 1, 14 paso 1) y su unidad de presentación es el
   mismo registro. Partirlas en seis rutas obligaría a navegar para hacer lo que el UCE
   describe como una acción sobre la pantalla que ya está abierta. La habilitación de cada
   acción la fija el estado del análisis, que es exactamente lo que la UCE 09 paso 6 dice:
   «muestra el detalle con las acciones habilitadas según el estado».
2. **DIAG-U03 comparte alta y edición**, como REC-U05: la UCE 07 es la misma pantalla en modo
   edición («presenta la ficha en modo edición», paso 2). Lo que cambia es el versionado, que
   es del backend.
3. **DIAG-U04 no es un listado nuevo**: DIAG-06 pasos 1-3 son el buscador de pacientes, que ya
   existe (REC-U06, y es el `include` UC-REC-S-01 que la propia UCE 07 nombra). El paso 4
   (listado de fichas previas) y el 6 (análisis del paciente) son **secciones de REC-U07**, que
   hoy muestran «Pendiente: todavía no hay endpoint…» y «Sin análisis registrados». DIAG-U04 es
   sólo el detalle clínico de una ficha, al que se llega desde esa lista.
4. **DIAG-U06 es un catálogo simple (P6) con dos tablas**, no dos pantallas: `tipo_analisis` y
   `tipo_muestra` tienen la misma forma (nombre único + descripción + estado) y la UCE 10 las
   trata como un solo módulo («módulo de Catálogos Clínicos»). Agregar la relación N:N
   `tipo_analisis_tipo_muestra` es parte del editor, no una pantalla aparte.
5. **DIAG-U07 queda fuera de la SPA autenticada.** Es anónima, mobile-first y responde a un
   enlace de WhatsApp (UCE 05 pasos 1-2, comentarios: «El paciente no posee cuenta ni
   credenciales del sistema interno»). Vive en la misma aplicación porque el despliegue es uno,
   pero bajo rutas públicas y sin el shell.
6. **DIAG-U01 es P1 y no P5** (panel de KPIs) aunque el nombre diga «Panel»: la UCE 09 pide
   «tabla paginada y filtrable», y el panel de indicadores es de otro subsistema
   (UCE-REP-02, `odd/design` pendiente). No se duplica el patrón P5 acá.

## 4. Dependencias externas

| Dependencia | UCE | Consecuencia |
|---|---|---|
| Generación de PDF del informe | 04 paso 7, 05 paso 8 | sin generador no hay `informe_resultados.ruta_archivo` ni descarga |
| Envío por WhatsApp + token OTP con TTL | 04 pasos 8-10, 05 pasos 3-4, 12 | requiere proveedor aprobado y programación de reenvío |
| Almacenamiento seguro del PDF | 04 paso 7 | requiere volumen/objeto seguro, no el disco de la API |
| Backend de DIAG | las 13 | **no existe**: `backend/app/api/v1/` sólo tiene auth, usuarios, roles, auditoría, pacientes y lista de espera |

## 5. Huecos y requisitos faltantes

Estos huecos **bloquean el paso 3** de las pantallas que tocan. Se reportan; no se resuelven
inventando.

### 5.1 Huecos de esquema (el nivel 3 no tiene lo que la UCE pide)

| # | Hueco | Evidencia | Bloquea |
|---|---|---|---|
| **G1** | **Los campos clínicos de la ficha no están enumerados.** `dato_clinico` es clave-valor (`campo` `varchar`, `valor` `text`, `tipo_dato` `varchar`) y ningún nivel lista las claves posibles; UCE-DIAG-01 paso 5 pide «campos clínicos obligatorios» sin nombrarlos | nivel 3 L64-72; UCE 01 paso 5 | DIAG-U03, DIAG-U04 |
| **G2** | **`hallazgo_analisis.tipo_hallazgo` no está enumerado** y UCE-DIAG-03 paso 3 pide «parámetros, resultados parciales y observaciones» sin definirlos | nivel 3 L146-155; UCE 03 paso 3 | DIAG-U02 |
| **G3** | **`analisis_micologico` no tiene columna de observaciones**, aunque UCE-DIAG-03 paso 3 y la postcondición las exigen; sólo cabrían como un `hallazgo_analisis` con `tipo_hallazgo = 'observacion'`, que G2 no permite decidir | nivel 3 L131-144 | DIAG-U02 |
| **G4** | **El filtro «bioquímico que registró la última acción» (UCE-DIAG-09 paso 3) no tiene fuente.** `analisis_micologico` guarda `profesional_responsable_id` y `profesional_validador_id`, no «última acción»; saldría de `auditoria.entidad_id`, que es polimórfico y sin FK | nivel 3 L131-144, L583; UCE 09 paso 3 | DIAG-U01 |
| **G5** | **UCE-DIAG-02 no pide el tipo de análisis y el esquema lo exige.** Paso 3 pide «Tipo de Muestra» y observaciones; `analisis_micologico.tipo_analisis_id` es obligatorio y la regla del N:N exige que la combinación esté admitida | nivel 3 L118-144, L224-233; UCE 02 paso 3 | DIAG-U05 |

### 5.2 Huecos de requisito (el nivel 1 es silencioso donde el nivel 3 tiene tabla)

| # | Hueco | Consecuencia |
|---|---|---|
| **G6** | **`version_ficha_clinica` y `version_analisis` existen pero ninguna UCE muestra el historial de versiones.** UCE-DIAG-07 paso 6 conserva la versión anterior y UCE-DIAG-13 la crea; ninguna dice quién las consulta ni desde dónde | no se especifica una pantalla de versiones: se reporta como requisito faltante |

### 5.3 Contradicciones entre niveles

| # | Contradicción | Resolución propuesta |
|---|---|---|
| **G7** | **`muestra` es 1:N por nota del nivel 3, y UCE-DIAG-02 sólo crea el primer análisis.** El nivel 3 dice explícitamente que «una muestra puede alimentar varios análisis» y que los adicionales reutilizan la misma `muestra`; ninguna UCE de nivel 1 describe cómo se agrega el segundo análisis a una muestra existente | se implementa lo que el nivel 1 pide (un análisis por ingreso) y **se reporta la falta de UCE** para el análisis adicional; no se agrega el botón |
| **G8** | **UCE-DIAG-08 lista al administrador como actor y la fila de UC-DIAG-08 no** | manda la UCE (tiene la secuencia): el administrador puede invalidar |
| **G9** | **El validador vive en tablas distintas según el nivel.** El nivel 2 dice `Profesional →firma (valida)→ Informe` (L91); el nivel 3 pone `profesional_validador_id` en `analisis_micologico` y no tiene columna de validador en `informe_resultados` | no bloquea: el acto de validar es del análisis y el informe lo hereda. Se lee el validador por `analisis_micologico` y se reporta para que el nivel 2 no se edite sin decisión del dueño |

### 5.4 Hueco de patrón

**No hay hueco de patrón nuevo.** Las siete pantallas caben en P1, P2, P3 y P6. La única con
forma particular es DIAG-U02 (P2 con seis acciones condicionadas por estado), que ya existe:
REC-U07 usa el mismo P2 con acciones y REC-U11 demostró que un diálogo con motivo obligatorio
se resuelve con la primitiva `Dialog`.

## 6. Patrones a construir primero

Por `screen-design-plan.md` §9, dos pantallas para fijar patrón y después instanciar:

1. **DIAG-U01 Panel de Análisis (P1)** — no depende de ningún hueco de esquema salvo G4, que
   se resuelve dejando el filtro de bioquímico fuera hasta que exista la fuente (mismo criterio
   que REC-U11 con el filtro de tipo de análisis). Es la pantalla que el sidebar ya espera en
   `Análisis`.
2. **DIAG-U02 Detalle de análisis (P2 con acciones)** — es el hub de seis UCE y el que fija el
   vocabulario de estados (`pendiente → en_proceso → terminado → validado | invalidado`) y el
   diálogo de motivo obligatorio. Depende de G2 y G3 para la sección de hallazgos, así que su
   especificación se cierra **después** de resolverlos.

Después, en este orden: DIAG-U03 + U04 (ficha, depende de G1), DIAG-U05 (depende de G5),
DIAG-U06 (independiente), DIAG-U07 (depende de WhatsApp/PDF).

## 7. Lo que este documento no decide

- Las claves de `dato_clinico` (G1) y los valores de `tipo_hallazgo` (G2): son contenido
  clínico, no presentación. Sin ellos no hay formulario ni tabla que especificar.
- Si DIAG-U07 comparte despliegue con la SPA o va aparte (decisión de producto).
- Qué proveedor de WhatsApp y qué generador de PDF (dependencias externas, §4).
