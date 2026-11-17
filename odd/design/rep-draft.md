# Borrador de diseño de pantallas — REP (Reportes y Estadísticas)

Pasos 0-2 de `odd/design/screen-design-plan.md`. Es el subsistema más chico del sistema:
**2 UCE**. Este documento deriva su inventario y **propone un patrón nuevo**, porque el único
que no encaja en los siete existentes es justamente su pantalla principal.

## 1. Alcance y fuentes

| Nivel | Archivo | Qué se tomó | Líneas |
|---|---|---|---|
| 1 | `TF_2026_Requerimientos_KLUKA_JORGE.md` §2.7.5 | UC-REP-01 y UC-REP-02 | L921-937 |
| 1 | idem §2.8.5 | UCE-REP-01 pasos 1-9, UCE-REP-02 pasos 1-5 | L2489-2536 |
| 1 | idem RF-09, RF-15 | alertas de stock en el panel; consolidación y exportación | §2.5 |
| 3 | `modelo_esquema_bd_sigemi.md` | `reporte` (genérica, REP-01) y las especializadas `reporte_inventario` / `reporte_residuos` | L623-637, L533-545 |

## 2. Conteo real de UCE

**2: UCE-REP-01 y UCE-REP-02.** No hay subflujos ni casos automáticos.

## 3. Inventario derivado (UCE → pantalla → patrón)

| UCE | Qué hace el usuario | Pantalla | Patrón |
|---|---|---|---|
| UCE–REP-01 | elige tipo de reporte y rango, previsualiza y exporta | **REP-U01** Generador de reportes | **P8 (nuevo, ver §5)** |
| UCE–REP-02 pasos 1-3 | consulta indicadores y alertas | **REP-U02** Panel de Control | P5 |
| UCE–REP-02 pasos 4-5 | selecciona un indicador y ve su detalle | **REP-U03** Detalle de indicador | P2 |

## 4. Agrupación y estado actual

| Pantalla | Nombre | Patrón | Rol | Estado |
|---|---|---|---|---|
| **REP-U01** | Generador de reportes | P8 | bioquimico, administrador | no existe |
| **REP-U02** | Panel de Control | P5 | bioquimico, administrador | **existe el marco**, sin datos (`frontend/src/features/dashboard/DashboardPage.tsx`, S7 de `03-shell-frontend.md`) |
| **REP-U03** | Detalle de indicador | P2 | bioquimico, administrador | no existe |

**REP-U02 ya está implementado como armazón**: siete ranuras de KPI (`Confirmados`,
`Atendidos`, `No asistieron`, `Pendiente`, `En Proceso`, `Terminado`, `Validado`), dos listas
(`Próximos turnos`, `Alertas de stock`) y la acción `Actualizar`, todas con estados vacíos
explícitos. Lo que falta es el cableado a endpoints que no existen y el paso 4-5 de la UCE
(seleccionar un indicador para ver su detalle), que hoy no tiene destino.

### 4.1 Decisiones de clasificación

1. **REP-U01 no es P1 ni P3.** P1 es «listado con filtros, tabla y **acciones por fila**», y
   acá no hay filas accionables: hay un conjunto de datos con dos acciones de conjunto
   (`Generar previsualización`, `Exportar`). P3 es «formulario de alta/edición con validación»,
   y acá no se crea ni se edita una entidad del dominio: se configura una consulta. Forzarla en
   P1 habría producido una tabla sin acciones y con dos botones huérfanos fuera de la tabla.
2. **REP-U03 se separa de REP-U02** porque la UCE 02 pasos 4-5 son una navegación explícita
   («selecciona un indicador para ver el detalle»), no un cambio de estado del panel: es un P2
   y merece su propia ruta una vez que exista qué mostrar.

## 5. Patrón faltante: P8 — generador con previsualización

**Decisión a registrar en `screen-design-plan.md` §3** (el plan anticipa exactamente este
caso: «o son dos pantallas, o el patrón falta»). No son dos pantallas, porque los parámetros
vigentes son el estado compartido entre previsualizar y exportar: partirlas obligaría a
repetir los filtros o a persistirlos en un lugar que ninguna UCE nombra.

| Campo | Valor |
|---|---|
| Código | **P8** |
| Nombre | Generador con previsualización |
| Cuándo | La UCE pide configurar parámetros, **previsualizar** el conjunto resultante y **exportar** el conjunto |
| Zonas | barra de parámetros · acción `Generar previsualización` · tabla de muestra (solo lectura, pocas filas) · acción `Exportar` · aviso de alcance (qué se está exportando) |
| Estados propios | sin generar · generando · vacío («No existen registros transaccionales para los parámetros indicados») · generado · exportando |
| Diferencia con P1 | P1 pagina registros del dominio y acciona filas; P8 no pagina: muestra una muestra y exporta el conjunto |
| Diferencia con P5 | P5 muestra indicadores ya agregados; P8 construye la consulta |

Comparte con P1 la tabla (`DataTable`), y con P3 los controles de parámetros (`FormField`).
No requiere primitivas nuevas.

## 6. Huecos y requisitos faltantes

| # | Hueco | Evidencia | Consecuencia |
|---|---|---|---|
| **R1** | **La anonimización del reporte Clínico no define qué se remueve.** UCE-REP-01 paso 5 dice «remoción de datos sensibles» sin enumerar campos | UCE-REP-01 paso 5; ningún nivel la define | no se puede especificar la columna «anonimizado» ni probar la regla: **bloquea REP-U01** |
| **R2** | **El «detalle del indicador» no dice qué muestra.** UCE-REP-02 pasos 4-5 no nombran el contenido ni su fuente | UCE-REP-02 pasos 4-5 | **bloquea REP-U03**: el destino natural es el módulo del indicador (turnos → REC-U01, análisis → DIAG-U01, insumos → LAB-U01, residuos → LAB-U09), pero eso es una decisión, no una derivación |
| **R3** | **`reporte` guarda `ruta_archivo` y `formato_archivo`, y ninguna UCE lista ni reusa exportaciones previas** | nivel 3 L623-637 | el nivel 3 soporta un historial de exportaciones que el nivel 1 no pide: no se agrega la pantalla |
| **R4** | **Los indicadores del panel dependen de cuatro subsistemas**, tres sin backend (REC agenda, DIAG, LAB) | UCE-REP-02 paso 2; estado de `backend/app/api/v1/` | REP-U02 no se puede cablear hoy; el armazón vacío es la representación honesta |
| **R5** | **Nivel 2 define `Reporte` como padre con hijos regionales y el nivel 3 lo realiza como tres tablas no fusionadas** | nota de modelado en nivel 3 L635-637 | no es contradicción (está resuelta y documentada); se registra para que no se «unifique» por error |

## 7. Orden de trabajo propuesto

1. **R1 primero**: sin la lista de campos anonimizados, REP-U01 no tiene especificación.
2. **R2** después: decidir si REP-U03 es una pantalla o una navegación al módulo; la segunda
   opción elimina una pantalla y un endpoint.
3. **REP-U02** no se toca hasta que existan los endpoints de los otros subsistemas; el armazón
   ya está y su S7 prohíbe inventar números.
