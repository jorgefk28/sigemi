import { API_BASE_URL } from './config';
import { apiRequest, buildQuery, withQuery } from './http';

/**
 * Report API (UCE-REP-01, RF-15).
 *
 * Pattern P8: parameters, preview, export. The export is a file, not JSON, so it
 * goes through its own fetch: the session token travels as a header, which a
 * plain `<a href>` cannot do.
 */

export interface ReporteFila {
  paciente_clave: string;
  fecha: string;
  tipo_analisis: string;
  tipo_muestra: string;
  estado: string;
  edad: number | null;
}

export interface ReportePreview {
  items: ReporteFila[];
  total: number;
  limit: number;
  offset: number;
  columnas: string[];
}

export interface ReporteFiltros {
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
}

/** Only the clinical report has data today (A-10). */
export const TIPOS_REPORTE = [
  { value: 'clinico', label: 'Clínico', disponible: true },
  { value: 'inventario', label: 'Inventario', disponible: false },
  { value: 'desechos', label: 'Desechos', disponible: false },
];

export const COLUMNA_LABELS: Record<string, string> = {
  paciente_clave: 'Paciente (clave)',
  fecha: 'Fecha',
  tipo_analisis: 'Tipo de análisis',
  tipo_muestra: 'Tipo de muestra',
  estado: 'Estado',
  edad: 'Edad',
};

function query(filters: ReporteFiltros): string {
  return buildQuery({
    fecha_desde: filters.fecha_desde,
    fecha_hasta: filters.fecha_hasta,
    limit: filters.limit,
    offset: filters.offset,
  });
}

export function previsualizarReporte(
  token: string | null,
  tipo: string,
  filters: ReporteFiltros = {},
): Promise<ReportePreview> {
  return apiRequest<ReportePreview>(withQuery(`/reportes/${tipo}`, query(filters)), { token });
}

/**
 * Download the export and hand the file to the browser.
 *
 * The object URL is revoked right after the click so the blob is not kept for the
 * lifetime of the tab.
 */
export async function descargarReporte(
  token: string | null,
  tipo: string,
  filters: ReporteFiltros = {},
): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const respuesta = await fetch(
    `${API_BASE_URL}${withQuery(`/reportes/${tipo}/exportar`, query(filters))}`,
    { headers },
  );
  if (!respuesta.ok) {
    throw new Error('No se pudo generar el archivo');
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `reporte-${tipo}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
