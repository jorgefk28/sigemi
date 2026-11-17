# 06 — Reportes y Estadísticas (REP): consolidación, exportación y panel

**Objetivo**: implementar el subsistema REP (2 UCE) con su patrón nuevo, de modo que los
datos acumulados puedan consolidarse y descargarse.
**Rama**: `main` (repo sin remoto).
**Estrategia de entrega**: commits por work unit.
**Runner**: `pytest` + `ruff check` + `ruff format --check` (backend); `vitest` + `tsc --noEmit`
+ `vite build` (frontend).

Inventario y clasificación en `odd/design/rep-draft.md` (pasos 0-2). Patrón **P8** agregado a
`odd/design/screen-design-plan.md` §3.

---

## Specs

### S1 — Reporte clínico anonimizado con previsualización y exportación

> **UCE–REP-01** (nivel 1 §2.8.5): «El usuario ingresa al módulo de Reportes e Investigaciones»
> (paso 1); «la interfaz ofrece filtros de selección: Tipo de Reporte (Clínico, Inventario,
> Desechos) y Rango de Fechas» (paso 2); «presiona Generar Previsualización» (paso 3); «el
> Backend ejecuta operaciones de cruce» (paso 4); «si el reporte es Clínico, ejecuta la regla de
> anonimización estricta» (paso 5); «la interfaz renderiza una vista en tabla de las primeras
> filas» (paso 6); «el usuario presiona Exportar» (paso 7); «el Backend empaqueta los resultados
> en formato tabular y transmite el archivo» (paso 8); «el navegador inicia la descarga» (paso
> 9). Excepción del paso 4: «No existen registros transaccionales para los parámetros
> indicados». RF-15.

**Endpoints** (`/api/v1`, `bioquimico` y `administrador`):

| Método | Ruta | UCE |
|---|---|---|
| `GET` | `/reportes/{tipo}` con `fecha_desde`, `fecha_hasta`, `limit`, `offset` | 01 pasos 3-6: previsualización |
| `GET` | `/reportes/{tipo}/exportar` con `fecha_desde`, `fecha_hasta` | 01 pasos 7-9: el conjunto completo en CSV |

**Datos** (columnas declaradas, A-10)

| Columna | Origen | Nota |
|---|---|---|
| `paciente_clave` | `paciente.id` truncado | clave opaca y estable; no reversible |
| `fecha` | `analisis_micologico.fecha_creacion` | día |
| `tipo_analisis` | `tipo_analisis.nombre` | |
| `tipo_muestra` | `tipo_muestra.nombre` | |
| `estado` | `analisis_micologico.estado` | |
| `edad` | derivada de `paciente.fecha_nacimiento` | se calcula, no se persiste |

**Reglas y su aplicación**:

| Regla | Clase | Origen | Dónde |
|---|---|---|---|
| El reporte clínico no lleva datos identificatorios | R1 | paso 5 + Ley 25.326 | la consulta no selecciona nombre, apellido, DNI, teléfono, correo, domicilio ni obra social |
| El export es el conjunto, no la página previsualizada | R1 | paso 8 («empaqueta los resultados») | el endpoint de export no pagina |
| Los tipos sin datos no generan archivo | R1 | excepción del paso 4 | inventario y desechos responden `400` con el motivo |
| Sólo `bioquimico` y `administrador` | R2 | precondición de REP-01 | `require_roles` |
| CSV con BOM y separador `;` | R4 | presentación | `services/reportes.a_csv` |

**Supuestos registrados** (A-10 de `odd/DECISIONES-AUTONOMAS.md`):

- **A-10.1** — La lista de campos prohibidos y la clave opaca son decisión del integrador; el
  nivel 1 dice «remoción de datos sensibles» sin enumerarlos. **Requiere confirmación del
  dueño**: la Ley 25.326 es suya, no mía.
- **A-10.2** — Sólo se implementa el reporte `clínico`: inventario y desechos dependen de un
  subsistema sin datos. La pantalla los muestra deshabilitados con el motivo.
- **A-10.3** — El export es CSV, no XLSX: `openpyxl` sería una dependencia nueva y `AGENTS.md`
  la sujeta a aprobación.

**Fuera de alcance**: el historial de exportaciones (`reporte.ruta_archivo` existe en el nivel
3 pero ninguna UCE lo lista; hueco R3 de `rep-draft.md`).

### S2 — Panel de Control y detalle del indicador

