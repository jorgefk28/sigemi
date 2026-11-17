import { useState } from 'react';
import {
  COLUMNA_LABELS,
  TIPOS_REPORTE,
  descargarReporte,
  previsualizarReporte,
  type ReportePreview,
} from '../../api/reportes';
import { ApiError } from '../../api/http';
import { Btn } from '../../components/Btn';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { loadToken } from '../../session/sessionStore';
import { useGoHome } from '../../routes/useGoHome';

/**
 * REP-U01 · Generador de reportes (P8 — generador con previsualización).
 *
 * Backing requirement: UCE-REP-01 pasos 1-9, RF-15. The pattern's three states
 * are explicit: parameters, preview, export. The export is the **whole** set, not
 * the previewed page (paso 8 «empaqueta los resultados»), and the clinical report
 * arrives anonymized from the backend (A-10), so the screen never has to remove a
 * field.
 *
 * The inventory and waste reports are offered disabled with their reason: their
 * subsystems have no data yet, and an empty file would look like a bug.
 */

interface Filtros {
  tipo: string;
  fecha_desde: string;
  fecha_hasta: string;
}

const NO_FILTROS: Filtros = { tipo: 'clinico', fecha_desde: '', fecha_hasta: '' };

export function ReportesPage() {
  const goHome = useGoHome();
  const token = loadToken();

  const [filtros, setFiltros] = useState<Filtros>(NO_FILTROS);
  const [preview, setPreview] = useState<ReportePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoElegido = TIPOS_REPORTE.find((tipo) => tipo.value === filtros.tipo);
  const disponible = tipoElegido?.disponible ?? false;

  function change(field: keyof Filtros, value: string) {
    setFiltros((previous) => ({ ...previous, [field]: value }));
    // Changing a parameter invalidates the preview: it no longer describes what
    // would be exported.
    setPreview(null);
    setError(null);
  }

  async function generar() {
    if (loading || !disponible) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pagina = await previsualizarReporte(token, filtros.tipo, {
        fecha_desde: filtros.fecha_desde || undefined,
        fecha_hasta: filtros.fecha_hasta || undefined,
        limit: 10,
      });
      setPreview(pagina);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        goHome();
        return;
      }
      setPreview(null);
      setError(
        err instanceof ApiError ? err.message : 'No se pudo generar la previsualización',
      );
    } finally {
      setLoading(false);
    }
  }

  async function exportar() {
    if (exporting || !preview || preview.total === 0) {
      return;
    }
    setExporting(true);
    setError(null);
    try {
      await descargarReporte(token, filtros.tipo, {
        fecha_desde: filtros.fecha_desde || undefined,
        fecha_hasta: filtros.fecha_hasta || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo exportar el reporte');
    } finally {
      setExporting(false);
    }
  }

  const columnas: Column<Record<string, unknown>>[] =
    preview?.columnas.map((columna) => ({
      key: columna,
      header: COLUMNA_LABELS[columna] ?? columna,
      render: (fila) => String(fila[columna] ?? '—'),
    })) ?? [];

  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
        Reportes y Estadísticas
      </h1>
      <p className="mt-1 text-sm text-muted">
        Consolidá datos y descargalos para análisis externo. El reporte clínico sale
        anonimizado: no incluye nombre, DNI ni datos de contacto.
      </p>

      <section className="mt-6 rounded-md border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tipo de reporte
            <select
              value={filtros.tipo}
              onChange={(event) => change('tipo', event.target.value)}
              className={INPUT}
            >
              {TIPOS_REPORTE.map((tipo) => (
                <option key={tipo.value} value={tipo.value} disabled={!tipo.disponible}>
                  {tipo.label}
                  {tipo.disponible ? '' : ' (sin datos todavía)'}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Desde
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(event) => change('fecha_desde', event.target.value)}
              className={INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Hasta
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(event) => change('fecha_hasta', event.target.value)}
              className={INPUT}
            />
          </label>

          <Btn variant="primary" disabled={loading || !disponible} onClick={() => void generar()}>
            {loading ? 'Generando…' : 'Generar Previsualización'}
          </Btn>

          <Btn
            disabled={exporting || !preview || preview.total === 0}
            onClick={() => void exportar()}
          >
            {exporting ? 'Exportando…' : 'Exportar'}
          </Btn>
        </div>

        {!disponible && (
          <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            El reporte de inventario y el de desechos dependen de un subsistema que todavía
            no tiene datos.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <section className="mt-4 overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2">
          <h2 className="text-sm font-semibold text-gray-900">Previsualización</h2>
          {preview && (
            <p className="text-xs text-muted">
              {preview.items.length} de {preview.total} filas
            </p>
          )}
        </div>

        {!preview ? (
          <div className="px-3 py-6">
            <EmptyState message="Configurá los parámetros y generá la previsualización" />
          </div>
        ) : preview.total === 0 ? (
          <div className="px-3 py-6">
            <p className="text-sm text-gray-800">
              No existen registros transaccionales para los parámetros indicados
            </p>
          </div>
        ) : (
          <DataTable
            label="Previsualización del reporte"
            columns={columnas}
            rows={preview.items as unknown as Record<string, unknown>[]}
            rowKey={(fila) =>
              `${String(fila.paciente_clave)}-${String(fila.fecha)}-${String(fila.tipo_analisis)}`
            }
          />
        )}
      </section>
    </div>
  );
}

const INPUT =
  'rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand focus:outline-none';