> **UCE–REP-02** pasos 1-5: «accede al panel de control», «el sistema muestra las tarjetas de
> indicadores y las alertas», «el usuario selecciona un indicador para ver el detalle», «el
> sistema muestra el detalle del indicador». Excepción del paso 2: «Sin datos disponibles».
> RF-09, RF-15.

- **REP-U02** ya existía como armazón (`03-shell-frontend.md` S7) con estados vacíos. Se le
  agrega el paso 4-5: cada tarjeta enlaza al módulo que gobierna su indicador (A-10).
- **REP-U03 no es pantalla**: es esa navegación.

**Regla**: los valores siguen vacíos hasta que los módulos tengan endpoints. Un indicador sin
fuente se muestra `—`, nunca un número inventado (S7 de `03-shell-frontend.md`).

---

## Screens

Inventario y clasificación en `odd/design/rep-draft.md` §3-4.

| Pantalla | Nombre | Patrón | Estado |
|---|---|---|---|
| **REP-U01** | Generador de reportes | **P8** | ✅ implementada (`features/reportes/ReportesPage.tsx`) |
| **REP-U02** | Panel de Control | P5 | ✅ armazón con estados vacíos + enlaces por indicador |
| **REP-U03** | Detalle de indicador | P2 | ✅ resuelta como navegación (A-10) |

---

## Tasks

| ID | Tarea | Specs | Ruta | Estado |
|---|---|---|---|---|
| T1 | Backend del reporte clínico anonimizado: previsualización con sobre y exportación CSV | S1 | inline (integrador) | ✅ (L2) |
| T2 | REP-U01 Generador de reportes (P8) y enlaces por indicador del panel (REP-U03) | S1, S2 | inline (integrador) | ✅ (L2) |
| T3 | Cablear los indicadores del panel a endpoints reales | S2 | — | ⛔ bloqueada: REC agenda, DIAG y LAB sin endpoints de agregación |

**Risk**: T1 → **item 3** (contrato nuevo que expone datos clínicos; la anonimización es lo que
lo hace publicable).

---

## Log

### L1 — Origen (2026-11-16)

Tercer y último subsistema del barrido nocturno autorizado por el dueño
(`odd/DECISIONES-AUTONOMAS.md`). REP era el único que no dependía de editar niveles 1-3 ni de
un servicio externo: la tabla `reporte` existe, la UCE está completa y la anonimización admite
una decisión declarada.

### L2 — T1 y T2: reporte clínico y generador (2026-11-16/17)

**Backend**: `app/schemas/reportes.py`, `app/services/reportes.py`,
`app/api/v1/reportes.py` (2 endpoints), `app/api/v1/router.py` (una línea),
`tests/test_rep_reportes.py` (7 casos).

**Frontend**: `api/reportes.ts`, `features/reportes/ReportesPage.tsx`,
`features/reportes/reportes.test.tsx` (8 casos), `components/Panel.tsx` (prop `action`),
`features/dashboard/DashboardPage.tsx` (enlaces por indicador).

**Decisiones de contrato**:

1. **La anonimización ocurre al leer, no al mostrar**: la consulta no selecciona los campos
   prohibidos. Un test verifica que ninguno de los siete valores sembrados aparezca en el
   cuerpo de la previsualización ni en el CSV.
2. **`paciente_clave` es estable y no reversible**: primeros 8 hex del UUID del paciente. Dos
   consultas seguidas devuelven la misma clave, y la clave no es el id.
3. **El export baja todo**: el endpoint no pagina; la previsualización sí (10 filas por defecto).
4. **CSV con BOM UTF-8 y `;`**: doble clic en Excel es-AR sin romper acentos ni columnas.
5. **`withQuery` evita el `?` colgando** cuando no hay filtros: un detalle, pero el test de
   exportación lo detectó antes de llegar a producción.

**Evidencia observada**: desde `backend/` → `pytest tests/test_rep_reportes.py` **7 passed**;
`ruff check .` → `All checks passed!`; `ruff format --check .` → `77 files already formatted`.
Desde `frontend/` → `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm test` **181
passed** (21 archivos); `npm run build` → `✓ built`.

**Suites completas**: `pytest -q` falla **sólo** los 9 casos de `tests/test_usuarios.py` que
cuentan filas absolutas, por la fila `admin@sigemi.local` que apareció en la base compartida
(misma causa documentada en L2 de `05-laboratorio-bioquimico.md`; no es una regresión).
